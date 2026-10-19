const app = document.getElementById('app');
const CONTACT = {
  facebook: 'https://www.facebook.com/GracefulGifts.Manila',
  messenger: 'https://m.me/GracefulGifts.Manila',
  phone: '+639755996605',
  displayPhone: '0975 599 6605',
  viber: 'viber://chat?number=%2B639755996605',
  map: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=14.6084144%2C120.9940068&heading=231.21&pitch=-2.39&fov=75'
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const money = value => value == null ? 'Price on request' : '₱' + Number(value).toLocaleString('en-PH');
const stock = watch => watch.stock === 0 ? 'Sold out' : watch.stock == null ? 'Availability on request' : watch.stock === 1 ? '1 available' : `${watch.stock} available`;
const name = watch => watch.model.toLowerCase().startsWith(watch.brand.toLowerCase() + ' ') ? watch.model : `${watch.brand} ${watch.model}`;
const path = decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/';
let catalog, favorites = new Set(), selection = new Set(), shown = 24;
let brandPathApplied = false;
let filters = { query: new URLSearchParams(location.search).get('q') || '', brand: '', size: '', dial: '', movement: '', category: '', availability: '', min: '', max: '', sort: 'newest' };
try { favorites = new Set(JSON.parse(localStorage.getItem('lux-favorites') || '[]')); } catch {}

const icon = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 4.6a5.5 5.5 0 0 0-7.8 0l-.6.6-.6-.6a5.5 5.5 0 0 0-7.8 7.8L12 21l8.4-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>'
};
const image = (watch, className = '') => watch?.image ? `<img class="${className}" src="${esc(watch.image)}" alt="${esc(name(watch))}" loading="lazy" decoding="async">` : `<div class="watch-placeholder ${className}"><span>L<span>✦</span></span><small>Image coming soon</small></div>`;
const link = watch => `/watch/${encodeURIComponent(watch.id)}/`;

function header(active = '') {
  const links = [['/', 'Discover'], ['/watches/', 'Watches'], ['/brands/', 'Brands'], ['/favorites/', 'Saved'], ['/contact/', 'Contact']];
  return `<div class="announcement"><div class="wrap"><span>WATCHES TO DISCOVER</span><span>Cash on delivery nationwide · Inspect before paying</span><a href="/#visit">Visit our Manila store ${icon.arrow}</a></div></div>
  <header class="header"><div class="wrap header-inner"><a class="logo" href="/" aria-label="Lux Co South home"><span class="logo-mark">L<i>✦</i></span><span class="logo-words">LUX CO <b>SOUTH</b><small>TIME, CONSIDERED.</small></span></a>
  <nav class="main-nav" aria-label="Main navigation">${links.map(([href, label]) => `<a href="${href}" ${active === label ? 'aria-current="page"' : ''}>${label}${label === 'Saved' ? `<span class="nav-count">${favorites.size || ''}</span>` : ''}</a>`).join('')}</nav>
  <div class="header-actions"><a class="header-search" href="/watches/" aria-label="Search watches">${icon.search}</a><a class="header-heart" href="/favorites/" aria-label="Saved watches">${icon.heart}<span>${favorites.size || ''}</span></a><button class="menu-trigger" type="button" data-menu aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button></div></div>
  <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile navigation" hidden>${links.map(([href,label]) => `<a href="${href}">${label}</a>`).join('')}</nav></header>`;
}
function footer() {
  return `<footer class="footer"><div class="wrap footer-main"><div class="footer-brand"><a class="logo logo-footer" href="/"><span class="logo-mark">L<i>✦</i></span><span class="logo-words">LUX CO <b>SOUTH</b><small>TIME, CONSIDERED.</small></span></a><p>Explore the collection, save the pieces you love, and ask us about availability.</p></div><div class="footer-links"><h3>Explore</h3><a href="/watches/">All watches</a><a href="/brands/">Shop by brand</a><a href="/favorites/">Saved watches</a></div><div class="footer-links"><h3>Get in touch</h3><a href="${CONTACT.messenger}" target="_blank" rel="noopener">Messenger</a><a href="${CONTACT.facebook}" target="_blank" rel="noopener">Facebook</a><a href="tel:${CONTACT.phone}">${CONTACT.displayPhone}</a></div><div class="footer-links"><h3>Visit</h3><p>Forbes Commercial<br>Sampaloc, Manila</p><a href="${CONTACT.map}" target="_blank" rel="noopener">View map ${icon.arrow}</a></div></div><div class="wrap footer-bottom"><span>© ${new Date().getFullYear()} Lux Co South</span><span>Prices and availability are subject to confirmation.</span></div></footer><a class="chat-float" href="${CONTACT.messenger}" target="_blank" rel="noopener" aria-label="Chat on Messenger">Chat with us ${icon.arrow}</a>`;
}
function card(watch) {
  const saved = favorites.has(watch.id);
  return `<article class="watch-card"><div class="card-photo"><a href="${link(watch)}" aria-label="View ${esc(name(watch))}">${image(watch)}</a><button type="button" class="heart-button ${saved ? 'is-saved' : ''}" data-favorite="${esc(watch.id)}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(name(watch))} ${saved ? 'from' : 'to'} favorites" aria-pressed="${saved}">${icon.heart}</button>${watch.stock === 0 ? '<span class="stock-badge">SOLD OUT</span>' : ''}</div><div class="card-body"><p class="card-brand">${esc(watch.brand)}</p><h3><a href="${link(watch)}">${esc(watch.model)}</a></h3><p class="card-spec">${esc([watch.movement, watch.size].filter(Boolean).join(' · ') || watch.id)}</p><div class="card-bottom"><strong>${money(watch.price)}</strong><span class="${watch.stock === 0 ? 'unavailable' : ''}">${stock(watch)}</span></div></div></article>`;
}
const sectionTitle = (eyebrow, title, href, label = 'View all') => `<div class="section-title"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${href ? `<a class="inline-link" href="${href}">${label} ${icon.arrow}</a>` : ''}</div>`;

