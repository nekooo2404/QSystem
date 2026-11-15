import { Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  UpdateUserSchema,
} from '@qsystem/contracts';
import { CurrentUser } from '../iam/current-user.decorator';
import type { RequestViewer } from '../iam/iam.service';
import { AbilitiesFactory } from './abilities.factory';
import { OrgService } from './org.service';

/** Inline @Body() types are invisible to ValidationPipe — parse explicitly. */
function parseBody<T>(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: unknown }; data?: T } }, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new HttpException(
      { code: 'INVALID_INPUT', message: 'Invalid request body', details: parsed.error?.issues },
      HttpStatus.BAD_REQUEST,
    );
  }
  return parsed.data as T;
}

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
    @Body() body: unknown,
  ) {
    return this.org.createDepartment(
      await this.viewer(user),
      parseBody<{ name: string; managerId?: string; parentId?: string }>(CreateDepartmentSchema, body),
    );
  }

  @Patch('departments/:id')
  async updateDepartment(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.org.updateDepartment(
      await this.viewer(user),
      id,
      parseBody<{ name?: string; managerId?: string; parentId?: string }>(UpdateDepartmentSchema, body),
    );
  }

  @Get('users')
  async listUsers(@CurrentUser() user: RequestViewer | undefined) {
    return this.org.listUsers(await this.viewer(user));
  }

  @Post('users')
  async createUser(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: unknown,
  ) {
    return this.org.createUser(await this.viewer(user), body);
  }

  @Patch('users/:id')
  async updateUser(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.org.updateUser(
      await this.viewer(user),
      id,
      parseBody<{ role?: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE'; departmentId?: string | null; reportsToId?: string | null }>(UpdateUserSchema, body),
    );
  }

  // ---- TASK stubs (Ruling R6: no TASK table yet — generic payload layer) ----

  /** GET /org/tasks: RLS-scoped, paginated, filtered task list. */
  @Get('tasks')
  async listTasks(
    @CurrentUser() user: RequestViewer | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.org.listTasks(await this.viewer(user), query);
  }

  /** POST /org/tasks: 4W-validated by SensorsInterceptor; persisted in Postgres. */
  @Post('tasks')
  async createTask(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.org.createTask(await this.viewer(user), body);
  }

  /** PATCH /org/tasks/:id: LDP-guarded by SensorsInterceptor; persisted in Postgres. */
  @Patch('tasks/:id')
  async updateTask(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.org.updateTask(await this.viewer(user), id, body);
  }

  // ---- QCRM customer endpoints ----

  @Get('crm/customers')
  async listCrmCustomers(
    @CurrentUser() user: RequestViewer | undefined,
    @Query() query: { q?: string; segment?: string; stage?: string },
  ) {
    return this.org.listCrmCustomers(await this.viewer(user), query);
  }

  @Post('crm/customers')
  async createCrmCustomer(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: unknown,
  ) {
    return this.org.createCrmCustomer(await this.viewer(user), body);
  }

  @Patch('crm/customers/:id')
  async updateCrmCustomer(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.org.updateCrmCustomer(await this.viewer(user), id, body);
  }

  @Delete('crm/customers/:id')
  async deleteCrmCustomer(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
  ) {
    return this.org.deleteCrmCustomer(await this.viewer(user), id);
  }
}
