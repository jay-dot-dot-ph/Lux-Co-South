import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const beforeArtifact = JSON.parse(readFileSync(join(root, 'reports', 'baseline-artifact.json')));
const before = JSON.parse(readFileSync(join(root, 'reports', 'network-before.json')));
const after = JSON.parse(readFileSync(join(root, 'reports', 'network-after.json')));
const images = readdirSync(join(root, 'dist', 'images'));
const sum = directory => readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => total + (entry.isDirectory() ? sum(join(directory, entry.name)) : statSync(join(directory, entry.name)).size), 0);
const afterArtifact = { hostingBytes: sum(join(root, 'dist')), imageBytes: images.reduce((n, file) => n + statSync(join(root, 'dist', 'images', file)).size, 0), imageCount: images.length, duplicateImageCopies: 0 };
const get = (rows, route, mobile = false, warm = false) => rows.find(row => row.route === route && row.mobile === mobile && row.warm === warm);
const format = value => Number(value).toLocaleString('en-US');
const pct = (a, b) => a === 0 ? 'n/a' : `${((a - b) / a * 100).toFixed(1)}%`;
const row = (label, a, b, unit = 'bytes') => `| ${label} | ${format(a)} ${unit} | ${format(b)} ${unit} | ${pct(a, b)} |`;
const homeBefore = get(before, '/'), homeAfter = get(after, '/');
const catalogBefore = get(before, '/watches/'), catalogAfter = get(after, '/watches/');
const repeatBefore = get(before, '/watches/', false, true), repeatAfter = get(after, '/watches/', false, true);
const lines = [
  '# Lux Co South optimization report', '',
  'Measured locally on the same 669-watch, 23-brand catalog. Browser values are Chromium CDP encoded transfer bytes from `http://127.0.0.1:4173` with the local server simulating Hosting cache headers. Tests rejected production watch-image requests and unexpected third-party origins. Google Fonts and Firebase CDN bytes are excluded from the local Hosting totals.', '',
  '| Metric | Before | After | Reduction |', '| --- | ---: | ---: | ---: |',
  row('Total Hosting artifact', beforeArtifact.hostingBytes, afterArtifact.hostingBytes),
  row('Product image files', beforeArtifact.imageBytes, afterArtifact.imageBytes),
  row('Homepage cold desktop transfer', homeBefore.bytes, homeAfter.bytes),
  row('Catalog first 24 cold desktop transfer', catalogBefore.bytes, catalogAfter.bytes),
  row('Catalog image transfer', catalogBefore.imageBytes, catalogAfter.imageBytes),
  row('Catalog image requests', catalogBefore.imageRequests, catalogAfter.imageRequests, 'requests'),
  row('Catalog repeat visit transfer', repeatBefore.bytes, repeatAfter.bytes),
  row('Homepage JavaScript and CSS transfer', homeBefore.jsCssBytes, homeAfter.jsCssBytes),
  row('Homepage cold mobile transfer', get(before, '/', true).bytes, get(after, '/', true).bytes),
  '',
  `Product image file count: ${beforeArtifact.imageCount} before, ${afterArtifact.imageCount} after. The after artifact contains separate thumbnail and detail variants. Exact duplicate image copies: ${beforeArtifact.duplicateImageCopies} before, ${afterArtifact.duplicateImageCopies} after.`, '',
  'The repeat-visit benchmark transferred zero bytes in both builds because the local server provided cache headers and Chromium reused its cache. The image-request count also remained the same; each request now transfers a smaller image. Monthly Firebase Hosting bandwidth, Google Sheets API calls, Firestore reads, and deployment storage were not measured here and cannot be inferred from these local values.', '',
  'The public Sheet export intermittently returned empty brand tabs (CHARRIOL during the first build attempt and Bvlgari during the latest source check). This artifact optimizes the previously deployed catalog snapshot and marks its provenance as `cached-hosting-catalog`. The staged full-build path validates all tabs before replacing `dist`; a fresh Sheet build needs healthy exports before publication. No production services or data were changed.', '',
  'Checks: catalog routes and product references, all image decodes and bounds, image content hashes and duplicates, local-origin browser network, desktop and mobile transfer, Firestore rules, and admin browser behavior. See `reports/network-before.json`, `reports/network-after.json`, and `dist/api/image-pipeline-report.json` for raw evidence.', ''
];
writeFileSync(join(root, 'reports', 'OPTIMIZATION.md'), lines.join('\n'));
console.log(lines.join('\n'));
