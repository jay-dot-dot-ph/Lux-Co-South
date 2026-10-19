export const SHEET_ID = '1qowXiNelPflvWPYv1lWWCf7z9AnltCL5Tem8Sus-arI';
export const TABS = [
  ['AP', 1994018057, 'Audemars Piguet'], ['BVLGARI', 153669170, 'Bvlgari'],
  ['CARTIER', 327287243, 'Cartier'], ['CHARRIOL', 976443302, 'Charriol'],
  ['COACH', 1611498834, 'Coach'], ['FOSSIL', 949872863, 'Fossil'],
  ['HUBLOT', 1825202400, 'Hublot'], ['INVICTA', 1839212129, 'Invicta'],
  ['MARCJACOBS', 1217338794, 'Marc Jacobs'], ['MK', 35068659, 'Michael Kors'],
  ['MS', 535083943, 'MoonSwatch'], ['OMEGA', 1895499623, 'Omega'],
  ['PANERAI', 867802356, 'Panerai'], ['PATEK', 742602860, 'Patek Philippe'],
  ['PS', 914894785, 'Philip Stein'], ['RADO', 705980892, 'Rado'],
  ['SEIKO', 324325008, 'Seiko'], ['TAG', 1894959040, 'TAG Heuer'],
  ['TISSOT', 1920786190, 'Tissot'], ['ROLEX', 2073039252, 'Rolex'],
  ['Super clone Rolex', 311075382, 'Super clone Rolex'],
  ['RM HIGHGRADE', 1859297103, 'Richard Mille Highgrade'],
  ['VACHERON', 1215005135, 'Vacheron Constantin']
];
export const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseCsv(input) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function parseProducts(csv, tab, label) {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex(row => row.some(value => value.trim().toLowerCase() === 'watch id') && row.some(value => value.trim().toLowerCase() === 'model name'));
  if (headerIndex < 0) throw new Error(`${tab} has no watch header row`);
  const headers = new Map(rows[headerIndex].map((value, index) => [value.trim().toLowerCase(), index]));
  for (const required of ['watch id', 'model name', 'price (php)', 'stock quantity']) {
    if (!headers.has(required)) throw new Error(`${tab} is missing ${required}`);
  }
  const cell = (row, name) => String(row[headers.get(name)] ?? '').trim();
  const watches = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const id = cell(row, 'watch id').toUpperCase();
    const model = cell(row, 'model name');
    if (!/^[A-Z0-9-]{2,24}$/.test(id) || !model) continue;
    const priceText = cell(row, 'price (php)').replace(/[^\d.]/g, '');
    const stockText = cell(row, 'stock quantity');
    const suppliedImage = cell(row, 'image url');
    watches.push({
      id, brand: label, brandSlug: slug(label), tab, model,
      size: cell(row, 'size'), category: cell(row, 'category'),
      dialColor: cell(row, 'dial color'), caseMaterial: cell(row, 'case material'),
      strapMaterial: cell(row, 'strap material'), movement: cell(row, 'movement type'),
      price: priceText && Number.isFinite(Number(priceText)) ? Number(priceText) : null,
      stock: /^\d+$/.test(stockText) ? Number(stockText) : null,
      description: cell(row, 'description'), dateAdded: cell(row, 'date added'),
      imageSource: /^https:\/\//i.test(suppliedImage) ? suppliedImage : null,
      image: null
    });
  }
  return watches;
}

export function parseImagePage(html) {
  const result = new Map();
  for (const [row] of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
    const id = cells[1]?.[1]?.replace(/<[^>]+>/g, '').trim().toUpperCase();
    const source = row.match(/<img\s+src="(https:\/\/docs\.google\.com\/sheets-images-rt\/[^"]+)"/i)?.[1];
    if (/^[A-Z0-9-]{2,24}$/.test(id || '') && source) {
      result.set(id, source.replaceAll('&amp;', '&').replace(/=w\d+-h\d+$/, '=w900-h900'));
    }
  }
  return result;
}
