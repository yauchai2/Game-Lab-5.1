// Beaconfall Phase 3: region lore, region bosses, region quest lines, NPC one-liners and Lore Fragments.
//
// Pure data + logic, no DOM and no THREE, so it runs unchanged under Node tests.
// All text lives in data/lore.json (display text only; item ids and save keys are untouched).
//
// Saved state (inside the existing profile fields, no schema bump):
//   p.loreFragments            ['lf_1_03', ...]      collected fragment ids (field already exists since schema v2)
//   p.storyFlags.rq            { q, stats, talked }  region quest lines
//     q[questId]   = { have: [n per goal], done }
//     stats[field] = { kill, elite, gather, chest }  lifetime counters per region (used by fragment sources)
//     talked[npc]  = true
import LORE from '../data/lore.json' with { type: 'json' };

export const LORE_DATA = LORE;
export const LORE_FIELDS = [1, 2, 3, 4, 5, 6];

// ---------- static lookups ----------
export const regionLore = field => LORE.regions[field] || null;
export const regionBossKey = field => LORE.regions[field]?.boss || null;
export const bossLore = key => LORE.bosses[key] || null;
export const bossLoreForField = field => bossLore(regionBossKey(field));
export const regionNpcs = field => LORE.npcs[field] || [];
export const regionQuests = field => LORE.quests[field] || [];
export const regionFragments = field => LORE.fragments[field] || [];
export const allFragments = () => LORE_FIELDS.flatMap(f => regionFragments(f));
export const fragmentById = id => allFragments().find(f => f.id === id) || null;
export const questById = id => { for (const f of LORE_FIELDS) { const q = regionQuests(f).find(x => x.id === id); if (q) return q; } return null; };
export const townLines = name => LORE.town.bots[name] || LORE.town.harbor[name] || null;
/** Boss bar text, e.g. "Cleaver Tusk · 裂地獠牙". */
export function bossDisplayName(field) {
  const b = bossLoreForField(field);
  return b ? (b.title ? `${b.name} · ${b.title}` : b.name) : null;
}
/** What the player knows about Morvane at this region (plan: staged reveal). */
export const morvaneStage = field => LORE.morvane.find(s => s.regions.includes(field)) || null;

// ---------- reward text ----------
export function rewardText(r = {}) {
  const parts = [];
  if (r.xp) parts.push(`XP ${r.xp}`);
  if (r.coins) parts.push(`金幣 ${r.coins}`);
  if (r.shards) parts.push(`星砂 ${r.shards}`);
  if (r.keys) parts.push(`鑰石 ${r.keys}`);
  return parts.join(' · ');
}

// ---------- state ----------
export function ensureLoreState(p) {
  if (!Array.isArray(p.loreFragments)) p.loreFragments = [];
  if (!p.storyFlags || typeof p.storyFlags !== 'object') p.storyFlags = {};
  const rq = p.storyFlags.rq && typeof p.storyFlags.rq === 'object' ? p.storyFlags.rq : (p.storyFlags.rq = {});
  if (!rq.q || typeof rq.q !== 'object') rq.q = {};
  if (!rq.stats || typeof rq.stats !== 'object') rq.stats = {};
  if (!rq.talked || typeof rq.talked !== 'object') rq.talked = {};
  return rq;
}
const statsOf = (rq, field) => rq.stats[field] || (rq.stats[field] = { kill: 0, elite: 0, gather: 0, chest: 0 });

export const fragmentCount = (p, field) => regionFragments(field).filter(f => (p.loreFragments || []).includes(f.id)).length;
export const hasFragment = (p, id) => (p.loreFragments || []).includes(id);
export function litLanternsBeyondFirst(p, field) {
  const prefix = field + ':';
  return Math.max(0, (p.litLanterns || []).filter(id => typeof id === 'string' && id.startsWith(prefix)).length - 1);
}

