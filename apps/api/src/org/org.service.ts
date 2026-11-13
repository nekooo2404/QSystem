import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
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
    } catch {
      throw error('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    }
  }
}
