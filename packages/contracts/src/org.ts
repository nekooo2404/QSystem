import { z } from 'zod';
import { RoleSchema } from './auth';

/**
 * POST /org/departments body. Mirrors OrgService.createDepartment
 * (`name` required — empty → 400 INVALID_INPUT).
 */
export const CreateDepartmentSchema = z.object({
  name: z.string().min(1),
  managerId: z.string().optional(),
  parentId: z.string().optional(),
});
export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;

/** PATCH /org/departments/:id body — all fields optional. */
export const UpdateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  managerId: z.string().optional(),
  parentId: z.string().optional(),
});
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;

/** PATCH /org/users/:id body — all optional, ids nullable (clear assignment). */
export const UpdateUserSchema = z.object({
  role: RoleSchema.optional(),
  departmentId: z.string().nullable().optional(),
  reportsToId: z.string().nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/**
 * TASK stub payload (R6: no TASK table yet — generic payload layer).
 * Mirrors the SensorsInterceptor 4W guard: each of what/who/when/where must
 * be present AND non-empty (missing or '' → 422 TASK_4W_INCOMPLETE).
 * flow/action pass through for the LDP layer to read.
 */
export const TaskPayload4WSchema = z
  .object({
    what: z.string().min(1),
    who: z.string().min(1),
    when: z.string().min(1),
    where: z.string().min(1),
    flow: z.string().optional(),
    action: z.string().optional(),
  })
  .passthrough();
export type TaskPayload4W = z.infer<typeof TaskPayload4WSchema>;
