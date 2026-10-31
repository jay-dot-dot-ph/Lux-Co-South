import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SHEET_ID, TABS, parseProducts } from './sheet.mjs';

const origin = process.env.SITE_ORIGIN || 'https://lux-co-south.web.app';
const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
const snapshot = resolve(import.meta.dirname, '..', '.cache', 'sheet-snapshot');
const get = async (url) => {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response;
};

const mode = process.argv[2] || 'source';
if (!['source', 'artifact'].includes(mode)) throw new Error('Use source or artifact mode.');
let changed;
let unavailable = false;
if (mode === 'source') {
  const live = await (await get(`${origin}/api/catalog.json?sync-check=${Date.now()}`)).json();
  const csvs = new Array(TABS.length);
  let next = 0;
  try {
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < TABS.length) {
        const index = next++;
        const [tab, gid, label] = TABS[index];
        let csv, last;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            csv = await (await get(`${base}/export?format=csv&gid=${gid}`)).text();
            parseProducts(csv, tab, label);
            last = null;
            break;
          } catch (error) {
            last = error;
            if (attempt < 2) await new Promise(done => setTimeout(done, 1000 * (attempt + 1)));
          }
        }
        if (last) throw last;
        csvs[index] = [gid, csv];
      }
    }));
    const fingerprint = createHash('sha256');
    for (const [gid, csv] of csvs) fingerprint.update(`${gid}\n${csv}\n`);
    changed = ['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME) || fingerprint.digest('hex') !== live.sourceFingerprint;
    if (changed) {
      mkdirSync(snapshot, { recursive: true });
      for (const [gid, csv] of csvs) writeFileSync(join(snapshot, `${gid}.csv`), csv);
    }
  } catch (error) {
    changed = false;
    unavailable = true;
    console.warn(`Sheet export unavailable; keeping the live catalog: ${error.message}`);
  }
} else {
  const built = JSON.parse(readFileSync('dist/api/site-fingerprint.json', 'utf8'));
  const response = await fetch(`${origin}/api/site-fingerprint.json?sync-check=${Date.now()}`, {
    cache: 'no-store', signal: AbortSignal.timeout(45000),
  });
  if (response.status === 404) changed = true;
  else {
    if (!response.ok) throw new Error(`Live site fingerprint returned HTTP ${response.status}`);
    const live = await response.json();
    changed = built.fingerprint !== live.fingerprint;
  }
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
if (process.env.GITHUB_STEP_SUMMARY && unavailable) appendFileSync(process.env.GITHUB_STEP_SUMMARY, 'Sheet export was incomplete. Catalog refresh skipped; the live site was preserved.\n');
console.log(unavailable ? 'Sheet source check skipped.' : `${mode === 'source' ? 'Sheet source' : 'Built site'} ${changed ? 'changed.' : 'unchanged.'}`);
