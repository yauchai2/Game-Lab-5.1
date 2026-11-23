// Phase 3C：v5 藍圖特殊淺區地貌互動玩法引擎 ＋ PoE 2 五大拓撲元資料
// 對應 src/field_blueprints.js 的 family 與 bpCell === 1（shallowKind）

export const FAMILY_META = {
  open:   { id: 'open',   icon: '🌾', name: '開闊爽刷型', tag: 'Wide-Open Blaster', color: '#4e9e4c', desc: '寬闊視野與高密度怪群，適合高速連鎖清圖。' },
  linear: { id: 'linear', icon: '⚡', name: '高速線性型', tag: 'Fast Linear',       color: '#3e8fd6', desc: '單向推進不回頭，搭配滑翔捷徑直衝終點。' },
  ring:   { id: 'ring',   icon: '⭕', name: '開放環形競技', tag: 'Open Ring Arena',   color: '#d8683a', desc: '巨型環狀主軸圍繞中央核心，四面來敵爽感拉滿。' },
  hybrid: { id: 'hybrid', icon: '🏝️', name: '混合跳島型', tag: 'Hybrid Islands',    color: '#8b5fd6', desc: '拱橋與滑翔上升氣流串聯浮島，立體機動首選。' },
  maze:   { id: 'maze',   icon: '🌿', name: '立體迷宮型', tag: 'Dense Labyrinth',   color: '#2c8c78', desc: '高低交錯林道與多條捷徑通道，暗藏秘境寶箱。' },
};

export const TERRAIN_EFFECTS = {
  ice_lake: {
    id: 'ice_lake', icon: '⛸️', name: '極寒冰湖', short: '冰面滑行 +38%',
    pillClass: 'st-terrain-ice', surfaceBase: 'ice',
    speedMult: 1.38, accelRate: 3.4, color: 0x9cf0ff,
    desc: '踩上冰面獲得高速滑行加速與慣性；火法術可融冰化為導電蒸汽雲。',
    tip: '⛸️ 踏入極寒冰湖：獲得高速滑行！以火屬性技能命中可融冰引發高溫蒸汽雲。',
  },
  lava_moat: {
    id: 'lava_moat', icon: '🔥', name: '熔岩護城河', short: '熔岩灼熱',
    pillClass: 'st-terrain-lava', surfaceBase: 'magma',
    speedMult: 0.92, accelRate: 14, hazard: 'lava', color: 0xff6a30,
    desc: '魔物踏入將持續灼燒；玩家徒步接觸會受熱傷（騎乘坐騎或滑翔可免疫），水／冰法術可急冷為蒸汽雲。',
    tip: '🔥 警告：熔岩護城河高溫灼熱！可乘坐騎、滑翔越過，或以冰／水法術引發急冷蒸汽！',
  },
  creek: {
    id: 'creek', icon: '🌊', name: '淺水清溪', short: '涉水潮濕',
    pillClass: 'st-terrain-water', surfaceBase: 'water',
    speedMult: 0.94, accelRate: 14, wet: true, color: 0x58c4ee,
    desc: '立即撲滅灼燒並附帶潮濕；冰／雷技能命中溪面將觸發結冰滑倒或大範圍感電連鎖！',
    tip: '🌊 踏入淺水清溪：已撲滅灼燒！在此施放雷／冰技能可立即引發感電水窪與水面結冰！',
  },
  lagoon: {
    id: 'lagoon', icon: '🌊', name: '珊瑚潮池', short: '潮池涉水',
    pillClass: 'st-terrain-water', surfaceBase: 'water',
    speedMult: 0.94, accelRate: 14, wet: true, color: 0x48d2e8,
    desc: '淺海潮池附帶潮濕效果，與雷／冰技能產生強力水域連鎖反應。',
    tip: '🌊 踏入珊瑚潮池：潮濕狀態可讓雷／冰技能觸發大範圍感電與凍結！',
  },
  koi_pond: {
    id: 'koi_pond', icon: '🌸', name: '錦鯉運河', short: '花溪涉水',
    pillClass: 'st-terrain-water', surfaceBase: 'water',
    speedMult: 0.96, accelRate: 14, wet: true, color: 0x62c8f0,
    desc: '淺水花溪可撲滅火焰並與冰／雷／火技能觸發環境連鎖反應。',
    tip: '🌸 踏入錦鯉運河：涉水潮濕可觸發水面結冰、感電水窪與水火蒸汽！',
  },
  alpine_lake: {
    id: 'alpine_lake', icon: '💧', name: '高山鏡湖', short: '鏡湖涉水',
    pillClass: 'st-terrain-water', surfaceBase: 'water',
    speedMult: 0.95, accelRate: 14, wet: true, color: 0x5cc4f5,
    desc: '清澈高山淺湖可撲滅灼燒，讓冰雷法術引發大範圍水域元素連鎖。',
    tip: '💧 踏入高山鏡湖：施放冰／雷法術可立即凍結或電擊整片湖面！',
  },
  electric_canal: {
    id: 'electric_canal', icon: '⚡', name: '電光運河', short: '電能充能 +15%',
    pillClass: 'st-terrain-elec', surfaceBase: 'water',
    speedMult: 1.15, accelRate: 14, manaRegen: 6.5, wet: true, color: 0x70e8ff,
    desc: '充滿星電能量的淺渠，提升 15% 移速並加速回魔，踏入的魔物將持續感電！',
    tip: '⚡ 踏入電光運河：移速提升並快速回復魔力，敵人踏入將陷入感電易傷！',
  },
  poison_bog: {
    id: 'poison_bog', icon: '🧪', name: '劇毒泥沼', short: '毒沼緩行',
    pillClass: 'st-terrain-poison', surfaceBase: 'poison',
    speedMult: 0.86, accelRate: 14, hazard: 'poison', color: 0x52c868,
    desc: '泥沼會使敵人中毒；以火屬性技能點燃沼面將引發劇烈「劇毒爆燃」！',
    tip: '🧪 踏入劇毒泥沼：對沼澤施放火屬性技能可直接引爆劇毒爆燃！',
  },
  marsh: {
    id: 'marsh', icon: '🌫️', name: '迷霧濕地', short: '濕地毒霧',
    pillClass: 'st-terrain-poison', surfaceBase: 'poison',
    speedMult: 0.88, accelRate: 14, hazard: 'poison', color: 0x62b884,
    desc: '沼氣瀰漫的淺濕地使敵人中毒，火屬性法術可將沼氣引爆成烈焰爆燃！',
    tip: '🌫️ 踏入迷霧濕地：敵人將持續中毒，使用火技能可引爆毒霧！',
  },
  spirit_spring: {
    id: 'spirit_spring', icon: '✨', name: '古樹靈泉', short: '靈泉療癒',
    pillClass: 'st-terrain-heal', surfaceBase: 'water',
    speedMult: 1.04, accelRate: 14, healHpPct: 0.042, manaRegen: 11, wet: true, color: 0x7ff5c8,
    desc: '古林靈泉持續回復生命與魔力，並淨化中毒與灼燒。',
    tip: '✨ 踏入古樹靈泉：持續回復生命與魔力，並淨化異常狀態！',
  },
  hot_spring: {
    id: 'hot_spring', icon: '♨️', name: '紅楓秘境溫泉', short: '溫泉療癒',
    pillClass: 'st-terrain-heal', surfaceBase: 'water',
    speedMult: 1.02, accelRate: 14, healHpPct: 0.05, manaRegen: 13, wet: true, color: 0xffc88a,
    desc: '溫暖泉水快速回復生命與魔力，並淨化所有負面狀態。',
    tip: '♨️ 泡入紅楓秘境溫泉：生命與魔力快速回復，同時淨化異常狀態！',
  },
  cloud_sea: {
    id: 'cloud_sea', icon: '☁️', name: '浮空雲氣', short: '雲氣輕身 +14%',
    pillClass: 'st-terrain-cloud', surfaceBase: null,
    speedMult: 1.14, accelRate: 11, jumpBonus: 1.15, color: 0xdff4ff,
    desc: '上升雲氣托舉身軀，提升移動速度與跳躍高度，便於銜接滑翔。',
    tip: '☁️ 踏入浮空雲氣：身輕如燕，移動速度與跳躍高度提升！',
  },
};

