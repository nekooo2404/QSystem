import { describe, expect, it } from 'vitest';
import { isAllowed, scopeFor, type ScopeViewer } from '../src/prisma/prisma-scope.extension';

const employee: ScopeViewer = {
  id: 'employee-a',
  role: 'EMPLOYEE',
  managedDepartmentIds: [],
  departmentId: 'dept-a',
};

const manager: ScopeViewer = {
  id: 'manager-a',
  role: 'MANAGER',
  managedDepartmentIds: ['dept-a'],
  departmentId: 'dept-a',
};

describe('audit remediation record scope', () => {
  it('keeps CRM rows tied to the owner/creator or managed department', () => {
    expect(scopeFor('crmCustomer', employee)).toEqual({
      OR: [{ ownerId: 'employee-a' }, { createdById: 'employee-a' }],
    });
    expect(isAllowed('crmCustomer', employee, { ownerId: 'employee-a', createdById: 'other' })).toBe(true);
    expect(isAllowed('crmCustomer', employee, { ownerId: 'other', createdById: 'other' })).toBe(false);
    expect(isAllowed('crmCustomer', manager, { ownerId: 'other', createdById: 'other', departmentId: 'dept-a' })).toBe(true);
  });

  it('lets an assignee see a task after reassignment without retaining creator ownership', () => {
    expect(isAllowed('task', employee, { ownerId: 'other', assigneeId: 'employee-a' })).toBe(true);
    expect(isAllowed('task', employee, { ownerId: 'other', assigneeId: 'employee-b' })).toBe(false);
  });
});
