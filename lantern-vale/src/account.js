// 帳號登入／註冊／登出 ＋ 多帳號存檔隔離 ＋ 刪除角色系統（支援離線 localStorage 與未來伺服器擴充）

const ACCOUNTS_KEY = 'lv_accounts_v1';
const CURRENT_KEY = 'lv_current_account_v1';

function getStore(storage) {
  if (storage) return storage;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function normalizeUsername(raw = '') {
  return String(raw || '').trim().replace(/\s+/g, '');
}

export function hashPassword(pw = '', salt = 'lv_salt_2026') {
  const s = `${salt}:${String(pw)}:${salt}`;
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function listAccounts(storage) {
  const st = getStore(storage);
  if (!st) return {};
  try { return JSON.parse(st.getItem(ACCOUNTS_KEY) || '{}') || {}; } catch { return {}; }
}

function saveAccounts(map, storage) {
  const st = getStore(storage);
  if (!st) return;
  try { st.setItem(ACCOUNTS_KEY, JSON.stringify(map)); } catch {}
}

export function getActiveAccount(storage) {
  const st = getStore(storage);
  if (!st) return { username: 'guest', isGuest: true };
  try {
    const u = st.getItem(CURRENT_KEY);
    if (u && u !== 'guest') return { username: u, isGuest: false };
  } catch {}
  return { username: 'guest', isGuest: true };
}

export function accountPrefix(username) {
  const u = normalizeUsername(username);
  if (!u || u === 'guest') return '';
  return `acct_${u.toLowerCase()}_`;
}

export function activePrefix(storage) {
  return accountPrefix(getActiveAccount(storage).username);
}

export function slotKeys(slot = 0, username = null, storage = null) {
  const s = Number.isInteger(slot) && slot >= 0 ? slot : 0;
  const pref = username !== null ? accountPrefix(username) : activePrefix(storage);
  return {
    charKey: pref + (s === 0 ? 'lv_prof' : 'lv_prof_' + s),
    profileKey: pref + (s === 0 ? 'lv_profile' : 'lv_profile_' + s),
    bestKey: pref + (s === 0 ? 'lv_best' : 'lv_best_' + s),
    activeSlotKey: pref + 'lv_active_slot',
  };
}

export function registerAccount(username, password, storage) {
  const u = normalizeUsername(username);
  if (u.length < 2 || u.length > 20) return { ok: false, reason: '帳號長度需為 2–20 個字元' };
  if (u.toLowerCase() === 'guest') return { ok: false, reason: 'guest 為保留訪客名稱，請換一個帳號' };
  if (!password || String(password).length < 4) return { ok: false, reason: '密碼至少需 4 個字元' };
  const accounts = listAccounts(storage);
  const id = u.toLowerCase();
  if (accounts[id]) return { ok: false, reason: '此帳號已被註冊，請直接登入或換一個名稱' };
  accounts[id] = {
    username: u,
    pwHash: hashPassword(password, id),
    createdAt: Date.now(),
  };
  saveAccounts(accounts, storage);
  const st = getStore(storage);
  try { st?.setItem(CURRENT_KEY, u); } catch {}
  return { ok: true, account: { username: u, isGuest: false } };
}

export function loginAccount(username, password, storage) {
  const u = normalizeUsername(username);
  if (!u) return { ok: false, reason: '請輸入帳號' };
  if (u.toLowerCase() === 'guest') {
    const st = getStore(storage);
    try { st?.setItem(CURRENT_KEY, 'guest'); } catch {}
    return { ok: true, account: { username: 'guest', isGuest: true } };
  }
  const accounts = listAccounts(storage);
  const rec = accounts[u.toLowerCase()];
  if (!rec) return { ok: false, reason: '查無此帳號，請先點「註冊新帳號」' };
  if (rec.pwHash !== hashPassword(password, u.toLowerCase())) {
    return { ok: false, reason: '密碼錯誤，請再試一次' };
  }
  const st = getStore(storage);
  try { st?.setItem(CURRENT_KEY, rec.username); } catch {}
  return { ok: true, account: { username: rec.username, isGuest: false } };
}

export function logoutAccount(storage) {
  const st = getStore(storage);
  try { st?.setItem(CURRENT_KEY, 'guest'); } catch {}
  return { ok: true, account: { username: 'guest', isGuest: true } };
}

export function deleteCharacterSlot(slot = 0, username = null, storage = null) {
  const st = getStore(storage);
  const keys = slotKeys(slot, username, storage);
  const cleared = [keys.charKey, keys.profileKey, keys.bestKey];
  if (st) {
    for (const k of cleared) {
      try { st.removeItem(k); } catch {}
    }
  }
  return { ok: true, slot, clearedKeys: cleared };
}

export function slotHasData(slot = 0, username = null, storage = null) {
  const st = getStore(storage);
  if (!st) return false;
  const k = slotKeys(slot, username, storage);
  try {
    return !!(st.getItem(k.charKey) || st.getItem(k.profileKey));
  } catch {
    return false;
  }
}

export function getAccountSummary(username = null, storage = null) {
  const st = getStore(storage);
  const acct = username !== null ? { username, isGuest: !username || username === 'guest' } : getActiveAccount(storage);
  let usedSlots = 0, totalLevels = 0;
  for (let i = 0; i < 3; i++) {
    const k = slotKeys(i, acct.username, storage);
    const hasC = st?.getItem(k.charKey);
    const hasP = st?.getItem(k.profileKey);
    if (hasC || hasP) {
      usedSlots++;
      try { totalLevels += (JSON.parse(hasP || '{}')?.level || 1); } catch { totalLevels += 1; }
    }
  }
  return { ...acct, usedSlots, totalLevels };
}

export function exportAccountData(username = null, storage = null) {
  const st = getStore(storage);
  const acct = username !== null ? { username } : getActiveAccount(storage);
  const data = { version: 1, username: acct.username, exportedAt: Date.now(), slots: {} };
  if (st) {
    for (let i = 0; i < 3; i++) {
      const k = slotKeys(i, acct.username, storage);
      const ch = st.getItem(k.charKey);
      const pr = st.getItem(k.profileKey);
      const bs = st.getItem(k.bestKey);
      if (ch || pr || bs) data.slots[i] = { ch, pr, bs };
    }
  }
  return JSON.stringify(data);
}

export function importAccountData(jsonStr, username = null, storage = null) {
  const st = getStore(storage);
  if (!st) return { ok: false, reason: '無法存取瀏覽器存檔空間' };
  let parsed;
  try { parsed = JSON.parse(String(jsonStr || '').trim()); } catch { return { ok: false, reason: '備份碼格式錯誤（非有效 JSON）' }; }
  if (!parsed?.slots || typeof parsed.slots !== 'object') return { ok: false, reason: '備份碼內容不完整' };
  const acct = username !== null ? { username } : getActiveAccount(storage);
  let restored = 0;
  for (let i = 0; i < 3; i++) {
    const s = parsed.slots[i];
    if (!s) continue;
    const k = slotKeys(i, acct.username, storage);
    if (typeof s.ch === 'string') st.setItem(k.charKey, s.ch);
    if (typeof s.pr === 'string') st.setItem(k.profileKey, s.pr);
    if (typeof s.bs === 'string') st.setItem(k.bestKey, s.bs);
    restored++;
  }
  return { ok: true, restored };
}
