import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHEET_ID, TABS, parseCsv, parseProducts, parseImagePage, slug } from './sheet.mjs';
import { extractWorkbookImages } from './xlsx-images.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const cache = join(root, '.cache', 'images');
const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
const origin = 'https://lux-co-south.web.app';

async function get(url, label, timeout = 60000) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'Mozilla/5.0 (compatible; LuxCoSouthCatalog/1.0)' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      last = error;
      if (attempt < 2) await new Promise(done => setTimeout(done, 500 * (attempt + 1)));
    }
  }
  throw new Error(`${label}: ${last?.message || 'download failed'}`);
}

async function pool(items, limit, task) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index], index); }
  }));
  return results;
}

const brandData = await pool(TABS, 4, async ([tab, gid, label]) => {
  const csv = await (await get(`${base}/export?format=csv&gid=${gid}`, `${tab} CSV`)).text();
  const watches = parseProducts(csv, tab, label);
  if (!watches.length) throw new Error(`${tab} had no valid watch rows`);
  let links = new Map();
  try {
    const html = await (await get(`${base}/edit?gid=${gid}`, `${tab} image page`)).text();
    links = parseImagePage(html);
  } catch (error) { console.warn(`Image page warning: ${error.message}`); }
  for (const watch of watches) watch.imageSource = links.get(watch.id) || watch.imageSource;
  console.log(`${label}: ${watches.length} watches; ${watches.filter(w => w.imageSource).length} image links`);
  return { tab, gid, label, watches, rows: parseCsv(csv) };
});

const watches = brandData.flatMap(brand => brand.watches);
let workbookImages = new Map();
const missingLinks = watches.filter(watch => !watch.imageSource);
if (missingLinks.length) {
  try {
    console.log(`Reading workbook photos for ${missingLinks.length} watches without public page links…`);
    const response = await get(`${base}/export?format=xlsx`, 'workbook images', 300000);
    const bytes = Buffer.from(await response.arrayBuffer());
    console.log(`Workbook export: ${(bytes.length / 1_000_000).toFixed(1)} MB.`);
    if (bytes.length > 750_000_000 || bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('invalid or oversized workbook');
    workbookImages = extractWorkbookImages(bytes, new Map(brandData.map(brand => [brand.tab, brand.rows])));
    console.log(`Found ${workbookImages.size} embedded workbook photos.`);
  } catch (error) { console.warn(`Workbook image warning: ${error.message}`); }
}
const ids = new Set();
for (const watch of watches) {
  if (ids.has(watch.id)) throw new Error(`Duplicate Watch ID: ${watch.id}`);
  ids.add(watch.id);
}

mkdirSync(cache, { recursive: true });
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'images'), { recursive: true });
mkdirSync(join(dist, 'api'), { recursive: true });

const imageWatches = watches.filter(watch => watch.imageSource || workbookImages.has(watch.id));
let saved = 0, missed = 0;
await pool(imageWatches, 8, async watch => {
  const embedded = !watch.imageSource && workbookImages.get(watch.id);
  if (embedded) {
    const file = `${watch.id}-${createHash('sha256').update(embedded.bytes).digest('hex').slice(0, 10)}.${embedded.extension}`;
    writeFileSync(join(dist, 'images', file), embedded.bytes);
    watch.image = `/images/${file}`;
    saved++;
    return;
  }
  const source = new URL(watch.imageSource);
  if (source.protocol !== 'https:' || !['docs.google.com', 'lh3.googleusercontent.com', 'drive.google.com'].includes(source.hostname)) {
    console.warn(`Unsupported image host for ${watch.id}: ${source.hostname}`); missed++; return;
  }
  const key = createHash('sha256').update(watch.imageSource).digest('hex').slice(0, 16);
  const cached = readdirSync(cache).find(name => name.startsWith(`${key}.`));
  let bytes, ext;
  try {
    if (cached) { bytes = readFileSync(join(cache, cached)); ext = cached.split('.').pop(); }
    else {
      const response = await get(watch.imageSource, `${watch.id} image`, 30000);
      const type = response.headers.get('content-type') || '';
      ext = type.includes('jpeg') ? 'jpg' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : null;
      bytes = Buffer.from(await response.arrayBuffer());
      if (!ext || bytes.length < 100 || bytes.length > 8_000_000) throw new Error('unsupported image');
      writeFileSync(join(cache, `${key}.${ext}`), bytes);
    }
    const file = `${watch.id}-${createHash('sha256').update(bytes).digest('hex').slice(0, 10)}.${ext}`;
    copyFileSync(join(cache, `${key}.${ext}`), join(dist, 'images', file));
    watch.image = `/images/${file}`;
    saved++;
  } catch (error) { console.warn(`Image unavailable for ${watch.id}: ${error.message}`); missed++; }
});

const brands = brandData.map(({ gid, label, watches: rows }) => ({ name: label, slug: slug(label), gid: String(gid), count: rows.length }));
const catalog = {
  source: base, fetchedAt: new Date().toISOString(),
  watches: watches.map(({ imageSource, ...watch }) => watch), brands
};
writeFileSync(join(dist, 'api', 'catalog.json'), JSON.stringify(catalog));
for (const file of ['app.js', 'styles.css', 'logo.jpg', 'favicon.svg']) copyFileSync(join(root, 'src', file), join(dist, file));
const assetVersion = createHash('sha256')
  .update(readFileSync(join(root, 'src', 'app.js')))
  .update(readFileSync(join(root, 'src', 'styles.css')))
  .digest('hex').slice(0, 12);
const template = readFileSync(join(root, 'src', 'index.html'), 'utf8')
  .replace('href="/styles.css"', `href="/styles.css?v=${assetVersion}"`)
  .replace('src="/app.js"', `src="/app.js?v=${assetVersion}"`);
const page = (path, title, description, image) => template
  .replaceAll('__TITLE__', title.replace(/[&<>"']/g, ''))
  .replaceAll('__DESCRIPTION__', description.replace(/[&<>"']/g, ''))
  .replaceAll('__CANONICAL__', origin + path)
  .replaceAll('__IMAGE_META__', image ? `<meta property="og:image" content="${origin + image}">` : '');
const writePage = (path, title, description, image) => {
  const folder = join(dist, path);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.html'), page('/' + path.replaceAll('\\', '/') + (path ? '/' : ''), title, description, image));
};
writeFileSync(join(dist, 'index.html'), page('/', 'Watch Collection South | Explore the watch collection', 'Explore watches by brand, style and price. Save favorites and inquire directly.', '/logo.jpg'));
for (const path of ['watches', 'brands', 'favorites', 'contact']) writePage(path, `${path[0].toUpperCase() + path.slice(1)} | Lux Co South`, 'Explore the Lux Co South watch collection.');
for (const brand of brands) writePage(`watches/${brand.slug}`, `${brand.name} watches | Lux Co South`, `Explore ${brand.name} watches at Lux Co South.`);
for (const watch of watches) writePage(`watch/${watch.id}`, `${watch.brand} ${watch.model} | Lux Co South`, `View ${watch.brand} ${watch.model}, Watch ID ${watch.id}, and inquire with Lux Co South.`, watch.image);
writeFileSync(join(dist, '404.html'), page('/', 'Page not found | Lux Co South', 'Browse the Lux Co South watch collection.'));
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
const paths = ['/', '/watches/', '/brands/', '/favorites/', '/contact/', ...brands.map(b => `/watches/${b.slug}/`), ...watches.map(w => `/watch/${w.id}/`)];
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${origin + path}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${watches.length} watches, ${brands.length} brands, ${saved} images; ${missed} image downloads unavailable.`);
