import { Inject, Injectable } from '@nestjs/common';

/**
 * AiProvider — explicit interface for future AI integrations (OpenAI-class).
 * Task 6 ships the interface + a local mock only: no SDK, no API keys, no
 * network. Consumers get a seam to inject the real client later via DI.
 */
export interface AiCompletionRequest {
  /** Prompt/system context; never contains credentials. */
  prompt: string;
  maxTokens?: number;
}

export interface AiCompletion {
  text: string;
  /** Local mock only; a real client would return provider/model metadata. */
  model: 'local-mock';
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
}

/**
 * Local mock: echoes a deterministic stub completion. Deliberately NOT part
 * of the NotifChannel enum — AI is a provider interface, not a notification
 * channel (ruling R16).
 */
@Injectable()
export class LocalAiProviderMock implements AiProvider {
  constructor(
    @Inject('NOTIFY_LOGGER') private readonly log: (message: string) => void,
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletion> {
    this.log(`[notify:ai-mock] complete prompt=${request.prompt.length} chars`);
    return {
      text: `[local-ai-mock] stub completion for: ${request.prompt.slice(0, 80)}`,
      model: 'local-mock',
    };
  }
}
