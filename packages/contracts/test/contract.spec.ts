import { describe, expect, it } from 'vitest';
import {
  ChangePasswordSchema,
  ApiErrorSchema,
  LoginSchema,
  MeResponseSchema,
  NotifyPayloadSchema,
  SearchQuerySchema,
  TaskPayload4WSchema,
  openApiComponents,
} from '../src/index';

/**
 * TDD RED (step 1): src/ schemas do not exist yet — this suite must FAIL
 * (unresolved import) until src/auth.ts, org.ts, notify.ts, search.ts and
 * index.ts are implemented (step 2 → GREEN).
 *
 * Behavioral-equivalence note (R2): the boundary cases below mirror the
 * api runtime rules (ValidationPipe + class-validator on iam DTOs, 4W guard
 * in SensorsInterceptor). After the api refactor (DTO classes `implements`
 * contract types, decorators untouched) the api suites rls/iam/sensors must
 * still pass unchanged — that is the runtime proof of equivalence.
 */
describe('contracts', () => {
  it('LoginInput từ chối email sai định dạng', () => {
    // Mirrors @IsEmail() on LoginDto.email (invalid → 400).
    expect(
      LoginSchema.safeParse({ email: 'not-an-email', password: 'secret123' }).success,
    ).toBe(false);
    // Mirrors @MinLength(1) on LoginDto.password (empty → 400).
    expect(LoginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(
      LoginSchema.safeParse({ email: 'a@b.co', password: 'secret123' }).success,
    ).toBe(true);
  });

  it('ChangePasswordSchema khớp rule PATCH /me/password (old min 1, new min 8)', () => {
    expect(
      ChangePasswordSchema.safeParse({ oldPassword: '', newPassword: 'newsecret1' }).success,
    ).toBe(false);
    expect(
      ChangePasswordSchema.safeParse({ oldPassword: 'old1', newPassword: 'short' }).success,
    ).toBe(false);
    expect(
      ChangePasswordSchema.safeParse({ oldPassword: 'old1', newPassword: 'newsecret1' })
        .success,
    ).toBe(true);
  });

  it('ApiError đúng shape {code,message,details}', () => {
    expect(ApiErrorSchema.safeParse({ code: 'E', message: 'm' }).success).toBe(true);
    expect(
      ApiErrorSchema.safeParse({ code: 'E', message: 'm', details: { a: 1 } }).success,
    ).toBe(true);
    expect(ApiErrorSchema.safeParse({ message: 'm' }).success).toBe(false);
  });

  it('MeResponse đủ 6 fields đúng types', () => {
    const base = {
      id: 'u1',
      email: 'a@b.co',
      name: 'A',
      role: 'MANAGER',
      departmentId: 'd1',
      managedDepartmentIds: ['d1'],
    };
    expect(MeResponseSchema.safeParse(base).success).toBe(true);
    // departmentId nullable; managed list may be empty (verbatim R2 shape).
    expect(
      MeResponseSchema.safeParse({ ...base, departmentId: null, managedDepartmentIds: [] })
        .success,
    ).toBe(true);
    const { role: _omitted, ...missing } = base;
    expect(MeResponseSchema.safeParse(missing).success).toBe(false);
    expect(MeResponseSchema.safeParse({ ...base, role: 'BOSS' }).success).toBe(false);
  });

  it('NotifyPayload/SearchQuery defaults đúng', () => {
    expect(
      NotifyPayloadSchema.safeParse({ channel: 'EMAIL', recipient: 'a@b.co' }).success,
    ).toBe(true);
    expect(
      NotifyPayloadSchema.safeParse({ channel: 'SMS', recipient: 'x' }).success,
    ).toBe(false);
    const q = SearchQuerySchema.parse({ q: 'hello' });
    expect(q.limit).toBe(20);
    expect(q.offset).toBe(0);
  });

  it('4W payload thiếu field bị từ chối', () => {
    // Missing `where` → rejected (SensorsInterceptor returns 422 TASK_4W_INCOMPLETE).
    expect(
      TaskPayload4WSchema.safeParse({ what: 'a', who: 'b', when: 'c' }).success,
    ).toBe(false);
    // Empty string counts as missing in the 4W guard (`=== ''` check).
    expect(
      TaskPayload4WSchema.safeParse({ what: 'a', who: 'b', when: 'c', where: '' }).success,
    ).toBe(false);
    // flow/action pass through untouched (LDP layer reads them, R6 stub).
    const ok = TaskPayload4WSchema.safeParse({
      what: 'a',
      who: 'b',
      when: 'c',
      where: 'd',
      flow: 'DIRECT',
      action: 'read',
    });
    expect(ok.success).toBe(true);
  });

  it('index re-export mọi schema + openApiComponents liệt kê đủ', () => {
    for (const key of [
      'LoginInput',
      'ChangePasswordInput',
      'MeResponse',
      'ApiError',
      'CreateDepartmentInput',
      'UpdateDepartmentInput',
      'UpdateUserInput',
      'TaskPayload4W',
      'NotifyPayload',
      'SearchQuery',
      'SearchResult',
    ]) {
      expect(openApiComponents.schemas).toHaveProperty(key);
    }
  });
});
