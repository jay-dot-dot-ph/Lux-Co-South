import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:4173';
const origin = new URL(base).origin;
const output = process.argv[2] || '.cache/network-before.json';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function scenario(route, { mobile = false, warm = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const entries = [];
  const errors = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const requests = new Map();
  cdp.on('Network.requestWillBeSent', event => {
    const url = event.request.url;
    if (/^https?:/.test(url) && !url.startsWith(origin) && !/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com)\//.test(url)) errors.push(`Unexpected origin: ${url}`);
    if (/^https:\/\/lux-co-south\.web\.app\/(images|chat|api)\//.test(url)) errors.push(`Production request in local test: ${url}`);
    requests.set(event.requestId, { url, type: event.type, cached: false });
  });
  cdp.on('Network.requestServedFromCache', event => { if (requests.has(event.requestId)) requests.get(event.requestId).cached = true; });
  cdp.on('Network.loadingFinished', event => {
    const request = requests.get(event.requestId);
    if (request?.url.startsWith(origin)) entries.push({ ...request, bytes: request.cached ? 0 : event.encodedDataLength });
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => { if (request.url().startsWith(origin) && !request.url().endsWith('/firebase-config.json')) errors.push(`Failed: ${request.url()}`); });
  const visit = async () => {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.locator('.watch-card, .detail-photo').first().waitFor({ timeout: 20000 });
    if (route.startsWith('/watches')) {
      for (let i = 0; i < Math.min(24, await page.locator('.watch-card').count()); i++) await page.locator('.watch-card').nth(i).scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(900);
    await page.locator('img').evaluateAll(images => Promise.all(images.filter(image => image.getBoundingClientRect().top < innerHeight).map(image => image.decode().catch(() => {}))));
  };
  await visit();
  if (warm) { entries.length = 0; await visit(); }
  const badImages = await page.locator('img').evaluateAll(images => images.filter(image => image.complete && !image.naturalWidth).map(image => image.src));
  assert.deepEqual(badImages, [], 'Broken visible or loaded images');
  assert.deepEqual(errors, [], 'Browser network errors');
  const local = entries.filter(entry => entry.url.startsWith(origin));
  const sum = list => list.reduce((total, item) => total + item.bytes, 0);
  const result = { route, mobile, warm, bytes: sum(local), requests: local.length, imageBytes: sum(local.filter(item => item.type === 'Image')), imageRequests: local.filter(item => item.type === 'Image').length, jsCssBytes: sum(local.filter(item => /\.(?:js|css)(?:\?|$)/.test(item.url))), cacheHits: local.filter(item => item.cached).length };
  await context.close();
  return result;
}
try {
  const results = [];
  for (const route of ['/', '/watches/', '/watch/AP-W001/']) results.push(await scenario(route));
  results.push(await scenario('/watches/', { warm: true }));
  results.push(await scenario('/', { mobile: true }));
  results.push(await scenario('/watches/', { mobile: true }));
  mkdirSync(output.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
  writeFileSync(output, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
