const app = document.getElementById('app');
const CONTACT = {
  facebook: 'https://www.facebook.com/GracefulGifts.Manila',
  messenger: 'https://m.me/GracefulGifts.Manila',
  phone: '+639755996605',
  displayPhone: '0975 599 6605',
  viber: 'viber://chat?number=%2B639755996605',
  map: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=14.6084144%2C120.9940068&heading=231.21&pitch=-2.39&fov=75'
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = value => value == null ? 'Price on request' : '₱' + Number(value).toLocaleString('en-PH');
const stock = watch => watch.stock === 0 ? 'Sold out' : watch.stock == null ? 'Availability on request' : watch.stock === 1 ? '1 available' : `${watch.stock} available`;
const name = watch => watch.model.toLowerCase().startsWith(watch.brand.toLowerCase() + ' ') ? watch.model : `${watch.brand} ${watch.model}`;
const path = decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/';
const link = watch => `/watch/${encodeURIComponent(watch.id)}/`;
const brandLink = brand => `/watches/${encodeURIComponent(brand.slug)}/`;

let catalog;
let favorites = new Set();
let selection = new Set();
let quickViewReturnFocus = null;
let overlayReturnFocus = null;
let compare = new Set();
let catalogView = 'grid';
let shown = 24;
let filters = {
  query: new URLSearchParams(location.search).get('q') || '',
  brand: '', size: '', dial: '', movement: '', category: '', strap: '',
  availability: '', min: '', max: '', sort: 'newest'
};
try { favorites = new Set(JSON.parse(localStorage.getItem('lux-favorites') || '[]')); } catch {}
try { compare = new Set(JSON.parse(sessionStorage.getItem('lux-compare') || '[]')); } catch {}
try { catalogView = localStorage.getItem('lux-view') === 'list' ? 'list' : 'grid'; } catch {}

const icon = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 5 5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 4.6a5.5 5.5 0 0 0-7.8 0l-.6.6-.6-.6a5.5 5.5 0 0 0-7.8 7.8L12 21l8.4-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M7 12h10m-7 5h4"/><circle cx="8" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 15.7A8.6 8.6 0 0 1 8.3 3.6 8.6 8.6 0 1 0 20.4 15.7Z"/></svg>',
  message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 10h8m-8 3h5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>'
};

function themeButton() {
  const light = document.documentElement.dataset.theme === 'light';
  return `<button class="icon-link theme-toggle" type="button" data-theme-toggle aria-label="Switch to ${light ? 'dark' : 'light'} mode" title="Switch to ${light ? 'dark' : 'light'} mode">${light ? icon.moon : icon.sun}</button>`;
}

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f8f5ef' : '#090807');
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    button.innerHTML = theme === 'light' ? icon.moon : icon.sun;
    button.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
    button.title = `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`;
  });
  if (persist) try { localStorage.setItem('lux-theme', theme); } catch {}
}

function image(watch, { eager = false } = {}) {
  return watch?.image
    ? `<img src="${esc(watch.image)}" alt="${esc(name(watch))}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`
    : '<div class="watch-placeholder"><img src="/logo.jpg" alt=""><span>Photography coming soon</span></div>';
}

function brand() {
  return '<a class="brand-lockup" href="/" aria-label="Watch Collection South home"><img src="/logo.jpg" alt="" width="64" height="64"><span><strong>WATCH COLLECTION</strong><em>SOUTH</em></span></a>';
}

function header(active = '') {
  const links = [['/', 'Home'], ['/watches/', 'Collection'], ['/brands/', 'Brands'], ['/#about', 'About'], ['/contact/', 'Contact']];
  const nav = links.map(([href, label]) => `<a href="${href}" ${active === label ? 'aria-current="page"' : ''}>${label}${label === 'Saved' ? `<span class="nav-count">${favorites.size || ''}</span>` : ''}</a>`).join('');
  return `<header class="site-header"><div class="wrap header-inner">${brand()}
    <nav class="desktop-nav" aria-label="Main navigation">${nav}</nav>
    <div class="header-actions">
      <button class="header-search" type="button" data-open-search><span>Search watches...</span>${icon.search}</button>
      ${themeButton()}
      <a class="icon-link saved-link" href="/favorites/" aria-label="Saved watches">${icon.heart}<span class="saved-count">${favorites.size || ''}</span></a>
      <button class="menu-button" type="button" data-menu aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu"><span></span><span></span></button>
    </div>
  </div><nav id="mobile-menu" class="mobile-menu" aria-label="Mobile navigation" hidden>
    <div class="mobile-menu-top"><span>THE COLLECTION</span><button type="button" data-menu aria-label="Close menu">${icon.close}</button></div>
    ${nav}<a class="mobile-menu-contact" href="${CONTACT.messenger}" target="_blank" rel="noopener">Inquire on Messenger ${icon.arrow}</a>
  </nav></header><nav class="bottom-nav" aria-label="Quick navigation"><a href="/" ${active === 'Home' ? 'aria-current="page"' : ''}>⌂<span>Home</span></a><a href="/watches/" ${active === 'Collection' ? 'aria-current="page"' : ''}>${icon.grid}<span>Watches</span></a><a href="/favorites/" ${active === 'Saved' ? 'aria-current="page"' : ''}>${icon.heart}<span>Saved</span></a><button type="button" data-open-search>${icon.search}<span>Search</span></button></nav>`;
}