/** The quest currently in progress for a region (first one not done), or null when the line is finished. */
export function activeQuest(p, field) {
  const rq = ensureLoreState(p);
  return regionQuests(field).find(q => !rq.q[q.id]?.done) || null;
}
export const regionDone = (p, field) => activeQuest(p, field) === null;
export function regionQuestCounts(p, field) {
  const rq = ensureLoreState(p), list = regionQuests(field);
  return { done: list.filter(q => rq.q[q.id]?.done).length, total: list.length };
}

/** Per-goal progress for a quest: [{ goal, have, need, done }]. Lantern and fragment goals read the live profile. */
export function questProgress(p, q) {
  const rq = ensureLoreState(p), st = rq.q[q.id];
  const field = Number(Object.keys(LORE.quests).find(f => LORE.quests[f].some(x => x.id === q.id)));
  return q.goals.map((goal, i) => {
    let have;
    if (st?.done) have = goal.n;
    else if (goal.k === 'lantern') have = litLanternsBeyondFirst(p, field);
    else if (goal.k === 'fragment') have = fragmentCount(p, field);
    else have = st?.have?.[i] || 0;
    have = Math.min(goal.n, have);
    return { goal, have, need: goal.n, done: have >= goal.n };
  });
}

function unlockFragment(p, frag, out) {
  if (!frag || p.loreFragments.includes(frag.id)) return false;
  p.loreFragments.push(frag.id);
  out.fragments.push(frag);
  return true;
}

function completeQuest(p, q, out) {
  const rq = ensureLoreState(p);
  const st = rq.q[q.id] || (rq.q[q.id] = { have: q.goals.map(() => 0), done: false });
  st.done = true; st.have = q.goals.map(g => g.n);
  const r = q.reward || {};
  if (r.coins) p.coins = (p.coins || 0) + r.coins;
  if (r.shards) p.shards = (p.shards || 0) + r.shards;
  if (r.keys) p.keys = (p.keys || 0) + r.keys;
  out.xp += r.xp || 0;
  out.quests.push(q);
  for (const f of allFragments()) if (f.src.k === 'quest' && f.src.id === q.id) unlockFragment(p, f, out);
}

/**
 * Feed one game event into the lore layer.
 *   ev = { field, kind: 'kill'|'gather'|'chest'|'talk'|'lantern'|'sync', elite?, boss?, npc?, idx? }
 * `field` is the current field id (0 = town). Returns { quests, fragments, xp, changed }.
 * Coins, shards and keys are applied here; the caller grants `xp` through its own level-up path.
 */
export function recordLoreEvent(p, ev) {
  const rq = ensureLoreState(p);
  const out = { quests: [], fragments: [], xp: 0, changed: false };
  const field = ev.field | 0;
  const inRegion = LORE_FIELDS.includes(field);
  const frags0 = p.loreFragments.length;

  // 1. lifetime counters and fragment sources that depend on them
  if (inRegion) {
    const s = statsOf(rq, field);
    if (ev.kind === 'kill') { s.kill++; if (ev.elite) s.elite++; }
    if (ev.kind === 'gather') s.gather++;
    if (ev.kind === 'chest') s.chest++;
    for (const f of regionFragments(field)) {
      const k = f.src.k;
      if (k === 'elite' && ev.kind === 'kill' && s.elite >= f.src.n) unlockFragment(p, f, out);
      else if (k === 'gather' && ev.kind === 'gather' && s.gather >= f.src.n) unlockFragment(p, f, out);
      else if (k === 'chest' && ev.kind === 'chest' && s.chest >= f.src.n) unlockFragment(p, f, out);
      else if (k === 'kill' && ev.kind === 'kill' && s.kill >= f.src.n) unlockFragment(p, f, out);
      else if (k === 'boss' && ev.kind === 'kill' && ev.boss) unlockFragment(p, f, out);
      else if (k === 'lantern' && ev.kind === 'lantern' && ev.idx === f.src.idx) unlockFragment(p, f, out);
    }
  }
  if (ev.kind === 'talk' && ev.npc) {
    rq.talked[ev.npc] = true;
    for (const f of allFragments()) if (f.src.k === 'talk' && f.src.npc === ev.npc) unlockFragment(p, f, out);
  }

  // 2. advance the active quest of every region, then complete anything that is satisfied
  for (const R of LORE_FIELDS) {
    for (let guard = 0; guard < 10; guard++) {
      const q = activeQuest(p, R);
      if (!q) break;
      const st = rq.q[q.id] || (rq.q[q.id] = { have: q.goals.map(() => 0), done: false });
      q.goals.forEach((g, i) => {
        const here = g.at === 'town' ? field === 0 : field === R;
        if (guard > 0 || !here || ev.kind === 'sync' || ev.kind === 'lantern') return;   // one event feeds one quest only
        let add = 0;
        if (g.k === 'kill' && ev.kind === 'kill') add = 1;
        else if (g.k === 'elite' && ev.kind === 'kill' && ev.elite) add = 1;
        else if (g.k === 'boss' && ev.kind === 'kill' && ev.boss) add = 1;
        else if (g.k === 'gather' && ev.kind === 'gather') add = 1;
        else if (g.k === 'chest' && ev.kind === 'chest') add = 1;
        else if (g.k === 'talk' && ev.kind === 'talk' && ev.npc === g.npc) add = 1;
        if (add) st.have[i] = Math.min(g.n, (st.have[i] || 0) + add);
      });
      if (questProgress(p, q).every(x => x.done)) completeQuest(p, q, out); else break;
    }
  }
  out.changed = out.quests.length > 0 || p.loreFragments.length !== frags0;
  return out;
}

