import { z } from 'zod';

/** Notify channels — Task 6 consumes verbatim. */
export const NotifyChannelSchema = z.enum(['EMAIL', 'VIBER', 'SOCKET']);
export type NotifyChannel = z.infer<typeof NotifyChannelSchema>;

/** Notify status values — exactly schema.prisma NotifStatus / API read values. */
export const NotifyStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED', 'DEAD']);
export type NotifyStatus = z.infer<typeof NotifyStatusSchema>;

/**
 * NotifyPayload — Task 6 consumes verbatim.
 * channel + recipient required; recipientId/payload/tenantId optional.
 */
export const NotifyPayloadSchema = z.object({
  channel: NotifyChannelSchema,
  recipient: z.string().min(1),
  recipientId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.string().nullable().optional(),
});
export type NotifyPayload = z.infer<typeof NotifyPayloadSchema>;