function footer() {
  return `<footer class="site-footer"><div class="wrap footer-top">
    <div class="footer-intro">${brand()}<p>Watches curated in Manila.</p><a href="/watches/" class="text-link">Browse watches ${icon.arrow}</a></div>
    <div class="footer-column"><h3>Explore</h3><a href="/watches/">All watches</a><a href="/brands/">Brands</a><a href="/favorites/">Your saved pieces</a></div>
    <div class="footer-column"><h3>Connect</h3><a href="${CONTACT.messenger}" target="_blank" rel="noopener">Messenger</a><a href="${CONTACT.facebook}" target="_blank" rel="noopener">Facebook</a><a href="tel:${CONTACT.phone}">${CONTACT.displayPhone}</a></div>
    <div class="footer-column"><h3>Visit us</h3><p>Forbes Commercial<br>Sampaloc, Manila</p><a href="${CONTACT.map}" target="_blank" rel="noopener">Get directions ${icon.arrow}</a></div>
  </div><div class="wrap footer-bottom"><span>© ${new Date().getFullYear()} Watch Collection South</span><span>Prices and availability are subject to confirmation.</span></div></footer>
  <a class="chat-float" href="${CONTACT.messenger}" target="_blank" rel="noopener" aria-label="Chat on Messenger"><span>MESSAGE US</span>${icon.arrow}</a><div id="compare-dock"></div>`;
}

function card(watch) {
  const saved = favorites.has(watch.id);
  return `<article class="watch-card">
    <div class="card-photo"><a href="${link(watch)}" aria-label="View ${esc(name(watch))}">${image(watch)}</a>
      <button class="heart-button ${saved ? 'is-saved' : ''}" type="button" data-favorite="${esc(watch.id)}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(name(watch))} ${saved ? 'from' : 'to'} favorites" aria-pressed="${saved}">${icon.heart}</button>
      ${watch.stock === 0 ? '<span class="stock-badge">SOLD OUT</span>' : ''}
      <button class="card-view" type="button" data-quick-view="${esc(watch.id)}" aria-label="Quick view ${esc(name(watch))}">QUICK VIEW ${icon.arrow}</button>
    </div>
    <div class="card-body"><p class="card-brand">${esc(watch.brand)}</p><h3><a href="${link(watch)}">${esc(watch.model)}</a></h3>
      <p class="card-spec">${esc([watch.movement, watch.size].filter(Boolean).join(' · ') || watch.id)}</p>
      <div class="card-bottom"><div><strong>${money(watch.price)}</strong><span class="${watch.stock === 0 ? 'unavailable' : ''}">${stock(watch)}</span></div><button class="card-inquire" type="button" data-inquire="${esc(watch.id)}" aria-label="Inquire about ${esc(name(watch))}" title="Inquire">${icon.message}</button></div>
      <button class="compare-add ${compare.has(watch.id) ? 'is-compared' : ''}" type="button" data-compare="${esc(watch.id)}" aria-pressed="${compare.has(watch.id)}">${compare.has(watch.id) ? '✓ Added to compare' : '+ Compare'}</button>
    </div>
  </article>`;
}

function sectionHead(number, eyebrow, title, href, label = 'View all') {
  return `<div class="section-head"><div><span class="section-index">${number}</span><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${href ? `<a class="text-link" href="${href}">${label} ${icon.arrow}</a>` : ''}</div>`;
}

function pageIntro(eyebrow, title, description, detail = '') {
  return `<section class="page-intro"><div class="wrap page-intro-inner"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>${detail ? `<span class="page-intro-detail">${detail}</span>` : ''}</div></section>`;
}

function home() {
  const featureBrands = ['Cartier', 'Rolex', 'Audemars Piguet', 'Patek Philippe', 'Omega', 'TAG Heuer', 'Vacheron Constantin', 'Seiko'];
  const preview = featureBrands.map(brand => catalog.watches.find(watch => watch.brand === brand && watch.image && watch.stock !== 0)).filter(Boolean);
  for (const watch of catalog.watches) {
    if (preview.length >= 8) break;
    if (watch.image && !preview.some(item => item.id === watch.id)) preview.push(watch);
  }
  const featuredBrands = [...catalog.brands].sort((a, b) => b.count - a.count).slice(0, 6);
  app.innerHTML = header('Home') + `<main>
    <section class="hero"><div class="wrap hero-layout">
      <div class="hero-copy"><p class="eyebrow">TIMELESS STYLE</p>
        <h1>Inspired By<br><em>Love and<br>Elegance</em></h1>
        <p class="hero-description">A curated collection of timepieces for everyday elegance.</p>
        <div class="hero-buttons"><a class="button button-primary" href="/watches/">EXPLORE COLLECTION ${icon.arrow}</a></div>
        <div class="hero-promises"><span>✧ <small>CURATED<br>SELECTION</small></span><span>◇ <small>INSPECT BEFORE<br>PAYING</small></span><span>⇢ <small>NATIONWIDE<br>DELIVERY</small></span></div>
      </div>
      <div class="hero-art"><div class="hero-mark"><img src="/logo.jpg" alt="Watch Collection South"></div></div>
    </div>
      <div class="hero-bottom"><div class="wrap"><span>${catalog.watches.length.toLocaleString()} WATCHES <i></i> ${catalog.brands.length} BRANDS</span></div></div>
    </section>
    <section class="home-brands section-pad"><div class="wrap">${sectionHead('01', 'BRANDS', 'Shop by brand.', '/brands/', 'All brands')}
      <div class="brand-feature-grid">${featuredBrands.map((brand, index) => `<a class="brand-feature" href="${brandLink(brand)}"><span class="brand-feature-top"><small>${String(index + 1).padStart(2, '0')}</small><span>${icon.arrow}</span></span><strong>${esc(brand.name)}</strong><span class="brand-feature-count">${brand.count} WATCHES</span></a>`).join('')}</div>
    </div></section>
    <section class="home-featured section-pad"><div class="wrap">${sectionHead('02', 'FEATURED', 'Explore the collection.', '/watches/', 'View all')}
      <div class="watch-grid">${preview.map(card).join('')}<a class="collection-tile" href="/watches/"><span>THE FULL COLLECTION</span><strong>Find your next<br><em>favorite.</em></strong><small>EXPLORE ALL ${catalog.watches.length} WATCHES ${icon.arrow}</small></a></div>
    </div></section>
    <section class="visit-section" id="about"><div class="wrap visit-grid">
      <div><p class="eyebrow">VISIT US</p><h2>See it<br><em>in person.</em></h2><p>Forbes Commercial, Sampaloc, Manila. Ask us to confirm availability before visiting.</p>
        <a class="button button-primary" href="${CONTACT.map}" target="_blank" rel="noopener">GET DIRECTIONS ${icon.arrow}</a></div>
      <div class="visit-card"><span class="visit-card-top">WATCH COLLECTION SOUTH <span>✧</span> MANILA</span><img src="/logo.jpg" alt="" loading="lazy"><strong>Forbes Commercial<br>Sampaloc, Manila</strong><a href="tel:${CONTACT.phone}">${CONTACT.displayPhone}</a></div>
    </div></section>
  </main>` + footer();
}

