import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { isProductionLike } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';

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
  expires_at: Date | string;
  revoked_at: Date | string | null;
  replaced_by_id: string | null;
}

type TxClient = Prisma.TransactionClient;

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'refresh_token';
const JWT_ISSUER = 'qsystem-api';
const JWT_AUDIENCE = 'qsystem-web';

function failFastJwtSecret(): string {
  // JWT_SECRET is required everywhere (prod and test). The spec sets a
  // test-only TEST_JWT_SECRET in bootstrap — that value never touches app
  // code; if it is unset the constructor throws before signing anything.
  const secret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'test' ? process.env.TEST_JWT_SECRET : undefined);
  if (!secret) {
    throw new Error(
      'qsystem: JWT_SECRET (or test-only TEST_JWT_SECRET when NODE_ENV=test) must be set — refusing to sign with a default key.',
    );
  }
  return secret;
}

function error(code: string, message: string, status: HttpStatus): HttpException {
  return new HttpException({ code, message }, status);
}

/** Sentinels thrown inside the rotation tx so the rollback is guaranteed. */
const ROTATION_CONFLICT = Symbol('ROTATION_CONFLICT');
const RATE_LIMITED = Symbol('RATE_LIMITED');

export function codedUnauthorized(code = 'UNAUTHORIZED', message = 'Unauthorized'): HttpException {
  return new HttpException({ code, message }, HttpStatus.UNAUTHORIZED);
}

