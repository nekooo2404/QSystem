import { IsEmail, IsString, MinLength } from 'class-validator';

/** POST /auth/login body. Shape pinned by plan R2 (T5 standardizes later). */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

/** PATCH /me/password body. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

/** GET /me response. Shape pinned by plan R2 (T5 standardizes later). */
export interface MeResponse {
  id: string;
  email: string;
  name: string;
  role: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE';
  departmentId: string | null;
  managedDepartmentIds: string[];
}