function home() {
  const visual = catalog.watches.find(w => w.image && w.stock !== 0) || catalog.watches[0];
  const preview = [...catalog.watches].filter(w => w.image).sort((a,b) => (b.dateAdded || '').localeCompare(a.dateAdded || '')).slice(0, 8);
  const featuredBrands = [...catalog.brands].sort((a,b) => b.count - a.count).slice(0, 8);
  app.innerHTML = header('Discover') + `<main><section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><p class="eyebrow hero-eyebrow"><span></span> THE WATCH EDIT</p><h1>Find the watch<br><em>that feels like you.</em></h1><p class="hero-description">Explore a wide selection of watches, compare the details, and save your favorites before you inquire.</p><div class="hero-buttons"><a class="button button-copper" href="/watches/">Explore watches ${icon.arrow}</a><a class="button button-ghost" href="/brands/">Browse brands</a></div><div class="hero-index"><div><strong>${catalog.watches.length.toLocaleString()}</strong><span>WATCHES</span></div><div><strong>${catalog.brands.length}</strong><span>BRANDS</span></div><div><strong>01</strong><span>GOOD CHOICE AWAY</span></div></div></div><a class="hero-product" href="${link(visual)}"><div class="hero-product-glow"></div>${image(visual)}<span class="hero-product-label"><small>FROM THE COLLECTION</small><strong>${esc(name(visual))}</strong><span>Explore this watch ${icon.arrow}</span></span></a></div><div class="hero-edge">LUX CO SOUTH <span>✦</span> WATCH COLLECTION <span>✦</span> MANILA</div></section>
  <section class="light-section"><div class="wrap home-categories">${sectionTitle('01 / EXPLORE', 'A collection with range.', '/brands/', 'All brands')}<div class="brand-feature-grid">${featuredBrands.map((brand,index) => `<a class="brand-feature" href="/watches/${brand.slug}/"><span class="brand-number">0${index+1}</span><strong>${esc(brand.name)}</strong><span>${brand.count} watches ${icon.arrow}</span></a>`).join('')}</div></div></section>
  <section class="featured-section"><div class="wrap">${sectionTitle('02 / THE SELECTION', 'Pieces to consider.', '/watches/', 'See the full collection')}<div class="watch-grid">${preview.map(card).join('')}</div></div></section>
  <section class="steps-section"><div class="wrap"><div class="steps-heading"><p class="eyebrow">03 / HOW IT WORKS</p><h2>A simpler way to choose.</h2></div><div class="steps-grid"><div><span>01</span><h3>Explore</h3><p>Search by brand or model, then narrow by style, movement, price, and availability.</p></div><div><span>02</span><h3>Save</h3><p>Keep a shortlist in this browser and compare the watches that catch your eye.</p></div><div><span>03</span><h3>Inquire</h3><p>Copy a prepared message with the Watch ID and link, then send it through Messenger.</p></div></div></div></section>
  <section class="visit-section" id="visit"><div class="wrap visit-grid"><div><p class="eyebrow">SEE US IN PERSON</p><h2>Meet the collection<br><em>in Manila.</em></h2><p>Find us at Forbes Commercial, Sampaloc, Manila. Ask about a specific Watch ID before your visit so we can confirm availability.</p><a class="button button-copper" href="${CONTACT.map}" target="_blank" rel="noopener">Get directions ${icon.arrow}</a></div><div class="visit-panel"><span class="visit-symbol">L✦</span><div><small>PHYSICAL STORE</small><strong>Forbes Commercial<br>Sampaloc, Manila</strong><a href="tel:${CONTACT.phone}">${CONTACT.displayPhone}</a></div></div></div></section></main>` + footer();
}

