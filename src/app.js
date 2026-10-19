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
let shown = 24;
let filters = {
  query: new URLSearchParams(location.search).get('q') || '',
  brand: '', size: '', dial: '', movement: '', category: '',
  availability: '', min: '', max: '', sort: 'newest'
};
try { favorites = new Set(JSON.parse(localStorage.getItem('lux-favorites') || '[]')); } catch {}

const icon = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 5 5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 4.6a5.5 5.5 0 0 0-7.8 0l-.6.6-.6-.6a5.5 5.5 0 0 0-7.8 7.8L12 21l8.4-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M7 12h10m-7 5h4"/><circle cx="8" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};

function image(watch, { eager = false } = {}) {
  return watch?.image
    ? `<img src="${esc(watch.image)}" alt="${esc(name(watch))}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`
    : '<div class="watch-placeholder"><img src="/logo.jpg" alt=""><span>Photography coming soon</span></div>';
}

function brand() {
  return '<a class="brand-lockup" href="/" aria-label="Watch Collection South home"><img src="/logo.jpg" alt="" width="64" height="64"><span><strong>WATCH COLLECTION</strong><em>SOUTH</em><small>CURATED TIMEPIECES</small></span></a>';
}

function header(active = '') {
  const links = [['/', 'Discover'], ['/watches/', 'Watches'], ['/brands/', 'Brands'], ['/favorites/', 'Saved'], ['/contact/', 'Contact']];
  const nav = links.map(([href, label]) => `<a href="${href}" ${active === label ? 'aria-current="page"' : ''}>${label}${label === 'Saved' ? `<span class="nav-count">${favorites.size || ''}</span>` : ''}</a>`).join('');
  return `<div class="announcement"><div class="wrap announcement-inner"><span>WATCH COLLECTION SOUTH <i></i> MANILA</span><span>Cash on delivery nationwide <b>·</b> Inspect before paying</span><a href="/#visit">Visit our store ${icon.arrow}</a></div></div>
  <header class="site-header"><div class="wrap header-inner">${brand()}
    <nav class="desktop-nav" aria-label="Main navigation">${nav}</nav>
    <div class="header-actions">
      <a class="icon-link" href="/watches/" aria-label="Search watches">${icon.search}</a>
      <a class="icon-link saved-link" href="/favorites/" aria-label="Saved watches">${icon.heart}<span class="saved-count">${favorites.size || ''}</span></a>
      <button class="menu-button" type="button" data-menu aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu"><span></span><span></span></button>
    </div>
  </div><nav id="mobile-menu" class="mobile-menu" aria-label="Mobile navigation" hidden>
    <div class="mobile-menu-top"><span>THE COLLECTION</span><button type="button" data-menu aria-label="Close menu">${icon.close}</button></div>
    ${nav}<a class="mobile-menu-contact" href="${CONTACT.messenger}" target="_blank" rel="noopener">Inquire on Messenger ${icon.arrow}</a>
  </nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="wrap footer-top">
    <div class="footer-intro">${brand()}<p>A considered selection of watches for every moment worth remembering.</p><a href="/watches/" class="text-link">Explore the collection ${icon.arrow}</a></div>
    <div class="footer-column"><h3>Explore</h3><a href="/watches/">All watches</a><a href="/brands/">Brands</a><a href="/favorites/">Your saved pieces</a></div>
    <div class="footer-column"><h3>Connect</h3><a href="${CONTACT.messenger}" target="_blank" rel="noopener">Messenger</a><a href="${CONTACT.facebook}" target="_blank" rel="noopener">Facebook</a><a href="tel:${CONTACT.phone}">${CONTACT.displayPhone}</a></div>
    <div class="footer-column"><h3>Visit us</h3><p>Forbes Commercial<br>Sampaloc, Manila</p><a href="${CONTACT.map}" target="_blank" rel="noopener">Get directions ${icon.arrow}</a></div>
  </div><div class="wrap footer-bottom"><span>© ${new Date().getFullYear()} Watch Collection South</span><span>Prices and availability are subject to confirmation.</span></div></footer>
  <a class="chat-float" href="${CONTACT.messenger}" target="_blank" rel="noopener" aria-label="Chat on Messenger"><span>LET'S TALK WATCHES</span>${icon.arrow}</a>`;
}

