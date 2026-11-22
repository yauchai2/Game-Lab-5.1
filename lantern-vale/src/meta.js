// 跨局進度（MMO 風格）：貨幣、金羽毛、每日委託、出發詞綴、傳家寶
import { serializeItem, deserializeItem } from './loot.js';

export const MODS = [
  { id: 'swift', name: '狂暴', desc: '敵人移動速度 +25%', reward: 0.25 },
  { id: 'swarm', name: '蜂擁', desc: '每波敵人數量 +40%', reward: 0.30 },
  { id: 'tough', name: '厚皮', desc: '敵人生命 +50%', reward: 0.20 },
  { id: 'fragile', name: '脆弱', desc: '你受到的傷害 +35%', reward: 0.35 },
  { id: 'elite', name: '精英潮', desc: '精英出現機率大增', reward: 0.30 },
  { id: 'fortune', name: '惡運', desc: '藥瓶補充減半，但裝備掉落階級 +2', reward: 0.15, drop: 2 },
];
export const MOD_MAX = 2;

const QUEST_POOL = [
  { id: 'kill', text: n => `擊敗 ${n} 隻敵人`, tiers: [25, 40, 60], ev: 'kill', reward: n => 30 + n },
  { id: 'depth', text: n => `抵達第 ${n} 層`, tiers: [3, 5, 7], ev: 'depth', max: true, reward: n => 25 + n * 12 },
  { id: 'feather', text: n => `找到 ${n} 根金羽毛`, tiers: [1, 2], ev: 'feather', reward: n => 60 * n },
  { id: 'shell', text: n => `撿起 ${n} 枚貝殼`, tiers: [3, 5], ev: 'shell', reward: n => 15 * n },
  { id: 'elite', text: n => `擊敗 ${n} 隻精英`, tiers: [2, 4], ev: 'elite', reward: n => 25 * n },
  { id: 'boss', text: () => '擊敗古樹鹿王', tiers: [1], ev: 'boss', reward: () => 150 },
  { id: 'town', text: n => `與 ${n} 位鎮民交談`, tiers: [3], ev: 'talk', reward: () => 20 },
];
const today = () => new Date().toISOString().slice(0, 10);
function seeded(seed) { let s = [...seed].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381); return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

export const DEFAULT_PROFILE = { shards: 0, feathers: 0, shells: 0, heirloom: null, mods: [], quests: null, best: { depth: 0, wins: 0 }, kills: 0, runs: 0 };

export class Meta {
  constructor(slot = 0) { this.key = slot ? 'lv_profile_' + slot : 'lv_profile'; this.p = this.load(); this.rollQuests(); this.runShards = 0; }
  load() { try { return { ...structuredClone(DEFAULT_PROFILE), ...JSON.parse(localStorage.getItem(this.key) || '{}') }; } catch (e) { return { ...structuredClone(DEFAULT_PROFILE) }; } }
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.p)); } catch (e) { /* ignore */ } }
  rollQuests() {
    const d = today(); if (this.p.quests && this.p.quests.day === d) return;
    const r = seeded('lv' + d), pool = [...QUEST_POOL], list = [];
    while (list.length < 3 && pool.length) { const q = pool.splice(Math.floor(r() * pool.length), 1)[0]; const need = q.tiers[Math.floor(r() * q.tiers.length)]; list.push({ id: q.id, need, have: 0, claimed: false }); }
    this.p.quests = { day: d, list }; this.save();
  }
  def(id) { return QUEST_POOL.find(q => q.id === id); }
  questText(q) { return this.def(q.id).text(q.need); }
  questReward(q) { return this.def(q.id).reward(q.need); }
  event(ev, n = 1) {
    let changed = false;
    for (const q of this.p.quests.list) { const d = this.def(q.id); if (d.ev !== ev || q.claimed || q.have >= q.need) continue; q.have = d.max ? Math.max(q.have, n) : Math.min(q.need, q.have + n); changed = true; }
    if (changed) this.save();
    return changed;
  }
  claim(i) { const q = this.p.quests.list[i]; if (!q || q.claimed || q.have < q.need) return 0; q.claimed = true; const r = this.questReward(q); this.p.shards += r; this.save(); return r; }
  get staminaK() { return 1 / (1 + 0.08 * this.p.feathers); }
  get heirloom() { return deserializeItem(this.p.heirloom); }
  setHeirloom(it) { this.p.heirloom = serializeItem(it); this.save(); }
  // 出發詞綴加成
  activeMods() { return MODS.filter(m => this.p.mods.includes(m.id)); }
  get shardMult() { return 1 + this.activeMods().reduce((s, m) => s + m.reward, 0); }
  get dropBonus() { return this.activeMods().reduce((s, m) => s + (m.drop || 0), 0); }
  has(id) { return this.p.mods.includes(id); }
  toggleMod(id) { const i = this.p.mods.indexOf(id); if (i >= 0) this.p.mods.splice(i, 1); else if (this.p.mods.length < MOD_MAX) this.p.mods.push(id); else return false; this.save(); return true; }
}