export function getTerrainEffect(shallowKind) {
  return shallowKind ? (TERRAIN_EFFECTS[shallowKind] || null) : null;
}

export function updateFieldTerrainFx(g, dt) {
  const p = g.player;
  if (!g.field || !g.world?.bpCell) {
    if (p) p.terrainFx = null;
    return;
  }

  // 1. 玩家腳下特殊地貌偵測（跳起或攀爬或站在橋上時不觸發淺區效果）
  const sk = (!p.air && !p.climbing) ? g.world.shallowAt?.(p.pos.x, p.pos.z) : null;
  const fx = getTerrainEffect(sk);
  p.terrainFx = fx;

  if (fx) {
    g._terrainTipsShown = g._terrainTipsShown || new Set();
    if (fx.tip && !g._terrainTipsShown.has(fx.id)) {
      g._terrainTipsShown.add(fx.id);
      g.ui?.toast?.(fx.tip, '#' + fx.color.toString(16).padStart(6, '0'));
    }

    const moving = Math.hypot(p.vel.x, p.vel.z) > 0.8;
    // 潮濕狀態立即撲滅灼燒
    if (fx.wet && p.statuses) {
      p.statuses.burn = 0;
      p.wet = 1.6;
    }
    // 靈泉／溫泉回復＋淨化
    if (fx.healHpPct) {
      const S = p.stats;
      if (p.hp < S.maxHp) p.hp = Math.min(S.maxHp, p.hp + S.maxHp * fx.healHpPct * dt);
      if (p.statuses) { p.statuses.poison = 0; p.statuses.burn = 0; p.statuses.chill = 0; }
      if (Math.random() < dt * 7) {
        g.puffs?.emit?.(p.pos.x + (Math.random() - 0.5) * 0.8, p.y + 0.15, p.pos.z + (Math.random() - 0.5) * 0.8, { c: fx.color, s: 0.22, up: 1.4, g: -0.4, life: 0.75, grow: 1.4 });
      }
    }
    // 魔力回復（電光運河／溫泉／靈泉）
    if (fx.manaRegen) {
      p.mana = Math.min(p.stats.mana, p.mana + fx.manaRegen * dt);
    }
    // 腳下視覺粒子（冰晶／水花／電花／雲氣）
    if (fx.id === 'ice_lake' && moving && Math.random() < dt * 14) {
      g.fx?.burst?.(p.pos.x, p.y + 0.08, p.pos.z, 2, { c: [0x9cf0ff, 0xffffff], s: 0.08, speed: 1.8, up: 0.8, life: 0.35 });
    } else if (fx.wet && !fx.healHpPct && moving && Math.random() < dt * 11) {
      g.fx?.burst?.(p.pos.x, p.y + 0.08, p.pos.z, 2, { c: [fx.color, 0xffffff], s: 0.08, speed: 1.9, up: 1.3, life: 0.34 });
    } else if (fx.id === 'electric_canal' && Math.random() < dt * 9) {
      g.fx?.burst?.(p.pos.x, p.y + 0.25, p.pos.z, 2, { c: [0x70e8ff, 0xffffff, 0xc88cff], s: 0.08, speed: 2.4, up: 1.5, life: 0.3 });
    } else if (fx.id === 'cloud_sea' && Math.random() < dt * 8) {
      g.puffs?.emit?.(p.pos.x, p.y + 0.08, p.pos.z, { c: 0xf4fbff, s: 0.24, up: 0.6, g: -0.2, life: 0.55, grow: 1.3 });
    }

    // 危險地貌（熔岩／毒沼）：乘坐騎免疫，溫和提示性傷害不會秒殺玩家
    if (fx.hazard && !g.mount?.def) {
      g._terrainHazTick = (g._terrainHazTick || 0) + dt;
      const interval = fx.hazard === 'lava' ? 0.85 : 1.35;
      if (g._terrainHazTick >= interval) {
        g._terrainHazTick = 0;
        if (fx.hazard === 'lava') {
          const dmg = Math.max(2, Math.round(p.stats.maxHp * 0.02));
          p.hp = Math.max(1, p.hp - dmg);
          g.ui?.dmgNum?.(p.pos.x, p.y + 1.5, p.pos.z, dmg, 'fire');
          g.fx?.burst?.(p.pos.x, p.y + 0.2, p.pos.z, 6, { c: [0xff6a30, 0xffd25a], s: 0.1, speed: 2.6, up: 2.2, life: 0.4 });
        } else if (fx.hazard === 'poison' && p.statuses) {
          p.statuses.poison = Math.max(p.statuses.poison || 0, 1.8);
          g.fx?.burst?.(p.pos.x, p.y + 0.2, p.pos.z, 5, { c: [0x52c868, 0xa86ae0], s: 0.09, speed: 2.0, up: 1.8, life: 0.4 });
        }
      }
    }
  } else {
    g._terrainHazTick = 0;
    if (p.wet > 0) p.wet = Math.max(0, p.wet - dt);
  }

  // 2. 魔物特殊地貌節流結算（每 0.6 秒掃描一次，效能零負擔）
  g._terrainEnemyTick = (g._terrainEnemyTick || 0) - dt;
  if (g._terrainEnemyTick <= 0) {
    g._terrainEnemyTick = 0.6;
    for (const e of g.enemies || []) {
      if (e.dead || e.flying || e.type === 'skyray') continue;
      if (e.wet > 0) e.wet = Math.max(0, e.wet - 0.6);
      const esk = g.world.shallowAt?.(e.pos.x, e.pos.z);
      const efx = getTerrainEffect(esk);
      if (!efx) continue;
      e.statuses = e.statuses || { poison: 0, freeze: 0, burn: 0, shock: 0 };
      if (efx.wet) e.wet = 2.0;
      if (efx.id === 'lava_moat') {
        e.statuses.burn = Math.max(e.statuses.burn || 0, 3.0);
        const dmg = Math.max(2, Math.round((e.maxHp || 30) * 0.025));
        e.hp = Math.max(1, e.hp - dmg);
        g.fx?.burst?.(e.pos.x, e.pos.y + 0.3, e.pos.z, 3, { c: [0xff6a30, 0xffd25a], s: 0.09, speed: 2.0, up: 2.0, life: 0.35 });
      } else if (efx.id === 'ice_lake') {
        e.slow = Math.max(e.slow || 0, 1.4);
      } else if (efx.id === 'electric_canal') {
        e.statuses.shock = Math.max(e.statuses.shock || 0, 3.0);
      } else if (efx.hazard === 'poison') {
        e.statuses.poison = Math.max(e.statuses.poison || 0, 3.2);
      }
    }
  }
}
