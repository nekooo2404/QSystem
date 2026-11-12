import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

/**
 * StorageModule (Task 7): presigned-URL storage over S3 (RustFS dev,
 * MinIO-compatible) with `files` metadata kept scoped via PrismaService.
 * OrgModule is imported for AbilitiesFactory (resolveViewer) — the same
 * viewer resolution NotifyController/OrgController use; PrismaService is
 * re-provided here following OrgModule's pattern.
 *
 * No S3 SDK (R20): SigV4 presigning lives in sigv4.ts on node:crypto.
 */
@Module({
  imports: [OrgModule],
  controllers: [StorageController],
  providers: [PrismaService, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
