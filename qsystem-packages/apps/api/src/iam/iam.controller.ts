import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { IamService } from './iam.service';
import { ChangePasswordDto, LoginDto, type MeResponse } from './dto/login.dto';
import { CurrentUser } from './current-user.decorator';
import { Public } from './jwt-auth.guard';
import { LoginRateLimiter, loginLimitKey } from './login-rate-limit';
import { isProductionLike } from '../config/env.config';

@Controller()
export class IamController {
  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  constructor(
    @Inject(IamService) private readonly iam: IamService,
    @Inject(LoginRateLimiter) private readonly limiter: LoginRateLimiter,
  ) {}

  private rateLimitIp(req: ExpressRequest): string {
    const baseIp = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    if (process.env.NODE_ENV !== 'test') return baseIp;
    const rawSuite = req.headers['x-test-suite-id'];
    const suiteId = Array.isArray(rawSuite) ? rawSuite[0] : rawSuite;
    if (typeof suiteId === 'string' && suiteId.trim().length > 0) {
      return `suite:${suiteId.trim()}:${baseIp}`;
    }
    return baseIp;
  }

  private assertSameOriginCsrf(req: ExpressRequest): void {
    const rawOrigin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    const rawReferer = Array.isArray(req.headers.referer) ? req.headers.referer[0] : req.headers.referer;

    let requestOrigin: string | undefined;
    const source = rawOrigin?.trim() || rawReferer?.trim();
    if (source) {
      try {
        requestOrigin = new URL(source).origin.toLowerCase();
      } catch {
        throw new HttpException(
          { code: 'CSRF_FORBIDDEN', message: 'Invalid request origin' },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    if (!requestOrigin) {
      const requireOrigin =
        process.env.STRICT_CSRF_ORIGIN === 'true' ||
        (isProductionLike() && process.env.STRICT_CSRF_ORIGIN !== 'false');
      if (requireOrigin) {
        throw new HttpException(
          { code: 'CSRF_FORBIDDEN', message: 'Origin header is required for cookie auth requests' },
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    const allowed = new Set<string>();
    for (const raw of [process.env.CORS_ORIGINS ?? '', process.env.APP_ORIGIN ?? '']) {
      for (const entry of raw.split(',')) {
        const trimmed = entry.trim().toLowerCase();
        if (trimmed) allowed.add(trimmed);
      }
    }

    const trustProxy = process.env.TRUST_PROXY?.trim() === 'true';
    const protoRaw =
      (trustProxy ? req.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined) ||
      req.protocol ||
      'http';
    const proto = protoRaw.toLowerCase();
    const host = req.get('host')?.trim();
    if (host) {
      allowed.add(`${proto}://${host.toLowerCase()}`);
    }
    const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
    if (forwardedHost && (!isProductionLike() || trustProxy)) {
      allowed.add(`${proto}://${forwardedHost.toLowerCase()}`);
    }

    if (!allowed.has(requestOrigin)) {
      throw new HttpException(
        { code: 'CSRF_FORBIDDEN', message: 'Cross-origin cookie request rejected' },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  @Public()
  @Post('auth/login')
  @HttpCode(201)
  async login(
    @Body() body: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ accessToken: string }> {
    const ip = this.rateLimitIp(req);
    const accountKey = loginLimitKey(ip, body?.email ?? '');
    // Strict per-IP bucket: every attempt consumes, so spraying guesses across
    // emails from one IP trips 5/min; the per-account bucket protects other
    // users behind the same NAT from one account's failures. acquire() records
    // the attempt and decides inside one tx, so parallel requests can't all
    // pass before any of them is counted.
    if (!(await this.limiter.acquire(ip, accountKey))) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const out = await this.iam.login(
        body?.email ?? '',
        body?.password ?? '',
        res,
        body?.remember ?? true,
      );
      await this.limiter.clearFailures(accountKey);
      return out;
    } catch (err) {
      // Only failures consume the per-account budget; a success clears it.
      if (
        err instanceof HttpException &&
        err.getStatus() === HttpStatus.UNAUTHORIZED
      ) {
        await this.limiter.recordFailure(accountKey);
      }
      throw err;
    }
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(201)
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ accessToken: string }> {
    this.assertSameOriginCsrf(req);
    const raw = (req.cookies as Record<string, string> | undefined)?.refresh_token;
    return this.iam.refresh(raw, res);
  }

  // Public-idempotent: always 200, even with no cookie. Chosen over a
  // guard-optional route so logout never 401s on an expired access token.
  @Public()
  @Post('auth/logout')
  @HttpCode(200)
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ ok: true }> {
    this.assertSameOriginCsrf(req);
    const raw = (req.cookies as Record<string, string> | undefined)?.refresh_token;
    await this.iam.logout(raw, res);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: { id: string; role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE' } | undefined): Promise<MeResponse> {
    return this.iam.me(user);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: { id: string; role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE' } | undefined,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ ok: true }> {
    await this.iam.changePassword(user, body.oldPassword, body.newPassword);
    this.iam.clearRefreshCookie(res);
    return { ok: true };
  }
}
