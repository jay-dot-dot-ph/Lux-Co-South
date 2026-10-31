import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { prepareAssets } from './prepare-assets.mjs';
import { writeSiteFingerprint } from './site-fingerprint.mjs';
import { publishStage } from './publish-stage.mjs';

const root = resolve(import.meta.dirname, '..'), stage = join(root, '.dist-next');
rmSync(stage, { recursive: true, force: true });
cpSync(join(root, 'dist'), stage, { recursive: true });
const catalogPath = join(stage, 'api', 'catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
if (!catalog.sourceFingerprint) {
  catalog.optimizationSource = 'cached-hosting-catalog';
  writeFileSync(catalogPath, JSON.stringify(catalog));
}
await prepareAssets(root, stage, true);
console.log(`Updated asset fingerprint ${writeSiteFingerprint(stage).fingerprint}`);
publishStage(root);
