import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ExceptionFilter } from './common/exception.filter';
import { HealthModule } from './health/health.module';
import { IamModule } from './iam/iam.module';
import { NotifyModule } from './notify/notify.module';
import { OrgModule } from './org/org.module';
import { RegistryModule } from './registry/registry.module';
import { SearchModule } from './search/search.module';
import { SocialModule } from './social/social.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [HealthModule, IamModule, OrgModule, NotifyModule, RegistryModule, SearchModule, SocialModule, StorageModule],
  providers: [{ provide: APP_FILTER, useClass: ExceptionFilter }],
})
export class AppModule {}
