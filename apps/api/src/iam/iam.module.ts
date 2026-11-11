import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  controllers: [IamController],
  providers: [
    PrismaService,
    IamService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [IamService, PrismaService],
})
export class IamModule {}
