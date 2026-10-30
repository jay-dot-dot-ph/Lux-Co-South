import {
  services, adminSignIn, guestName, time, escapeHtml, sendMessage,
  doc, collection, query, where, orderBy, limit, startAfter, getDoc, getDocs,
  onSnapshot, writeBatch, serverTimestamp, updateDoc, setDoc, deleteDoc, signOut
} from './firebase.js';

const root = document.getElementById('admin-app');
const themeKey = 'lux-admin-theme';
const statusChoices = ['new', 'open', 'pending', 'resolved'];
let session = null, profile = null, staffRows = [], rows = [], selectedId = null;
let messages = [], older = [], oldestCursor = null, moreMessages = true;
let inboxCursor = null, moreInbox = false, blockState = false, preview = null;
let view = 'chat', sound = true, sending = false, busy = false, started = false;
let profileStop, staffStop, inboxStop, threadStop, blockStop;
const delivered = new Set();
const seen = new Set();

function isManager() { return ['owner', 'admin'].includes(profile?.role); }
function isOwner() { return profile?.role === 'owner'; }
function activeRow() { return rows.find(row => row.id === selectedId); }
function canHandle(row) { return !!row && (isManager() || row.assignedStaffUid === session?.auth.currentUser?.uid); }
function showError(error) {
  const el = root.querySelector('.lux-chat-error');
  if (el) el.textContent = error?.message || String(error);
}
function chime() {
  if (!sound) return;
  try {
    const audio = new AudioContext(), tone = audio.createOscillator(), gain = audio.createGain();
    tone.frequency.value = 740;
    gain.gain.setValueAtTime(.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .14);
    tone.connect(gain).connect(audio.destination);
    tone.start(); tone.stop(audio.currentTime + .15);
    tone.onended = () => audio.close();
  } catch {}
}
function setTheme(value) {
  document.documentElement.dataset.theme = value === 'light' ? 'light' : 'dark';
  try { localStorage.setItem(themeKey, document.documentElement.dataset.theme); } catch {}
  root.querySelectorAll('[data-theme]').forEach(button => {
    button.textContent = document.documentElement.dataset.theme === 'light' ? 'Dark mode' : 'Light mode';
    button.setAttribute('aria-label', button.textContent);
  });
}
function productCard(p) {
  return `<span class="lux-product">${p.image ? `<span class="lux-product-photo"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></span>` : '<span class="lux-product-photo">✦</span>'}<span class="lux-product-copy"><strong>${escapeHtml(p.brand)} ${escapeHtml(p.name)}</strong><small>Watch ID ${escapeHtml(p.id)}</small><small>${p.price == null ? 'Price on request' : `₱${Number(p.price).toLocaleString('en-PH')}`} · ${p.stock === 0 ? 'Sold out' : p.stock == null ? 'Availability on request' : `${p.stock} available`}</small><small>${escapeHtml([p.size, p.movement].filter(Boolean).join(' · '))}</small></span></span>`;
}
function modal() {
  if (!preview) return '';
  return `<div class="lux-image-backdrop" data-close-preview><section class="lux-image-modal" role="dialog" aria-modal="true" aria-label="Watch image preview"><button class="lux-image-close" type="button" data-close-preview aria-label="Close image preview">×</button><div class="lux-image-stage">${preview.image ? `<img src="${escapeHtml(preview.image)}" alt="${escapeHtml(preview.brand)} ${escapeHtml(preview.name)}">` : '<span>Image unavailable</span>'}</div><div class="lux-image-info"><small>WATCH ID ${escapeHtml(preview.id)}</small><h2>${escapeHtml(preview.brand)} ${escapeHtml(preview.name)}</h2><p>${preview.price == null ? 'Price on request' : `₱${Number(preview.price).toLocaleString('en-PH')}`} · ${preview.stock === 0 ? 'Sold out' : preview.stock == null ? 'Availability on request' : `${preview.stock} available`}</p><p>${escapeHtml([preview.size, preview.movement, preview.category, preview.dialColor].filter(Boolean).join(' · '))}</p><p>${escapeHtml(preview.description || '')}</p></div></section></div>`;
}
function themeButton() {
  const label = document.documentElement.dataset.theme === 'light' ? 'Dark mode' : 'Light mode';
  return `<button type="button" data-theme aria-label="${label}">${label}</button>`;
}
function header() {
  return `<header class="lux-admin-header"><a href="/">WATCH COLLECTION <b>SOUTH</b></a><strong>${view === 'staff' ? 'Staff' : 'Messages'}</strong><div>${isOwner() ? `<button type="button" data-view="${view === 'staff' ? 'chat' : 'staff'}">${view === 'staff' ? 'Inbox' : 'Staff'}</button>` : ''}${themeButton()}<button type="button" data-sound>${sound ? 'Mute sound' : 'Enable sound'}</button><button type="button" data-signout>Sign out</button></div></header>`;
}
function login(message = '') {
  root.innerHTML = `<div class="lux-admin-login"><a href="/">WATCH COLLECTION SOUTH</a><div class="lux-login-theme">${themeButton()}</div><h1>Staff messages</h1><form id="login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form><p class="lux-chat-error" role="alert">${escapeHtml(message)}</p></div>`;
}
function staffPage() {
  root.innerHTML = header() + `<div class="lux-staff-page"><div class="lux-staff-intro"><p class="eyebrow">OWNER ACCESS</p><h1>Staff management</h1><p>Manage who can reply to customers.</p></div><div class="lux-staff-grid"><section class="lux-staff-list"><h2>Team members</h2>${staffRows.map(person => `<div class="lux-staff-row"><div><strong>${escapeHtml(person.displayName || person.email || person.id)}</strong><small>${escapeHtml(person.email || '')}</small><small>UID ${escapeHtml(person.id)}</small></div><span>${escapeHtml(person.role)} · ${person.active ? 'Active' : 'Disabled'}</span>${person.role === 'owner' ? '' : `<select data-staff-role="${escapeHtml(person.id)}" aria-label="Role for ${escapeHtml(person.displayName || person.email || person.id)}"><option value="staff" ${person.role === 'staff' ? 'selected' : ''}>Staff</option><option value="admin" ${person.role === 'admin' ? 'selected' : ''}>Admin</option></select><button type="button" data-staff-active="${escapeHtml(person.id)}">${person.active ? 'Disable' : 'Enable'}</button>`}</div>`).join('') || '<p>No staff profiles yet.</p>'}</section><section class="lux-staff-add"><h2>Grant access</h2><p>Create an email/password account in Firebase Authentication first, then paste its UID here.</p><form id="staff-form"><label>Firebase Auth UID<input name="uid" maxlength="128" required></label><label>Name<input name="name" maxlength="80" required></label><label>Email<input name="email" type="email" maxlength="254" required></label><label>Role<select name="role"><option value="staff">Staff</option><option value="admin">Admin</option></select></label><button type="submit" ${busy ? 'disabled' : ''}>Grant access</button></form></section></div></div><p class="lux-chat-error" role="alert"></p>`;
}
function render() {
  if (!session || !profile) return login();
  if (view === 'staff' && isOwner()) return staffPage();
  const input = root.querySelector('#admin-message');
  const draft = input?.value || '';
  const focused = document.activeElement === input;
  const caret = focused ? input.selectionStart : 0;
  const oldHistory = root.querySelector('.lux-admin-messages');
  const oldHeight = oldHistory?.scrollHeight || 0, oldTop = oldHistory?.scrollTop || 0;
  const follow = !oldHistory || oldHeight - oldTop - oldHistory.clientHeight < 60;
  const active = activeRow();
  root.innerHTML = header() + `<div class="lux-admin-layout"><aside class="lux-inbox"><h1>Conversations <small>${rows.reduce((n, r) => n + (r.adminUnreadCount || 0), 0)} unread messages</small></h1>${rows.map(r => `<button class="lux-inbox-row ${r.id === selectedId ? 'active' : ''}" type="button" data-conversation="${escapeHtml(r.id)}"><span class="lux-guest-avatar">${guestName(r.id).slice(-2)}</span><span><strong>${guestName(r.id)}</strong><small>${escapeHtml(r.lastMessage || '')}</small><small>${escapeHtml(r.status || 'new')}${r.assignedStaffUid ? ' · Assigned' : ''}</small></span><time>${time(r.lastMessageAt)}</time>${r.adminUnreadCount ? `<i aria-label="${r.adminUnreadCount} unread messages">${r.adminUnreadCount}</i>` : ''}</button>`).join('') || '<p class="lux-chat-empty">No conversations yet.</p>'}${moreInbox ? '<button class="lux-load-more" type="button" data-inbox-more>Load older conversations</button>' : ''}</aside><section class="lux-admin-thread ${active ? 'active' : ''}">${active ? `<header><button type="button" class="lux-back" data-back aria-label="Back to inbox">←</button><span class="lux-guest-avatar">${guestName(active.id).slice(-2)}</span><div class="lux-thread-title"><strong>${guestName(active.id)}</strong><small>Conversation ${escapeHtml(active.id)}${blockState ? ' · Blocked' : ''}</small></div><div class="lux-thread-tools"><label>Status<select data-status>${statusChoices.map(s => `<option value="${s}" ${(active.status || 'new') === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></label>${isManager() ? `<label>Assigned<select data-assign><option value="">Unassigned</option>${staffRows.filter(p => p.active).map(p => `<option value="${escapeHtml(p.id)}" ${active.assignedStaffUid === p.id ? 'selected' : ''}>${escapeHtml(p.displayName || p.email || p.id)}</option>`).join('')}</select></label><button type="button" data-block ${busy ? 'disabled' : ''}>${blockState ? 'Unblock' : 'Block'}</button>` : ''}${isOwner() ? `<button type="button" class="lux-danger" data-delete-chat ${busy ? 'disabled' : ''}>Delete chat</button>` : ''}</div></header><div class="lux-admin-messages"><button type="button" data-thread-more ${messages.length < 40 || !moreMessages ? 'hidden' : ''}>Load older messages</button>${[...older, ...messages].sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0) || a.id.localeCompare(b.id)).map(m => `<div class="lux-chat-bubble ${m.senderRole !== 'customer' ? 'out' : 'in'}">${m.product ? `<button type="button" class="lux-product-button" data-product="${escapeHtml(m.id)}" aria-label="Preview ${escapeHtml(m.product.name)} image">${productCard(m.product)}</button>` : ''}<p>${escapeHtml(m.text)}</p><small>${time(m.createdAt)}${m.senderRole !== 'customer' ? ` · ${m.pending ? 'Sending' : active.customerSeenAt?.toMillis?.() >= m.createdAt?.toMillis?.() ? 'Seen' : active.customerDeliveredAt?.toMillis?.() >= m.createdAt?.toMillis?.() ? 'Delivered' : 'Sent'}` : ''}</small></div>`).join('')}</div><form class="lux-chat-form"><label class="sr-only" for="admin-message">Reply</label><textarea id="admin-message" maxlength="2000" rows="2" placeholder="${blockState ? 'This visitor is blocked' : 'Write a reply…'}" required ${sending || blockState ? 'disabled' : ''}></textarea><button type="submit" ${sending || blockState ? 'disabled' : ''}>Send</button></form>` : '<div class="lux-admin-placeholder">Select a conversation to reply.</div>'}</section></div>${modal()}<p class="lux-chat-error" role="alert"></p>`;
  const current = root.querySelector('#admin-message');
  if (current) {
    current.value = draft;
    if (focused) { current.focus(); current.setSelectionRange(caret, caret); }
  }
  const history = root.querySelector('.lux-admin-messages');
  if (history) history.scrollTop = follow ? history.scrollHeight : oldTop + Math.max(0, history.scrollHeight - oldHeight);
}
function stopConversation() {
  threadStop?.(); blockStop?.(); threadStop = blockStop = null;
  selectedId = null; messages = []; older = []; oldestCursor = null; moreMessages = true; preview = null; blockState = false;
}
function stopAll() {
  stopConversation();
  inboxStop?.(); profileStop?.(); staffStop?.();
  inboxStop = profileStop = staffStop = null;
  rows = []; staffRows = []; profile = null; session = null; started = false;
}
function inboxQuery() {
  const base = collection(session.db, 'luxConversations');
  return isManager() ? query(base, orderBy('lastMessageAt', 'desc'), limit(30))
    : query(base, where('assignedStaffUid', '==', session.auth.currentUser.uid), orderBy('lastMessageAt', 'desc'), limit(30));
}
function subscribeInbox() {
  inboxStop?.(); started = false;
  inboxStop = onSnapshot(inboxQuery(), snapshot => {
    const incoming = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (started && incoming.some(r => r.lastSenderRole === 'customer' && !rows.some(old => old.id === r.id && old.lastMessageId === r.lastMessageId))) chime();
    started = true;
    const removed = new Set(snapshot.docChanges().filter(change => change.type === 'removed').map(change => change.doc.id));
    rows = [...incoming, ...rows.filter(old => !removed.has(old.id) && !incoming.some(r => r.id === old.id) && old.lastMessageAt?.toMillis?.() < incoming.at(-1)?.lastMessageAt?.toMillis?.())];
    inboxCursor = snapshot.docs.at(-1) || null; moreInbox = snapshot.size === 30;
    if (selectedId && !rows.some(r => r.id === selectedId)) stopConversation();
    for (const row of incoming) deliver(row);
    render();
  }, showError);
}
function subscribeStaff() {
  staffStop?.(); staffStop = null; staffRows = [];
  if (!isManager()) return;
  staffStop = onSnapshot(query(collection(session.db, 'luxStaff'), limit(100)), snapshot => {
    staffRows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, showError);
}
async function start() {
  const s = await services();
  if (!s.auth.currentUser || s.auth.currentUser.isAnonymous) return login();
  session = s;
  profileStop?.();
  profileStop = onSnapshot(doc(s.db, 'luxStaff', s.auth.currentUser.uid), snapshot => {
    const next = snapshot.exists() ? snapshot.data() : null;
    if (!next?.active || !['owner', 'admin', 'staff'].includes(next.role)) {
      stopAll(); login('This account has no active Lux Co South chat permission.'); return;
    }
    const roleChanged = profile?.role !== next.role;
    profile = next;
    if (roleChanged) { stopConversation(); subscribeStaff(); subscribeInbox(); }
    render();
  }, error => login(error.message));
}
function deliver(row) {
  if (!session || !canHandle(row) || row.lastSenderRole !== 'customer' || document.visibilityState !== 'visible') return;
  if (row.adminDeliveredAt?.toMillis?.() >= row.lastMessageAt?.toMillis?.()) return;
  const key = `${row.id}:${row.lastMessageId}`;
  if (delivered.has(key)) return;
  delivered.add(key);
  updateDoc(doc(session.db, 'luxConversations', row.id), { adminDeliveredAt: serverTimestamp() }).catch(showError);
}
function acknowledge() {
  const row = activeRow();
  if (!row || row.lastSenderRole !== 'customer' || document.visibilityState !== 'visible') return;
  if (!messages.some(m => m.id === row.lastMessageId) || row.adminSeenAt?.toMillis?.() >= row.lastMessageAt?.toMillis?.()) return;
  const key = `${row.id}:${row.lastMessageId}`;
  if (seen.has(key)) return;
  seen.add(key);
  updateDoc(doc(session.db, 'luxConversations', row.id), { adminDeliveredAt: serverTimestamp(), adminSeenAt: serverTimestamp(), adminUnreadCount: 0 }).catch(showError);
}
function select(id) {
  stopConversation(); selectedId = id; render();
  if (!id) return;
  threadStop = onSnapshot(query(collection(session.db, 'luxConversations', id, 'messages'), orderBy('createdAt', 'desc'), limit(40)), snapshot => {
    messages = snapshot.docs.map(d => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
    if (!older.length) oldestCursor = snapshot.docs.at(-1) || null;
    older = older.filter(m => !messages.some(n => n.id === m.id));
    render(); acknowledge();
  }, showError);
  blockStop = onSnapshot(doc(session.db, 'luxBlockedCustomers', id), snapshot => {
    blockState = snapshot.exists(); render();
  }, showError);
}
async function blockToggle() {
  if (!selectedId || !isManager() || busy) return;
  const id = selectedId, shouldBlock = !blockState;
  if (shouldBlock && !confirm('Block this visitor from reading or sending messages?')) return;
  busy = true; render();
  try {
    const ref = doc(session.db, 'luxBlockedCustomers', id);
    const exists = (await getDoc(ref)).exists();
    if (exists !== blockState) throw new Error('Block state changed. Reopen this conversation.');
    if (shouldBlock) await setDoc(ref, { blockedAt: serverTimestamp(), blockedBy: session.auth.currentUser.uid });
    else await deleteDoc(ref);
  } catch (error) { showError(error); }
  finally { busy = false; render(); }
}
async function deleteConversation() {
  if (!selectedId || !isOwner() || busy || sending) return;
  const id = selectedId;
  if (!confirm('Permanently delete this chat and all its messages? This cannot be undone. The visitor will remain blocked.')) return;
  busy = true; render();
  try {
    const block = doc(session.db, 'luxBlockedCustomers', id);
    if (!(await getDoc(block)).exists()) await setDoc(block, { blockedAt: serverTimestamp(), blockedBy: session.auth.currentUser.uid });
    let page;
    do {
      page = await getDocs(query(collection(session.db, 'luxConversations', id, 'messages'), limit(100)));
      if (!page.empty) {
        const batch = writeBatch(session.db);
        page.docs.forEach(item => batch.delete(item.ref));
        await batch.commit();
      }
    } while (page.size === 100);
    await deleteDoc(doc(session.db, 'luxConversations', id));
    stopConversation(); rows = rows.filter(row => row.id !== id); render();
  } catch (error) { showError(error); }
  finally { busy = false; }
}
async function updateStaff(id, change) {
  if (!isOwner() || id === session.auth.currentUser.uid) return;
  const person = staffRows.find(row => row.id === id);
  if (!person || person.role === 'owner') return;
  if (change.active === false && !confirm(`Disable ${person.displayName || person.email || id}?`)) return render();
  try { await updateDoc(doc(session.db, 'luxStaff', id), change); }
  catch (error) { showError(error); render(); }
}

root.addEventListener('submit', async event => {
  event.preventDefault();
  if (event.target.id === 'login-form') {
    const button = event.target.querySelector('button'); button.disabled = true;
    try { await adminSignIn(event.target.email.value, event.target.password.value); await start(); }
    catch (error) { login(error.message); }
    return;
  }
  if (event.target.id === 'staff-form') {
    if (!isOwner() || busy) return;
    const form = event.target, uid = form.elements.uid.value.trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return showError(new Error('Enter a valid Firebase Auth UID.'));
    busy = true; render();
    try {
      const ref = doc(session.db, 'luxStaff', uid);
      if ((await getDoc(ref)).exists()) throw new Error('This UID already has a staff profile.');
      await setDoc(ref, { displayName: form.elements.name.value.trim(), email: form.elements.email.value.trim().toLowerCase(), role: form.elements.role.value, active: true, createdAt: serverTimestamp(), createdBy: session.auth.currentUser.uid });
      form.reset();
    } catch (error) { showError(error); }
    finally { busy = false; render(); }
    return;
  }
  if (sending || blockState || !selectedId) return;
  const input = root.querySelector('#admin-message'), value = input?.value.trim();
  if (!value) return;
  sending = true; input.disabled = true; root.querySelector('.lux-chat-form button').disabled = true;
  try {
    await sendMessage(session.db, selectedId, 'admin', value);
    const current = root.querySelector('#admin-message');
    if (current) { current.value = ''; current.disabled = false; current.focus(); }
  } catch (error) { showError(error); input.disabled = false; input.focus(); }
  finally { sending = false; root.querySelector('#admin-message')?.removeAttribute('disabled'); root.querySelector('.lux-chat-form button')?.removeAttribute('disabled'); }
});
root.addEventListener('keydown', event => {
  if (event.target.id === 'admin-message' && event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    if (event.target.value.trim() && !sending && !blockState) event.target.form?.requestSubmit();
  }
  if (event.key === 'Escape' && preview) { preview = null; render(); }
});
root.addEventListener('change', async event => {
  if (event.target.matches('[data-status]') && activeRow()) {
    try { await updateDoc(doc(session.db, 'luxConversations', selectedId), { status: event.target.value }); }
    catch (error) { showError(error); render(); }
  }
  if (event.target.matches('[data-assign]') && isManager() && activeRow()) {
    try { await updateDoc(doc(session.db, 'luxConversations', selectedId), { assignedStaffUid: event.target.value || null }); }
    catch (error) { showError(error); render(); }
  }
  if (event.target.matches('[data-staff-role]') && isOwner()) await updateStaff(event.target.dataset.staffRole, { role: event.target.value });
});
root.addEventListener('click', async event => {
  if (event.target.closest('button[data-theme]')) return setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  const next = event.target.closest('[data-view]');
  if (next) { view = next.dataset.view; stopConversation(); render(); return; }
  const row = event.target.closest('[data-conversation]');
  if (row) return select(row.dataset.conversation);
  if (event.target.closest('[data-back]')) return select(null);
  if (event.target.closest('[data-sound]')) { sound = !sound; try { localStorage.setItem('lux-admin-sound', String(sound)); } catch {} render(); return; }
  if (event.target.closest('[data-signout]')) { const auth = session.auth; stopAll(); await signOut(auth); login(); return; }
  if (event.target.closest('[data-block]')) return blockToggle();
  if (event.target.closest('[data-delete-chat]')) return deleteConversation();
  const toggle = event.target.closest('[data-staff-active]');
  if (toggle && isOwner()) { const person = staffRows.find(p => p.id === toggle.dataset.staffActive); if (person) return updateStaff(person.id, { active: !person.active }); }
  const product = event.target.closest('[data-product]');
  if (product) { preview = [...older, ...messages].find(m => m.id === product.dataset.product)?.product || null; render(); root.querySelector('.lux-image-close')?.focus(); return; }
  if (event.target.closest('[data-close-preview]')) { if (event.target.closest('.lux-image-modal') && !event.target.closest('.lux-image-close')) return; preview = null; render(); return; }
  if (event.target.closest('[data-inbox-more]') && inboxCursor) {
    try {
      const base = collection(session.db, 'luxConversations');
      const q = isManager() ? query(base, orderBy('lastMessageAt', 'desc'), startAfter(inboxCursor), limit(30))
        : query(base, where('assignedStaffUid', '==', session.auth.currentUser.uid), orderBy('lastMessageAt', 'desc'), startAfter(inboxCursor), limit(30));
      const page = await getDocs(q);
      rows.push(...page.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => !rows.some(old => old.id === r.id)));
      inboxCursor = page.docs.at(-1) || inboxCursor; moreInbox = page.size === 30; render();
    } catch (error) { showError(error); }
    return;
  }
  if (event.target.closest('[data-thread-more]') && oldestCursor) {
    try {
      const page = await getDocs(query(collection(session.db, 'luxConversations', selectedId, 'messages'), orderBy('createdAt', 'desc'), startAfter(oldestCursor), limit(40)));
      older.push(...page.docs.map(d => ({ id: d.id, ...d.data() })));
      oldestCursor = page.docs.at(-1) || oldestCursor; moreMessages = page.size === 40; render();
    } catch (error) { showError(error); }
  }
});
document.addEventListener('visibilitychange', () => { acknowledge(); rows.forEach(deliver); });
try { sound = localStorage.getItem('lux-admin-sound') !== 'false'; } catch {}
try { document.documentElement.dataset.theme = localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }
start().catch(error => login(error.message));
