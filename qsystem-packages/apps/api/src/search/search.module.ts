import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { OrgModule } from '../org/org.module';
import { SearchController } from './search.controller';
import { MEILI_CONFIG, SearchService, meiliConfigFromEnv } from './search.service';
import { SearchSyncWorker } from './sync.worker';

/**
 * SearchModule (Task 7): scoped search over Meilisearch (shared REST client
 * in search.service.ts, plain fetch — R20, no SDK) plus the manual sync
 * worker that indexes `files` into the `documents` index. OrgModule is
 * imported for AbilitiesFactory (resolveViewer) — the same viewer resolution
 * NotifyController uses; PrismaService comes from IamModule via OrgModule
 * OrgModule's pattern.
 *
 * The Meili config provider reads env at construction (dev-only fallbacks
 * are visible in search.service.ts); nothing credential-shaped is hardcoded
 * as the primary path.
 */
@Module({
  imports: [IamModule, OrgModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchSyncWorker,
    { provide: MEILI_CONFIG, useFactory: meiliConfigFromEnv },
  ],
  exports: [SearchService, SearchSyncWorker],
})
export class SearchModule {}
