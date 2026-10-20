import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { SHEET_ID, TABS } from './sheet.mjs';

const origin = process.env.SITE_ORIGIN || 'https://lux-co-south.web.app';
const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
const get = async (url) => {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response;
};

const mode = process.argv[2] || 'source';
if (!['source', 'artifact'].includes(mode)) throw new Error('Use source or artifact mode.');
let changed;
if (mode === 'source') {
  const live = await (await get(`${origin}/api/catalog.json?sync-check=${Date.now()}`)).json();
  const csvs = new Array(TABS.length);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < TABS.length) {
      const index = next++;
      const [, gid] = TABS[index];
      const csv = await (await get(`${base}/export?format=csv&gid=${gid}`)).text();
      if (!csv.includes('Watch ID') || !csv.includes('Model Name')) throw new Error(`Sheet tab ${gid} has no watch catalog header`);
      csvs[index] = [gid, csv];
    }
  }));
  const fingerprint = createHash('sha256');
  for (const [gid, csv] of csvs) fingerprint.update(`${gid}\n${csv}\n`);
  changed = fingerprint.digest('hex') !== live.sourceFingerprint;
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
console.log(`${mode === 'source' ? 'Sheet source' : 'Built site'} ${changed ? 'changed.' : 'unchanged.'}`);
