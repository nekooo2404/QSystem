import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [IamModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}

