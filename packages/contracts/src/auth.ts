import { z } from 'zod';

/** Shared role enum (matches Prisma Role + iam/org DTO literals). */
export const RoleSchema = z.enum(['DIRECTOR', 'MANAGER', 'EMPLOYEE']);

/**
 * POST /auth/login body. Mirrors LoginDto (@IsEmail + @MinLength(1));
 * shape pinned verbatim by plan R2.
 */
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** PATCH /me/password body. Mirrors ChangePasswordDto (old min 1, new min 8). */
export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/**
 * GET /me response. Verbatim R2 shape: 6 fields
 * {id, email, name, role, departmentId, managedDepartmentIds}.
 */
export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  departmentId: z.string().nullable(),
  managedDepartmentIds: z.array(z.string()),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** Standard coded error body {code, message, details?}. */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