const options = (values, label) => `<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
function filterPanel() {
  const ceiling = Math.ceil(Math.max(...catalog.watches.map(watch => watch.price || 0)) / 1000) * 1000;
  const categories = ['CHRONOGRAPH', 'DRESS', 'DIVER', 'SKELETON'];
  const colors = [['Black', '#121212'], ['White', '#f4eee5'], ['Blue', '#244d86'], ['Green', '#1d6846'], ['Gold', '#bd8b48'], ['Pink', '#d99aa0']];
  const choice = (key, value, label) => `<button class="filter-choice ${filters[key] === value ? 'selected' : ''}" type="button" data-filter-choice="${key}" data-value="${esc(value)}" aria-pressed="${filters[key] === value}"><span class="choice-box" aria-hidden="true"></span>${label}</button>`;
  return `<div class="filter-heading"><h2>FILTERS</h2><button type="button" data-clear>Clear all</button><button class="filter-close" type="button" data-close-filters aria-label="Close filters">${icon.close}</button></div>
    <details class="filter-section" open><summary>Style</summary><div class="filter-choices">${categories.map(value => choice('category', value, value[0] + value.slice(1).toLowerCase())).join('')}</div></details>
    <details class="filter-section" open><summary>Price range</summary><div class="price-range"><input type="range" data-price-range min="0" max="${ceiling}" step="500" value="${filters.max || ceiling}" aria-label="Maximum price"><div><span>₱0</span><output id="price-max-label">${filters.max ? money(filters.max) : money(ceiling) + '+'}</output></div><label class="price-min">From <input type="number" data-filter="min" min="0" placeholder="Any amount" value="${esc(filters.min)}"></label></div></details>
    <details class="filter-section" open><summary>Dial color</summary><div class="dial-swatches">${colors.map(([color, hex]) => `<button type="button" class="dial-swatch ${filters.dial === color ? 'selected' : ''}" data-filter-choice="dial" data-value="${color}" aria-label="${color} dial" aria-pressed="${filters.dial === color}" title="${color}"><span style="background:${hex}"></span></button>`).join('')}</div><span class="swatch-name">${filters.dial || 'Any color'}</span></details>
    <details class="filter-section" open><summary>Strap type</summary><div class="filter-choices">${['Stainless Steel', 'Leather', 'Rubber', 'Other'].map(value => choice('strap', value, value)).join('')}</div></details>
    <details class="filter-section"><summary>More filters</summary><div class="filter-more"><div class="filter-group"><label for="filter-brand">Brand</label><select id="filter-brand" data-filter="brand">${options(catalog.brands.map(brand => brand.name), 'All brands')}</select></div><div class="filter-group"><label for="filter-size">Size</label><select id="filter-size" data-filter="size">${options(catalog.watches.map(watch => watch.size), 'Any size')}</select></div><div class="filter-group"><label for="filter-movement">Movement</label><select id="filter-movement" data-filter="movement">${options(catalog.watches.map(watch => watch.movement), 'Any movement')}</select></div><div class="filter-group"><label for="filter-availability">Availability</label><select id="filter-availability" data-filter="availability"><option value="">All watches</option><option value="available">Available</option><option value="soldout">Sold out</option></select></div></div></details>`;
}

function catalogPage() {
  const brand = catalog.brands.find(item => path === `/watches/${item.slug}`);
  if (brand) filters.brand = brand.name;
  app.innerHTML = header('Collection') + `<main>
    <section class="collection-banner"><div class="wrap"><p class="eyebrow">WATCH COLLECTION SOUTH</p><h1>${brand ? esc(brand.name) : 'OUR COLLECTION'}</h1><p>Discover timepieces that match your style.</p></div></section>
    <section class="catalog-section"><div class="wrap catalog-layout">
      <aside class="filter-panel" id="filter-panel" aria-label="Catalog filters">${filterPanel()}</aside>
      <div class="catalog-content"><div class="catalog-toolbar">
        <span class="toolbar-count" id="result-count"></span>
        <label class="sort-box"><span>SORT BY</span><select id="sort"><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="brand">Brand: A–Z</option></select>${icon.chevron}</label>
        <div class="view-switch" role="group" aria-label="Catalog view"><button type="button" data-view="grid" aria-label="Grid view" aria-pressed="${catalogView === 'grid'}">${icon.grid}</button><button type="button" data-view="list" aria-label="List view" aria-pressed="${catalogView === 'list'}">${icon.list}</button></div>
        <button class="filter-trigger" type="button" data-open-filters aria-controls="filter-panel" aria-expanded="false">${icon.filter} FILTERS</button>
      </div><div class="active-filters" id="active-filters" aria-label="Active filters"></div><div id="results"></div></div>
    </div></section>
  </main><button class="filter-overlay" type="button" data-close-filters aria-label="Close filters" hidden></button>` + footer();
  document.getElementById('sort').value = filters.sort;
  document.querySelectorAll('[data-filter]').forEach(element => {
    element.value = filters[element.dataset.filter] || '';
    element.addEventListener('input', () => { filters[element.dataset.filter] = element.value; shown = 24; renderResults(); });
  });
  document.querySelector('[data-price-range]').addEventListener('input', event => {
    filters.max = Number(event.target.value) >= Number(event.target.max) ? '' : event.target.value;
    document.getElementById('price-max-label').textContent = filters.max ? money(filters.max) : money(event.target.max) + '+';
    shown = 24;
    renderResults();
  });
  document.getElementById('sort').addEventListener('change', event => { filters.sort = event.target.value; renderResults(); });
  renderResults();
  updateCompareUI();
}

function renderResults() {
  const query = filters.query.trim().toLowerCase();
  const rows = catalog.watches.filter(watch =>
    (!query || [watch.brand, watch.model, watch.id, watch.description].join(' ').toLowerCase().includes(query))
    && (!filters.brand || watch.brand === filters.brand)
    && (!filters.size || watch.size === filters.size)
    && (!filters.dial || (watch.dialColor || '').toLowerCase().includes(filters.dial.toLowerCase()))
    && (!filters.movement || watch.movement === filters.movement)
    && (!filters.category || watch.category === filters.category)
    && (!filters.strap || (filters.strap === 'Other'
      ? Boolean(watch.strapMaterial) && !/steel|leather|rubber/i.test(watch.strapMaterial)
      : (watch.strapMaterial || '').toLowerCase().includes(filters.strap.toLowerCase())))
    && (!filters.availability || (filters.availability === 'soldout' ? watch.stock === 0 : watch.stock !== 0))
    && (!filters.min || (watch.price != null && watch.price >= Number(filters.min)))
    && (!filters.max || (watch.price != null && watch.price <= Number(filters.max)))
  );
  if (filters.sort === 'price-asc') rows.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  else if (filters.sort === 'price-desc') rows.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  else if (filters.sort === 'brand') rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  else rows.sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
  document.getElementById('result-count').textContent = `Showing ${Math.min(shown, rows.length)} of ${rows.length.toLocaleString()} watches`;
  document.querySelectorAll('[data-filter-choice]').forEach(button => {
    const selected = filters[button.dataset.filterChoice] === button.dataset.value;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const swatchName = document.querySelector('.swatch-name');
  if (swatchName) swatchName.textContent = filters.dial || 'Any color';
  const filterNames = { query: 'Search', brand: 'Brand', size: 'Size', dial: 'Dial', movement: 'Movement', category: 'Style', strap: 'Strap', availability: 'Stock', min: 'From', max: 'To' };
  const active = Object.entries(filterNames).filter(([key]) => filters[key]);
  document.getElementById('active-filters').innerHTML = active.map(([key, label]) =>
    `<button type="button" class="filter-chip" data-remove-filter="${key}" aria-label="Remove ${label.toLowerCase()} filter">${label}: ${esc(key === 'min' || key === 'max' ? money(filters[key]) : filters[key])} ${icon.close}</button>`
  ).join('');
  document.getElementById('results').innerHTML = rows.length
    ? `<div class="watch-grid ${catalogView === 'list' ? 'list-view' : ''}">${rows.slice(0, shown).map(card).join('')}</div>${rows.length > shown ? `<div class="load-more"><span>${Math.min(shown, rows.length)} OF ${rows.length}</span><button class="button button-outline" type="button" data-more>SHOW MORE ${icon.arrow}</button></div>` : ''}`
    : `<div class="empty-state"><span class="empty-symbol">✧</span><p class="eyebrow">NO MATCHES FOUND</p><h2>Nothing in this edit—yet.</h2><p>Try another search or start again with all watches.</p><button class="button button-outline" type="button" data-clear>RESET FILTERS ${icon.arrow}</button></div>`;
}

function brandsPage() {
  const brands = [...catalog.brands].sort((a, b) => a.name.localeCompare(b.name));
  app.innerHTML = header('Brands') + `<main>${pageIntro('BRANDS', 'Shop by brand.', `Explore ${brands.length} brands.`)}
    <section class="brands-page section-pad"><div class="wrap"><div class="brand-page-header"><p>THE DIRECTORY</p><span>${brands.length} MAISONS · ${catalog.watches.length} WATCHES</span></div>
      <div class="brand-directory">${brands.map((brand, index) => `<a href="${brandLink(brand)}" class="brand-tile"><span class="brand-tile-index">${String(index + 1).padStart(2, '0')}</span><strong>${esc(brand.name)}</strong><span class="brand-tile-foot"><small>${brand.count} WATCHES</small>${icon.arrow}</span></a>`).join('')}</div>
    </div></section></main>` + footer();
}

function detailPage() {
  const id = path.split('/')[2]?.toUpperCase();
  const watch = catalog.watches.find(item => item.id === id);
  if (!watch) {
    app.innerHTML = header('Collection') + `<main class="wrap empty-state page-empty"><span class="empty-symbol">✧</span><h1>That piece isn't here.</h1><p>This Watch ID may no longer be listed.</p><a class="button button-primary" href="/watches/">EXPLORE WATCHES ${icon.arrow}</a></main>` + footer();
    return;
  }
  const specs = [['Watch ID', watch.id], ['Size', watch.size], ['Category', watch.category], ['Dial color', watch.dialColor], ['Case material', watch.caseMaterial], ['Strap material', watch.strapMaterial], ['Movement', watch.movement]].filter(([, value]) => value);
  const related = catalog.watches.filter(item => item.brandSlug === watch.brandSlug && item.id !== watch.id).slice(0, 4);
  const saved = favorites.has(watch.id);
  app.innerHTML = header('Collection') + `<main class="detail-main"><div class="wrap">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/watches/">COLLECTION</a><span>/</span><a href="/watches/${esc(watch.brandSlug)}/">${esc(watch.brand)}</a><span>/</span><span>${esc(watch.id)}</span></nav>
    <div class="detail-heading"><div><p class="eyebrow">${esc(watch.brand)} <span>·</span> ${esc(watch.id)}</p><h1>${esc(watch.model)}</h1></div>
      <div class="detail-price"><strong>${money(watch.price)}</strong><span class="stock-pill ${watch.stock === 0 ? 'unavailable' : ''}"><i></i>${stock(watch)}</span></div>
    </div>
    <div class="detail-grid">
      <div class="detail-info"><p class="eyebrow">ABOUT THIS PIECE</p>
        <p class="detail-description">${esc(watch.description || 'Ask us for more details about this watch.')}</p>
        <div class="detail-actions"><button class="button button-primary" type="button" data-inquire="${esc(watch.id)}">INQUIRE ${icon.arrow}</button>
          <button class="detail-heart ${saved ? 'is-saved' : ''}" type="button" data-favorite="${esc(watch.id)}" aria-label="${saved ? 'Remove from' : 'Save to'} favorites" aria-pressed="${saved}">${icon.heart}</button></div>
        <div class="detail-extra"><button class="compare-add ${compare.has(watch.id) ? 'is-compared' : ''}" type="button" data-compare="${esc(watch.id)}" aria-pressed="${compare.has(watch.id)}">${compare.has(watch.id) ? '✓ Added to compare' : '+ Compare'}</button><button class="copy-link" type="button" data-share="${esc(watch.id)}">COPY LINK ${icon.arrow}</button></div>
      </div>
      <div class="detail-media"><div class="detail-photo">${image(watch, { eager: true })}</div><div class="detail-media-foot"><span>WATCH COLLECTION SOUTH</span><span>PIECE ${esc(watch.id)}</span></div></div>
    </div>
    <section class="spec-section">${sectionHead('01', 'THE DETAILS', 'The finer points.')}
      <dl>${specs.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>
    ${related.length ? `<section class="related-section">${sectionHead('02', 'CONTINUE EXPLORING', `More from ${esc(watch.brand)}.`, `/watches/${esc(watch.brandSlug)}/`, 'See all')}<div class="watch-grid">${related.map(card).join('')}</div></section>` : ''}
  </div></main><div class="mobile-inquiry"><span>${money(watch.price)}</span><button type="button" data-inquire="${esc(watch.id)}">INQUIRE ${icon.arrow}</button></div>` + footer();
}

