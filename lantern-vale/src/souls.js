// 「怪物即技能」靈魂吸收與鑲嵌系統（Blue Mage / Monster Soul Cards）
export const MONSTER_SOULS = {
  slime: {
    id: 'slime', name: '青苔史萊姆之魂', icon: '🟢', slot: 'mobility', color: '#78d464',
    title: '彈跳黏液翻滾',
    desc: '翻滾改為彈跳黏液突進，落地留下 4 秒劇毒緩速池。',
    bonuses: { maxHp: 20 },
  },
  boar: {
    id: 'boar', name: '衝鋒野豬之魂', icon: '🐗', slot: 'mobility', color: '#d87a4a',
    title: '霸體野豬衝撞',
    desc: '翻滾化為霸體衝鋒，撞飛路徑上的敵人並造成 220% 暈眩重擊。',
    bonuses: { moveSpd: 8 },
  },
  skyray: {
    id: 'skyray', name: '雲翼飛鰩之魂', icon: '🦅', slot: 'mobility', color: '#58d4f0',
    title: '雲翼上升氣流',
    desc: '跳躍高度 +30%、滑翔速度 +45%，滯空時自動發射雷光羽翼追蹤敵人。',
    bonuses: { moveSpd: 12 },
  },
  golem: {
    id: 'golem', name: '星晶巨像之魂', icon: '🗿', slot: 'mobility', color: '#6ae8ff',
    title: '星晶震地防壁',
    desc: '常駐護甲 +18%，翻滾與落地時引爆星晶震波暈眩周圍敵人。',
    bonuses: { armor: 18, maxHp: 35 },
  },
  thorn: {
    id: 'thorn', name: '棘芽射手之魂', icon: '🌵', slot: 'combat', color: '#8ad858',
    title: '三連毒棘齊射',
    desc: '普通攻擊額外朝前方扇形發射 3 枚淬毒荊棘彈。',
    bonuses: { atkSpd: 10 },
  },
  moth: {
    id: 'moth', name: '月影飛蛾之魂', icon: '🦋', slot: 'combat', color: '#c08cff',
    title: '月光爆裂印記',
    desc: '攻擊命中時於敵人腳下綻放月影法陣，延遲引爆範圍暗月傷害。',
    bonuses: { crit: 6, cdr: 8 },
  },
  stag: {
    id: 'stag', name: '古樹鹿王之魂', icon: '🦌', slot: 'combat', color: '#ffae4a',
    title: '古樹根鬚奔騰',
    desc: '施放任意主動技能時，額外召喚 3 道古樹根鬚衝擊波向前穿刺。',
    bonuses: { dmgPct: 18, area: 15 },
  },
};

export const SOUL_SLOTS = {
  mobility: { name: '移動／身法槽', icon: '💨', desc: '改變翻滾、跳躍或滑翔模組' },
  combat:   { name: '戰鬥／攻擊槽', icon: '⚔️', desc: '附加額外攻擊或施法模組' },
};

export function ensureSouls(profile) {
  if (!profile.souls || typeof profile.souls !== 'object') {
    profile.souls = { owned: [], equipped: { mobility: null, combat: null } };
  }
  if (!Array.isArray(profile.souls.owned)) profile.souls.owned = [];
  if (!profile.souls.equipped) profile.souls.equipped = { mobility: null, combat: null };
  return profile.souls;
}

export function grantSoul(profile, soulId) {
  const def = MONSTER_SOULS[soulId];
  if (!def) return { granted: false };
  const s = ensureSouls(profile);
  const isNew = !s.owned.includes(soulId);
  if (isNew) s.owned.push(soulId);
  return { granted: true, isNew, def };
}

export function rollSoulDrop(profile, enemyType, isElite = false, dropMult = 1, rng = Math.random) {
  const def = MONSTER_SOULS[enemyType];
  if (!def) return null;
  const baseChance = enemyType === 'stag' ? 1.0 : isElite ? 0.45 : 0.16;
  const chance = Math.min(1.0, baseChance * dropMult);
  if (rng() > chance) return null;
  return grantSoul(profile, enemyType);
}

export function equipSoul(profile, soulId) {
  const def = MONSTER_SOULS[soulId];
  if (!def) return false;
  const s = ensureSouls(profile);
  if (!s.owned.includes(soulId)) return false;
  s.equipped[def.slot] = soulId;
  return true;
}

export function unequipSoul(profile, slot) {
  const s = ensureSouls(profile);
  if (!(slot in s.equipped)) return false;
  s.equipped[slot] = null;
  return true;
}

export function activeSouls(profile) {
  const s = ensureSouls(profile);
  const out = {};
  if (s.equipped.mobility && MONSTER_SOULS[s.equipped.mobility]) out.mobility = MONSTER_SOULS[s.equipped.mobility];
  if (s.equipped.combat && MONSTER_SOULS[s.equipped.combat]) out.combat = MONSTER_SOULS[s.equipped.combat];
  return out;
}
