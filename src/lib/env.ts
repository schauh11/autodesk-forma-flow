// Minimal env validation, most config is now in config.json
// This file is kept for any remaining env-based config

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info').optional(),
  FORMA_FLOW_DATA_DIR: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let parsed: Env;

try {
  parsed = envSchema.parse(process.env);
} catch (error) {
  parsed = { NODE_ENV: 'development', LOG_LEVEL: 'info' } as Env;
}

export const env = parsed;
export type { Env };
