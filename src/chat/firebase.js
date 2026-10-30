import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInAnonymously, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, doc, collection, query, where, orderBy, limit, startAfter, getDoc, getDocs, onSnapshot, writeBatch, serverTimestamp, updateDoc, setDoc, deleteDoc, increment } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';

let connection;
export async function services() {
  if (connection) return connection;
  connection = (async () => {
    let config;
    try {
      const response = await fetch('/__/firebase/init.json');
      if (response.ok) config = await response.json();
    } catch {}
    // Hosting's reserved config can omit appId even when a Web app exists.
    if (config?.projectId === 'lux-co-south' && !config.appId) {
      config.appId = '1:352944526003:web:364113a62b707bc7c216c6';
    }
    if (!config && ['localhost', '127.0.0.1'].includes(location.hostname)) {
      const response = await fetch('/firebase-config.json');
      if (response.ok) config = await response.json();
    }
    if (!config?.apiKey || !config?.projectId || !config?.appId) throw new Error('Chat needs Firebase web configuration.');
    const app = initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);
    if (config.emulator === true && ['localhost', '127.0.0.1'].includes(location.hostname)) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    await setPersistence(auth, browserLocalPersistence);
    await auth.authStateReady();
    return { auth, db };
  })();
  try { return await connection; } catch (error) { connection = null; throw error; }
}

export async function guest() {
  const s = await services();
  if (!s.auth.currentUser) await signInAnonymously(s.auth);
  if (!s.auth.currentUser?.isAnonymous) throw new Error('A staff account is signed in here. Use another browser to inquire.');
  return { ...s, uid: s.auth.currentUser.uid };
}

export async function adminSignIn(email, password) {
  const s = await services();
  await signInWithEmailAndPassword(s.auth, email, password);
  const profile = await getDoc(doc(s.db, 'luxStaff', s.auth.currentUser.uid));
  if (!profile.exists() || profile.data().active !== true || !['owner', 'admin', 'staff'].includes(profile.data().role)) {
    await signOut(s.auth);
    throw new Error('This account has no Lux Co South chat permission.');
  }
  return { ...s, profile: profile.data() };
}

export function product(watch) {
  return { id: String(watch.id), name: String(watch.model), brand: String(watch.brand), image: watch.image || '', price: watch.price ?? null, stock: watch.stock ?? null, size: watch.size || '', movement: watch.movement || '', category: watch.category || '', dialColor: watch.dialColor || '', description: watch.description || '' };
}
export function guestName(uid) {
  let hash = 0;
  for (const char of uid) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `Guest ${String(hash % 100000).padStart(5, '0')}`;
}
export const time = value => value?.toDate?.().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) || 'Sending…';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
export { doc, collection, query, where, orderBy, limit, startAfter, getDoc, getDocs, onSnapshot, writeBatch, serverTimestamp, updateDoc, setDoc, deleteDoc, signOut };

export async function sendMessage(db, uid, senderRole, text, watch = null) {
  const clean = text.trim();
  if (!clean || clean.length > 2000) throw new Error('Enter a message of 1–2000 characters.');
  const conversation = doc(db, 'luxConversations', uid);
  const message = doc(collection(conversation, 'messages'));
  const batch = writeBatch(db);
  const now = serverTimestamp();
  const payload = { senderUid: senderRole === 'customer' ? uid : (await services()).auth.currentUser.uid, senderRole, text: clean, product: watch, createdAt: now };
  batch.set(message, payload);
  const summary = { lastMessageId: message.id, lastMessage: clean, lastMessageAt: now, lastSenderRole: senderRole, updatedAt: now };
  if (senderRole === 'customer') {
    const existing = await getDoc(conversation);
    if (!existing.exists()) batch.set(conversation, { customerUid: uid, createdAt: now, customerDeliveredAt: now, customerSeenAt: now, adminDeliveredAt: null, adminSeenAt: null, adminUnreadCount: 1, customerUnreadCount: 0, status: 'new', assignedStaffUid: null, ...summary });
    else batch.update(conversation, { ...summary, adminUnreadCount: increment(1) });
  } else batch.update(conversation, { ...summary, customerUnreadCount: increment(1) });
  await batch.commit();
  return message.id;
}
