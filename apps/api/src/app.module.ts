import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ExceptionFilter } from './common/exception.filter';
import { IamModule } from './iam/iam.module';
import { NotifyModule } from './notify/notify.module';
import { OrgModule } from './org/org.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [IamModule, OrgModule, NotifyModule, SearchModule, StorageModule],
  providers: [{ provide: APP_FILTER, useClass: ExceptionFilter }],
})
export class AppModule {}
