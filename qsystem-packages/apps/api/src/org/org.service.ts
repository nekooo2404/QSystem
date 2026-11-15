import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  CreateTaskSchema,
  CreateUserSchema,
  TaskQuerySchema,
  UpdateTaskSchema,
} from '@qsystem/contracts';
import { AuditService } from '../common/audit.service';
import { isAllowed } from '../prisma/prisma-scope.extension';
import { PrismaService, type ScopeViewer } from '../prisma/prisma.service';

function error(code: string, message: string, status: HttpStatus): HttpException {
  return new HttpException({ code, message }, status);
}

export type CrmSegment = 'enterprise' | 'individual';
export type CrmStage = 'Mới' | 'Tiềm năng' | 'Đàm phán' | 'Đang chăm sóc';

export interface CrmCustomerRecord {
  id: string;
  code: string;
  name: string;
  email: string;
  industry: string;
  segment: CrmSegment;
  ownerInitials: string;
  ownerName: string;
  ownerTone: 'plum' | 'indigo' | 'slate' | 'teal' | 'cyan';
  stage: CrmStage;
  lastContact: string;
  createdById?: string;
}

const VALID_CRM_STAGES = new Set<CrmStage>(['Mới', 'Tiềm năng', 'Đàm phán', 'Đang chăm sóc']);

const BASELINE_CRM_CUSTOMERS: CrmCustomerRecord[] = [
  {
    id: 'c-1',
    code: 'QT',
    name: 'QTS Group',
    email: 'qtsgroup@example.com',
    industry: 'Công nghệ',
    segment: 'enterprise',
    ownerInitials: 'LA',
    ownerName: 'Lan Anh',
    ownerTone: 'indigo',
    stage: 'Đang chăm sóc',
    lastContact: '12/11/2026',
  },
  {
    id: 'c-2',
    code: 'VI',
    name: 'VietHealth',
    email: 'viethealth@example.com',
    industry: 'Y tế',
    segment: 'enterprise',
    ownerInitials: 'HM',
    ownerName: 'Hà My',
    ownerTone: 'slate',
    stage: 'Tiềm năng',
    lastContact: '13/11/2026',
  },
  {
    id: 'c-3',
    code: 'GR',
    name: 'GreenFarm',
    email: 'greenfarm@example.com',
    industry: 'Nông nghiệp',
    segment: 'enterprise',
    ownerInitials: 'ĐA',
    ownerName: 'Đức Anh',
    ownerTone: 'plum',
    stage: 'Đàm phán',
    lastContact: '14/11/2026',
  },
  {
    id: 'c-4',
    code: 'NO',
    name: 'Nova Studio',
    email: 'novastudio@example.com',
    industry: 'Thiết kế',
    segment: 'individual',
    ownerInitials: 'BT',
    ownerName: 'Bảo Trâm',
    ownerTone: 'teal',
    stage: 'Mới',
    lastContact: '15/11/2026',
  },
  {
    id: 'c-5',
    code: 'EA',
    name: 'EastBridge',
    email: 'eastbridge@example.com',
    industry: 'Dịch vụ',
    segment: 'enterprise',
    ownerInitials: 'MK',
    ownerName: 'Minh Khôi',
    ownerTone: 'plum',
    stage: 'Đang chăm sóc',
    lastContact: '15/11/2026',
  },
];

function crmInitials(name: string, fallback: string): string {
  const letters = name.trim().replace(/[^a-zA-ZÀ-ỹ0-9]/g, '');
  return (letters.slice(0, 2) || fallback).toUpperCase();
}

function ownerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatTodayVi(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

@Injectable()
export class OrgService {
  private readonly crmCustomers = new Map<string, CrmCustomerRecord>(
    BASELINE_CRM_CUSTOMERS.map((row) => [row.id, { ...row }]),
  );

  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async recordAudit(entry: Parameters<AuditService['writeAudit']>[0]) {
    try {
      await this.audit.writeAudit(entry);
    } catch (auditErr) {
      // eslint-disable-next-line no-console
      console.error('qsystem: audit write failed', entry.entity, entry.entityId, auditErr);
    }
  }

  private client(viewer: ScopeViewer) {
    return this.prisma.forUser({
      id: viewer.id,
      role: viewer.role,
      managedDepartmentIds: viewer.managedDepartmentIds,
      departmentId: viewer.departmentId,
    });
  }

  async listDepartments(viewer: ScopeViewer) {
    return this.client(viewer).department.findMany({ orderBy: { name: 'asc' } });
  }

  async createDepartment(
    viewer: ScopeViewer,
    body: { name: string; managerId?: string; parentId?: string },
  ) {
    if (viewer.role !== 'DIRECTOR') {
      throw error('FORBIDDEN', 'Only DIRECTOR may create departments', HttpStatus.FORBIDDEN);
    }
    if (!body.name) throw error('INVALID_INPUT', 'name is required', HttpStatus.BAD_REQUEST);
    const created = await this.prisma.runAsUser(viewer.id, (tx) =>
      tx.department.create({
        data: {
          name: body.name,
          managerId: body.managerId ?? null,
          parentId: body.parentId ?? null,
          tenantId: null,
        },
      }),
    );
    await this.recordAudit({
      actorId: viewer.id,
      action: 'CREATE',
      entity: 'Department',
      entityId: created.id,
      newData: {
        name: created.name,
        managerId: created.managerId,
        parentId: created.parentId,
      },
    });
    return created;
  }

  async updateDepartment(
    viewer: ScopeViewer,
    id: string,
    body: { name?: string; managerId?: string; parentId?: string },
  ) {
    // DIRECTOR may edit any department; a MANAGER only departments they manage.
    // Non-managers / out-of-scope rows must never leak existence: the pre-check
    // through the scoped client returns null for hidden rows → 403 coded.
    // Truly missing rows stay 404 for DIRECTOR (verified via the unscoped
    // existence check below) but remain 403 for anyone else.
    if (viewer.role === 'EMPLOYEE') {
      throw error('FORBIDDEN', 'Insufficient permission', HttpStatus.FORBIDDEN);
    }
    // A department cannot be its own parent (would create a cycle), and only
    // a DIRECTOR may reassign the manager: the RLS WITH CHECK on
    // departments_managed rejects a manager moving that column themselves.
    if (body.parentId === id) {
      throw error('INVALID_INPUT', 'A department cannot be its own parent', HttpStatus.BAD_REQUEST);
    }
    if (viewer.role === 'MANAGER' && body.managerId !== undefined) {
      throw error('FORBIDDEN', 'Only DIRECTOR may reassign the department manager', HttpStatus.FORBIDDEN);
    }
    const visible = await this.client(viewer).department.findUnique({ where: { id } });
    if (!visible) {
      if (viewer.role === 'DIRECTOR') {
        const exists = await this.prisma.withIdentity(viewer.id, (tx) =>
          tx.department.findUnique({ where: { id }, select: { id: true } }),
        );
        if (!exists) {
          throw error('NOT_FOUND', 'Department not found', HttpStatus.NOT_FOUND);
        }
      }
      throw error('FORBIDDEN', 'Insufficient permission', HttpStatus.FORBIDDEN);
    }
    if (body.parentId) {
      let cursor: string | null = body.parentId;
      const visited = new Set<string>([id]);
      for (let hop = 0; hop < 50 && cursor; hop++) {
        if (visited.has(cursor)) {
          throw error('INVALID_INPUT', 'Department parent hierarchy cannot contain a cycle', HttpStatus.BAD_REQUEST);
        }
        visited.add(cursor);
        const parentRow: { parentId: string | null } | null = await this.prisma.withIdentity(
          viewer.id,
          (tx) =>
            tx.department.findUnique({
              where: { id: cursor as string },
              select: { parentId: true },
            }),
        );
        cursor = parentRow?.parentId ?? null;
      }
    }
    const updated = await this.prisma.runAsUser(viewer.id, (tx) =>
      tx.department.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.managerId !== undefined ? { managerId: body.managerId } : {}),
          ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        },
      }),
    );
    // Task 9 audit: department edits are sensitive (flow-2 style). The
    // pre-image is `visible` (the scoped pre-check read). All three mutable
    // fields are captured — a manager reassignment or re-parent is more
    // sensitive than a rename and must not record as a no-op.
    await this.recordAudit({
      actorId: viewer.id,
      action: 'UPDATE',
      entity: 'Department',
      entityId: id,
      oldData: {
        name: visible.name,
        managerId: visible.managerId,
        parentId: visible.parentId,
      },
      newData: {
        name: updated.name,
        managerId: updated.managerId,
        parentId: updated.parentId,
      },
    });
    return updated;
  }

  async listUsers(viewer: ScopeViewer) {
    const rows = await this.client(viewer).user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        reportsToId: true,
      },
    });
    // Salary stubs: schema has no salary columns yet — DIRECTOR sees the keys,
    // everyone else gets them stripped by the sensors interceptor. Include the
    // keys here so the interceptor has something to filter (EMPLOYEE rows from
    // other viewers are already hidden by scope; DIRECTOR rows keep both).
    return rows.map((row) => ({
      ...row,
      base_salary: 0,
      bonus: 0,
    }));
  }

  async updateUser(
    viewer: ScopeViewer,
    id: string,
    body: { role?: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE'; departmentId?: string | null; reportsToId?: string | null },
  ) {
    if (viewer.role !== 'DIRECTOR') {
      throw error('FORBIDDEN', 'Only DIRECTOR may update users', HttpStatus.FORBIDDEN);
    }
    if (body.reportsToId === id) {
      throw error('INVALID_INPUT', 'User cannot report to themselves', HttpStatus.BAD_REQUEST);
    }
    if (body.reportsToId) {
      let cursor: string | null = body.reportsToId;
      const visited = new Set<string>([id]);
      for (let hop = 0; hop < 50 && cursor; hop++) {
        if (visited.has(cursor)) {
          throw error('INVALID_INPUT', 'Reporting hierarchy cannot contain a cycle', HttpStatus.BAD_REQUEST);
        }
        visited.add(cursor);
        const mgrRow: { reportsToId: string | null } | null = await this.prisma.withIdentity(
          viewer.id,
          (tx) =>
            tx.user.findUnique({
              where: { id: cursor as string },
              select: { reportsToId: true },
            }),
        );
        cursor = mgrRow?.reportsToId ?? null;
      }
    }
    try {
      const { existing, updated } = await this.prisma.runAsUser(viewer.id, async (tx) => {
        const current = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            departmentId: true,
            reportsToId: true,
          },
        });
        if (!current) {
          throw error('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
        }
        if (current.role === 'DIRECTOR' && body.role !== undefined && body.role !== 'DIRECTOR') {
          const directorCount = await tx.user.count({ where: { role: 'DIRECTOR' } });
          if (directorCount <= 1) {
            throw error('BAD_REQUEST', 'Cannot demote the last DIRECTOR', HttpStatus.BAD_REQUEST);
          }
        }
        const nextRow = await tx.user.update({
          where: { id },
          data: {
            ...(body.role !== undefined ? { role: body.role } : {}),
            ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
            ...(body.reportsToId !== undefined ? { reportsToId: body.reportsToId } : {}),
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            departmentId: true,
            reportsToId: true,
          },
        });
        return { existing: current, updated: nextRow };
      });
      if (body.role !== undefined && body.role !== existing.role) {
        await this.prisma.withIdentity(id, (tx) =>
          tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        );
      }
      await this.recordAudit({
        actorId: viewer.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        oldData: {
          role: existing.role,
          departmentId: existing.departmentId,
          reportsToId: existing.reportsToId,
        },
        newData: {
          role: updated.role,
          departmentId: updated.departmentId,
          reportsToId: updated.reportsToId,
        },
      });
      return updated;
    } catch (err) {
      // Only "record not found" is 404; FK violations (unknown departmentId /
      // reportsToId) are bad input, not a missing user.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw error('BAD_REQUEST', 'Unknown departmentId or reportsToId', HttpStatus.BAD_REQUEST);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw error('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
      }
      throw err;
    }
  }

  async createUser(viewer: ScopeViewer, raw: unknown) {
    const parsed = CreateUserSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid user payload', details: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    const body = parsed.data;
    if (viewer.role === 'EMPLOYEE') {
      throw error('FORBIDDEN', 'Only DIRECTOR or MANAGER may create users', HttpStatus.FORBIDDEN);
    }
    if (viewer.role === 'MANAGER') {
      if (body.role !== 'EMPLOYEE') {
        throw error('FORBIDDEN', 'MANAGER may only create EMPLOYEE users', HttpStatus.FORBIDDEN);
      }
      if (!body.departmentId || !viewer.managedDepartmentIds.includes(body.departmentId)) {
        throw error('FORBIDDEN', 'MANAGER may only create users inside managed departments', HttpStatus.FORBIDDEN);
      }
    }

    const email = body.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(body.password);
    try {
      const created = await this.prisma.runAsUser(viewer.id, (tx) =>
        tx.user.create({
          data: {
            email,
            name: body.name.trim(),
            passwordHash,
            role: body.role,
            departmentId: body.departmentId ?? null,
            reportsToId: body.reportsToId ?? (viewer.role === 'MANAGER' ? viewer.id : null),
            tenantId: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            departmentId: true,
            reportsToId: true,
          },
        }),
      );
      await this.recordAudit({
        actorId: viewer.id,
        action: 'CREATE',
        entity: 'User',
        entityId: created.id,
        newData: {
          email: created.email,
          role: created.role,
          departmentId: created.departmentId,
          ...(body.jobTitle ? { jobTitle: body.jobTitle } : {}),
        },
      });
      return {
        ...created,
        ...(body.jobTitle ? { jobTitle: body.jobTitle } : {}),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw error('CONFLICT', 'Email is already registered', HttpStatus.CONFLICT);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw error('BAD_REQUEST', 'Unknown departmentId or reportsToId', HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }

  async listTasks(viewer: ScopeViewer, rawQuery: Record<string, unknown>) {
    const parsed = TaskQuerySchema.safeParse(rawQuery ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid task query', details: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    const { status, departmentId, ownerId, assigneeId, q, page, pageSize } = parsed.data;
    const trimmedQ = q?.trim();
    const where: Prisma.TaskWhereInput = {
      ...(status ? { status } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(trimmedQ
        ? {
            OR: [
              { code: { contains: trimmedQ, mode: 'insensitive' } },
              { title: { contains: trimmedQ, mode: 'insensitive' } },
              { what: { contains: trimmedQ, mode: 'insensitive' } },
              { assigneeName: { contains: trimmedQ, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const client = this.client(viewer);
    const [items, total] = await Promise.all([
      client.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      client.task.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async createTask(viewer: ScopeViewer, raw: unknown) {
    const parsed = CreateTaskSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid task payload', details: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    const body = parsed.data;
    if (viewer.role === 'EMPLOYEE' && body.assigneeId && body.assigneeId !== viewer.id) {
      throw error('FORBIDDEN', 'Employees may only create tasks for themselves', HttpStatus.FORBIDDEN);
    }

    const candidateUserId = body.assigneeId ?? body.who;
    const matchedAssignee = candidateUserId
      ? await this.client(viewer).user.findUnique({
          where: { id: candidateUserId },
          select: { id: true, name: true, departmentId: true },
        })
      : null;

    const ownerId =
      viewer.role === 'EMPLOYEE' ? viewer.id : (matchedAssignee?.id ?? viewer.id);
    const departmentId =
      body.departmentId !== undefined
        ? body.departmentId
        : (matchedAssignee?.departmentId ??
            (viewer.managedDepartmentIds[0] ?? viewer.departmentId ?? null));

    if (
      viewer.role === 'MANAGER' &&
      departmentId &&
      !viewer.managedDepartmentIds.includes(departmentId)
    ) {
      throw error('FORBIDDEN', 'Cannot assign task outside managed departments', HttpStatus.FORBIDDEN);
    }
    if (viewer.role === 'EMPLOYEE' && departmentId && departmentId !== viewer.departmentId) {
      throw error('FORBIDDEN', 'Cannot assign task outside your department', HttpStatus.FORBIDDEN);
    }
    if (!isAllowed('task', viewer, { ownerId, departmentId })) {
      throw error('FORBIDDEN', 'Insufficient permission to create task in scope', HttpStatus.FORBIDDEN);
    }

    const code = await this.prisma.nextTaskCode();
    try {
      const task = await this.client(viewer).task.create({
        data: {
          code,
          title: body.title?.trim() || body.what,
          what: body.what,
          who: body.who,
          when: body.when,
          where: body.where,
          status: body.status ?? 'Đang làm',
          priority: body.priority ?? 'NORMAL',
          flow: body.flow ?? null,
          dueDate: body.dueDate?.trim() || body.when,
          assigneeId: body.assigneeId ?? matchedAssignee?.id ?? null,
          assigneeName: body.assigneeName?.trim() || matchedAssignee?.name || body.who,
          ownerId,
          departmentId,
          tenantId: null,
        },
      });
      await this.recordAudit({
        actorId: viewer.id,
        action: 'CREATE',
        entity: 'Task',
        entityId: task.id,
        newData: {
          code: task.code,
          title: task.title,
          status: task.status,
          priority: task.priority,
          ownerId: task.ownerId,
          departmentId: task.departmentId,
        },
      });
      return { ok: true as const, task };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw error('BAD_REQUEST', 'Unknown departmentId or ownerId', HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }

  async updateTask(viewer: ScopeViewer, id: string, raw: unknown) {
    const parsed = UpdateTaskSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid task update payload', details: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    const body = parsed.data;
    const existing = await this.client(viewer).task.findUnique({ where: { id } });
    if (!existing) {
      if (viewer.role === 'DIRECTOR') {
        throw error('NOT_FOUND', 'Task not found', HttpStatus.NOT_FOUND);
      }
      throw error('FORBIDDEN', 'Insufficient permission', HttpStatus.FORBIDDEN);
    }

    const nextDepartmentId = body.departmentId !== undefined ? body.departmentId : existing.departmentId;
    if (
      viewer.role === 'MANAGER' &&
      nextDepartmentId &&
      !viewer.managedDepartmentIds.includes(nextDepartmentId)
    ) {
      throw error('FORBIDDEN', 'Cannot move task outside managed departments', HttpStatus.FORBIDDEN);
    }
    if (viewer.role === 'EMPLOYEE' && nextDepartmentId !== existing.departmentId) {
      throw error('FORBIDDEN', 'Employees cannot reassign task departments', HttpStatus.FORBIDDEN);
    }

    try {
      const task = await this.client(viewer).task.update({
        where: { id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.what !== undefined ? { what: body.what } : {}),
          ...(body.who !== undefined ? { who: body.who } : {}),
          ...(body.when !== undefined ? { when: body.when } : {}),
          ...(body.where !== undefined ? { where: body.where } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.flow !== undefined ? { flow: body.flow } : {}),
          ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
          ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
          ...(body.assigneeName !== undefined ? { assigneeName: body.assigneeName } : {}),
          ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
        },
      });
      await this.recordAudit({
        actorId: viewer.id,
        action: 'UPDATE',
        entity: 'Task',
        entityId: task.id,
        oldData: {
          status: existing.status,
          priority: existing.priority,
          departmentId: existing.departmentId,
          assigneeId: existing.assigneeId,
        },
        newData: {
          status: task.status,
          priority: task.priority,
          departmentId: task.departmentId,
          assigneeId: task.assigneeId,
        },
      });
      return { ok: true as const, task };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw error('BAD_REQUEST', 'Unknown departmentId', HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }

  async listCrmCustomers(_viewer: ScopeViewer, query?: { q?: string; segment?: string; stage?: string }) {
    const q = typeof query?.q === 'string' ? query.q.trim().toLowerCase() : '';
    const segment = query?.segment === 'enterprise' || query?.segment === 'individual' ? query.segment : null;
    const stage = typeof query?.stage === 'string' && VALID_CRM_STAGES.has(query.stage as CrmStage) ? query.stage : null;

    const all = Array.from(this.crmCustomers.values());
    const items = all.filter((row) => {
      if (segment && row.segment !== segment) return false;
      if (stage && row.stage !== stage) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.industry.toLowerCase().includes(q) ||
        row.ownerName.toLowerCase().includes(q)
      );
    });
    return { items, total: items.length };
  }

  async createCrmCustomer(viewer: ScopeViewer, raw: unknown) {
    const payload = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw error('INVALID_INPUT', 'Valid customer name and email are required', HttpStatus.BAD_REQUEST);
    }
    const duplicate = Array.from(this.crmCustomers.values()).some(
      (c) => c.email.toLowerCase() === email,
    );
    if (duplicate) {
      throw error('CONFLICT', 'Customer email already exists', HttpStatus.CONFLICT);
    }

    const segment: CrmSegment = payload.segment === 'individual' ? 'individual' : 'enterprise';
    const stage: CrmStage =
      typeof payload.stage === 'string' && VALID_CRM_STAGES.has(payload.stage as CrmStage)
        ? (payload.stage as CrmStage)
        : 'Mới';
    const industry = typeof payload.industry === 'string' && payload.industry.trim() ? payload.industry.trim() : 'Dịch vụ';
    const ownerName = typeof payload.ownerName === 'string' && payload.ownerName.trim() ? payload.ownerName.trim() : 'Minh Khôi';
    const lastContact =
      typeof payload.lastContact === 'string' && payload.lastContact.trim()
        ? payload.lastContact.trim()
        : formatTodayVi();
    const record: CrmCustomerRecord = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: crmInitials(name, 'KH'),
      name,
      email,
      industry,
      segment,
      ownerInitials: ownerInitials(ownerName),
      ownerName,
      ownerTone: 'indigo',
      stage,
      lastContact,
      createdById: viewer.id,
    };
    const nextEntries: Array<[string, CrmCustomerRecord]> = [
      [record.id, record],
      ...Array.from(this.crmCustomers.entries()),
    ];
    this.crmCustomers.clear();
    for (const [k, v] of nextEntries) {
      this.crmCustomers.set(k, v);
    }
    await this.recordAudit({
      actorId: viewer.id,
      action: 'CREATE',
      entity: 'CrmCustomer',
      entityId: record.id,
      newData: { name: record.name, email: record.email, stage: record.stage },
    });
    return { ok: true as const, customer: record };
  }

  async updateCrmCustomer(viewer: ScopeViewer, id: string, raw: unknown) {
    const existing = this.crmCustomers.get(id);
    if (!existing) {
      throw error('NOT_FOUND', 'Customer not found', HttpStatus.NOT_FOUND);
    }
    const payload = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const nextEmail =
      typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : existing.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw error('INVALID_INPUT', 'Invalid email address', HttpStatus.BAD_REQUEST);
    }
    const emailConflict = Array.from(this.crmCustomers.values()).some(
      (c) => c.id !== id && c.email.toLowerCase() === nextEmail,
    );
    if (emailConflict) {
      throw error('CONFLICT', 'Customer email already exists', HttpStatus.CONFLICT);
    }

    const nextName =
      typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : existing.name;
    const nextOwner =
      typeof payload.ownerName === 'string' && payload.ownerName.trim()
        ? payload.ownerName.trim()
        : existing.ownerName;
    const nextStage: CrmStage =
      typeof payload.stage === 'string' && VALID_CRM_STAGES.has(payload.stage as CrmStage)
        ? (payload.stage as CrmStage)
        : existing.stage;
    if (typeof payload.stage === 'string' && !VALID_CRM_STAGES.has(payload.stage as CrmStage)) {
      throw error('INVALID_INPUT', 'Invalid CRM stage', HttpStatus.BAD_REQUEST);
    }
    const updated: CrmCustomerRecord = {
      ...existing,
      code: crmInitials(nextName, existing.code),
      name: nextName,
      email: nextEmail,
      industry:
        typeof payload.industry === 'string' && payload.industry.trim()
          ? payload.industry.trim()
          : existing.industry,
      segment:
        payload.segment === 'individual' || payload.segment === 'enterprise'
          ? payload.segment
          : existing.segment,
      ownerName: nextOwner,
      ownerInitials: ownerInitials(nextOwner),
      stage: nextStage,
      lastContact:
        typeof payload.lastContact === 'string' && payload.lastContact.trim()
          ? payload.lastContact.trim()
          : formatTodayVi(),
    };
    this.crmCustomers.set(id, updated);
    await this.recordAudit({
      actorId: viewer.id,
      action: 'UPDATE',
      entity: 'CrmCustomer',
      entityId: id,
      oldData: { stage: existing.stage, ownerName: existing.ownerName },
      newData: { stage: updated.stage, ownerName: updated.ownerName },
    });
    return { ok: true as const, customer: updated };
  }

  async deleteCrmCustomer(viewer: ScopeViewer, id: string) {
    const existing = this.crmCustomers.get(id);
    if (!existing) {
      throw error('NOT_FOUND', 'Customer not found', HttpStatus.NOT_FOUND);
    }
    if (viewer.role === 'EMPLOYEE' && existing.createdById !== viewer.id) {
      throw error('FORBIDDEN', 'Only DIRECTOR, MANAGER, or record creator may delete customers', HttpStatus.FORBIDDEN);
    }
    this.crmCustomers.delete(id);
    await this.recordAudit({
      actorId: viewer.id,
      action: 'DELETE',
      entity: 'CrmCustomer',
      entityId: id,
      oldData: { name: existing.name, email: existing.email },
    });
    return { ok: true as const, id };
  }
}
