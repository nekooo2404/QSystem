import { Module, Provider } from '@nestjs/common';
import { AbilitiesFactory } from '../org/abilities.factory';
import { IamModule } from '../iam/iam.module';
import { OrgModule } from '../org/org.module';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';
import { NotifyWorker } from './notify.worker';
import { LocalEmailProvider } from './providers/local-email.provider';
import { LocalViberFallbackProvider } from './providers/local-viber-fallback.provider';
import { LocalSocketGateway } from './providers/local-socket.gateway';
import { LocalVideoProviderMock } from './providers/local-video.provider-mock';
import { LocalAiProviderMock } from './providers/local-ai.provider-mock';
import type { NotificationProvider } from './providers/notification-provider.interface';

/** Shared dev logger — console only; never a credential sink. */
const consoleLog = (message: string): void => {
  // eslint-disable-next-line no-console
  console.log(message);
};

/**
 * NotificationModule (Task 6): outbox enqueue, local poll worker, channel
 * providers, and the scoped `GET /notifications` read. Local/dev adapters
 * only — no real SMTP/Viber/Socket.IO/LiveKit/OpenAI, no credentials.
 *
 * OrgModule is imported for AbilitiesFactory (resolveViewer) — the same
 * viewer resolution the OrgController uses. OrgModule in turn imports
 * IamModule, which exports the app's single PrismaService instance (the
 * worker used to get its own identity-less pool; one pool, one disconnect).
 */
@Module({
  imports: [IamModule, OrgModule],
  controllers: [NotifyController],
  providers: [
    NotifyService,
    NotifyWorker,
    // Explicit class-token DI (esbuild emits no param metadata): the logger
    // token keeps providers test-friendly without positional confusion.
    { provide: 'NOTIFY_LOGGER', useValue: consoleLog },
    LocalEmailProvider,
    LocalViberFallbackProvider,
    LocalSocketGateway,
    LocalVideoProviderMock,
    LocalAiProviderMock,
    {
      provide: 'NOTIFY_PROVIDERS',
      useFactory(email: LocalEmailProvider, viber: LocalViberFallbackProvider, socket: LocalSocketGateway): NotificationProvider[] {
        return [email, viber, socket];
      },
      inject: [LocalEmailProvider, LocalViberFallbackProvider, LocalSocketGateway],
    },
  ] satisfies Provider[],
  exports: [NotifyService, NotifyWorker],
})
export class NotifyModule {}