function card(watch) {
  const saved = favorites.has(watch.id);
  return `<article class="watch-card">
    <div class="card-photo"><a href="${link(watch)}" aria-label="View ${esc(name(watch))}">${image(watch)}</a>
      <button class="heart-button ${saved ? 'is-saved' : ''}" type="button" data-favorite="${esc(watch.id)}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(name(watch))} ${saved ? 'from' : 'to'} favorites" aria-pressed="${saved}">${icon.heart}</button>
      ${watch.stock === 0 ? '<span class="stock-badge">SOLD OUT</span>' : ''}
      <span class="card-view">VIEW PIECE ${icon.arrow}</span>
    </div>
    <div class="card-body"><p class="card-brand">${esc(watch.brand)}</p><h3><a href="${link(watch)}">${esc(watch.model)}</a></h3>
      <p class="card-spec">${esc([watch.movement, watch.size].filter(Boolean).join(' · ') || watch.id)}</p>
      <div class="card-bottom"><strong>${money(watch.price)}</strong><span class="${watch.stock === 0 ? 'unavailable' : ''}">${stock(watch)}</span></div>
    </div>
  </article>`;
}

function sectionHead(number, eyebrow, title, href, label = 'View all') {
  return `<div class="section-head"><div><span class="section-index">${number}</span><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${href ? `<a class="text-link" href="${href}">${label} ${icon.arrow}</a>` : ''}</div>`;
}

function pageIntro(eyebrow, title, description, detail = '') {
  return `<section class="page-intro"><div class="wrap page-intro-inner"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div><span class="page-intro-detail">${detail || 'WATCH COLLECTION SOUTH'}</span></div></section>`;
}

