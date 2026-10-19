import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseProducts } from './sheet.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const catalog = JSON.parse(readFileSync(join(dist, 'api', 'catalog.json'), 'utf8'));
assert.equal(catalog.brands.length, 23, 'Expected all 23 brand tabs');
assert(catalog.watches.length > 100, 'Catalog appears incomplete');
assert.equal(catalog.brands.reduce((sum, brand) => sum + brand.count, 0), catalog.watches.length, 'Brand counts differ from products');
assert.equal(new Set(catalog.watches.map(w => w.id)).size, catalog.watches.length, 'Duplicate Watch IDs');
assert(existsSync(join(dist, 'index.html')) && existsSync(join(dist, 'app.js')) && existsSync(join(dist, 'styles.css')));
assert(existsSync(join(dist, 'logo.jpg')), 'Brand logo missing from build');
assert(readFileSync(join(dist, 'index.html'), 'utf8').includes('href="/styles.css"'), 'Design stylesheet missing from pages');
for (const brand of catalog.brands) assert(existsSync(join(dist, 'watches', brand.slug, 'index.html')), `Missing ${brand.name} route`);
for (const watch of catalog.watches) {
  assert(existsSync(join(dist, 'watch', watch.id, 'index.html')), `Missing ${watch.id} route`);
  if (watch.image) assert(existsSync(join(dist, watch.image.replace(/^\//, ''))), `Missing ${watch.id} image`);
}
const fixture = 'notice,,,,\nImage,Watch ID,Brand,Model Name,Price (PHP),Stock Quantity\n,ABC-1,Test,"Quoted, model","1,250",0\n';
const parsed = parseProducts(fixture, 'TEST', 'Test');
assert.equal(parsed[0].model, 'Quoted, model');
assert.equal(parsed[0].price, 1250);
assert.equal(parsed[0].stock, 0);
console.log(`Validated ${catalog.watches.length} watches, ${catalog.brands.length} brands, ${catalog.watches.filter(w => w.image).length} local images and all routes.`);