function favoritesPage() {
  const rows = catalog.watches.filter(watch => favorites.has(watch.id));
  selection = new Set([...selection].filter(id => rows.some(watch => watch.id === id)));
  app.innerHTML = header('Saved') + `<main>${pageIntro('SAVED', 'Your watches.', `${rows.length} saved`)}
    <section class="favorites-page section-pad"><div class="wrap">${rows.length
      ? `<div class="saved-toolbar"><span>${rows.length} ${rows.length === 1 ? 'PIECE' : 'PIECES'} IN YOUR SHORTLIST</span><button type="button" data-select-all>${selection.size === rows.length ? 'DESELECT ALL' : 'SELECT ALL'}</button></div>
        <div class="saved-list">${rows.map(watch => `<div class="saved-row">
          <label class="saved-check"><input type="checkbox" data-select="${esc(watch.id)}" ${selection.has(watch.id) ? 'checked' : ''}><span class="sr-only">Select ${esc(name(watch))}</span></label>
          <a class="saved-photo" href="${link(watch)}">${image(watch)}</a>
          <div class="saved-description"><p class="eyebrow">${esc(watch.brand)}</p><h2><a href="${link(watch)}">${esc(watch.model)}</a></h2><small>${esc(watch.id)} · ${stock(watch)}</small></div>
          <strong class="saved-price">${money(watch.price)}</strong>
          <button class="saved-remove" type="button" data-favorite="${esc(watch.id)}" aria-label="Remove ${esc(name(watch))}">${icon.close}</button>
        </div>`).join('')}</div>
        <div class="saved-actions"><span>${selection.size} SELECTED FOR INQUIRY</span><button class="button button-primary" type="button" data-inquire-selected ${selection.size ? '' : 'disabled'}>INQUIRE ABOUT SELECTED ${icon.arrow}</button></div>`
      : `<div class="empty-state"><span class="empty-symbol">♡</span><p class="eyebrow">YOUR SHORTLIST AWAITS</p><h2>Start with a piece you love.</h2><p>Tap the heart on any watch to save it here for later.</p><a class="button button-primary" href="/watches/">EXPLORE THE COLLECTION ${icon.arrow}</a></div>`}
    </div></section></main>` + footer();
  updateCompareUI();
}

