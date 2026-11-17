import { Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateDepartmentSchema,
  CreateProjectSchema,
  CreateWorkPackageSchema,
  UpdateDepartmentSchema,
  UpdateUserSchema,
  UpdateWorkPackageSchema,
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
      parseBody<{ role?: 'DIRECTOR' | 'MANAGER' | 'EMPLOYEE'; status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'; jobTitle?: string | null; departmentId?: string | null; reportsToId?: string | null }>(UpdateUserSchema, body),
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

  @Get('work-packages')
  async listWorkPackages(
    @CurrentUser() user: RequestViewer | undefined,
    @Query('projectId') projectId?: string,
  ) {
    return this.org.listWorkPackages(await this.viewer(user), projectId);
  }

  @Get('projects')
  async listProjects(@CurrentUser() user: RequestViewer | undefined) {
    return this.org.listProjects(await this.viewer(user));
  }

  @Post('projects')
  async createProject(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: unknown,
  ) {
    return this.org.createProject(await this.viewer(user), parseBody(CreateProjectSchema, body));
  }

  @Post('work-packages')
  async createWorkPackage(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: unknown,
  ) {
    return this.org.createWorkPackage(await this.viewer(user), parseBody(CreateWorkPackageSchema, body));
  }

  @Patch('work-packages/:id')
  async updateWorkPackage(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.org.updateWorkPackage(await this.viewer(user), id, parseBody(UpdateWorkPackageSchema, body));
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

  @Get('crm/summary')
  async crmSummary(@CurrentUser() user: RequestViewer | undefined) {
    return this.org.crmSummary(await this.viewer(user));
  }
}
