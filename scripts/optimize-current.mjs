import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { optimizeWatchImages } from './optimize-images.mjs';
import { writeSiteFingerprint } from './site-fingerprint.mjs';
import { publishStage } from './publish-stage.mjs';
import { prepareAssets } from './prepare-assets.mjs';

const root = resolve(import.meta.dirname, '..');
const stage = join(root, '.dist-next');
const existingCatalog = JSON.parse(readFileSync(join(root, 'dist', 'api', 'catalog.json'), 'utf8'));
if (existingCatalog.watches.some(watch => watch.thumbnailImage)) {
  throw new Error('The current catalog already contains optimized image variants. Use refresh-current-assets.mjs instead.');
}
rmSync(stage, { recursive: true, force: true });
cpSync(join(root, 'dist'), stage, { recursive: true });
const catalogPath = join(stage, 'api', 'catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const report = await optimizeWatchImages(catalog.watches, stage, root);
writeFileSync(catalogPath, JSON.stringify(catalog));
await prepareAssets(root, stage, true);
const manifest = writeSiteFingerprint(stage);
publishStage(root);
console.log(`Optimized ${report.sourceImageCount} product images into ${report.emittedImageCount} unique files. Artifact fingerprint ${manifest.fingerprint}.`);