function home() {
  const visual = catalog.watches.find(watch => watch.image && watch.stock !== 0) || catalog.watches[0];
  const preview = [...catalog.watches].filter(watch => watch.image).sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || '')).slice(0, 8);
  const featuredBrands = [...catalog.brands].sort((a, b) => b.count - a.count).slice(0, 6);
  app.innerHTML = header('Discover') + `<main>
    <section class="hero"><div class="wrap hero-grid">
      <div class="hero-copy"><p class="eyebrow"><span class="eyebrow-line"></span> THE PRIVATE EDIT</p>
        <h1>Time is<br><em>personal.</em></h1>
        <p class="hero-description">Discover the piece that feels unmistakably yours. Explore our curated watch collection, save your favorites, and inquire with confidence.</p>
        <div class="hero-buttons"><a class="button button-primary" href="/watches/">EXPLORE THE COLLECTION ${icon.arrow}</a><a class="button button-outline" href="/brands/">DISCOVER BRANDS</a></div>
        <div class="hero-proof"><span><strong>${catalog.watches.length.toLocaleString()}</strong> CURATED WATCHES</span><span><strong>${catalog.brands.length}</strong> BRANDS TO EXPLORE</span><span class="hero-proof-line"></span><span>MANILA, PHILIPPINES</span></div>
      </div>
      <a class="hero-visual" href="${link(visual)}" aria-label="Explore ${esc(name(visual))}">
        <div class="hero-visual-frame">${image(visual, { eager: true })}</div>
        <span class="hero-visual-index">01 / FEATURED PIECE</span>
        <span class="hero-visual-caption"><small>FROM THE COLLECTION</small><strong>${esc(name(visual))}</strong><span>Discover this watch ${icon.arrow}</span></span>
      </a>
    </div><div class="hero-bottom"><div class="wrap"><span>AN EDIT OF TIMELESS PIECES</span><span>DISCOVER <span class="gold-star">✧</span> SAVE <span class="gold-star">✧</span> INQUIRE</span></div></div></section>
    <section class="home-brands section-pad"><div class="wrap">${sectionHead('01', 'EXPLORE BY MAISON', 'Find a name that speaks to you.', '/brands/', 'All brands')}
      <div class="brand-feature-grid">${featuredBrands.map((brand, index) => `<a class="brand-feature" href="${brandLink(brand)}"><span class="brand-feature-top"><small>${String(index + 1).padStart(2, '0')}</small><span>${icon.arrow}</span></span><strong>${esc(brand.name)}</strong><span class="brand-feature-count">${brand.count} WATCHES</span></a>`).join('')}</div>
    </div></section>
    <section class="home-featured section-pad"><div class="wrap">${sectionHead('02', 'CURATED SELECTION', 'Pieces worth a closer look.', '/watches/', 'View collection')}
      <div class="watch-grid">${preview.map(card).join('')}</div>
    </div></section>
    <section class="home-story section-pad"><div class="wrap story-grid">
      <div class="story-brand"><img src="/logo.jpg" alt="Watch Collection South" loading="lazy"></div>
      <div class="story-copy"><p class="eyebrow">03 / THE EXPERIENCE</p><h2>Explore with<br><em>intention.</em></h2><p>Search by brand or detail, keep the pieces that catch your eye, then ask us about the watches you love. Your shortlist stays in this browser until you're ready.</p>
        <div class="story-steps"><div><span>01</span><strong>Discover</strong><p>Browse and refine the entire collection.</p></div><div><span>02</span><strong>Consider</strong><p>Save a personal selection of favorites.</p></div><div><span>03</span><strong>Connect</strong><p>Send a prepared inquiry through Messenger.</p></div></div>
      </div>
    </div></section>
    <section class="visit-section" id="visit"><div class="wrap visit-grid">
      <div><p class="eyebrow">VISIT THE COLLECTION</p><h2>Experience it<br><em>in person.</em></h2><p>Find us at Forbes Commercial, Sampaloc, Manila. Ask about a Watch ID before visiting so we can confirm availability.</p>
        <a class="button button-primary" href="${CONTACT.map}" target="_blank" rel="noopener">GET DIRECTIONS ${icon.arrow}</a></div>
      <div class="visit-card"><span class="visit-card-top">WATCH COLLECTION SOUTH <span>✧</span> MANILA</span><img src="/logo.jpg" alt="" loading="lazy"><strong>Forbes Commercial<br>Sampaloc, Manila</strong><a href="tel:${CONTACT.phone}">${CONTACT.displayPhone}</a></div>
    </div></section>
  </main>` + footer();
}

