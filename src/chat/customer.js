import { guest, product, time, escapeHtml, sendMessage, doc, collection, query, orderBy, limit, startAfter, getDocs, onSnapshot, updateDoc, serverTimestamp } from './firebase.js';

const root = document.createElement('div');
root.id = 'lux-chat-root';
document.body.append(root);
let session, selected, open = false, sending = false, conversation, messages = [], older = [], unsubConversation, unsubMessages, loading = false;
let oldestCursor = null;
let moreMessages = true;
let prefill = '';
let acknowledging = false;
const acknowledgements = new Set();
const watchHtml = watch => watch ? `<div class="lux-product">${watch.image ? `<img src="${escapeHtml(watch.thumbnailImage || watch.image)}" alt="" loading="lazy" decoding="async">` : '<span>✦</span>'}<div><strong>${escapeHtml(watch.brand)} ${escapeHtml(watch.name)}</strong><small>Watch ID ${escapeHtml(watch.id)} · ${watch.price == null ? 'Price on request' : `₱${Number(watch.price).toLocaleString('en-PH')}`}</small><small>${watch.stock === 0 ? 'Sold out' : watch.stock == null ? 'Availability on request' : `${watch.stock} available`}${watch.size ? ` · ${escapeHtml(watch.size)}` : ''}${watch.movement ? ` · ${escapeHtml(watch.movement)}` : ''}</small></div></div>` : '';

function paint() {
  const draft = root.querySelector('#lux-message')?.value || '';
  const inputFocused = document.activeElement?.id === 'lux-message';
  const caret = inputFocused ? root.querySelector('#lux-message').selectionStart : 0;
  const oldHistory = root.querySelector('.lux-chat-history');
  const oldHeight = oldHistory?.scrollHeight || 0;
  const oldTop = oldHistory?.scrollTop || 0;
  const follow = !oldHistory || oldHeight - oldTop - oldHistory.clientHeight < 60;
  const unread = conversation?.customerUnreadCount || 0;
  root.innerHTML = `<button class="lux-chat-launch" type="button" data-chat-open aria-label="Open Lux Co South chat">Chat with us ${unread ? `<b>${Math.min(unread, 99)}</b>` : ''}</button>${open ? `<section class="lux-chat-panel" aria-label="Chat with Lux Co South"><header><span class="lux-chat-avatar">L✦</span><div><strong>Lux Co South</strong><small>Message us about any watch</small></div><button type="button" data-chat-close aria-label="Close chat">×</button></header><div class="lux-chat-history"><button type="button" data-chat-older ${messages.length < 40 || loading || !moreMessages ? 'hidden' : ''}>Load older messages</button>${[...older, ...messages].sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0) || a.id.localeCompare(b.id)).map(m => `<div class="lux-chat-bubble ${m.senderRole === 'customer' ? 'out' : 'in'}">${m.product ? watchHtml(m.product) : ''}<p>${escapeHtml(m.text)}</p><small>${time(m.createdAt)}${m.senderRole === 'customer' ? ` · ${m.pending ? 'Sending' : conversation?.adminSeenAt?.toMillis?.() >= m.createdAt?.toMillis?.() ? 'Seen' : conversation?.adminDeliveredAt?.toMillis?.() >= m.createdAt?.toMillis?.() ? 'Delivered' : 'Sent'}` : ''}</small></div>`).join('') || '<p class="lux-chat-empty">Ask us about a watch. Our team will reply here.</p>'}</div>${selected ? `<div class="lux-chat-selected">${watchHtml(selected)}<button type="button" data-chat-remove aria-label="Remove selected watch">×</button></div>` : ''}<form class="lux-chat-form"><label class="sr-only" for="lux-message">Your message</label><textarea id="lux-message" maxlength="2000" rows="2" placeholder="Write a message…" required ${sending ? 'disabled' : ''}></textarea><button type="submit" ${sending ? 'disabled' : ''}>Send</button></form><p class="lux-chat-error" role="alert"></p></section>` : ''}`;
  if (open) { const history = root.querySelector('.lux-chat-history'); history.scrollTop = follow ? history.scrollHeight : oldTop + Math.max(0, history.scrollHeight - oldHeight); }
  if ((draft || prefill) && root.querySelector('#lux-message')) root.querySelector('#lux-message').value = draft || prefill;
  if (inputFocused && root.querySelector('#lux-message')) { const input = root.querySelector('#lux-message'); input.focus(); input.setSelectionRange(caret, caret); }
}

