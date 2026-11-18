import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { OrgModule } from '../org/org.module';
import { SearchModule } from '../search/search.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

/**
 * StorageModule (Task 7): presigned-URL storage over S3 (RustFS dev,
 * MinIO-compatible) with `files` metadata kept scoped via PrismaService.
 * OrgModule is imported for AbilitiesFactory (resolveViewer) — the same
 * viewer resolution NotifyController/OrgController use; PrismaService
 * comes from IamModule via OrgModule (single shared instance).
 *
 * No S3 SDK (R20): SigV4 presigning lives in sigv4.ts on node:crypto.
 */
@Module({
  imports: [IamModule, OrgModule, SearchModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