const options = (values, label) => `<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b)).map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
function filterPanel() {
  return `<div class="filter-head"><h2>Refine</h2><button type="button" data-clear>Clear all</button></div><label>Brand<select data-filter="brand">${options(catalog.brands.map(b => b.name), 'All brands')}</select></label><label>Size<select data-filter="size">${options(catalog.watches.map(w => w.size), 'Any size')}</select></label><label>Dial color<select data-filter="dial">${options(catalog.watches.map(w => w.dialColor), 'Any dial')}</select></label><label>Movement<select data-filter="movement">${options(catalog.watches.map(w => w.movement), 'Any movement')}</select></label><label>Category<select data-filter="category">${options(catalog.watches.map(w => w.category), 'Any category')}</select></label><label>Availability<select data-filter="availability"><option value="">All watches</option><option value="available">Available</option><option value="soldout">Sold out</option></select></label><div class="price-filter"><span>Price range</span><div><label><span class="sr-only">Minimum price</span><input type="number" data-filter="min" min="0" placeholder="Min ₱"></label><label><span class="sr-only">Maximum price</span><input type="number" data-filter="max" min="0" placeholder="Max ₱"></label></div></div>`;
}
function catalogPage() {
  const brand = catalog.brands.find(b => path === `/watches/${b.slug}`);
  if (brand && !brandPathApplied) { filters.brand = brand.name; brandPathApplied = true; }
  app.innerHTML = header('Watches') + `<main><section class="page-banner"><div class="wrap"><p class="eyebrow">THE COLLECTION</p><h1>${brand ? esc(brand.name) : 'Explore watches.'}</h1><p>Find the details that matter. Save the ones you love.</p></div></section><section class="catalog-section"><div class="wrap catalog-layout"><aside class="filter-panel" id="filter-panel">${filterPanel()}</aside><div class="catalog-content"><div class="catalog-controls"><label class="search-box">${icon.search}<span class="sr-only">Search watches</span><input id="catalog-search" type="search" placeholder="Search brand, model or Watch ID" value="${esc(filters.query)}"></label><label class="sort-box"><span>Sort</span><select id="sort"><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="brand">Brand: A–Z</option></select></label><button class="mobile-filter-trigger" type="button" data-open-filters>Filters</button></div><div class="result-meta"><span id="result-count"></span><span>Prices in Philippine pesos</span></div><div id="results"></div></div></div></section></main><div class="filter-overlay" data-close-filters hidden></div>` + footer();
  document.getElementById('sort').value = filters.sort;
  document.querySelectorAll('[data-filter]').forEach(el => { el.value = filters[el.dataset.filter] || ''; el.addEventListener('input', () => { filters[el.dataset.filter] = el.value; shown = 24; renderResults(); }); });
  document.getElementById('catalog-search').addEventListener('input', e => { filters.query = e.target.value; shown = 24; renderResults(); });
  document.getElementById('sort').addEventListener('change', e => { filters.sort = e.target.value; renderResults(); });
  renderResults();
}
function renderResults() {
  let rows = catalog.watches.filter(w => {
    const q = filters.query.trim().toLowerCase();
    return (!q || [w.brand,w.model,w.id,w.description].join(' ').toLowerCase().includes(q))
      && (!filters.brand || w.brand === filters.brand)
      && (!filters.size || w.size === filters.size)
      && (!filters.dial || w.dialColor === filters.dial)
      && (!filters.movement || w.movement === filters.movement)
      && (!filters.category || w.category === filters.category)
      && (!filters.availability || (filters.availability === 'soldout' ? w.stock === 0 : w.stock !== 0))
      && (!filters.min || (w.price != null && w.price >= Number(filters.min)))
      && (!filters.max || (w.price != null && w.price <= Number(filters.max)));
  });
  if (filters.sort === 'price-asc') rows.sort((a,b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  else if (filters.sort === 'price-desc') rows.sort((a,b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  else if (filters.sort === 'brand') rows.sort((a,b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  else rows.sort((a,b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
  document.getElementById('result-count').textContent = `${rows.length.toLocaleString()} ${rows.length === 1 ? 'watch' : 'watches'}`;
  document.getElementById('results').innerHTML = rows.length ? `<div class="watch-grid">${rows.slice(0, shown).map(card).join('')}</div>${rows.length > shown ? `<div class="load-more"><button class="button button-outline-dark" type="button" data-more>Show more ${icon.arrow}</button><span>Showing ${Math.min(shown, rows.length)} of ${rows.length}</span></div>` : ''}` : `<div class="empty-state"><span>✦</span><h2>No watches match those filters.</h2><p>Try a different search or clear your filters.</p><button class="button button-outline-dark" type="button" data-clear>Clear filters</button></div>`;
}
function brandsPage() {
  app.innerHTML = header('Brands') + `<main><section class="page-banner"><div class="wrap"><p class="eyebrow">FIND YOUR FIT</p><h1>Browse by brand.</h1><p>Every watch in the collection, organized for easy exploring.</p></div></section><section class="brands-page light-section"><div class="wrap"><div class="brands-intro"><span>${catalog.brands.length} BRANDS</span><p>Choose a name to see every piece in that collection.</p></div><div class="brand-directory">${catalog.brands.map((b,i) => `<a href="/watches/${b.slug}/"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(b.name)}</strong><small>${b.count} watches</small>${icon.arrow}</a>`).join('')}</div></div></section></main>` + footer();
}
function detailPage() {
  const id = path.split('/')[2]?.toUpperCase();
  const watch = catalog.watches.find(w => w.id === id);
  if (!watch) { app.innerHTML = header('Watches') + `<main class="wrap empty-state page-empty"><h1>Watch not found.</h1><p>This piece may no longer be listed.</p><a class="button button-copper" href="/watches/">Browse watches ${icon.arrow}</a></main>` + footer(); return; }
  const specs = [['Watch ID',watch.id],['Size',watch.size],['Category',watch.category],['Dial color',watch.dialColor],['Case material',watch.caseMaterial],['Strap material',watch.strapMaterial],['Movement',watch.movement]].filter(([,value]) => value);
  const related = catalog.watches.filter(w => w.brandSlug === watch.brandSlug && w.id !== watch.id).slice(0,4);
  app.innerHTML = header('Watches') + `<main class="detail-main"><div class="wrap"><div class="breadcrumbs"><a href="/watches/">Watches</a><span>/</span><a href="/watches/${watch.brandSlug}/">${esc(watch.brand)}</a><span>/</span><span>${esc(watch.id)}</span></div><div class="detail-grid"><div class="detail-photo">${image(watch)}</div><div class="detail-info"><p class="eyebrow">${esc(watch.brand)}</p><h1>${esc(watch.model)}</h1><p class="detail-id">WATCH ID ${esc(watch.id)}</p><div class="detail-price"><strong>${money(watch.price)}</strong><span class="${watch.stock === 0 ? 'unavailable' : ''}"><i></i>${stock(watch)}</span></div><p class="detail-description">${esc(watch.description || 'Ask us for more details about this watch.')}</p><div class="detail-actions"><button class="button button-copper" type="button" data-inquire="${esc(watch.id)}">${watch.stock === 0 ? 'Ask about this watch' : 'Inquire about this watch'} ${icon.arrow}</button><button class="detail-heart ${favorites.has(watch.id) ? 'is-saved' : ''}" type="button" data-favorite="${esc(watch.id)}" aria-label="Save to favorites" aria-pressed="${favorites.has(watch.id)}">${icon.heart}</button></div><p class="detail-note">Copy a prepared message, then open Messenger and paste it.</p><button class="copy-link" type="button" data-share="${esc(watch.id)}">Copy watch link ${icon.arrow}</button></div></div><section class="spec-section">${sectionTitle('THE DETAILS', 'Specifications')}<dl>${specs.map(([label,value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>${related.length ? `<section class="related-section">${sectionTitle('MORE TO EXPLORE', `More from ${esc(watch.brand)}`, `/watches/${watch.brandSlug}/`)}<div class="watch-grid">${related.map(card).join('')}</div></section>` : ''}</div></main><div class="mobile-inquiry"><span>${money(watch.price)}</span><button type="button" data-inquire="${esc(watch.id)}">Inquire ${icon.arrow}</button></div>` + footer();
}
function favoritesPage() {
  const rows = catalog.watches.filter(w => favorites.has(w.id));
  selection = new Set([...selection].filter(id => rows.some(w => w.id === id)));
  app.innerHTML = header('Saved') + `<main><section class="page-banner"><div class="wrap"><p class="eyebrow">YOUR SHORTLIST</p><h1>Saved watches.</h1><p>Keep the pieces that speak to you in one place.</p></div></section><section class="favorites-page light-section"><div class="wrap">${rows.length ? `<div class="saved-toolbar"><span>${rows.length} saved ${rows.length === 1 ? 'watch' : 'watches'}</span><button type="button" data-select-all>${selection.size === rows.length ? 'Deselect all' : 'Select all'}</button></div><div class="saved-list">${rows.map(w => `<div class="saved-row"><label><input type="checkbox" data-select="${esc(w.id)}" ${selection.has(w.id) ? 'checked' : ''}><span class="sr-only">Select ${esc(name(w))}</span></label><a class="saved-photo" href="${link(w)}">${image(w)}</a><div><p class="eyebrow">${esc(w.brand)}</p><h2><a href="${link(w)}">${esc(w.model)}</a></h2><small>${esc(w.id)} · ${stock(w)}</small></div><strong>${money(w.price)}</strong><button class="saved-remove" type="button" data-favorite="${esc(w.id)}" aria-label="Remove ${esc(name(w))}">×</button></div>`).join('')}</div><div class="saved-actions"><span>${selection.size} selected</span><button class="button button-copper" type="button" data-inquire-selected ${selection.size ? '' : 'disabled'}>Inquire about selected ${icon.arrow}</button></div>` : `<div class="empty-state"><span>♡</span><h2>Your shortlist is waiting.</h2><p>Tap the heart on any watch to save it here.</p><a class="button button-copper" href="/watches/">Explore watches ${icon.arrow}</a></div>`}</div></section></main>` + footer();
}
function contactPage() {
  app.innerHTML = header('Contact') + `<main><section class="page-banner"><div class="wrap"><p class="eyebrow">LET'S CONNECT</p><h1>Let's talk watches.</h1><p>Ask about a piece, request details, or plan a visit.</p></div></section><section class="contact-page light-section"><div class="wrap contact-grid"><div class="contact-copy"><p class="eyebrow">A PERSONAL INQUIRY</p><h2>Start with the watch that caught your eye.</h2><p>Each watch page can prepare a message with its Watch ID, price, and direct link. Save several pieces to ask about them together.</p><a class="button button-outline-dark" href="/watches/">Browse watches ${icon.arrow}</a></div><div class="contact-cards"><a href="${CONTACT.messenger}" target="_blank" rel="noopener"><small>MESSAGE US</small><strong>Messenger</strong><span>Send a direct message ${icon.arrow}</span></a><a href="tel:${CONTACT.phone}"><small>GIVE US A CALL</small><strong>${CONTACT.displayPhone}</strong><span>Call from your phone ${icon.arrow}</span></a><a href="${CONTACT.viber}"><small>CHAT ON VIBER</small><strong>Viber</strong><span>Open a conversation ${icon.arrow}</span></a><a href="${CONTACT.facebook}" target="_blank" rel="noopener"><small>FOLLOW THE PAGE</small><strong>Facebook</strong><span>Visit our page ${icon.arrow}</span></a></div></div></section><section class="contact-visit"><div class="wrap"><p class="eyebrow">VISIT THE STORE</p><h2>Forbes Commercial<br>Sampaloc, Manila</h2><a class="button button-copper" href="${CONTACT.map}" target="_blank" rel="noopener">View location ${icon.arrow}</a></div></section></main>` + footer();
}

function toast(message) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role','status'); document.body.appendChild(el); }
  el.textContent = message; el.classList.add('show'); clearTimeout(el.timer); el.timer = setTimeout(() => el.classList.remove('show'), 3500);
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true; }
  catch { const el = document.createElement('textarea'); el.value = value; el.style.position = 'fixed'; el.style.opacity = '0'; document.body.appendChild(el); el.select(); const ok = document.execCommand('copy'); el.remove(); return ok; }
}
function inquiry(watches) {
  if (watches.length === 1) {
    const w = watches[0];
    return `Hello Graceful Gifts Manila!\n\nI saw this watch on the Lux Co South website:\n${name(w)}\nWatch ID: ${w.id}\nPrice: ${money(w.price)}\nWatch link: ${location.origin}${link(w)}\n\n${w.stock === 0 ? 'I noticed it is sold out. Do you have another unit or a similar model?' : 'Is this still available?'}`;
  }
  return `Hello Graceful Gifts Manila!\n\nI'm interested in these watches from Lux Co South:\n\n${watches.map((w,i) => `${i+1}. ${name(w)}\n   Watch ID: ${w.id}\n   ${money(w.price)}\n   ${location.origin}${link(w)}`).join('\n\n')}\n\nWhich are currently available?`;
}
async function handleInquiry(button, watches) {
  if (button.dataset.copied === 'yes') { window.open(CONTACT.messenger, '_blank', 'noopener'); return; }
  if (!watches.length) return toast('Select at least one watch first.');
  if (await copyText(inquiry(watches))) { button.dataset.copied = 'yes'; button.innerHTML = `Message copied · Open Messenger ${icon.arrow}`; toast('Message copied. Open Messenger and paste it.'); }
  else toast('Could not copy the message. Please check clipboard permission.');
}
document.addEventListener('click', async event => {
  const menu = event.target.closest('[data-menu]');
  if (menu) { const panel = document.getElementById('mobile-menu'); panel.hidden = !panel.hidden; menu.setAttribute('aria-expanded', String(!panel.hidden)); return; }
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) { const id = favorite.dataset.favorite; favorites.has(id) ? favorites.delete(id) : favorites.add(id); try { localStorage.setItem('lux-favorites', JSON.stringify([...favorites])); } catch { toast('Favorites could not be saved in this browser.'); } render(); return; }
  if (event.target.closest('[data-clear]')) { filters = { query:'',brand:'',size:'',dial:'',movement:'',category:'',availability:'',min:'',max:'',sort:'newest' }; shown=24; catalogPage(); return; }
  if (event.target.closest('[data-more]')) { shown += 24; renderResults(); return; }
  if (event.target.closest('[data-open-filters]')) { document.getElementById('filter-panel').classList.add('open'); document.querySelector('.filter-overlay').hidden = false; return; }
  if (event.target.closest('[data-close-filters]')) { document.getElementById('filter-panel').classList.remove('open'); document.querySelector('.filter-overlay').hidden = true; return; }
  const selectAll = event.target.closest('[data-select-all]');
  if (selectAll) { const rows = catalog.watches.filter(w => favorites.has(w.id)); selection = selection.size === rows.length ? new Set() : new Set(rows.map(w => w.id)); favoritesPage(); return; }
  const inquiryButton = event.target.closest('[data-inquire]');
  if (inquiryButton) { await handleInquiry(inquiryButton, catalog.watches.filter(w => w.id === inquiryButton.dataset.inquire)); return; }
  const selectedButton = event.target.closest('[data-inquire-selected]');
  if (selectedButton) { await handleInquiry(selectedButton, catalog.watches.filter(w => selection.has(w.id))); return; }
  const share = event.target.closest('[data-share]');
  if (share) toast(await copyText(location.origin + link({ id: share.dataset.share })) ? 'Watch link copied.' : 'Could not copy the link.');
});
document.addEventListener('change', event => {
  const checkbox = event.target.closest('[data-select]');
  if (checkbox) { checkbox.checked ? selection.add(checkbox.dataset.select) : selection.delete(checkbox.dataset.select); favoritesPage(); }
});
function render() {
  if (path === '/') home();
  else if (path === '/watches' || path.startsWith('/watches/')) catalogPage();
  else if (path === '/brands') brandsPage();
  else if (path === '/favorites') favoritesPage();
  else if (path === '/contact') contactPage();
  else if (path.startsWith('/watch/')) detailPage();
  else app.innerHTML = header() + `<main class="wrap empty-state page-empty"><h1>Page not found.</h1><a class="button button-copper" href="/watches/">Browse watches ${icon.arrow}</a></main>` + footer();
}
fetch('/api/catalog.json').then(response => { if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`); return response.json(); }).then(data => { catalog = data; render(); }).catch(() => { app.innerHTML = `<div class="load-error"><span class="logo-mark">L<i>✦</i></span><h1>The collection is temporarily unavailable.</h1><p>Please try again shortly.</p><button onclick="location.reload()">Try again</button></div>`; });