const options = (values, label) => `<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
function filterPanel() {
  return `<div class="filter-heading"><div><p class="eyebrow">THE DETAILS</p><h2>Refine your search</h2></div><button type="button" data-close-filters aria-label="Close filters">${icon.close}</button></div>
    <div class="filter-group"><label for="filter-brand">Brand</label><select id="filter-brand" data-filter="brand">${options(catalog.brands.map(brand => brand.name), 'All brands')}</select></div>
    <div class="filter-group"><label for="filter-size">Size</label><select id="filter-size" data-filter="size">${options(catalog.watches.map(watch => watch.size), 'Any size')}</select></div>
    <div class="filter-group"><label for="filter-dial">Dial color</label><select id="filter-dial" data-filter="dial">${options(catalog.watches.map(watch => watch.dialColor), 'Any dial')}</select></div>
    <div class="filter-group"><label for="filter-movement">Movement</label><select id="filter-movement" data-filter="movement">${options(catalog.watches.map(watch => watch.movement), 'Any movement')}</select></div>
    <div class="filter-group"><label for="filter-category">Category</label><select id="filter-category" data-filter="category">${options(catalog.watches.map(watch => watch.category), 'Any category')}</select></div>
    <div class="filter-group"><label for="filter-availability">Availability</label><select id="filter-availability" data-filter="availability"><option value="">All watches</option><option value="available">Available</option><option value="soldout">Sold out</option></select></div>
    <fieldset class="filter-price"><legend>Price range</legend><div><label><span class="sr-only">Minimum price</span><input type="number" data-filter="min" min="0" placeholder="Min ₱"></label><label><span class="sr-only">Maximum price</span><input type="number" data-filter="max" min="0" placeholder="Max ₱"></label></div></fieldset>
    <button class="filter-clear" type="button" data-clear>Clear all filters ${icon.arrow}</button>`;
}

function catalogPage() {
  const brand = catalog.brands.find(item => path === `/watches/${item.slug}`);
  if (brand) filters.brand = brand.name;
  app.innerHTML = header('Watches') + `<main>
    ${pageIntro(brand ? 'THE MAISON EDIT' : 'THE COLLECTION', brand ? esc(brand.name) : 'Explore the collection.', brand ? `Discover every ${esc(brand.name)} piece in our selection.` : 'Find a watch for your next chapter. Refine by the details that matter.', brand ? `${brand.count} WATCHES` : `${catalog.watches.length} WATCHES · ${catalog.brands.length} BRANDS`)}
    <section class="catalog-section"><div class="wrap catalog-layout">
      <aside class="filter-panel" id="filter-panel" aria-label="Catalog filters">${filterPanel()}</aside>
      <div class="catalog-content"><div class="catalog-toolbar">
        <label class="search-box">${icon.search}<span class="sr-only">Search watches</span><input id="catalog-search" type="search" placeholder="Search brand, model or Watch ID" value="${esc(filters.query)}"></label>
        <label class="sort-box"><span>SORT BY</span><select id="sort"><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="brand">Brand: A–Z</option></select>${icon.chevron}</label>
        <button class="filter-trigger" type="button" data-open-filters aria-controls="filter-panel" aria-expanded="false">${icon.filter} FILTERS</button>
      </div><div class="result-meta"><span id="result-count"></span><span>ALL PRICES IN PHILIPPINE PESOS</span></div><div id="results"></div></div>
    </div></section>
  </main><button class="filter-overlay" type="button" data-close-filters aria-label="Close filters" hidden></button>` + footer();
  document.getElementById('sort').value = filters.sort;
  document.querySelectorAll('[data-filter]').forEach(element => {
    element.value = filters[element.dataset.filter] || '';
    element.addEventListener('input', () => { filters[element.dataset.filter] = element.value; shown = 24; renderResults(); });
  });
  document.getElementById('catalog-search').addEventListener('input', event => { filters.query = event.target.value; shown = 24; renderResults(); });
  document.getElementById('sort').addEventListener('change', event => { filters.sort = event.target.value; renderResults(); });
  renderResults();
}

function renderResults() {
  const query = filters.query.trim().toLowerCase();
  const rows = catalog.watches.filter(watch =>
    (!query || [watch.brand, watch.model, watch.id, watch.description].join(' ').toLowerCase().includes(query))
    && (!filters.brand || watch.brand === filters.brand)
    && (!filters.size || watch.size === filters.size)
    && (!filters.dial || watch.dialColor === filters.dial)
    && (!filters.movement || watch.movement === filters.movement)
    && (!filters.category || watch.category === filters.category)
    && (!filters.availability || (filters.availability === 'soldout' ? watch.stock === 0 : watch.stock !== 0))
    && (!filters.min || (watch.price != null && watch.price >= Number(filters.min)))
    && (!filters.max || (watch.price != null && watch.price <= Number(filters.max)))
  );
  if (filters.sort === 'price-asc') rows.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  else if (filters.sort === 'price-desc') rows.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  else if (filters.sort === 'brand') rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  else rows.sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
  document.getElementById('result-count').textContent = `${rows.length.toLocaleString()} ${rows.length === 1 ? 'piece' : 'pieces'}`;
  document.getElementById('results').innerHTML = rows.length
    ? `<div class="watch-grid">${rows.slice(0, shown).map(card).join('')}</div>${rows.length > shown ? `<div class="load-more"><span>SHOWING ${Math.min(shown, rows.length)} OF ${rows.length}</span><button class="button button-outline" type="button" data-more>VIEW MORE WATCHES ${icon.arrow}</button></div>` : ''}`
    : `<div class="empty-state"><span class="empty-symbol">✧</span><p class="eyebrow">NO MATCHES FOUND</p><h2>Nothing in this edit—yet.</h2><p>Try another search or start again with all watches.</p><button class="button button-outline" type="button" data-clear>RESET FILTERS ${icon.arrow}</button></div>`;
}

function brandsPage() {
  const brands = [...catalog.brands].sort((a, b) => a.name.localeCompare(b.name));
  app.innerHTML = header('Brands') + `<main>${pageIntro('THE NAME BEHIND THE WATCH', 'Explore by brand.', 'Follow the names you love and discover the watches in each collection.', `${brands.length} BRANDS`)}
    <section class="brands-page section-pad"><div class="wrap"><div class="brand-page-header"><p>THE DIRECTORY</p><span>${brands.length} MAISONS · ${catalog.watches.length} WATCHES</span></div>
      <div class="brand-directory">${brands.map((brand, index) => `<a href="${brandLink(brand)}" class="brand-tile"><span class="brand-tile-index">${String(index + 1).padStart(2, '0')}</span><strong>${esc(brand.name)}</strong><span class="brand-tile-foot"><small>${brand.count} WATCHES</small>${icon.arrow}</span></a>`).join('')}</div>
    </div></section></main>` + footer();
}

function detailPage() {
  const id = path.split('/')[2]?.toUpperCase();
  const watch = catalog.watches.find(item => item.id === id);
  if (!watch) {
    app.innerHTML = header('Watches') + `<main class="wrap empty-state page-empty"><span class="empty-symbol">✧</span><h1>That piece isn't here.</h1><p>This Watch ID may no longer be listed.</p><a class="button button-primary" href="/watches/">EXPLORE WATCHES ${icon.arrow}</a></main>` + footer();
    return;
  }
  const specs = [['Watch ID', watch.id], ['Size', watch.size], ['Category', watch.category], ['Dial color', watch.dialColor], ['Case material', watch.caseMaterial], ['Strap material', watch.strapMaterial], ['Movement', watch.movement]].filter(([, value]) => value);
  const related = catalog.watches.filter(item => item.brandSlug === watch.brandSlug && item.id !== watch.id).slice(0, 4);
  const saved = favorites.has(watch.id);
  app.innerHTML = header('Watches') + `<main class="detail-main"><div class="wrap">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/watches/">COLLECTION</a><span>/</span><a href="/watches/${esc(watch.brandSlug)}/">${esc(watch.brand)}</a><span>/</span><span>${esc(watch.id)}</span></nav>
    <div class="detail-grid"><div class="detail-media"><div class="detail-photo">${image(watch, { eager: true })}</div><div class="detail-media-foot"><span>WATCH COLLECTION SOUTH</span><span>PIECE ${esc(watch.id)}</span></div></div>
      <div class="detail-info"><p class="eyebrow">${esc(watch.brand)} <span>·</span> ${esc(watch.id)}</p><h1>${esc(watch.model)}</h1>
        <div class="detail-price"><strong>${money(watch.price)}</strong><span class="stock-pill ${watch.stock === 0 ? 'unavailable' : ''}"><i></i>${stock(watch)}</span></div>
        <p class="detail-description">${esc(watch.description || 'Ask us for more details about this watch.')}</p>
        <div class="detail-actions"><button class="button button-primary" type="button" data-inquire="${esc(watch.id)}">INQUIRE ABOUT THIS PIECE ${icon.arrow}</button>
          <button class="detail-heart ${saved ? 'is-saved' : ''}" type="button" data-favorite="${esc(watch.id)}" aria-label="${saved ? 'Remove from' : 'Save to'} favorites" aria-pressed="${saved}">${icon.heart}</button></div>
        <p class="detail-note">A prepared message will be copied for you to send through Messenger.</p>
        <button class="copy-link" type="button" data-share="${esc(watch.id)}">COPY A LINK TO THIS WATCH ${icon.arrow}</button>
        <div class="detail-assurance"><span>01 / SAVE TO YOUR SHORTLIST</span><span>02 / ASK US ABOUT AVAILABILITY</span><span>03 / INSPECT BEFORE PAYING</span></div>
      </div>
    </div>
    <section class="spec-section">${sectionHead('01', 'THE DETAILS', 'The finer points.')}
      <dl>${specs.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>
    ${related.length ? `<section class="related-section">${sectionHead('02', 'CONTINUE EXPLORING', `More from ${esc(watch.brand)}.`, `/watches/${esc(watch.brandSlug)}/`, 'See all')}<div class="watch-grid">${related.map(card).join('')}</div></section>` : ''}
  </div></main><div class="mobile-inquiry"><span>${money(watch.price)}</span><button type="button" data-inquire="${esc(watch.id)}">INQUIRE ${icon.arrow}</button></div>` + footer();
}

