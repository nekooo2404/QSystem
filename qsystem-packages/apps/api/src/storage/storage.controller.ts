import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { PresignInput } from './storage.service';
import { StorageService } from './storage.service';
import { CurrentUser } from '../iam/current-user.decorator';
import type { RequestViewer } from '../iam/iam.service';
import { AbilitiesFactory } from '../org/abilities.factory';
import type { ScopeViewer } from '../prisma/prisma.service';

function codedNotFound(): HttpException {
  // Coded body per dispatch ruling: {code:'NOT_FOUND'} — identical shape for
  // out-of-scope and missing rows, so no existence oracle leaks through.
  return new HttpException(
    { code: 'NOT_FOUND', message: 'NOT_FOUND' },
    HttpStatus.NOT_FOUND,
  );
}

function codedUnauthorized(): HttpException {
  return new HttpException(
    { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' },
    HttpStatus.UNAUTHORIZED,
  );
}

/**
 * StorageController (Task 7). Scope chain (identical to NotifyController):
 *   @CurrentUser() → AbilitiesFactory.resolveViewer → StorageService
 *   → PrismaService.forUser(viewer) — app-layer scope (file: EMPLOYEE ownerId,
 *   MANAGER managed departments, DIRECTOR bypass) + SQL RLS backstop
 *   (files_self/files_department/files_company).
 *
 * POST /files/presign → metadata upsert + presigned PUT URL returned in the
 * JSON body (not a redirect). GET /files/:id → scoped metadata read +
 * presigned GET URL in the JSON body (never a 302, per the dispatch ruling).
 */
@Controller('files')
export class StorageController {
  // Explicit tokens — esbuild (vitest) does not emit decorator metadata.
  constructor(
    @Inject(AbilitiesFactory) private readonly abilities: AbilitiesFactory,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  @Post('presign')
  @HttpCode(201)
  async presign(
    @CurrentUser() user: RequestViewer | undefined,
    @Body() body: PresignInput,
  ): Promise<{
    fileId: string;
    bucket: string;
    key: string;
    uploadUrl: string;
    expiresInSeconds: number;
  }> {
    if (!user?.id) {
      // Guard normally 401s before this point; a missing viewer is still a
      // coded 401 here (never an unscoped write).
      throw codedUnauthorized();
    }
    const viewer: ScopeViewer = await this.abilities.resolveViewer({
      id: user.id,
      role: user.role,
    });
    return this.storage.presignUpload(viewer, {
      bucket: body?.bucket ?? '',
      key: body?.key ?? '',
      mimeType: typeof body?.mimeType === 'string' ? body.mimeType : undefined,
      size: typeof body?.size === 'number' ? body.size : undefined,
    });
  }

  @Get()
  async listFiles(@CurrentUser() user: RequestViewer | undefined) {
    if (!user?.id) {
      throw codedUnauthorized();
    }
    const viewer: ScopeViewer = await this.abilities.resolveViewer({
      id: user.id,
      role: user.role,
    });
    return this.storage.listFiles(viewer);
  }

  @Get(':id')
  async download(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
  ): Promise<{
    id: string;
    bucket: string;
    key: string;
    mimeType: string | null;
    size: number | null;
    url: string;
    expiresInSeconds: number;
  }> {
    if (!user?.id) {
      // Guard normally 401s before this point; a missing viewer is still a
      // coded 401 here (never an unscoped read).
      throw codedUnauthorized();
    }
    const viewer: ScopeViewer = await this.abilities.resolveViewer({
      id: user.id,
      role: user.role,
    });
    const file = await this.storage.getDownload(viewer, id);
    // Out-of-scope AND missing rows are the same coded 404 — no existence
    // oracle (dispatch ruling; the scoped findUnique already returns null
    // for rows the viewer cannot see).
    if (!file) throw codedNotFound();
    return {
      id: file.id,
      bucket: file.bucket,
      key: file.key,
      mimeType: file.mimeType,
      size: file.size,
      url: file.url,
      expiresInSeconds: file.expiresInSeconds,
    };
  }

  @Patch(':id')
  async updateFile(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
    @Body() body: { key?: string; mimeType?: string },
  ) {
    if (!user?.id) {
      throw codedUnauthorized();
    }
    const viewer: ScopeViewer = await this.abilities.resolveViewer({
      id: user.id,
      role: user.role,
    });
    const updated = await this.storage.updateFile(viewer, id, {
      key: typeof body?.key === 'string' ? body.key : undefined,
      mimeType: typeof body?.mimeType === 'string' ? body.mimeType : undefined,
    });
    if (!updated) throw codedNotFound();
    return updated;
  }

  @Delete(':id')
  async deleteFile(
    @CurrentUser() user: RequestViewer | undefined,
    @Param('id') id: string,
  ) {
    if (!user?.id) {
      throw codedUnauthorized();
    }
    const viewer: ScopeViewer = await this.abilities.resolveViewer({
      id: user.id,
      role: user.role,
    });
    const deleted = await this.storage.deleteFile(viewer, id);
    if (!deleted) throw codedNotFound();
    return deleted;
  }
}
