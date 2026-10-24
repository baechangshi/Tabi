// Firebase 공통 모듈 (목록 페이지·편집기 공용)
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, query, where, orderBy,
  limit, startAfter, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

export const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');

// 로컬 에뮬레이터 테스트: 주소 뒤에 ?emu=1 을 붙이면 이 탭에서 계속 에뮬레이터를 사용합니다.
const params = new URLSearchParams(location.search);
if (params.has('emu')) sessionStorage.setItem('emu', '1');
const useEmu = sessionStorage.getItem('emu') === '1';

export let auth = null, db = null;
if (configured || useEmu) {
  const app = initializeApp(useEmu ? { apiKey: 'demo-key', projectId: 'demo-tab-studio', authDomain: '127.0.0.1' } : firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (useEmu) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}
export const enabled = !!db;

export const INSTRUMENT_NAMES = { guitar: '기타', bass4: '베이스 4줄', bass5: '베이스 5줄' };

let currentUser = null;
const listeners = new Set();
if (auth) onAuthStateChanged(auth, u => { currentUser = u; listeners.forEach(f => f(u)); });
export function onUser(fn) { listeners.add(fn); if (auth) fn(currentUser); else fn(null); }
export const getUser = () => currentUser;

export async function signIn() {
  if (!auth) throw new Error('Firebase 설정이 필요합니다.');
  const r = await signInWithPopup(auth, new GoogleAuthProvider());
  return r.user;
}
export const signOutUser = () => auth && signOut(auth);

/* ---------- 검색용 키워드 ---------- */
export function makeKeywords(...texts) {
  const set = new Set();
  for (const t of texts) {
    const words = String(t || '').toLowerCase().split(/[\s\-_/.,()[\]]+/).filter(Boolean);
    for (const w of words) for (let i = 1; i <= Math.min(w.length, 15); i++) set.add(w.slice(0, i));
  }
  return [...set].slice(0, 250);
}

/* ---------- 악보 CRUD ---------- */
// tabs/{id}      : 목록용 메타데이터 (가벼움)
// tabBodies/{id} : 악보 본문 (JSON 문자열)
export async function loadTab(id) {
  const [m, b] = await Promise.all([getDoc(doc(db, 'tabs', id)), getDoc(doc(db, 'tabBodies', id))]);
  if (!m.exists() || !b.exists()) return null;
  return { id, meta: m.data(), song: JSON.parse(b.data().body) };
}

export async function saveTab(song, existing) {
  const user = currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const isOwn = existing && existing.meta.ownerUid === user.uid;
  const id = isOwn ? existing.id : doc(collection(db, 'tabs')).id;
  const title = (song.title || '').trim() || '제목 없음';
  const ownerName = (user.displayName || user.email?.split('@')[0] || '익명').slice(0, 80);
  const lastMeasure = song.measures.reduce((acc, m, i) =>
    (m.memo || m.lyric || m.chords.some(Boolean) || m.notes.some(s => s.some(Boolean))) ? i : acc, -1);
  const meta = {
    title: title.slice(0, 120),
    titleLower: title.toLowerCase().slice(0, 120),
    artist: (song.artist || '').trim().slice(0, 120),
    instrument: song.instrument,
    tuning: song.tuning,
    capo: song.capo,
    tempo: song.tempo,
    measureCount: lastMeasure + 1,
    ownerUid: user.uid,
    ownerName,
    keywords: makeKeywords(title, song.artist, ownerName),
    updatedAt: serverTimestamp()
  };
  if (!isOwn) {
    meta.createdAt = serverTimestamp();
    if (existing) meta.forkOf = existing.id;
  }
  const body = { ownerUid: user.uid, body: JSON.stringify({ version: 2, ...song }), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(doc(db, 'tabs', id), meta, { merge: isOwn });
  batch.set(doc(db, 'tabBodies', id), body);
  await batch.commit();
  return { id, created: !isOwn };
}

export async function deleteTab(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'tabBodies', id));
  batch.delete(doc(db, 'tabs', id));
  await batch.commit();
}

/* ---------- 목록 ---------- */
export async function listTabs({ instrument = '', mine = false, sort = 'updated', search = '', after = null, pageSize = 30 }) {
  const c = [];
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean).map(w => w.slice(0, 15));
  const q = words[0] || '';
  if (q) {
    // 검색: 키워드(제목·아티스트·작성자 접두어) + 최근 수정순. 악기/내 악보 필터는 클라이언트에서 적용.
    c.push(where('keywords', 'array-contains', q.slice(0, 15)), orderBy('updatedAt', 'desc'));
  } else {
    if (instrument) c.push(where('instrument', '==', instrument));
    if (mine && currentUser) c.push(where('ownerUid', '==', currentUser.uid));
    if (sort === 'title') c.push(orderBy('titleLower', 'asc'));
    else if (sort === 'created') c.push(orderBy('createdAt', 'desc'));
    else c.push(orderBy('updatedAt', 'desc'));
  }
  if (after) c.push(startAfter(after));
  c.push(limit(pageSize));
  const snap = await getDocs(query(collection(db, 'tabs'), ...c));
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (q) {
    if (instrument) items = items.filter(x => x.instrument === instrument);
    if (mine && currentUser) items = items.filter(x => x.ownerUid === currentUser.uid);
    if (words.length > 1) items = items.filter(x => words.slice(1).every(w => (x.keywords || []).includes(w)));
  }
  return { items, last: snap.docs[snap.docs.length - 1] || null, hasMore: snap.docs.length === pageSize };
}
