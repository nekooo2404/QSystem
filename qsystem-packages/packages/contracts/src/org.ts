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
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  departmentId: z.string().nullable().optional(),
  reportsToId: z.string().nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/** POST /org/users body — create user within authorized org scope. */
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: RoleSchema.default('EMPLOYEE'),
  jobTitle: z.string().trim().max(120).optional(),
  departmentId: z.string().min(1).nullable().optional(),
  reportsToId: z.string().min(1).nullable().optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const TaskStatusSchema = z.enum(['Đang làm', 'Chờ duyệt', 'Hoàn thành', 'Quá hạn']);
export type TaskStatusDto = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export type TaskPriorityDto = z.infer<typeof TaskPrioritySchema>;

export const TaskAssignmentModeSchema = z.enum(['PACKAGE_TO_MANAGER', 'TASK_TO_EMPLOYEE']);
export type TaskAssignmentMode = z.infer<typeof TaskAssignmentModeSchema>;

export const WorkPackageStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE']);
export type WorkPackageStatus = z.infer<typeof WorkPackageStatusSchema>;

/**
 * TASK payload — preserves the SensorsInterceptor 4W guard (what/who/when/where
 * required non-empty; missing or '' -> 422 TASK_4W_INCOMPLETE) and adds typed
 * fields for PostgreSQL task persistence.
 */
export const TaskPayload4WSchema = z
  .object({
    what: z.string().min(1),
    who: z.string().min(1),
    when: z.string().min(1),
    where: z.string().min(1),
    flow: z.string().optional(),
    action: z.string().optional(),
    version: z.coerce.number().int().min(1).optional(),
  })
  .passthrough();
export type TaskPayload4W = z.infer<typeof TaskPayload4WSchema>;

export const CreateTaskSchema = TaskPayload4WSchema.extend({
  title: z.string().min(1).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  dueDate: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  assigneeName: z.string().min(1).optional(),
  departmentId: z.string().nullable().optional(),
  projectId: z.string().min(1).optional(),
  workPackageId: z.string().min(1).optional(),
  assignmentMode: TaskAssignmentModeSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    what: z.string().min(1).optional(),
    who: z.string().min(1).optional(),
    when: z.string().min(1).optional(),
    where: z.string().min(1).optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    dueDate: z.string().min(1).optional(),
    assigneeId: z.string().nullable().optional(),
    assigneeName: z.string().min(1).optional(),
    departmentId: z.string().nullable().optional(),
    projectId: z.string().min(1).optional(),
    workPackageId: z.string().min(1).nullable().optional(),
    assignmentMode: TaskAssignmentModeSchema.optional(),
    progress: z.number().int().min(0).max(100).optional(),
    flow: z.string().optional(),
    action: z.string().optional(),
  })
  .passthrough();
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  departmentId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type TaskQueryInput = z.infer<typeof TaskQuerySchema>;

export const CreateWorkPackageSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  managerId: z.string().min(1),
  dueDate: z.string().min(1).optional(),
});
export type CreateWorkPackageInput = z.infer<typeof CreateWorkPackageSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const UpdateWorkPackageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  managerId: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  status: WorkPackageStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
});
export type UpdateWorkPackageInput = z.infer<typeof UpdateWorkPackageSchema>;
