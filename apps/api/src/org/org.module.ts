import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AbilitiesFactory } from './abilities.factory';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { SensorsInterceptor } from './sensors.interceptor';

@Module({
  controllers: [OrgController],
  providers: [
    PrismaService,
    AuditService,
    OrgService,
    AbilitiesFactory,
    { provide: APP_INTERCEPTOR, useClass: SensorsInterceptor },
  ],
  exports: [AbilitiesFactory, OrgService],
})
export class OrgModule {}