function contactPage() {
  app.innerHTML = header('Contact') + `<main>${pageIntro('CONTACT', "Let's talk watches.", 'Ask about a watch or plan a visit.')}
    <section class="contact-page section-pad"><div class="wrap">
      <div class="contact-lead"><div><p class="eyebrow">GET IN TOUCH</p><h2>How can we<br><em>help?</em></h2><p>Ask about availability, details or visiting the store.</p><a class="text-link" href="/watches/">Browse watches ${icon.arrow}</a></div><img src="/logo.jpg" alt="Watch Collection South" loading="lazy"></div>
      <div class="contact-methods"><p class="eyebrow">CHOOSE HOW TO CONNECT</p>
        <a href="${CONTACT.messenger}" target="_blank" rel="noopener"><span>01</span><div><small>MESSAGE US</small><strong>Messenger</strong></div>${icon.arrow}</a>
        <a href="tel:${CONTACT.phone}"><span>02</span><div><small>GIVE US A CALL</small><strong>${CONTACT.displayPhone}</strong></div>${icon.arrow}</a>
        <a href="${CONTACT.viber}"><span>03</span><div><small>CHAT ON VIBER</small><strong>Viber</strong></div>${icon.arrow}</a>
        <a href="${CONTACT.facebook}" target="_blank" rel="noopener"><span>04</span><div><small>FOLLOW THE PAGE</small><strong>Facebook</strong></div>${icon.arrow}</a>
      </div>
    </div></section>
    <section class="contact-visit"><div class="wrap contact-visit-inner"><div><p class="eyebrow">VISIT THE STORE</p><h2>See the collection<br><em>in Manila.</em></h2><p>Forbes Commercial, Sampaloc, Manila</p></div><a class="button button-primary" href="${CONTACT.map}" target="_blank" rel="noopener">GET DIRECTIONS ${icon.pin}</a></div></section>
  </main>` + footer();
}

