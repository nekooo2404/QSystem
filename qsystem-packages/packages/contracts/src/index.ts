export {
  RoleSchema,
  LoginSchema,
  ChangePasswordSchema,
  MeResponseSchema,
  ApiErrorSchema,
  type Role,
  type LoginInput,
  type ChangePasswordInput,
  type MeResponse,
  type ApiError,
} from './auth';
export {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  UpdateUserSchema,
  CreateUserSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskPayload4WSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskQuerySchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
  type UpdateUserInput,
  type CreateUserInput,
  type TaskStatusDto,
  type TaskPriorityDto,
  type TaskPayload4W,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskQueryInput,
} from './org';
export {
  NotifyChannelSchema,
  NotifyStatusSchema,
  NotifyPayloadSchema,
  type NotifyChannel,
  type NotifyStatus,
  type NotifyPayload,
} from './notify';
export {
  SearchQuerySchema,
  SearchResultSchema,
  type SearchQuery,
  type SearchResult,
} from './search';
export {
  SocialCategorySchema,
  CreateSocialPostSchema,
  UpdateSocialPostSchema,
  CreateSocialCommentSchema,
  SocialFeedQuerySchema,
  type SocialCategory,
  type CreateSocialPostInput,
  type UpdateSocialPostInput,
  type CreateSocialCommentInput,
  type SocialFeedQueryInput,
} from './social';

/**
 * Minimal OpenAPI components snippet describing the contract schemas.
 * Names mirror the exported inferred types for Task 6/7/8 consumers.
 */
export const openApiComponents = {
  schemas: {
    LoginInput: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 1 },
      },
    },
    ChangePasswordInput: {
      type: 'object',
      required: ['oldPassword', 'newPassword'],
      properties: {
        oldPassword: { type: 'string', minLength: 1 },
        newPassword: { type: 'string', minLength: 8 },
      },
    },
    MeResponse: {
      type: 'object',
      required: ['id', 'email', 'name', 'role', 'departmentId', 'managedDepartmentIds'],
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        role: { type: 'string', enum: ['DIRECTOR', 'MANAGER', 'EMPLOYEE'] },
        departmentId: { type: ['string', 'null'] },
        managedDepartmentIds: { type: 'array', items: { type: 'string' } },
      },
    },
    ApiError: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    },
    CreateDepartmentInput: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1 },
        managerId: { type: 'string' },
        parentId: { type: 'string' },
      },
    },
    UpdateDepartmentInput: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        managerId: { type: 'string' },
        parentId: { type: 'string' },
      },
    },
    UpdateUserInput: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['DIRECTOR', 'MANAGER', 'EMPLOYEE'] },
        departmentId: { type: ['string', 'null'] },
        reportsToId: { type: 'string' },
      },
    },
    TaskPayload4W: {
      type: 'object',
      required: ['what', 'who', 'when', 'where'],
      properties: {
        what: { type: 'string', minLength: 1 },
        who: { type: 'string', minLength: 1 },
        when: { type: 'string', minLength: 1 },
        where: { type: 'string', minLength: 1 },
        flow: { type: 'string' },
        action: { type: 'string' },
      },
    },
    NotifyPayload: {
      type: 'object',
      required: ['channel', 'recipient'],
      properties: {
        channel: { type: 'string', enum: ['EMAIL', 'VIBER', 'SOCKET'] },
        recipient: { type: 'string', minLength: 1 },
        recipientId: { type: 'string' },
        payload: { type: 'object' },
        tenantId: { type: ['string', 'null'] },
      },
    },
    SearchQuery: {
      type: 'object',
      required: ['q'],
      properties: {
        q: { type: 'string', minLength: 1 },
        limit: { type: 'integer', default: 20 },
        offset: { type: 'integer', default: 0 },
        filters: { type: 'object' },
      },
    },
    SearchResult: {
      type: 'object',
      required: ['hits', 'total', 'limit', 'offset'],
      properties: {
        hits: { type: 'array', items: { type: 'object' } },
        total: { type: 'integer' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
      },
    },
  },
} as const;
