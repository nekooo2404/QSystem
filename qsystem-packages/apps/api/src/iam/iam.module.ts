import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginRateLimiter } from './login-rate-limit';

@Module({
  controllers: [IamController],
  providers: [
    PrismaService,
    IamService,
    LoginRateLimiter,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [IamService, PrismaService],
})
export class IamModule {}
