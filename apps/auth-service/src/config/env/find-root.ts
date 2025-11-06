import fs from 'fs';
import path from 'path';

export function findRepoRoot(startDir: string = __dirname): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(dir, 'nx.json')) ||
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return startDir; // fallback
    dir = parent;
  }
}