/**
 * One-line summary for the HUD tracker: the active quest of the current region.
 * In town (field 0) it only shows when region 1's active quest has a goal that is done in town (talk to Hale).
 */
export function trackerLine(p, field) {
  let region = field;
  if (!field) {
    const q1 = activeQuest(p, 1);
    region = q1 && q1.goals.some(g => g.at === 'town' && !questProgress(p, q1).find(x => x.goal === g)?.done) ? 1 : 0;
  }
  if (!LORE_FIELDS.includes(region)) return null;
  const q = activeQuest(p, region);
  if (!q) return null;
  const prog = questProgress(p, q);
  const goal = prog.find(x => !x.done) || prog[0];
  return { title: q.title, text: `${goal.goal.text}（${goal.have}/${goal.need}）` };
}

// ---------- Codex cards ----------
const npcNameById = id => {
  for (const f of LORE_FIELDS) { const n = regionNpcs(f).find(x => x.id === id); if (n) return n.name; }
  return id === 'hale' ? LORE.town.hale.name : id;
};
/** Where a not-yet-found fragment comes from (shown in the Codex instead of its text). */
export function fragmentHint(frag) {
  const s = frag.src;
  switch (s.k) {
    case 'talk': return `與 ${npcNameById(s.npc)} 交談`;
    case 'quest': return `完成任務「${questById(s.id)?.title || s.id}」`;
    case 'lantern': return `在本區點亮第 ${s.idx} 盞新星燈`;
    case 'boss': return `擊敗 ${bossLoreForField(Number(frag.id.split('_')[1]))?.name || '區域首領'}`;
    case 'elite': return `在本區累計擊敗 ${s.n} 隻精英`;
    case 'gather': return `在本區累計採集 ${s.n} 次`;
    case 'chest': return `在本區打開第 ${s.n} 個高台寶箱`;
    case 'kill': return `在本區累計擊敗 ${s.n} 隻魔物`;
    default: return '探索本區';
  }
}
/** Codex cards for the Lore tab: collection summary, then per region: overview, boss, quests, people, fragments. */
export function loreCards(p) {
  ensureLoreState(p);
  const cards = [];
  const total = allFragments().length;
  cards.push({ icon: '🔖', name: `傳說碎片 ${p.loreFragments.filter(id => fragmentById(id)).length}/${total}`, sub: 'Lore Fragments',
    desc: '用探索、任務、首領與 NPC 對話取得。每區的碎片拼出 Morvane 的過去。', color: '#9fd8ff' });
  for (const f of LORE_FIELDS) {
    const r = regionLore(f), b = bossLoreForField(f), qc = regionQuestCounts(p, f), m = morvaneStage(f);
    cards.push({ icon: '🗺️', name: `${f}. ${r.name} · ${r.legacy}`, sub: `${r.levels} · ${r.faction} · 任務 ${qc.done}/${qc.total} · 碎片 ${fragmentCount(p, f)}/${regionFragments(f).length}`,
      desc: `${r.desc}<br>燈的衝突：${r.conflict}${m ? `<br>Morvane：${m.known}` : ''}`, color: '#62b85a' });
    cards.push({ icon: '👑', name: `${b.name}${b.title ? ' · ' + b.title : ''}`, sub: `${r.name} 區域首領`, desc: `${b.role}<br>${b.intro}`, color: '#d94862' });
    const act = activeQuest(p, f);
    for (const q of regionQuests(f)) {
      const done = !!ensureLoreState(p).q[q.id]?.done;
      const isAct = act?.id === q.id;
      const goals = questProgress(p, q).map(x => `${x.done ? '✔' : '▫'} ${x.goal.text}${done ? '' : `（${x.have}/${x.need}）`}`).join('<br>');
      cards.push({ icon: done ? '✅' : isAct ? '📜' : '🔒', name: q.title, sub: `${r.name} · ${done ? '已完成' : isAct ? '進行中' : '尚未開放'}`,
        desc: `${q.desc}<br>${done || isAct ? goals : '完成前一個任務後開放'}<br>獎勵：${rewardText(q.reward)}`, color: done ? '#3a9e52' : isAct ? '#ffd85a' : '#8a8a8a' });
    }
    for (const n of regionNpcs(f)) cards.push({ icon: '💬', name: n.name, sub: `${r.name} · ${n.faction}`, desc: n.lines.join('<br>'), color: '#6cb8ff' });
    for (const fr of regionFragments(f)) {
      const got = p.loreFragments.includes(fr.id);
      cards.push({ icon: got ? '🔖' : '❔', name: got ? fr.title : '？？？', sub: `${r.name} · 傳說碎片`, desc: got ? fr.text : `未取得。來源：${fragmentHint(fr)}`, color: got ? '#9fd8ff' : '#8a8a8a' });
    }
  }
  return cards;
}

