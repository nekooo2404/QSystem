import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  controllers: [IamController],
  providers: [
    IamService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [IamService],
})
export class IamModule {}