function openQuickView(id, trigger) {
  const watch = catalog.watches.find(item => item.id === id);
  if (!watch) return;
  closeQuickView(false);
  quickViewReturnFocus = trigger;
  const saved = favorites.has(watch.id);
  const modal = document.createElement('div');
  modal.className = 'quick-view-backdrop';
  modal.setAttribute('data-quick-close', '');
  modal.innerHTML = `<section class="quick-view" role="dialog" aria-modal="true" aria-labelledby="quick-view-title">
    <button class="quick-close" type="button" data-quick-close aria-label="Close quick view">${icon.close}</button>
    <div class="quick-photo">${image(watch, { eager: true })}</div>
    <div class="quick-info">
      <p class="eyebrow">${esc(watch.brand)} · ${esc(watch.id)}</p>
      <h2 id="quick-view-title">${esc(watch.model)}</h2>
      <p class="quick-description">${esc(watch.description || 'Ask us for more details about this watch.')}</p>
      <p class="quick-meta">${[watch.movement, watch.size, watch.dialColor].filter(Boolean).map(esc).join(' · ')}</p>
      <div class="quick-price"><strong>${money(watch.price)}</strong><span>${stock(watch)}</span></div>
      <div class="quick-actions"><button class="button button-primary" type="button" data-inquire="${esc(watch.id)}">INQUIRE ${icon.arrow}</button>
        <button class="detail-heart ${saved ? 'is-saved' : ''}" type="button" data-favorite="${esc(watch.id)}" aria-label="${saved ? 'Remove from' : 'Save to'} favorites" aria-pressed="${saved}">${icon.heart}</button></div>
      <button class="compare-add ${compare.has(watch.id) ? 'is-compared' : ''}" type="button" data-compare="${esc(watch.id)}" aria-pressed="${compare.has(watch.id)}">${compare.has(watch.id) ? '✓ Added to compare' : '+ Compare'}</button>
      <a class="text-link" href="${link(watch)}">VIEW ALL DETAILS ${icon.arrow}</a>
    </div>
  </section>`;
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  modal.querySelector('.quick-close').focus();
}

function closeQuickView(restoreFocus = true) {
  const modal = document.querySelector('.quick-view-backdrop');
  if (!modal) return;
  modal.remove();
  document.body.classList.remove('modal-open');
  if (restoreFocus && quickViewReturnFocus?.isConnected) quickViewReturnFocus.focus();
  quickViewReturnFocus = null;
}

function closeOverlay(restoreFocus = true) {
  const overlay = document.querySelector('.utility-backdrop');
  if (!overlay) return;
  overlay.remove();
  document.body.classList.remove('modal-open');
  if (restoreFocus && overlayReturnFocus?.isConnected) overlayReturnFocus.focus();
  overlayReturnFocus = null;
}

function searchMatches(query) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return catalog.watches.filter(watch => [watch.brand, watch.model, watch.id, watch.movement, watch.size].some(value => String(value || '').toLowerCase().includes(term))).slice(0, 6);
}

function updateSearchSuggestions() {
  const input = document.getElementById('global-search');
  const output = document.getElementById('search-suggestions');
  if (!input || !output) return;
  const query = input.value.trim();
  const matches = searchMatches(query);
  output.innerHTML = !query ? `<p class="search-hint">Search by brand, model or Watch ID.</p>`
    : `<div class="search-results-head"><span>${matches.length ? 'MATCHING WATCHES' : 'NO MATCHES'}</span><a href="/watches/?q=${encodeURIComponent(query)}">ALL RESULTS ${icon.arrow}</a></div>
      ${matches.map(watch => `<a class="search-result" href="${link(watch)}"><span class="search-thumb">${image(watch)}</span><span><small>${esc(watch.brand)} · ${esc(watch.id)}</small><strong>${esc(watch.model)}</strong></span><em>${money(watch.price)}</em></a>`).join('')}`;
}

function openSearch(trigger) {
  closeQuickView(false);
  closeOverlay(false);
  overlayReturnFocus = trigger;
  const overlay = document.createElement('div');
  overlay.className = 'utility-backdrop';
  overlay.innerHTML = `<section class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title"><div class="utility-head"><div><p class="eyebrow">WATCH COLLECTION SOUTH</p><h2 id="search-title">Find a watch</h2></div><button class="utility-close" type="button" data-close-overlay aria-label="Close search">${icon.close}</button></div><label class="global-search-box">${icon.search}<span class="sr-only">Search watches</span><input id="global-search" type="search" placeholder="Brand, model or Watch ID" autocomplete="off"></label><div id="search-suggestions" aria-live="polite"></div></section>`;
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
  overlay.querySelector('#global-search').focus();
  updateSearchSuggestions();
}

function updateCompareUI() {
  const rows = catalog.watches.filter(watch => compare.has(watch.id));
  document.querySelectorAll('[data-compare]').forEach(button => {
    const added = compare.has(button.dataset.compare);
    button.classList.toggle('is-compared', added);
    button.setAttribute('aria-pressed', String(added));
    button.textContent = added ? '✓ Added to compare' : '+ Compare';
  });
  const dock = document.getElementById('compare-dock');
  if (dock) dock.innerHTML = rows.length ? `<div class="compare-dock"><span><strong>${rows.length}/3</strong> watches selected</span><div><button type="button" data-clear-compare>Clear</button><button class="button button-primary" type="button" data-open-compare ${rows.length < 2 ? 'disabled' : ''}>COMPARE ${icon.arrow}</button></div></div>` : '';
  if (document.querySelector('.compare-dialog')) renderCompareDialog();
}