async function load() {
  if (session) return;
  session = await guest();
  const ref = doc(session.db, 'luxConversations', session.uid);
  unsubConversation = onSnapshot(ref, snapshot => {
    conversation = snapshot.exists() ? snapshot.data() : null;
    paint();
    acknowledge();
  }, showError);
}
function showError(error) {
  const el = root.querySelector('.lux-chat-error');
  if (el) el.textContent = error?.message || 'Chat is unavailable. Please retry.';
}
function acknowledge() {
  if (!session || !conversation || document.visibilityState !== 'visible' || conversation.lastSenderRole === 'customer') return;
  if (open && !messages.some(message => message.id === conversation.lastMessageId)) return;
  const latest = conversation.lastMessageAt?.toMillis?.() || 0;
  if (acknowledging || (open ? conversation.customerSeenAt : conversation.customerDeliveredAt)?.toMillis?.() >= latest) return;
  const key = `${open ? 'seen' : 'delivered'}:${conversation.lastMessageId}`;
  if (acknowledgements.has(key)) return;
  acknowledgements.add(key);
  acknowledging = true;
  updateDoc(doc(session.db, 'luxConversations', session.uid), open ? { customerDeliveredAt: serverTimestamp(), customerSeenAt: serverTimestamp(), customerUnreadCount: 0 } : { customerDeliveredAt: serverTimestamp() }).catch(error => { acknowledgements.delete(key); showError(error); }).finally(() => { acknowledging = false; });
}
function listenMessages() {
  if (!session || unsubMessages) return;
  unsubMessages = onSnapshot(query(collection(session.db, 'luxConversations', session.uid, 'messages'), orderBy('createdAt', 'desc'), limit(40)), snapshot => {
    messages = snapshot.docs.map(d => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
    if (!older.length) oldestCursor = snapshot.docs.at(-1) || null;
    older = older.filter(m => !messages.some(n => n.id === m.id));
    const draft = root.querySelector('#lux-message')?.value || '';
    paint();
    if (draft) root.querySelector('#lux-message').value = draft;
    acknowledge();
  }, showError);
}
export async function openChat(watch = null, draft = '') {
  if (watch) selected = product(watch);
  if (draft) prefill = draft;
  open = true;
  paint();
  try { await load(); listenMessages(); paint(); root.querySelector('#lux-message')?.focus(); }
  catch (error) { showError(error); }
}
root.addEventListener('click', async event => {
  if (event.target.closest('[data-chat-open]')) return openChat();
  if (event.target.closest('[data-chat-close]')) { open = false; unsubMessages?.(); unsubMessages = null; paint(); return; }
  if (event.target.closest('[data-chat-remove]')) { selected = null; paint(); return; }
  if (event.target.closest('[data-chat-older]') && !loading && messages.length) {
    loading = true;
    try {
      const page = await getDocs(query(collection(session.db, 'luxConversations', session.uid, 'messages'), orderBy('createdAt', 'desc'), startAfter(oldestCursor), limit(40)));
      older.push(...page.docs.map(d => ({ id: d.id, ...d.data() })));
      oldestCursor = page.docs.at(-1) || oldestCursor;
      moreMessages = page.size === 40;
    } catch (error) { showError(error); } finally { loading = false; paint(); }
  }
});
root.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  const input = root.querySelector('#lux-message');
  const value = input.value;
  sending = true; input.disabled = true;
  try {
    await load();
    await sendMessage(session.db, session.uid, 'customer', value, selected);
    try { localStorage.setItem('lux-chat-used', '1'); } catch {}
    const current = root.querySelector('#lux-message'); if (current) current.value = '';
    prefill = '';
    selected = null;
    paint();
  } catch (error) { input.disabled = false; showError(error); }
  finally { sending = false; root.querySelector('#lux-message')?.removeAttribute('disabled'); }
});
document.addEventListener('visibilitychange', acknowledge);
paint();
// Restore the inbox badge only when this browser already has a retained chat session.
try { if (localStorage.getItem('lux-chat-used') === '1') load().catch(() => {}); } catch {}
const originalOpen = openChat;
export { originalOpen as showChat };
