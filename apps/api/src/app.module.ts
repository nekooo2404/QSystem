import { Module } from '@nestjs/common';
import { IamModule } from './iam/iam.module';
import { OrgModule } from './org/org.module';

@Module({
  imports: [IamModule, OrgModule],
})
export class AppModule {}
