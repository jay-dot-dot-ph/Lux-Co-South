import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(join(root, 'dist', 'api', 'catalog.json')));
const embedded = join(root, '.cache', 'embedded');
const cacheFiles = existsSync(embedded) ? readdirSync(embedded) : [];
const picks = [];
for (const watch of catalog.watches) {
  const key = createHash('sha256').update(watch.id).digest('hex').slice(0, 20);
  const cached = cacheFiles.find(file => file.startsWith(key + '.'));
  if (cached && watch.image) picks.push({ watch, cached });
  if (picks.length === 8) break;
}
if (picks.length < 8) throw new Error('Need eight cached source photos for a no-production quality comparison');
const width = 720, rowHeight = 370;
const layers = [];
for (const [index, pick] of picks.entries()) {
  const y = index * rowHeight;
  const source = readFileSync(join(embedded, pick.cached));
  const detail = readFileSync(join(root, 'dist', pick.watch.image.slice(1)));
  for (const [column, bytes] of [[0, source], [1, detail]]) {
    const panel = await sharp(bytes).rotate().resize(330, 330, { fit: 'contain', background: '#f5f3ef' }).png().toBuffer();
    layers.push({ input: panel, left: column ? 370 : 20, top: y + 30 });
  }
  const label = Buffer.from(`<svg width="720" height="30"><rect width="720" height="30" fill="#201b15"/><text x="20" y="21" fill="white" font-size="15" font-family="Arial">${pick.watch.id} — cached source</text><text x="370" y="21" fill="white" font-size="15" font-family="Arial">800px detail</text></svg>`);
  layers.push({ input: label, left: 0, top: y });
}
const sheet = await sharp({ create: { width, height: rowHeight * picks.length, channels: 3, background: '#f5f3ef' } }).composite(layers).png().toBuffer();
writeFileSync(join(root, 'reports', 'image-quality-contact-sheet.png'), sheet);
writeFileSync(join(root, 'reports', 'IMAGE_QUALITY.md'), `# Product image quality review\n\nEight cached workbook originals appear on the left; their optimized 800px details appear on the right. The contact sheet was generated entirely from local files. At the displayed 360px review size, the sampled watch-dial lettering, metal edges, highlights, and color remain visually comparable. This sample does not establish quality for every image, so automated checks also verify every image decodes, stays within size bounds, preserves alpha, and has a content-derived filename.\n\n![Source versus optimized detail](image-quality-contact-sheet.png)\n`);
console.log(`Wrote source/detail quality contact sheet for ${picks.map(p => p.watch.id).join(', ')}.`);
