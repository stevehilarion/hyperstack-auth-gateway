import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { envSchema, type AuthEnvVars } from './env.schema';

function findRepoRoot(): string {
  let dir = __dirname;

  while (true) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.resolve(__dirname, '../../../../..');
}

const ROOT_DIR = findRepoRoot();

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const envFiles = [
  path.join(ROOT_DIR, '.env'),
  path.join(ROOT_DIR, `.env.${NODE_ENV}`),
  path.join(ROOT_DIR, '.env.local'),
  path.join(ROOT_DIR, 'apps/auth-service/.env'),
  path.join(ROOT_DIR, `apps/auth-service/.env.${NODE_ENV}`),
  path.join(ROOT_DIR, 'apps/auth-service/.env.local'),
];

for (const file of envFiles) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file, override: true });
  }
}

export function loadAuthEnvOrDie(): AuthEnvVars {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(' Invalid environment for Auth-Service:\n', parsed.error.format());
    console.error(' Checked env files:', envFiles.filter(fs.existsSync));
    process.exit(1);
  }
  return parsed.data;
}

export { ROOT_DIR };
