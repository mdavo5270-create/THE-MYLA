/**
 * Shared validation helpers (Zod schemas).
 * Keep input validation centralized.
 */

import { z } from 'zod';

export const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const intentSchema = z.object({
  type: z.enum(['move', 'interact', 'chat', 'custom']),
  payload: z.unknown(),
  seq: z.number().int().nonnegative().optional(),
  timestamp: z.number().optional(),
});

export type ValidatedIntent = z.infer<typeof intentSchema>;
