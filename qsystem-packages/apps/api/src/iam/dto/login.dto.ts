import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type {
  ChangePasswordInput,
  LoginInput,
} from '@qsystem/contracts';

/** POST /auth/login body. Shape pinned by plan R2 (standardized in @qsystem/contracts). */
export class LoginDto implements LoginInput {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

/** PATCH /me/password body. Rules mirror ChangePasswordSchema. */
export class ChangePasswordDto implements ChangePasswordInput {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

/** GET /me response. Shape pinned by plan R2 — canonical type lives in @qsystem/contracts. */
export type { MeResponse } from '@qsystem/contracts';
