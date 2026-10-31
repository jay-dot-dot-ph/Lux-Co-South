import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const settings = { thumbnail: { size: 480, quality: 80 }, detail: { size: 800, quality: 85 } };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const imageDir = directory => join(directory, 'images');
const cacheDir = directory => join(directory, '.cache', 'optimized-images');

async function variant(source, format, original, sourceHash, kind, cache) {
  const { size, quality } = settings[kind];
  const key = digest(Buffer.from(`sharp-v1:${sourceHash}:${kind}:${size}:${quality}`));
  for (const ext of ['webp', 'jpg', 'png']) {
    const file = join(cache, `${key}.${ext}`);
    if (existsSync(file)) return { bytes: readFileSync(file), ext, reused: true };
  }
  const sourceFits = Math.max(original.width, original.height) <= size && (!original.orientation || original.orientation === 1);
  const normalized = sourceFits ? source : await sharp(source, { failOn: 'error' }).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).toBuffer();
  const normalizedExt = format === 'jpeg' ? 'jpg' : format;
  let originalFormat = sourceFits ? source : normalized;
  if (!sourceFits) {
    const pipeline = sharp(normalized);
    originalFormat = format === 'jpeg' ? await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
      : format === 'png' ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : await pipeline.webp({ quality }).toBuffer();
  }
  let bytes = originalFormat, ext = normalizedExt;
  if (format !== 'webp') {
    const webp = await sharp(normalized).webp({ quality, effort: 5 }).toBuffer();
    if (webp.length < originalFormat.length) { bytes = webp; ext = 'webp'; }
  }
  writeFileSync(join(cache, `${key}.${ext}`), bytes);
  return { bytes, ext, reused: false };
}

export async function optimizeWatchImages(watches, output, root) {
  const images = imageDir(output);
  const cache = cacheDir(root);
  mkdirSync(cache, { recursive: true });
  const sourcePaths = [...new Set(watches.map(w => w.image).filter(Boolean))];
  const results = new Map(), records = [];
  let next = 0;
  async function worker() {
    while (next < sourcePaths.length) {
      const path = sourcePaths[next++];
      if (!/^\/images\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)) throw new Error(`Invalid product image path ${path}`);
      const file = join(output, path.slice(1));
      const source = readFileSync(file);
      const metadata = await sharp(source, { failOn: 'error' }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error(`Unreadable product image ${path}`);
      const sourceHash = digest(source), entries = {};
      for (const kind of ['detail', 'thumbnail']) {
        const prepared = await variant(source, metadata.format, metadata, sourceHash, kind, cache);
        const outputHash = digest(prepared.bytes).slice(0, 16);
        const name = `${outputHash}.${prepared.ext}`;
        const outputFile = join(images, name);
        if (!existsSync(outputFile)) writeFileSync(outputFile, prepared.bytes);
        const checked = await sharp(prepared.bytes).metadata();
        if (Math.max(checked.width, checked.height) > settings[kind].size || Boolean(metadata.hasAlpha) !== Boolean(checked.hasAlpha)) throw new Error(`Image bounds or transparency changed for ${path}`);
        entries[kind] = `/images/${name}`;
        records.push({ source: path, variant: kind, path: entries[kind], sourceBytes: source.length, bytes: prepared.bytes.length, sourceWidth: metadata.width, sourceHeight: metadata.height, width: checked.width, height: checked.height, format: prepared.ext });
      }
      results.set(path, entries);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  for (const watch of watches) if (watch.image) {
    const entries = results.get(watch.image);
    watch.image = entries.detail;
    watch.thumbnailImage = entries.thumbnail;
  }
  const referenced = new Set(watches.flatMap(w => [w.image, w.thumbnailImage]).filter(Boolean).map(path => path.slice('/images/'.length)));
  for (const file of readdirSync(images)) if (!referenced.has(file)) rmSync(join(images, file));
  records.sort((a, b) => a.source.localeCompare(b.source) || a.variant.localeCompare(b.variant));
  const report = { settings, sourceImageCount: sourcePaths.length, emittedImageCount: referenced.size, sourceBytes: records.filter(r => r.variant === 'detail').reduce((n, r) => n + r.sourceBytes, 0), emittedBytes: [...referenced].reduce((n, name) => n + readFileSync(join(images, name)).length, 0), records };
  writeFileSync(join(output, 'api', 'image-pipeline-report.json'), JSON.stringify(report));
  return report;
}
