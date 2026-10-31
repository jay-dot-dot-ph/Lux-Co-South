import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const dist = resolve(import.meta.dirname, '..', 'dist');
const catalog = JSON.parse(readFileSync(join(dist, 'api', 'catalog.json'), 'utf8'));
const report = JSON.parse(readFileSync(join(dist, 'api', 'image-pipeline-report.json'), 'utf8'));
assert.equal(catalog.brands.length, 23);
assert(catalog.watches.length > 100, 'Catalog appears incomplete');
assert.equal(catalog.brands.reduce((sum, brand) => sum + brand.count, 0), catalog.watches.length);
assert.equal(new Set(catalog.watches.map(w => w.id)).size, catalog.watches.length);
assert.equal(report.settings.thumbnail.size, 480);
assert.equal(report.settings.thumbnail.quality, 80);
assert.equal(report.settings.detail.size, 800);
assert.equal(report.settings.detail.quality, 85);
const references = new Set();
for (const watch of catalog.watches) {
  if (!watch.image) continue;
  for (const kind of ['image', 'thumbnailImage']) {
    const path = watch[kind];
    assert.match(path, /^\/images\/[a-f0-9]{16}\.(?:webp|jpg|png)$/, `${watch.id} ${kind} is not a local content-hashed image`);
    assert(existsSync(join(dist, path.slice(1))), `${watch.id} ${kind} is missing`);
    references.add(path.slice('/images/'.length));
  }
}
const files = readdirSync(join(dist, 'images')).sort();
assert.deepEqual(files, [...references].sort(), 'Image folder has missing or unreferenced files');
const digests = new Set();
let imageBytes = 0, webp = 0;
for (const name of files) {
  const bytes = readFileSync(join(dist, 'images', name));
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(name.slice(0, 16), digest.slice(0, 16), `Incorrect image content hash: ${name}`);
  assert(!digests.has(digest), `Duplicate image data: ${name}`);
  digests.add(digest);
  const dimensions = await sharp(bytes, { failOn: 'error' }).metadata();
  assert(dimensions.width > 0 && dimensions.height > 0, `Image will not decode: ${name}`);
  imageBytes += bytes.length;
  if (name.endsWith('.webp')) webp++;
}
for (const watch of catalog.watches) {
  if (!watch.image) continue;
  for (const [kind, bound] of [['image', 800], ['thumbnailImage', 480]]) {
    const metadata = await sharp(join(dist, watch[kind].slice(1))).metadata();
    assert(Math.max(metadata.width, metadata.height) <= bound, `${watch.id} ${kind} exceeds ${bound}px`);
  }
}
assert.equal(report.emittedImageCount, files.length);
assert.equal(report.emittedBytes, imageBytes);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const admin = readFileSync(join(dist, 'admin', 'index.html'), 'utf8');
for (const page of [html, admin]) {
  for (const match of page.matchAll(/(?:src|href)="(\/(?:app|styles|chat|admin)[^"?#]+\.(?:js|css))"/g)) assert(existsSync(join(dist, match[1].slice(1))), `Missing static asset ${match[1]}`);
}
assert(html.includes('https://lux-co-south.web.app/'), 'Canonical and Open Graph URLs should be absolute');
const appPath = html.match(/src="(\/app\.[a-f0-9]{12}\.js)"/)?.[1];
assert(appPath, 'Homepage script is not content hashed');
const app = readFileSync(join(dist, appPath.slice(1)), 'utf8');
assert(!app.includes("import('/chat/customer.js')"), 'New visitors should load chat lazily');
assert(!app.includes('https://lux-co-south.web.app/images/'), 'Local app must not request production watch photos');
const hostingBytes = (function total(directory) { return readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => sum + (entry.isDirectory() ? total(join(directory, entry.name)) : statSync(join(directory, entry.name)).size), 0); })(dist);
console.log(JSON.stringify({ watches: catalog.watches.length, images: files.length, webp, imageBytes, hostingBytes, duplicateImages: 0 }));
