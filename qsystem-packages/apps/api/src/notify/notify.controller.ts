import { Controller, Get, Inject, OnModuleDestroy, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../iam/current-user.decorator';
import type { RequestViewer } from '../iam/iam.service';
import { AbilitiesFactory } from '../org/abilities.factory';
import { NotifyService } from './notify.service';
import { RedisSocketGateway } from './providers/redis-socket.gateway';

@Controller('notifications')
export class NotifyController implements OnModuleDestroy {
  private readonly sseClients = new Set<() => void>();

  constructor(
    @Inject(NotifyService) private readonly notify: NotifyService,
    @Inject(AbilitiesFactory) private readonly abilities: AbilitiesFactory,
    @Inject(RedisSocketGateway) private readonly socket: RedisSocketGateway,
  ) {}

  onModuleDestroy(): void {
    for (const close of [...this.sseClients]) {
      close();
    }
    this.sseClients.clear();
  }

  @Get()
  async list(@CurrentUser() user: RequestViewer) {
    const viewer = await this.abilities.resolveViewer(user);
    return this.notify.listFor(viewer);
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: RequestViewer, @Param('id') id: string) {
    const viewer = await this.abilities.resolveViewer(user);
    return this.notify.markRead(viewer, id);
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: RequestViewer) {
    const viewer = await this.abilities.resolveViewer(user);
    return this.notify.markAllRead(viewer);
  }

  @Get('stream')
  async stream(
    @CurrentUser() user: RequestViewer,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const viewer = await this.abilities.resolveViewer(user);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent('ready', { userId: viewer.id });

    const unsubscribe = this.socket.subscribeUser(viewer.id, (payload) => {
      writeEvent('notification', payload);
    });
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': keepalive\n\n');
    }, 25_000);
    heartbeat.unref?.();

    const cleanup = () => {
      this.sseClients.delete(cleanup);
      unsubscribe();
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    };
    this.sseClients.add(cleanup);
    req.on('close', cleanup);
  }
}
