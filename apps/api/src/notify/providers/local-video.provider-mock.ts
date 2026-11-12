import { Inject, Injectable } from '@nestjs/common';

/**
 * VideoProvider — explicit interface for future video (LiveKit-class)
 * integrations. Task 6 ships the interface + a local mock only: no SDK, no
 * credentials, no network. Consumed by QTask/call features later via DI.
 */
export interface VideoSessionRequest {
  roomId: string;
  participantIds: string[];
  /** Optional display metadata; never credentials. */
  title?: string;
}

export interface VideoSession {
  roomId: string;
  /** Local mock returns a non-resolvable placeholder URL, clearly marked. */
  joinUrl: string;
}

export interface VideoProvider {
  createSession(request: VideoSessionRequest): Promise<VideoSession>;
  endSession(roomId: string): Promise<void>;
}

/**
 * Local mock: logs and returns placeholder data. Deliberately NOT part of the
 * NotifChannel enum — video is a provider interface, not a notification
 * channel (ruling R16).
 */
@Injectable()
export class LocalVideoProviderMock implements VideoProvider {
  constructor(
    @Inject('NOTIFY_LOGGER') private readonly log: (message: string) => void,
  ) {}

  async createSession(request: VideoSessionRequest): Promise<VideoSession> {
    this.log(`[notify:video-mock] create room=${request.roomId} participants=${request.participantIds.length}`);
    return {
      roomId: request.roomId,
      joinUrl: `mock://video/${request.roomId}`, // placeholder — no real service
    };
  }

  async endSession(roomId: string): Promise<void> {
    this.log(`[notify:video-mock] end room=${roomId}`);
  }
}
