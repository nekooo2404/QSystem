import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../iam/jwt-auth.guard';
import { HealthService, type ReadinessReport } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get('live')
  live() {
    return this.health.live();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessReport> {
    const report = await this.health.ready();
    res.status(report.ok ? 200 : 503);
    return report;
  }
}

