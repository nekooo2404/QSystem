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
import {
  clearLoginFailures,
  isLoginLimited,
  loginLimitKey,
  recordLoginFailure,
} from './iam.service';

@Controller()
export class IamController {
  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  constructor(@Inject(IamService) private readonly iam: IamService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(201)
  async login(
    @Body() body: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ accessToken: string }> {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const key = loginLimitKey(ip, body.email);
    if (isLoginLimited(key)) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const out = await this.iam.login(body.email, body.password, res);
      clearLoginFailures(key);
      return out;
    } catch (err) {
      // Only failed attempts consume budget — a success always clears the key,
      // so legit logins are never blocked by earlier failures.
      if (
        err instanceof HttpException &&
        err.getStatus() === HttpStatus.UNAUTHORIZED
      ) {
        recordLoginFailure(key);
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
    const raw = (req.cookies as Record<string, string> | undefined)?.refresh_token;
    await this.iam.logout(raw, res);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: { id: string; role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE' }): Promise<MeResponse> {
    return this.iam.me(user);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: { id: string; role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE' },
    @Body() body: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    await this.iam.changePassword(user, body.oldPassword, body.newPassword);
    return { ok: true };
  }
}