function favoritesPage() {
  const rows = catalog.watches.filter(watch => favorites.has(watch.id));
  selection = new Set([...selection].filter(id => rows.some(watch => watch.id === id)));
  app.innerHTML = header('Saved') + `<main>${pageIntro('A PERSONAL SELECTION', 'Your saved pieces.', 'Keep the watches that stay on your mind in one place.', `${rows.length} SAVED`)}
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
}

function contactPage() {
  app.innerHTML = header('Contact') + `<main>${pageIntro('BEGIN A CONVERSATION', "Let's talk watches.", 'Ask about a piece, request more details, or plan a visit.', 'MANILA · PHILIPPINES')}
    <section class="contact-page section-pad"><div class="wrap contact-grid">
      <div class="contact-intro"><img src="/logo.jpg" alt="Watch Collection South" loading="lazy"><div><p class="eyebrow">WE'RE HERE TO HELP</p><h2>A more personal way to find your watch.</h2><p>Each watch page prepares an inquiry with its Watch ID, price and link. You can also save several pieces and ask about them together.</p><a class="text-link" href="/watches/">Browse the collection ${icon.arrow}</a></div></div>
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
    return `Hello Graceful Gifts Manila!\n\nI saw this watch on the Lux Co South website:\n${name(watch)}\nWatch ID: ${watch.id}\nPrice: ${money(watch.price)}\nWatch link: ${location.origin}${link(watch)}\n\n${watch.stock === 0 ? 'I noticed it is sold out. Do you have another unit or a similar model?' : 'Is this still available?'}`;
  }
  return `Hello Graceful Gifts Manila!\n\nI'm interested in these watches from Lux Co South:\n\n${watches.map((watch, index) => `${index + 1}. ${name(watch)}\n   Watch ID: ${watch.id}\n   ${money(watch.price)}\n   ${location.origin}${link(watch)}`).join('\n\n')}\n\nWhich are currently available?`;
}

async function handleInquiry(button, watches) {
  if (button.dataset.copied === 'yes') { window.open(CONTACT.messenger, '_blank', 'noopener'); return; }
  if (!watches.length) return toast('Select at least one watch first.');
  if (await copyText(inquiry(watches))) {
    button.dataset.copied = 'yes';
    button.innerHTML = `MESSAGE COPIED · OPEN MESSENGER ${icon.arrow}`;
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
    filters = { query: '', brand: '', size: '', dial: '', movement: '', category: '', availability: '', min: '', max: '', sort: 'newest' };
    shown = 24;
    catalogPage();
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
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
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
}

fetch('/api/catalog.json')
  .then(response => { if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`); return response.json(); })
  .then(data => { catalog = data; render(); })
  .catch(() => {
    app.innerHTML = '<div class="load-error"><img src="/logo.jpg" alt="Watch Collection South"><h1>The collection is temporarily unavailable.</h1><p>Please try again shortly.</p><button type="button" onclick="location.reload()">TRY AGAIN</button></div>';
  });
