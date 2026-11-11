import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';

export interface RequestViewer {
  id: string;
  role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
}

interface LookupRow {
  id: string;
  password_hash: string;
  role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
  department_id: string | null;
}

interface RefreshRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
}

type TxClient = Prisma.TransactionClient;

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'refresh_token';

// In-memory login rate limiter: 5 failed attempts / minute, keyed by IP +
// email. Keying by email as well as IP means one account's failures never lock
// out other users behind the same NAT; only failures consume budget, so legit
// logins are never blocked and a success clears the key. Replaceable with a
// shared store (Redis) when the API runs multi-instance — documented per plan.
const failures = new Map<string, number[]>();

export function loginLimitKey(ip: string, email: string): string {
  return `${ip}::${email.toLowerCase()}`;
}

export function isLoginLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (failures.get(key) ?? []).filter((t) => t > windowStart);
  failures.set(key, hits);
  return hits.length >= 5;
}

export function recordLoginFailure(key: string): void {
  failures.set(key, [...(failures.get(key) ?? []), Date.now()]);
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

function failFastJwtSecret(testSecret?: string): string {
  const secret = process.env.JWT_SECRET ?? testSecret;
  if (!secret) {
    throw new Error(
      'qsystem: JWT_SECRET must be set (fail-fast; tests set TEST_JWT_SECRET local only).',
    );
  }
  return secret;
}

function error(code: string, message: string, status: HttpStatus): HttpException {
  return new HttpException({ code, message }, status);
}

@Injectable()
export class IamService {
  // `unscoped` is the raw client IamService operates itself. "Unscoped"
  //   means "no app-layer scope filters" — Postgres RLS still applies to every
  //   query, which is why all post-identity work runs inside withIdentity()
  //   (SET LOCAL app.current_user_id per transaction, same pattern as
  //   PrismaService.runAsUser). Pre-identity reads go through SECURITY
  //   DEFINER functions only, never direct table queries.
  private readonly unscoped = new PrismaClient();
  private readonly jwtSecret: string;

  constructor() {
    // TEST_JWT_SECRET is test-only (spec sets it locally); production and
    // non-test app traffic MUST provide JWT_SECRET — fail fast otherwise.
    this.jwtSecret =
      process.env.NODE_ENV === 'test'
        ? failFastJwtSecret(process.env.TEST_JWT_SECRET ?? 'test-only-secret-do-not-use-in-prod')
        : failFastJwtSecret();
  }

  /** Pre-identity lookup via SECURITY DEFINER — never queries users directly. */
  private async lookupIdentity(email: string): Promise<LookupRow | null> {
    const rows = await this.unscoped.$queryRaw<LookupRow[]>`
      SELECT * FROM auth_user_lookup(${email})
    `;
    return rows[0] ?? null;
  }

  /** Pre-identity refresh-token lookup via DEFINER — never queries table directly. */
  private async lookupRefresh(tokenHash: string): Promise<RefreshRow | null> {
    const rows = await this.unscoped.$queryRaw<RefreshRow[]>`
      SELECT * FROM auth_refresh_lookup(${tokenHash})
    `;
    return rows[0] ?? null;
  }

  /**
   * Run `fn` with `app.current_user_id` set for the transaction so the RLS
   * SELF policies (refresh_tokens_self, users_self, ...) see the request
   * identity. Required for every direct table read/write — without it the
   * restricted qsystem_app role sees nothing (RLS deny by default).
   */
  private async withIdentity<T>(userId: string, fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.unscoped.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
      );
      return fn(tx);
    });
  }

  private signAccess(viewer: RequestViewer): string {
    return jwt.sign(
      { sub: viewer.id, role: viewer.role },
      this.jwtSecret,
      { expiresIn: ACCESS_TTL_SECONDS },
    );
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async createRefreshToken(db: TxClient, userId: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('hex');
    await db.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        tenantId: null,
      },
    });
    return raw;
  }

  private refreshCookieOptions(): { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number } {
    return {
      httpOnly: true,
      // Secure only in production so supertest (plain HTTP, NODE_ENV=test)
      // receives the cookie — documented per plan.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: REFRESH_TTL_MS,
    };
  }

  async login(
    email: string,
    password: string,
    res: { cookie: (name: string, val: string, opts: Record<string, unknown>) => void },
  ): Promise<{ accessToken: string }> {
    const identity = await this.lookupIdentity(email);
    // No oracle: wrong email and wrong password both yield INVALID_CREDENTIALS.
    const valid = identity
      ? await argon2.verify(identity.password_hash, password).catch(() => false)
      : false;
    if (!identity || !valid) {
      throw error('INVALID_CREDENTIALS', 'Invalid email or password', HttpStatus.UNAUTHORIZED);
    }
    const raw = await this.withIdentity(identity.id, (tx) =>
      this.createRefreshToken(tx, identity.id),
    );
    res.cookie(REFRESH_COOKIE, raw, this.refreshCookieOptions());
    return { accessToken: this.signAccess({ id: identity.id, role: identity.role }) };
  }

  /** Rotate a refresh token. Reuse of a spent/revoked token revokes the chain. */
  async refresh(
    rawToken: string | undefined,
    res: {
      cookie: (name: string, val: string, opts: Record<string, unknown>) => void;
      clearCookie: (name: string, opts: Record<string, unknown>) => void;
    },
  ): Promise<{ accessToken: string }> {
    if (!rawToken) {
      throw error('INVALID_CREDENTIALS', 'Missing refresh token', HttpStatus.UNAUTHORIZED);
    }
    const row = await this.lookupRefresh(this.hashToken(rawToken));
    if (!row || row.expires_at.getTime() < Date.now() || row.revoked_at || row.replaced_by_id) {
      if (row) await this.withIdentity(row.user_id, (tx) => this.revokeChain(tx, row.user_id));
      throw error(
        row && (row.revoked_at || row.replaced_by_id) ? 'REFRESH_REUSED' : 'INVALID_CREDENTIALS',
        'Refresh token invalid or reused',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const accessToken = await this.withIdentity(row.user_id, async (tx) => {
      // Rotation: issue the replacement first, then retire the old token
      // linked to it — reuse of the old token is detectable via replaced_by_id.
      const rawNext = await this.createRefreshToken(tx, row.user_id);
      const next = await tx.refreshToken.findUniqueOrThrow({
        where: { tokenHash: this.hashToken(rawNext) },
        select: { id: true },
      });
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
      const identity = await tx.user.findUniqueOrThrow({
        where: { id: row.user_id },
        select: { role: true },
      });
      res.cookie(REFRESH_COOKIE, rawNext, this.refreshCookieOptions());
      return this.signAccess({ id: row.user_id, role: identity.role });
    });
    return { accessToken };
  }

  async logout(
    rawToken: string | undefined,
    res: { clearCookie: (name: string, opts: Record<string, unknown>) => void },
  ): Promise<void> {
    // Idempotent: always 200, even with no cookie.
    if (rawToken) {
      const row = await this.lookupRefresh(this.hashToken(rawToken));
      if (row && !row.revoked_at) {
        await this.withIdentity(row.user_id, (tx) =>
          tx.refreshToken.update({
            where: { id: row.id },
            data: { revokedAt: new Date() },
          }),
        );
      }
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }

  async me(viewer: RequestViewer): Promise<{
    id: string;
    email: string;
    name: string;
    role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
    departmentId: string | null;
    managedDepartmentIds: string[];
  }> {
    const user = await this.withIdentity(viewer.id, (tx) =>
      tx.user.findUnique({
        where: { id: viewer.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          managedDepartments: { select: { id: true } },
        },
      }),
    );
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      managedDepartmentIds: user.managedDepartments.map((d) => d.id),
    };
  }

  async changePassword(
    viewer: RequestViewer,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.withIdentity(viewer.id, async (tx) => {
      const identity = await tx.user.findUnique({
        where: { id: viewer.id },
        select: { passwordHash: true },
      });
      if (!identity) throw new UnauthorizedException();
      const ok = await argon2.verify(identity.passwordHash, oldPassword).catch(() => false);
      if (!ok) {
        throw error('WRONG_PASSWORD', 'Old password is incorrect', HttpStatus.BAD_REQUEST);
      }
      await tx.user.update({
        where: { id: viewer.id },
        data: { passwordHash: await argon2.hash(newPassword) },
      });
      // Password change revokes every live session.
      await this.revokeChain(tx, viewer.id);
    });
  }

  verifyAccess(token: string): RequestViewer {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { sub: string; role: RequestViewer['role'] };
      if (!payload?.sub || !payload?.role) throw new Error('bad payload');
      return { id: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async revokeChain(tx: TxClient, userId: string): Promise<void> {
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
