import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join, isAbsolute } from 'path';
import { findRepoRoot } from './find-root';

const ROOT = findRepoRoot();

function resolvePathMaybeFromRoot(p: string): string {
  return isAbsolute(p) ? p : join(ROOT, p);
}

function loadKeyFrom(fileRelOrAbs: string): string {
  const p = resolvePathMaybeFromRoot(fileRelOrAbs);
  if (!existsSync(p)) {
    throw new Error(`JWT key file not found: ${p}`);
  }
  return readFileSync(p, 'utf8');
}

function loadPrivateKey(): string {
  const rel = process.env.JWT_PRIVATE_KEY_FILE || 'keys/private.pem';
  return loadKeyFrom(rel);
}

function loadPublicKey(): string {
  const rel = process.env.JWT_PUBLIC_KEY_FILE || 'keys/public.pem';
  return loadKeyFrom(rel);
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    AUTH_DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3001),

    // JWT
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),
    JWT_ISS: z.string().default('https://auth.hyperstack.local'),
    JWT_AUD: z.string().default('hyperstack-api'),
    JWT_KID: z.string().default('dev-key-1'),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
  })
  .transform((v) => ({
    NODE_ENV: v.NODE_ENV,
    PORT: v.PORT,
    AUTH_DATABASE_URL: v.AUTH_DATABASE_URL,
    jwt: {
      privateKey: loadPrivateKey(),
      publicKey: loadPublicKey(),
      accessTtl: v.JWT_ACCESS_TTL,
      refreshTtl: v.JWT_REFRESH_TTL,
      iss: v.JWT_ISS,
      aud: v.JWT_AUD,
      kid: v.JWT_KID,
    },
    redis: {
      host: v.REDIS_HOST,
      port: v.REDIS_PORT,
    },
  }));

export type AuthEnvVars = z.infer<typeof envSchema>;
