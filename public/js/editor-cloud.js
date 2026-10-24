// 편집기 ↔ Firebase 연결
import { enabled, onUser, getUser, signIn, signOutUser, loadTab, saveTab, deleteTab, INSTRUMENT_NAMES } from './firebase.js';

const E = window.TabEditor;
const $ = s => document.querySelector(s);
const bSave = $('#bCloudSave'), bDel = $('#bCloudDel'), status = $('#cloudStatus'), userBox = $('#userBox');
let current = null;   // { id, meta }
let saving = false;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isOwner = () => current && getUser() && current.meta.ownerUid === getUser().uid;

function refreshUI() {
  const u = getUser();
  if (!enabled) {
    bSave.disabled = true;
    status.innerHTML = '온라인 저장 꺼짐 — <b>js/firebase-config.js</b> 설정 필요 (MD/PDF 저장은 사용 가능)';
    return;
  }
  bSave.disabled = saving;
  bDel.style.display = isOwner() ? '' : 'none';
  let txt = '';
  if (!current) txt = '새 악보 (아직 저장 안 됨)';
  else if (isOwner()) txt = '내 악보';
  else txt = `<b>${esc(current.meta.ownerName)}</b>님의 악보 · 저장하면 내 악보로 복사됩니다`;
  if (E.isDirty()) txt += ' · <span style="color:#ffcf6b">수정됨</span>';
  status.innerHTML = txt;
  bSave.textContent = current && !isOwner() ? '☁ 내 악보로 복사' : '☁ 저장';
  E.setAuthorLine(current ? `작성자: ${current.meta.ownerName}` : (u ? `작성자: ${u.displayName || ''}` : ''));
  userBox.innerHTML = u
    ? `<span class="user">${u.photoURL ? `<img src="${esc(u.photoURL)}" referrerpolicy="no-referrer" alt="">` : ''}${esc(u.displayName || u.email || '')}</span><button id="bLogout">로그아웃</button>`
    : `<button id="bLogin">Google 로그인</button>`;
  const li = $('#bLogin'), lo = $('#bLogout');
  if (li) li.onclick = () => signIn().catch(err => E.toast('로그인 실패: ' + err.message, 3000));
  if (lo) lo.onclick = () => signOutUser();
}

async function doSave() {
  if (!enabled || saving) return;
  if (!getUser()) {
    try { await signIn(); } catch (err) { E.toast('로그인이 필요합니다', 2500); return; }
  }
  const song = E.getSong();
  if (!song.title.trim()) { E.toast('제목을 입력해 주세요', 2500); document.getElementById('title')?.focus(); return; }
  saving = true; refreshUI();
  try {
    const r = await saveTab(song, current);
    const meta = { ...(current && isOwner() ? current.meta : {}), ownerUid: getUser().uid, ownerName: getUser().displayName || '익명', title: song.title };
    current = { id: r.id, meta };
    history.replaceState(null, '', 'editor.html?id=' + encodeURIComponent(r.id));
    E.setClean();
    E.toast(r.created ? '새 악보로 저장했습니다' : '저장했습니다');
  } catch (err) {
    console.error(err);
    E.toast('저장 실패: ' + (err.code || err.message), 4000);
  } finally { saving = false; refreshUI(); }
}

async function doDelete() {
  if (!isOwner()) return;
  if (!confirm(`'${current.meta.title}' 악보를 삭제할까요? 되돌릴 수 없습니다.`)) return;
  try {
    await deleteTab(current.id);
    E.setClean();
    location.href = 'index.html';
  } catch (err) { E.toast('삭제 실패: ' + (err.code || err.message), 4000); }
}

async function init() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (enabled) {
    bSave.onclick = doSave;
    bDel.onclick = doDelete;
    E.hooks.onSave = doSave;
    E.hooks.onReset = () => { current = null; history.replaceState(null, '', 'editor.html'); refreshUI(); };
    E.hooks.onDirty = () => refreshUI();
    onUser(() => refreshUI());
    if (id) {
      status.textContent = '불러오는 중…';
      try {
        const t = await loadTab(id);
        if (!t) { E.toast('악보를 찾을 수 없습니다', 3000); history.replaceState(null, '', 'editor.html'); }
        else { current = { id, meta: t.meta }; E.loadSong(t.song); }
      } catch (err) { console.error(err); E.toast('불러오기 실패: ' + (err.code || err.message), 4000); }
    }
  }
  refreshUI();
}
init();
