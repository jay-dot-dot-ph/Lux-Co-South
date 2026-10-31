import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.xml':'application/xml', '.txt':'text/plain' };
const port = Number(process.env.LUX_PORT || 4173);
createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  let file = resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { response.writeHead(404).end(); return; }
  const cache = pathname.startsWith('/images/') ? 'public, max-age=31536000, immutable'
    : /\.[a-f0-9]{12}\.(?:js|css)$/.test(pathname) ? 'public, max-age=31536000, immutable'
    : pathname === '/api/catalog.json' || pathname.endsWith('.html') || pathname.endsWith('/') ? 'public, max-age=60'
    : /\.(?:js|css)$/.test(pathname) ? 'public, max-age=300' : 'public, max-age=3600';
  response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': cache });
  response.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
