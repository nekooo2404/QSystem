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

@Injectable()
export class OrgService {
  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

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
    return this.prisma.runAsUser(viewer.id, (tx) =>
      tx.department.create({
        data: {
          name: body.name,
          managerId: body.managerId ?? null,
          parentId: body.parentId ?? null,
          tenantId: null,
        },
      }),
    );
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
    try {
      await this.audit.writeAudit({
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
    } catch (auditErr) {
      // Best-effort: audit must never block the business write, but a silent
      // discard would leave a compliance hole with no signal.
      // eslint-disable-next-line no-console
      console.error('qsystem: audit write failed for department update', id, auditErr);
    }
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
    try {
      return await this.prisma.runAsUser(viewer.id, (tx) =>
        tx.user.update({
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
        }),
      );
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
      try {
        await this.audit.writeAudit({
          actorId: viewer.id,
          action: 'CREATE',
          entity: 'User',
          entityId: created.id,
          newData: { email: created.email, role: created.role, departmentId: created.departmentId },
        });
      } catch (auditErr) {
        // eslint-disable-next-line no-console
        console.error('qsystem: audit write failed for user create', created.id, auditErr);
      }
      return created;
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
      return { ok: true as const, task };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw error('BAD_REQUEST', 'Unknown departmentId', HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }
}
