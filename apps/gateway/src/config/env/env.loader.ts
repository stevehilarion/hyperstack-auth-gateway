import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { envSchema, type EnvVars } from './env.schema';

function findRepoRoot(startDir: string = __dirname): string {
  let dir = path.resolve(startDir);
  // sube hasta la raíz buscando nx.json (o package.json como fallback)
  while (true) {
    const nxPath = path.join(dir, 'nx.json');
    const pkgPath = path.join(dir, 'package.json');

    if (fs.existsSync(nxPath) || fs.existsSync(pkgPath)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd(); // último recurso
    dir = parent;
  }
}

const ROOT_DIR = findRepoRoot();

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const envFiles = [
  path.join(ROOT_DIR, '.env'),
  path.join(ROOT_DIR, `.env.${NODE_ENV}`),
  path.join(ROOT_DIR, '.env.local'),
];

for (const file of envFiles) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file, override: true });
  }
}

export function loadEnvOrDie(): EnvVars {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(' Invalid environment for Gateway:\n', parsed.error.format());
    console.error(' Checked env files (in order):', envFiles.filter(fs.existsSync));
    process.exit(1);
  }
  return parsed.data;
}

export default loadEnvOrDie;
export { ROOT_DIR };