function renderCompareDialog() {
  const dialog = document.querySelector('.compare-dialog');
  if (!dialog) return;
  const rows = catalog.watches.filter(watch => compare.has(watch.id));
  if (rows.length < 2) { closeOverlay(); return; }
  const specs = [['Brand', 'brand'], ['Size', 'size'], ['Movement', 'movement'], ['Dial', 'dialColor'], ['Case', 'caseMaterial'], ['Strap', 'strapMaterial']];
  dialog.innerHTML = `<div class="utility-head"><div><p class="eyebrow">SIDE BY SIDE</p><h2 id="compare-title">Compare watches</h2></div><button class="utility-close" type="button" data-close-overlay aria-label="Close comparison">${icon.close}</button></div><div class="compare-grid">${rows.map(watch => `<article class="compare-item"><div class="compare-photo">${image(watch)}</div><div class="compare-item-head"><small>${esc(watch.brand)} · ${esc(watch.id)}</small><button type="button" data-compare="${esc(watch.id)}" aria-label="Remove ${esc(name(watch))} from comparison">${icon.close}</button></div><h3><a href="${link(watch)}">${esc(watch.model)}</a></h3><strong class="compare-price">${money(watch.price)}</strong><span class="compare-stock">${stock(watch)}</span><dl>${specs.map(([label, key]) => `<div><dt>${label}</dt><dd>${esc(watch[key] || '—')}</dd></div>`).join('')}</dl><a class="button button-outline" href="${link(watch)}">VIEW WATCH ${icon.arrow}</a></article>`).join('')}</div>`;
}

function openCompare(trigger) {
  if (compare.size < 2) return;
  closeQuickView(false);
  closeOverlay(false);
  overlayReturnFocus = trigger;
  const overlay = document.createElement('div');
  overlay.className = 'utility-backdrop';
  overlay.innerHTML = '<section class="compare-dialog" role="dialog" aria-modal="true" aria-labelledby="compare-title"></section>';
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
  renderCompareDialog();
  overlay.querySelector('.utility-close')?.focus();
}

function toast(message) {
  let element = document.getElementById('toast');
  if (!element) {
    element = document.createElement('div');
    element.id = 'toast';
    element.className = 'toast';
    element.setAttribute('role', 'status');
    document.body.appendChild(element);
  }
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(element.timer);
  element.timer = setTimeout(() => element.classList.remove('show'), 3500);
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true; }
  catch {
    const element = document.createElement('textarea');
    element.value = value;
    element.style.position = 'fixed';
    element.style.opacity = '0';
    document.body.appendChild(element);
    element.select();
    const copied = document.execCommand('copy');
    element.remove();
    return copied;
  }
}

function inquiry(watches) {
  if (watches.length === 1) {
    const watch = watches[0];
    return `Hello Graceful Gifts Manila!\n\nI saw this watch on Watch Collection South:\n${name(watch)}\nWatch ID: ${watch.id}\nPrice: ${money(watch.price)}\nWatch link: ${location.origin}${link(watch)}\n\n${watch.stock === 0 ? 'I noticed it is sold out. Do you have another unit or a similar model?' : 'Is this still available?'}`;
  }
  return `Hello Graceful Gifts Manila!\n\nI'm interested in these watches from Watch Collection South:\n\n${watches.map((watch, index) => `${index + 1}. ${name(watch)}\n   Watch ID: ${watch.id}\n   ${money(watch.price)}\n   ${location.origin}${link(watch)}`).join('\n\n')}\n\nWhich are currently available?`;
}

async function handleInquiry(button, watches) {
  if (button.dataset.copied === 'yes') { window.open(CONTACT.messenger, '_blank', 'noopener'); return; }
  if (!watches.length) return toast('Select at least one watch first.');
  if (await copyText(inquiry(watches))) {
    button.dataset.copied = 'yes';
    if (button.classList.contains('card-inquire')) {
      button.classList.add('is-copied');
      button.setAttribute('aria-label', 'Open Messenger to send inquiry');
      button.title = 'Open Messenger';
    } else button.innerHTML = `MESSAGE COPIED · OPEN MESSENGER ${icon.arrow}`;
    toast('Message copied. Open Messenger and paste it.');
  } else toast('Could not copy the message. Please check clipboard permission.');
}

