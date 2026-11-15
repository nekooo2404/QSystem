import { Module } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { IamModule } from '../iam/iam.module';
import { OrgModule } from '../org/org.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [IamModule, OrgModule],
  controllers: [SocialController],
  providers: [SocialService, AuditService],
})
export class SocialModule {}

