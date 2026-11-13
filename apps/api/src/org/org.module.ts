import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from '../common/audit.service';
import { IamModule } from '../iam/iam.module';
import { AbilitiesFactory } from './abilities.factory';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { SensorsInterceptor } from './sensors.interceptor';

@Module({
  // IamModule exports the single PrismaService instance — re-providing it in
  // each module created 5 pools, of which only one got onModuleDestroy.
  imports: [IamModule],
  controllers: [OrgController],
  providers: [
    AuditService,
    OrgService,
    AbilitiesFactory,
    { provide: APP_INTERCEPTOR, useClass: SensorsInterceptor },
  ],
  exports: [AbilitiesFactory, OrgService],
})
export class OrgModule {}