function updateFavoriteButtons() {
  document.querySelectorAll('[data-favorite]').forEach(button => {
    const saved = favorites.has(button.dataset.favorite);
    const watch = catalog.watches.find(item => item.id === button.dataset.favorite);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${watch ? name(watch) : 'watch'} ${saved ? 'from' : 'to'} favorites`);
  });
  document.querySelectorAll('.saved-count, .nav-count').forEach(element => {
    element.textContent = favorites.size || '';
  });
}

function closeFilters() {
  const panel = document.getElementById('filter-panel');
  if (!panel) return;
  panel.classList.remove('open');
  document.querySelector('.filter-overlay').hidden = true;
  document.body.classList.remove('drawer-open');
  document.querySelector('[data-open-filters]')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', async event => {
  const filterChoice = event.target.closest('[data-filter-choice]');
  if (filterChoice) {
    const key = filterChoice.dataset.filterChoice;
    filters[key] = filters[key] === filterChoice.dataset.value ? '' : filterChoice.dataset.value;
    shown = 24;
    renderResults();
    return;
  }
  const searchTrigger = event.target.closest('[data-open-search]');
  if (searchTrigger) { openSearch(searchTrigger); return; }
  if (event.target.matches('.utility-backdrop') || event.target.closest('[data-close-overlay]')) { closeOverlay(); return; }
  const view = event.target.closest('[data-view]');
  if (view) {
    catalogView = view.dataset.view;
    try { localStorage.setItem('lux-view', catalogView); } catch {}
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === catalogView)));
    renderResults();
    return;
  }
  const compareButton = event.target.closest('[data-compare]');
  if (compareButton) {
    const id = compareButton.dataset.compare;
    if (compare.has(id)) compare.delete(id);
    else if (compare.size >= 3) { toast('Compare up to three watches.'); return; }
    else compare.add(id);
    try { sessionStorage.setItem('lux-compare', JSON.stringify([...compare])); } catch {}
    updateCompareUI();
    return;
  }
  if (event.target.closest('[data-open-compare]')) { openCompare(event.target.closest('[data-open-compare]')); return; }
  if (event.target.closest('[data-clear-compare]')) {
    compare.clear();
    try { sessionStorage.removeItem('lux-compare'); } catch {}
    updateCompareUI();
    return;
  }
  if (event.target.closest('[data-theme-toggle]')) {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    return;
  }
  if (event.target.matches('.quick-view-backdrop') || event.target.closest('.quick-close')) { closeQuickView(); return; }
  const quick = event.target.closest('[data-quick-view]');
  if (quick) { openQuickView(quick.dataset.quickView, quick); return; }
  const menu = event.target.closest('[data-menu]');
  if (menu) {
    const panel = document.getElementById('mobile-menu');
    panel.hidden = !panel.hidden;
    document.querySelectorAll('[data-menu]').forEach(button => button.setAttribute('aria-expanded', String(!panel.hidden)));
    document.body.classList.toggle('menu-open', !panel.hidden);
    return;
  }
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    const id = favorite.dataset.favorite;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    try { localStorage.setItem('lux-favorites', JSON.stringify([...favorites])); }
    catch { toast('Favorites could not be saved in this browser.'); }
    if (path === '/favorites') favoritesPage();
    else updateFavoriteButtons();
    return;
  }
  if (event.target.closest('[data-clear]')) {
    filters = { query: '', brand: '', size: '', dial: '', movement: '', category: '', strap: '', availability: '', min: '', max: '', sort: 'newest' };
    shown = 24;
    catalogPage();
    return;
  }
  const removeFilter = event.target.closest('[data-remove-filter]');
  if (removeFilter) {
    const key = removeFilter.dataset.removeFilter;
    filters[key] = '';
    const control = document.querySelector(`[data-filter="${key}"]`);
    if (control) control.value = '';
    if (key === 'max') {
      const slider = document.querySelector('[data-price-range]');
      if (slider) {
        slider.value = slider.max;
        document.getElementById('price-max-label').textContent = money(slider.max) + '+';
      }
    }
    shown = 24;
    renderResults();
    return;
  }
  if (event.target.closest('[data-more]')) { shown += 24; renderResults(); return; }
  if (event.target.closest('[data-open-filters]')) {
    document.getElementById('filter-panel').classList.add('open');
    document.querySelector('.filter-overlay').hidden = false;
    document.body.classList.add('drawer-open');
    document.querySelector('[data-open-filters]').setAttribute('aria-expanded', 'true');
    return;
  }
  if (event.target.closest('[data-close-filters]')) { closeFilters(); return; }
  const selectAll = event.target.closest('[data-select-all]');
  if (selectAll) {
    const rows = catalog.watches.filter(watch => favorites.has(watch.id));
    selection = selection.size === rows.length ? new Set() : new Set(rows.map(watch => watch.id));
    favoritesPage();
    return;
  }
  const inquiryButton = event.target.closest('[data-inquire]');
  if (inquiryButton) { await handleInquiry(inquiryButton, catalog.watches.filter(watch => watch.id === inquiryButton.dataset.inquire)); return; }
  const selectedButton = event.target.closest('[data-inquire-selected]');
  if (selectedButton) { await handleInquiry(selectedButton, catalog.watches.filter(watch => selection.has(watch.id))); return; }
  const share = event.target.closest('[data-share]');
  if (share) toast(await copyText(location.origin + link({ id: share.dataset.share })) ? 'Watch link copied.' : 'Could not copy the link.');
});
document.addEventListener('change', event => {
  const checkbox = event.target.closest('[data-select]');
  if (checkbox) {
    checkbox.checked ? selection.add(checkbox.dataset.select) : selection.delete(checkbox.dataset.select);
    favoritesPage();
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'global-search') updateSearchSuggestions();
});
document.addEventListener('keydown', event => {
  const modal = document.querySelector('.utility-backdrop') || document.querySelector('.quick-view-backdrop');
  if (modal && event.key === 'Tab') {
    const controls = [...modal.querySelectorAll('button, a[href], input')].filter(element => !element.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if ((event.key === '/' || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey))) && !modal && !event.target.closest('input, textarea, select, [contenteditable="true"]')) {
    event.preventDefault();
    openSearch(document.activeElement);
    return;
  }
  if (event.key === 'Enter' && event.target.id === 'global-search') {
    event.preventDefault();
    location.href = '/watches/?q=' + encodeURIComponent(event.target.value.trim());
    return;
  }
  if (event.key === 'Escape') {
    if (modal) { modal.classList.contains('utility-backdrop') ? closeOverlay() : closeQuickView(); return; }
    closeFilters();
    const menu = document.getElementById('mobile-menu');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      document.body.classList.remove('menu-open');
      document.querySelectorAll('[data-menu]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    }
  }
});

function render() {
  if (path === '/') home();
  else if (path === '/watches' || path.startsWith('/watches/')) catalogPage();
  else if (path === '/brands') brandsPage();
  else if (path === '/favorites') favoritesPage();
  else if (path === '/contact') contactPage();
  else if (path.startsWith('/watch/')) detailPage();
  else app.innerHTML = header() + `<main class="wrap empty-state page-empty"><span class="empty-symbol">✧</span><h1>Page not found.</h1><p>Let's find a watch instead.</p><a class="button button-primary" href="/watches/">EXPLORE WATCHES ${icon.arrow}</a></main>` + footer();
  updateCompareUI();
}

setTheme(document.documentElement.dataset.theme || 'dark', false);
fetch('/api/catalog.json')
  .then(response => { if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`); return response.json(); })
  .then(data => { catalog = data; render(); })
  .catch(() => {
    app.innerHTML = '<div class="load-error"><img src="/logo.jpg" alt="Watch Collection South"><h1>The collection is temporarily unavailable.</h1><p>Please try again shortly.</p><button type="button" onclick="location.reload()">TRY AGAIN</button></div>';
  });
