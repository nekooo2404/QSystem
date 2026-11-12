import { Module } from '@nestjs/common';
import { IamModule } from './iam/iam.module';
import { NotifyModule } from './notify/notify.module';
import { OrgModule } from './org/org.module';

@Module({
  imports: [IamModule, OrgModule, NotifyModule],
})
export class AppModule {}
