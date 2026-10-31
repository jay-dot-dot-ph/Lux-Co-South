import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const backgrounds = ['hero-watch.png', 'collection-banner.png', 'marble-background.png'];
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const replacePath = (html, oldPath, newPath) => {
  const split = oldPath.lastIndexOf('.');
  const expression = `(["'])${escaped(oldPath.slice(0, split))}(?:\\.[a-f0-9]{12})?${escaped(oldPath.slice(split))}(?:\\?v=[a-f0-9]{12})?\\1`;
  return html.replaceAll(new RegExp(expression, 'g'), (whole, quote) => `${quote}${newPath}${quote}`);
};
function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? htmlFiles(join(directory, entry.name)) : entry.name.endsWith('.html') ? [join(directory, entry.name)] : []);
}

export async function prepareAssets(root, output, rewriteExisting = false) {
  const src = join(root, 'src');
  const chat = join(output, 'chat');
  mkdirSync(chat, { recursive: true });
  mkdirSync(join(output, 'admin'), { recursive: true });
  copyFileSync(join(src, 'logo.jpg'), join(output, 'logo.jpg'));
  copyFileSync(join(src, 'favicon.svg'), join(output, 'favicon.svg'));
  const staticCache = join(root, '.cache', 'optimized-static');
  mkdirSync(staticCache, { recursive: true });
  const staticPaths = {};
  for (const file of [...backgrounds, 'logo.jpg']) {
    const source = readFileSync(join(src, file));
    const cacheFile = join(staticCache, `${hash(Buffer.concat([source, Buffer.from('webp-q85-v1')]))}.webp`);
    const compressed = existsSync(cacheFile) ? readFileSync(cacheFile)
      : await sharp(source).resize({ width: file === 'logo.jpg' ? 320 : 2200, withoutEnlargement: true }).webp({ quality: 85, effort: 5 }).toBuffer();
    if (!existsSync(cacheFile)) writeFileSync(cacheFile, compressed);
    const chosen = compressed.length < source.length ? compressed : source;
    const extension = chosen === compressed ? 'webp' : file.split('.').pop();
    const name = `${file.slice(0, file.lastIndexOf('.'))}.${hash(chosen)}.${extension}`;
    writeFileSync(join(output, name), chosen);
    staticPaths[`/${file}`] = `/${name}`;
  }
  copyFileSync(join(src, 'chat', 'firebase.js'), join(chat, 'firebase.js'));
  const customer = readFileSync(join(src, 'chat', 'customer.js'));
  const customerPath = `/chat/customer.${hash(customer)}.js`;
  writeFileSync(join(output, customerPath.slice(1)), customer);
  const admin = readFileSync(join(src, 'chat', 'admin.js'));
  const adminPath = `/chat/admin.${hash(admin)}.js`;
  writeFileSync(join(output, adminPath.slice(1)), admin);
  const app = readFileSync(join(src, 'app.js'), 'utf8').replaceAll("'/chat/customer.js'", `'${customerPath}'`).replaceAll('/logo.jpg', staticPaths['/logo.jpg']);
  const appPath = `/app.${hash(app)}.js`;
  writeFileSync(join(output, appPath.slice(1)), app);
  const paths = { '/app.js': appPath, '/chat/admin.js': adminPath, '/chat/customer.js': customerPath };
  for (const file of ['styles.css', 'chat.css', 'admin.css']) {
    let css = readFileSync(join(src, file), 'utf8');
    for (const [from, to] of Object.entries(staticPaths)) css = css.replaceAll(from, to);
    const bytes = Buffer.from(css);
    const name = file.replace(/\.css$/, `.${hash(bytes)}.css`);
    paths[`/${file}`] = `/${name}`;
    writeFileSync(join(output, name), bytes);
  }
  const rewrite = html => Object.entries(paths).reduce((value, [oldPath, newPath]) => replacePath(value, oldPath, newPath), html)
    .replaceAll('src="/logo.jpg"', `src="${staticPaths['/logo.jpg']}"`);
  if (rewriteExisting) for (const file of htmlFiles(output)) writeFileSync(file, rewrite(readFileSync(file, 'utf8')));
  writeFileSync(join(output, 'admin', 'index.html'), rewrite(readFileSync(join(src, 'admin', 'index.html'), 'utf8')));
  for (const file of readdirSync(output)) if (/^(?:app|styles|chat|admin)(?:\.[a-f0-9]{12})?\.(?:js|css)$/.test(file) && !Object.values(paths).some(path => path.slice(1) === file)) rmSync(join(output, file));
  for (const file of readdirSync(chat)) if (/^(?:admin|customer)(?:\.[a-f0-9]{12})?\.js$/.test(file) && !Object.values(paths).some(path => path.slice('/chat/'.length) === file)) rmSync(join(chat, file));
  for (const file of readdirSync(output)) if (/^(?:hero-watch|collection-banner|marble-background|logo)(?:\.[a-f0-9]{12})?\.(?:png|jpg|webp)$/.test(file) && file !== 'logo.jpg' && !Object.values(staticPaths).some(path => path.slice(1) === file)) rmSync(join(output, file));
  return { paths, rewrite };
}
