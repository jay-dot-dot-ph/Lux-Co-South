import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function allFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? allFiles(join(directory, entry.name), path) : path === 'api/site-fingerprint.json' ? [] : [path];
  }).sort();
}

export function writeSiteFingerprint(directory) {
  const files = allFiles(directory), digest = createHash('sha256');
  for (const path of files) {
    let bytes = readFileSync(join(directory, path));
    if (path === 'api/catalog.json') {
      const catalog = JSON.parse(bytes.toString('utf8'));
      delete catalog.fetchedAt;
      bytes = Buffer.from(JSON.stringify(catalog));
    }
    digest.update(path).update('\0').update(createHash('sha256').update(bytes).digest()).update('\0');
  }
  const manifest = { fingerprint: digest.digest('hex'), fileCount: files.length };
  writeFileSync(join(directory, 'api', 'site-fingerprint.json'), JSON.stringify(manifest));
  return manifest;
}