@Injectable()
export class IamService {
  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  private readonly jwtSecret: string;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.jwtSecret = failFastJwtSecret();
  }

  /** Pre-identity lookup via SECURITY DEFINER — never queries users directly. */
  private async lookupIdentity(email: string): Promise<LookupRow | null> {
    const rows = await this.prisma.lookupIdentity(email);
    return (rows[0] as LookupRow | undefined) ?? null;
  }

  /** Pre-identity refresh-token lookup via DEFINER — never queries table directly. */
  private async lookupRefresh(tokenHash: string): Promise<RefreshRow | null> {
    const rows = await this.prisma.lookupRefresh(tokenHash);
    return (rows[0] as RefreshRow | undefined) ?? null;
  }

  private signAccess(viewer: RequestViewer): string {
    return jwt.sign(
      { sub: viewer.id, role: viewer.role },
      this.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: ACCESS_TTL_SECONDS,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        jwtid: crypto.randomUUID(),
      },
    );
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private asTime(value: Date | string | null): number | null {
    if (value === null || value === undefined) return null;
    // PG may hand back a string for TIMESTAMP columns through some drivers —
    // coerce instead of assuming Date, else a 500 instead of the intended 401.
    return new Date(value).getTime();
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

  private refreshCookieOptions(remember = true): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    domain?: string;
    maxAge?: number;
  } {
    const sameSiteRaw = (process.env.COOKIE_SAME_SITE ?? 'lax').trim().toLowerCase();
    const sameSite: 'lax' | 'strict' | 'none' =
      sameSiteRaw === 'strict' || sameSiteRaw === 'none' ? sameSiteRaw : 'lax';
    const secureRaw = process.env.COOKIE_SECURE?.trim().toLowerCase();
    // Secure defaults to true in staging/production (or when SameSite=None);
    // NODE_ENV=test stays HTTP-compatible unless COOKIE_SECURE=true is set.
    const secure =
      secureRaw === 'true'
        ? true
        : secureRaw === 'false'
          ? false
          : sameSite === 'none'
            ? true
            : isProductionLike();
    const path = process.env.COOKIE_PATH?.trim() || '/';
    const domain = process.env.COOKIE_DOMAIN?.trim();
    return {
      httpOnly: true,
      secure,
      sameSite,
      path,
      ...(domain ? { domain } : {}),
      ...(remember ? { maxAge: REFRESH_TTL_MS } : {}),
    };
  }

  async login(
    email: string,
    password: string,
    res: { cookie: (name: string, val: string, opts: Record<string, unknown>) => void },
    remember = true,
  ): Promise<{ accessToken: string }> {
    const identity = await this.lookupIdentity(email);
    // No oracle: wrong email and wrong password both yield INVALID_CREDENTIALS.
    const valid = identity
      ? await argon2.verify(identity.password_hash, password).catch(() => false)
      : false;
    if (!identity || !valid) {
      throw error('INVALID_CREDENTIALS', 'Invalid email or password', HttpStatus.UNAUTHORIZED);
    }
    const raw = await this.prisma.withIdentity(identity.id, (tx) =>
      this.createRefreshToken(tx, identity.id),
    );
    res.cookie(REFRESH_COOKIE, raw, this.refreshCookieOptions(remember));
    return { accessToken: this.signAccess({ id: identity.id, role: identity.role }) };
  }

  /**
   * Rotate a refresh token. Reuse of a spent/revoked token revokes the whole
   * chain + 401 REFRESH_REUSED; a merely EXPIRED (or unknown) token is a
   * plain 401 INVALID_CREDENTIALS with no chain revocation — expiry is normal
   * lifecycle, not compromise.
   */
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
    if (!row) {
      throw error('INVALID_CREDENTIALS', 'Refresh token invalid', HttpStatus.UNAUTHORIZED);
    }
    const expired = (this.asTime(row.expires_at) ?? 0) < Date.now();
    const reused = !!(row.revoked_at || row.replaced_by_id);
    if (expired || reused) {
      // Revoke the chain only on genuine reuse (revoked/replaced token
      // presented again = possible theft); expiry alone revokes nothing.
      if (reused) {
        await this.prisma.withIdentity(row.user_id, (tx) => this.revokeChain(tx, row.user_id));
      }
      throw error(
        reused ? 'REFRESH_REUSED' : 'INVALID_CREDENTIALS',
        reused ? 'Refresh token reused' : 'Refresh token expired',
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const accessToken = await this.prisma.withIdentity(row.user_id, async (tx) => {
        // Rotation: issue the replacement first, then retire the old token
        // linked to it — reuse of the old token is detectable via replaced_by_id.
        const rawNext = await this.createRefreshToken(tx, row.user_id);
        const next = await tx.refreshToken.findUniqueOrThrow({
          where: { tokenHash: this.hashToken(rawNext) },
          select: { id: true },
        });
        // CAS claim: two tabs refreshing the same cookie both pass the read
        // above, so the rotation re-asserts the row is still unspent. The
        // loser's fresh token rolls back with its transaction.
        const claimed = await tx.refreshToken.updateMany({
          where: { id: row.id, revokedAt: null, replacedById: null },
          data: { revokedAt: new Date(), replacedById: next.id },
        });
        if (claimed.count === 0) throw ROTATION_CONFLICT;
        const identity = await tx.user.findUniqueOrThrow({
          where: { id: row.user_id },
          select: { role: true },
        });
        res.cookie(REFRESH_COOKIE, rawNext, this.refreshCookieOptions());
        return this.signAccess({ id: row.user_id, role: identity.role });
      });
      return { accessToken };
    } catch (err) {
      if (err === ROTATION_CONFLICT) {
        // Lost a concurrent rotation race (double tab), which is NOT theft:
        // the winner keeps its session, so the chain is left intact here.
        // Presenting an already-spent token later still hits the reuse path
        // above and revokes the chain.
        throw error('REFRESH_REUSED', 'Refresh token reused', HttpStatus.UNAUTHORIZED);
      }
      throw err;
    }
  }

  clearRefreshCookie(res: { clearCookie: (name: string, opts: Record<string, unknown>) => void }): void {
    const { maxAge: _maxAge, ...clearOpts } = this.refreshCookieOptions();
    res.clearCookie(REFRESH_COOKIE, clearOpts);
  }

  async logout(
    rawToken: string | undefined,
    res: { clearCookie: (name: string, opts: Record<string, unknown>) => void },
  ): Promise<void> {
    // Idempotent: always 200, even with no cookie.
    if (rawToken) {
      const row = await this.lookupRefresh(this.hashToken(rawToken));
      if (row && !row.revoked_at) {
        await this.prisma.withIdentity(row.user_id, (tx) =>
          tx.refreshToken.update({
            where: { id: row.id },
            data: { revokedAt: new Date() },
          }),
        );
      }
    }
    this.clearRefreshCookie(res);
  }

  async me(viewer: RequestViewer | undefined): Promise<{
    id: string;
    email: string;
    name: string;
    role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
    departmentId: string | null;
    managedDepartmentIds: string[];
  }> {
    // Guard-attached identity is required — a missing viewer (no/invalid
    // bearer) is 401 with a coded body, never Nest's default uncoded shape.
    if (!viewer?.id) throw codedUnauthorized('UNAUTHORIZED', 'Missing or invalid access token');
    const user = await this.prisma.withIdentity(viewer.id, (tx) =>
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
    if (!user) throw codedUnauthorized('UNAUTHORIZED', 'User not found');
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
    viewer: RequestViewer | undefined,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!viewer?.id) throw codedUnauthorized('UNAUTHORIZED', 'Missing or invalid access token');
    const viewerId: string = viewer.id;
    await this.prisma.withIdentity(viewerId, async (tx) => {
      const identity = await tx.user.findUnique({
        where: { id: viewerId },
        select: { passwordHash: true },
      });
      if (!identity) throw codedUnauthorized('UNAUTHORIZED', 'User not found');
      const ok = await argon2.verify(identity.passwordHash, oldPassword).catch(() => false);
      if (!ok) {
        throw error('WRONG_PASSWORD', 'Old password is incorrect', HttpStatus.BAD_REQUEST);
      }
      await tx.user.update({
        where: { id: viewerId },
        data: { passwordHash: await argon2.hash(newPassword) },
      });
      // Password change revokes every live session.
      await this.revokeChain(tx, viewerId);
    });
  }

  verifyAccess(token: string): RequestViewer {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as { sub: string; role: RequestViewer['role'] };
      if (!payload?.sub || !payload?.role) throw new Error('bad payload');
      return { id: payload.sub, role: payload.role };
    } catch {
      throw codedUnauthorized('INVALID_CREDENTIALS', 'Invalid or expired access token');
    }
  }

  private async revokeChain(tx: TxClient, userId: string): Promise<void> {
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