// ---------- game glue (kept here so frontier.js, world_alive.js and game.js share one entry point) ----------
let xpGranter = null;
/** frontier.js registers its level-up path here so lore.js never imports it (avoids an import cycle). */
export function registerLoreXp(fn) { xpGranter = fn; }
const shownRegion = new Set();
/**
 * Report a gameplay event to the lore layer from live game code and show the toasts.
 * ev = { kind, elite?, boss?, npc?, idx? }; the current field is read from `g.field`.
 */
export function loreHook(g, ev) {
  const p = g.meta.p;
  const field = g.field || 0;
  const res = recordLoreEvent(p, { field, ...ev });
  if (res.xp && xpGranter) xpGranter(g, res.xp);
  const toast = (text, color) => g.ui?.toast?.(text, color);
  if (ev.boss) {
    const b = bossLoreForField(field);
    if (b?.defeat) toast(`👑 ${b.name} · ${b.defeat}`, '#ffd85a');
  }
  for (const q of res.quests) { toast(`📜 任務完成 · ${q.title}　${rewardText(q.reward)}`, '#ffd85a'); g.audio?.sfx?.('perfect'); }
  for (const f of res.fragments) { toast(`🔖 傳說碎片 · ${f.title}（按 Codex 查看）`, '#9fd8ff'); }
  if (res.changed) g.meta.save?.();
  return res;
}
/** Region intro toast, once per session per region, plus a sync so lantern and fragment goals re-check. */
export function loreEnterRegion(g) {
  const field = g.field || 0;
  const r = regionLore(field);
  if (!r) return;
  loreHook(g, { kind: 'sync' });
  if (!shownRegion.has(field)) { shownRegion.add(field); g.ui?.toast?.(`🗺️ ${r.enter}`, '#ffe08a'); }
}
