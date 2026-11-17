import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type CrmCustomer as PrismaCrmCustomer } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  CreateTaskSchema,
  CreateProjectSchema,
  CreateWorkPackageSchema,
  CreateUserSchema,
  TaskQuerySchema,
  TaskStatusSchema,
  UpdateTaskSchema,
  UpdateWorkPackageSchema,
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
  ownerId?: string;
  departmentId?: string | null;
}

const VALID_CRM_STAGES = new Set<CrmStage>(['Mới', 'Tiềm năng', 'Đàm phán', 'Đang chăm sóc']);

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

function assertIsoDate(value: string | undefined): void {
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    throw error('INVALID_INPUT', 'Invalid due date', HttpStatus.BAD_REQUEST);
  }
}

function canAdvanceTaskStatus(current: string, next: string): boolean {
  if (current === next) return true;
  const allowed: Record<string, readonly string[]> = {
    'Đang làm': ['Chờ duyệt', 'Hoàn thành'],
    'Chờ duyệt': ['Hoàn thành'],
  };
  return allowed[current]?.includes(next) ?? false;
}

@Injectable()
export class OrgService {
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
        jobTitle: true,
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
    body: { role?: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE'; status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'; jobTitle?: string | null; departmentId?: string | null; reportsToId?: string | null },
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
            jobTitle: true,
            role: true,
            status: true,
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
            ...(body.status !== undefined ? {
              status: body.status,
              suspendedAt: body.status === 'SUSPENDED' ? new Date() : null,
              deactivatedAt: body.status === 'DEACTIVATED' ? new Date() : null,
            } : {}),
            ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle?.trim() || null } : {}),
            ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
            ...(body.reportsToId !== undefined ? { reportsToId: body.reportsToId } : {}),
          },
          select: {
            id: true,
            email: true,
            name: true,
            jobTitle: true,
            role: true,
            status: true,
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
          status: existing.status,
          jobTitle: existing.jobTitle,
          departmentId: existing.departmentId,
          reportsToId: existing.reportsToId,
        },
        newData: {
          role: updated.role,
          status: updated.status,
          jobTitle: updated.jobTitle,
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
            jobTitle: body.jobTitle ?? null,
            departmentId: body.departmentId ?? null,
            reportsToId: body.reportsToId ?? (viewer.role === 'MANAGER' ? viewer.id : null),
            tenantId: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            jobTitle: true,
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
        ...(created.jobTitle ? { jobTitle: created.jobTitle } : {}),
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

  async listWorkPackages(viewer: ScopeViewer, projectId?: string) {
    return this.client(viewer).workPackage.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async listProjects(viewer: ScopeViewer) {
    return this.client(viewer).project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { workPackages: true },
    });
  }

  async createProject(viewer: ScopeViewer, raw: unknown) {
    const parsed = CreateProjectSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid project payload', details: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (viewer.role !== 'DIRECTOR') {
      throw error('FORBIDDEN', 'Only DIRECTOR may create projects', HttpStatus.FORBIDDEN);
    }
    return this.client(viewer).project.create({
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        ownerId: viewer.id,
        tenantId: null,
      },
    });
  }

  async createWorkPackage(viewer: ScopeViewer, raw: unknown) {
    const parsed = CreateWorkPackageSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid work package payload', details: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (viewer.role !== 'DIRECTOR') {
      throw error('FORBIDDEN', 'Only DIRECTOR may assign work packages', HttpStatus.FORBIDDEN);
    }
    const body = parsed.data;
    const manager = await this.client(viewer).user.findUnique({
      where: { id: body.managerId },
      select: { id: true, role: true },
    });
    if (!manager || manager.role !== 'MANAGER') {
      throw error('BAD_REQUEST', 'Work packages must be assigned to a MANAGER', HttpStatus.BAD_REQUEST);
    }
    const workPackage = await this.client(viewer).workPackage.create({
      data: {
        projectId: body.projectId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        managerId: body.managerId,
        assignedById: viewer.id,
        dueDate: body.dueDate ?? null,
      },
    });
    await this.prisma.notification.create({
      data: {
        channel: 'SOCKET',
        recipient: manager.id,
        recipientId: manager.id,
        payload: { type: 'WORK_PACKAGE_ASSIGNED', workPackageId: workPackage.id, projectId: workPackage.projectId },
        status: 'PENDING',
        tenantId: null,
      },
    });
    return workPackage;
  }

  async updateWorkPackage(viewer: ScopeViewer, id: string, raw: unknown) {
    const parsed = UpdateWorkPackageSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid work package update', details: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.client(viewer).workPackage.findUnique({ where: { id } });
    if (!existing) throw error('NOT_FOUND', 'Work package not found', HttpStatus.NOT_FOUND);
    if (viewer.role === 'EMPLOYEE' || (viewer.role === 'MANAGER' && existing.managerId !== viewer.id)) {
      throw error('FORBIDDEN', 'Insufficient permission for work package', HttpStatus.FORBIDDEN);
    }
    return this.client(viewer).workPackage.update({ where: { id }, data: parsed.data });
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
          select: { id: true, name: true, email: true, departmentId: true },
        })
      : null;

    assertIsoDate(body.dueDate);
    const ownerId = viewer.id;
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
    if (body.workPackageId) {
      const workPackage = await this.client(viewer).workPackage.findUnique({
        where: { id: body.workPackageId },
        select: { id: true, managerId: true, projectId: true },
      });
      if (!workPackage) throw error('NOT_FOUND', 'Work package not found', HttpStatus.NOT_FOUND);
      if (viewer.role === 'MANAGER' && workPackage.managerId !== viewer.id) {
        throw error('FORBIDDEN', 'Only the package manager may assign package tasks', HttpStatus.FORBIDDEN);
      }
      if (viewer.role === 'EMPLOYEE') {
        throw error('FORBIDDEN', 'Employees cannot assign package tasks', HttpStatus.FORBIDDEN);
      }
    }
    if (body.assignmentMode === 'PACKAGE_TO_MANAGER' && viewer.role !== 'DIRECTOR') {
      throw error('FORBIDDEN', 'Only DIRECTOR may assign work packages', HttpStatus.FORBIDDEN);
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
          projectId: body.projectId ?? null,
          workPackageId: body.workPackageId ?? null,
          assignmentMode: body.assignmentMode ?? 'TASK_TO_EMPLOYEE',
          progress: body.progress ?? 0,
        },
      });
      if (matchedAssignee && matchedAssignee.id !== viewer.id) {
        await this.prisma.notification.create({
          data: {
            channel: 'SOCKET',
            recipient: matchedAssignee.email,
            recipientId: matchedAssignee.id,
            payload: { type: 'TASK_ASSIGNED', taskId: task.id, taskCode: task.code },
            status: 'PENDING',
            tenantId: null,
          },
        });
      }
      if (body.assignmentMode === 'TASK_TO_EMPLOYEE' && matchedAssignee?.departmentId) {
        const manager = await this.client(viewer).user.findFirst({
          where: { departmentId: matchedAssignee.departmentId, role: 'MANAGER' },
          select: { id: true },
        });
        if (manager && manager.id !== matchedAssignee.id && manager.id !== viewer.id) {
          await this.prisma.notification.create({
            data: {
              channel: 'SOCKET',
              recipient: manager.id,
              recipientId: manager.id,
              payload: { type: 'DIRECT_TASK_ASSIGNED', taskId: task.id, taskCode: task.code },
              status: 'PENDING',
              tenantId: null,
            },
          });
        }
      }
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
    assertIsoDate(body.dueDate);
    const existing = await this.client(viewer).task.findUnique({ where: { id } });
    if (!existing) {
      if (viewer.role === 'DIRECTOR') {
        throw error('NOT_FOUND', 'Task not found', HttpStatus.NOT_FOUND);
      }
      throw error('FORBIDDEN', 'Insufficient permission', HttpStatus.FORBIDDEN);
    }

    const nextDepartmentId = body.departmentId !== undefined ? body.departmentId : existing.departmentId;
    const nextAssigneeId = body.assigneeId !== undefined ? body.assigneeId : existing.assigneeId;
    const nextAssignee = nextAssigneeId
      ? await this.client(viewer).user.findUnique({
          where: { id: nextAssigneeId },
          select: { id: true, name: true, departmentId: true },
        })
      : null;
    if (nextAssigneeId && !nextAssignee) {
      throw error('BAD_REQUEST', 'Unknown assignee', HttpStatus.BAD_REQUEST);
    }
    if (viewer.role === 'EMPLOYEE' && body.assigneeId !== undefined && body.assigneeId !== existing.assigneeId) {
      throw error('FORBIDDEN', 'Employees cannot reassign tasks', HttpStatus.FORBIDDEN);
    }
    if (viewer.role === 'MANAGER' && nextAssignee?.departmentId && !viewer.managedDepartmentIds.includes(nextAssignee.departmentId)) {
      throw error('FORBIDDEN', 'Cannot assign task outside managed departments', HttpStatus.FORBIDDEN);
    }
    if (existing.flow === 'DIRECT' && viewer.role === 'MANAGER') {
      throw error('FLOW2_MONITOR_ONLY', 'Direct-flow tasks are monitor-only for managers', HttpStatus.FORBIDDEN);
    }
    if (body.flow !== undefined && body.flow !== existing.flow && viewer.role !== 'DIRECTOR') {
      throw error('FORBIDDEN', 'Only DIRECTOR may change task flow', HttpStatus.FORBIDDEN);
    }
    if (body.status !== undefined && !canAdvanceTaskStatus(existing.status, body.status)) {
      throw error('INVALID_TRANSITION', 'Task status transition is not allowed', HttpStatus.CONFLICT);
    }
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
    if (
      body.progress !== undefined &&
      viewer.role === 'EMPLOYEE' &&
      nextAssigneeId !== viewer.id
    ) {
      throw error('FORBIDDEN', 'Employees may only update progress on their own tasks', HttpStatus.FORBIDDEN);
    }

    try {
      const claimed = await this.client(viewer).task.updateMany({
        where: { id, version: body.version ?? existing.version },
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
          ...(body.assigneeName !== undefined ? { assigneeName: body.assigneeName } : (nextAssignee ? { assigneeName: nextAssignee.name } : {})),
          ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
          ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
          ...(body.workPackageId !== undefined ? { workPackageId: body.workPackageId } : {}),
          ...(body.assignmentMode !== undefined ? { assignmentMode: body.assignmentMode } : {}),
          ...(body.progress !== undefined ? { progress: body.progress } : {}),
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throw error('CONFLICT', 'Task was changed by another user', HttpStatus.CONFLICT);
      }
      const task = await this.client(viewer).task.findUniqueOrThrow({ where: { id } });
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

  private crmRecord(row: PrismaCrmCustomer): CrmCustomerRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      email: row.email,
      industry: row.industry,
      segment: row.segment as CrmSegment,
      ownerInitials: row.ownerInitials,
      ownerName: row.ownerName,
      ownerTone: 'indigo',
      stage: row.stage as CrmStage,
      lastContact: row.lastContact,
      createdById: row.createdById,
    };
  }

  async listCrmCustomers(viewer: ScopeViewer, query?: { q?: string; segment?: string; stage?: string }) {
    const q = typeof query?.q === 'string' ? query.q.trim().toLowerCase() : '';
    const segment = query?.segment === 'enterprise' || query?.segment === 'individual' ? query.segment : null;
    const stage = typeof query?.stage === 'string' && VALID_CRM_STAGES.has(query.stage as CrmStage) ? query.stage : null;

    const where: Prisma.CrmCustomerWhereInput = {
      ...(segment ? { segment } : {}),
      ...(stage ? { stage } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { industry: { contains: q, mode: 'insensitive' } },
              { ownerName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const client = this.client(viewer);
    const [rows, total] = await Promise.all([
      client.crmCustomer.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      client.crmCustomer.count({ where }),
    ]);
    return { items: rows.map((row) => this.crmRecord(row)), total };
  }

  async createCrmCustomer(viewer: ScopeViewer, raw: unknown) {
    const payload = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw error('INVALID_INPUT', 'Valid customer name and email are required', HttpStatus.BAD_REQUEST);
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
    const requestedOwnerId = typeof payload.ownerId === 'string' ? payload.ownerId : viewer.id;
    if (viewer.role === 'EMPLOYEE' && requestedOwnerId !== viewer.id) {
      throw error('FORBIDDEN', 'Employees may only own their customers', HttpStatus.FORBIDDEN);
    }
    const owner = await this.client(viewer).user.findUnique({
      where: { id: requestedOwnerId },
      select: { id: true, name: true, departmentId: true },
    });
    if (!owner) throw error('FORBIDDEN', 'Customer owner is outside your scope', HttpStatus.FORBIDDEN);
    const departmentId = typeof payload.departmentId === 'string' ? payload.departmentId : owner.departmentId;
    if (viewer.role === 'MANAGER' && departmentId && !viewer.managedDepartmentIds.includes(departmentId)) {
      throw error('FORBIDDEN', 'Customer department is outside your scope', HttpStatus.FORBIDDEN);
    }
    const verifiedOwnerName = owner.name;
    const record: CrmCustomerRecord = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: crmInitials(name, 'KH'),
      name,
      email,
      industry,
      segment,
       ownerInitials: ownerInitials(verifiedOwnerName),
       ownerName: verifiedOwnerName,
      ownerTone: 'indigo',
      stage,
      lastContact,
       createdById: viewer.id,
       ownerId: requestedOwnerId,
       departmentId,
    };
    try {
      const created = await this.client(viewer).crmCustomer.create({
        data: {
          code: record.code,
          name: record.name,
          email: record.email,
          industry: record.industry,
          segment: record.segment,
          ownerInitials: record.ownerInitials,
          ownerName: record.ownerName,
          ownerId: record.ownerId ?? viewer.id,
          stage: record.stage,
          lastContact: record.lastContact,
          createdById: viewer.id,
          departmentId: record.departmentId,
          tenantId: null,
        },
      });
      await this.recordAudit({
        actorId: viewer.id,
        action: 'CREATE',
        entity: 'CrmCustomer',
        entityId: created.id,
        newData: { name: created.name, email: created.email, stage: created.stage },
      });
      return { ok: true as const, customer: this.crmRecord(created) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw error('CONFLICT', 'Customer email already exists', HttpStatus.CONFLICT);
      }
      throw err;
    }
  }

  async updateCrmCustomer(viewer: ScopeViewer, id: string, raw: unknown) {
    const existing = await this.client(viewer).crmCustomer.findUnique({ where: { id } });
    if (!existing) {
      throw error('NOT_FOUND', 'Customer not found', HttpStatus.NOT_FOUND);
    }
    const payload = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const nextEmail =
      typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : existing.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw error('INVALID_INPUT', 'Invalid email address', HttpStatus.BAD_REQUEST);
    }
    const nextName =
      typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : existing.name;
    const nextOwnerId = typeof payload.ownerId === 'string' ? payload.ownerId : existing.ownerId;
    if (viewer.role === 'EMPLOYEE' && (nextOwnerId !== existing.ownerId || nextOwnerId !== viewer.id)) {
      throw error('FORBIDDEN', 'Employees cannot reassign customer ownership', HttpStatus.FORBIDDEN);
    }
    const owner = await this.client(viewer).user.findUnique({
      where: { id: nextOwnerId },
      select: { id: true, name: true, departmentId: true },
    });
    if (!owner) throw error('FORBIDDEN', 'Customer owner is outside your scope', HttpStatus.FORBIDDEN);
    const nextDepartmentId = typeof payload.departmentId === 'string' ? payload.departmentId : existing.departmentId;
    if (viewer.role === 'MANAGER' && nextDepartmentId && !viewer.managedDepartmentIds.includes(nextDepartmentId)) {
      throw error('FORBIDDEN', 'Customer department is outside your scope', HttpStatus.FORBIDDEN);
    }
    const nextOwner = owner.name;
    const nextStage: CrmStage =
      typeof payload.stage === 'string' && VALID_CRM_STAGES.has(payload.stage as CrmStage)
        ? (payload.stage as CrmStage)
        : (existing.stage as CrmStage);
    if (typeof payload.stage === 'string' && !VALID_CRM_STAGES.has(payload.stage as CrmStage)) {
      throw error('INVALID_INPUT', 'Invalid CRM stage', HttpStatus.BAD_REQUEST);
    }
    try {
      const updated = await this.client(viewer).crmCustomer.update({
        where: { id },
        data: {
          code: crmInitials(nextName, existing.code),
          name: nextName,
          email: nextEmail,
          industry: typeof payload.industry === 'string' && payload.industry.trim() ? payload.industry.trim() : existing.industry,
          segment: payload.segment === 'individual' || payload.segment === 'enterprise' ? payload.segment : existing.segment,
          ownerName: nextOwner,
          ownerInitials: ownerInitials(nextOwner),
          ownerId: nextOwnerId,
          departmentId: nextDepartmentId,
          stage: nextStage,
          lastContact: typeof payload.lastContact === 'string' && payload.lastContact.trim() ? payload.lastContact.trim() : formatTodayVi(),
        },
      });
      await this.recordAudit({
        actorId: viewer.id,
        action: 'UPDATE',
        entity: 'CrmCustomer',
        entityId: id,
        oldData: { stage: existing.stage, ownerName: existing.ownerName },
        newData: { stage: updated.stage, ownerName: updated.ownerName },
      });
      return { ok: true as const, customer: this.crmRecord(updated) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw error('CONFLICT', 'Customer email already exists', HttpStatus.CONFLICT);
      }
      throw err;
    }
  }

  async deleteCrmCustomer(viewer: ScopeViewer, id: string) {
    const existing = await this.client(viewer).crmCustomer.findUnique({ where: { id } });
    if (!existing) {
      throw error('NOT_FOUND', 'Customer not found', HttpStatus.NOT_FOUND);
    }
    if (viewer.role === 'EMPLOYEE' && existing.createdById !== viewer.id && existing.ownerId !== viewer.id) {
      throw error('FORBIDDEN', 'Only the customer owner may delete this customer', HttpStatus.FORBIDDEN);
    }
    await this.client(viewer).crmCustomer.delete({ where: { id } });
    await this.recordAudit({
      actorId: viewer.id,
      action: 'DELETE',
      entity: 'CrmCustomer',
      entityId: id,
      oldData: { name: existing.name, email: existing.email },
    });
    return { ok: true as const, id };
  }

  async crmSummary(viewer: ScopeViewer) {
    const deals = await this.client(viewer).crmDeal.findMany({
      select: { amountCents: true, probability: true, stage: true, currency: true },
    });
    const pipelineCents = deals
      .filter((deal) => !['WON', 'LOST', 'Đã thắng', 'Đã mất'].includes(deal.stage))
      .reduce((sum, deal) => sum + Math.round(deal.amountCents * Math.max(0, Math.min(100, deal.probability)) / 100), 0);
    const wonCents = deals
      .filter((deal) => ['WON', 'Đã thắng'].includes(deal.stage))
      .reduce((sum, deal) => sum + deal.amountCents, 0);
    return {
      currency: deals[0]?.currency ?? 'VND',
      pipelineCents,
      wonCents,
      dealCount: deals.length,
    };
  }
}
