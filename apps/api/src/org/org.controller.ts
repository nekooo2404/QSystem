import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../iam/current-user.decorator';
import type { RequestViewer } from '../iam/iam.service';
import { AbilitiesFactory } from './abilities.factory';
import { OrgService } from './org.service';

@Controller('org')
export class OrgController {
  // NOTE: explicit @Inject — vitest runs through esbuild, which does not emit
  // decorator metadata, so constructor-param DI needs explicit tokens.
  constructor(
    @Inject(OrgService) private readonly org: OrgService,
    @Inject(AbilitiesFactory) private readonly abilities: AbilitiesFactory,
  ) {}

  private async viewer(user: RequestViewer | undefined) {
    return this.abilities.resolveViewer({
      id: user?.id ?? '',
      role: user?.role ?? 'EMPLOYEE',
    });
  }

  @Get('departments')
  async listDepartments(@CurrentUser() user: RequestViewer | undefined) {
    return this.org.listDepartments(await this.viewer(user));
  }

  @Post('departments')
  async createDepartment(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: { name: string; managerId?: string; parentId?: string },
  ) {
    return this.org.createDepartment(await this.viewer(user), body ?? {});
  }

  @Patch('departments/:id')
  async updateDepartment(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: { name?: string; managerId?: string; parentId?: string },
  ) {
    return this.org.updateDepartment(await this.viewer(user), id, body ?? {});
  }

  @Get('users')
  async listUsers(@CurrentUser() user: RequestViewer | undefined) {
    return this.org.listUsers(await this.viewer(user));
  }

  @Patch('users/:id')
  async updateUser(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: { role?: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE'; departmentId?: string | null; reportsToId?: string | null },
  ) {
    return this.org.updateUser(await this.viewer(user), id, body ?? {});
  }

  // ---- TASK stubs (Ruling R6: no TASK table yet — generic payload layer) ----

  /** POST /org/tasks: 4W-validated by SensorsInterceptor; stub returns ok. */
  @Post('tasks')
  async createTask(@Body() body: Record<string, unknown>) {
    return { ok: true as const, task: { ...(body ?? {}) } };
  }

  /** PATCH /org/tasks/:id: LDP-guarded by SensorsInterceptor; stub returns ok. */
  @Patch('tasks/:id')
  async updateTask(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return { ok: true as const, task: { id, ...(body ?? {}) } };
  }
}
