import { existsSync, renameSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

export function publishStage(root) {
  const base = resolve(root), stage = resolve(base, '.dist-next'), published = resolve(base, 'dist'), backup = resolve(base, '.dist-previous');
  for (const path of [stage, published, backup]) if (!path.startsWith(base + sep)) throw new Error('Build path escaped site checkout');
  if (!existsSync(stage)) throw new Error('Staged build is missing');
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
  if (existsSync(published)) renameSync(published, backup);
  try { renameSync(stage, published); }
  catch (error) { if (existsSync(backup)) renameSync(backup, published); throw error; }
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
}
