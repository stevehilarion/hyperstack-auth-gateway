import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join, isAbsolute } from 'path';

function findRepoRoot(startDir: string = __dirname): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  let dir = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(dir, 'nx.json')) ||
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))
    ) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

const ROOT = findRepoRoot(__dirname);

function resolveFromRoot(p: string): string {
  return isAbsolute(p) ? p : join(ROOT, p);
}

function loadPublicKey(): string {
  const rel = process.env.JWT_PUBLIC_KEY_FILE || 'keys/public.pem';
  const p = resolveFromRoot(rel);
  if (!existsSync(p)) {
    throw new Error(`Gateway JWT public key not found at: ${p}`);
  }
  return readFileSync(p, 'utf8');
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GATEWAY_PORT: z.coerce.number().optional(),
  PORT: z.coerce.number().optional(),
  AUTH_SERVICE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  ALLOWED_ORIGINS: z.string().optional(),

  // Claims para validar tokens en el gateway
  JWT_ISS: z.string().default('https://auth.hyperstack.local'),
  JWT_AUD: z.string().default('hyperstack-api'),
}).transform(v => ({
  NODE_ENV: v.NODE_ENV,
  AUTH_SERVICE_URL: v.AUTH_SERVICE_URL,
  REDIS_HOST: v.REDIS_HOST,
  REDIS_PORT: v.REDIS_PORT,
  ALLOWED_ORIGINS: v.ALLOWED_ORIGINS
    ? v.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [],
  GATEWAY_PORT: v.GATEWAY_PORT ?? v.PORT ?? 3000,
  jwt: {
    publicPem: loadPublicKey(),
    iss: v.JWT_ISS,
    aud: v.JWT_AUD,
  },
}));

export type EnvVars = z.infer<typeof envSchema>;
