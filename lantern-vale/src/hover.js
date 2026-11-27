// Universal Hover & Inspect System (全境懸停反饋與互動系統)
// 涵蓋 55+ 獨立 UI 元素（顆粒級資訊卡）、Tab 小地圖標記偵測、3D 世界全物件與微音效節流
import { CLASSES, ACTIVE_GEMS, unlockedCount } from './puzzle.js';
import { FIELDS, xpForNextLevel } from './frontier.js';
import { flameSnapshot, FLAME_CFG } from './flame.js';
import { FIELD_BLUEPRINTS } from './field_blueprints.js';
import { FAMILY_META, getRealmRule } from './terrain_fx.js';
import { getFieldDanger, nextMilestone } from './progression.js';
import { getFieldHotspot, getFerrySchedule, getClassTeamRole } from './mmo_protocol.js';
import { dayInfo, findSecondClass } from './world_alive.js';
import { TIDE_PHASES, ULTIMATES, MICRO_BUFFS, lootMultForTide } from './tide.js';
import { activeMountDef } from './mounts.js';
import { RARITY, SLOTS, itemScore, tierInfo } from './loot.js';
import { partStatusText } from './parts.js';
import { SURFACE_DEFS } from './elements.js';
import { getCurrentChapter, availableStatPoints, STAT_DEFS } from './mmo_rpg.js';
import { getActiveAccount } from './account.js';
import { WORLD_REGIONS, MAP_LAYERS } from './worldmap.js';

export const STATUS_HOVER_META = {
  'st-poison':     { title: '🧪 中毒', desc: '每秒流失 3% 最大生命值（最低至 1 HP）。可透過蘋果酒、破曉大太陽或繁花聖樹淨化。' },
  'st-freeze':     { title: '❄️ 冰凍', desc: '完全無法移動與施法；在寒霜狀態下再次受冰系攻擊會觸發冰凍。' },
  'st-chill':      { title: '🧊 寒霜緩速', desc: '移動速度降低 35%；期間再次受到寒冰攻擊將轉為冰凍。' },
  'st-burn':       { title: '🔥 灼燒', desc: '每秒流失 3.5% 最大生命值。靠近水窪或施放淨化技能可提前解除。' },
  'st-shock':      { title: '⚡ 感電', desc: '承受的所有傷害提高 +20%！注意閃避高傷紅圈與精英技能。' },
  'st-overload':   { title: '💢 魔力過載', desc: '連續施法 3 次觸發！技能傷害 +25%、冷卻縮減 20%，持續期間火力全開。' },
  'st-buff-fury':  { title: '🔥 狂暴祝福', desc: '傷害 +45%、攻擊速度 +15%、移動速度 +20%。' },
  'st-buff-frost': { title: '❄️ 寒霜附魔', desc: '所有攻擊附帶 2.2 秒緩速，並有 28% 機率直接冰凍敵人（觸發碎冰 1.45× 爆發）。' },
  'st-buff-gold':  { title: '💰 祝福強化', desc: '大幅提升戰利品掉落率或下一次普攻傷害強化。' },
  'st-buff-sheep': { title: '🐑 軟綿祝福', desc: '撫摸蓬鬆小綿羊獲得：移動速度 +10%，每秒持續回復 1.5% 生命與 3 點法力。' },
  'st-spark':      { title: '✨ 歸來星火', desc: '結束自動巡遊轉為手動接管後引爆：手動掉寶率 ×1.5 倍！' },
};

export const ELEMENT_COMBO_HINTS = {
  water:             '再施放 ❄️寒冰 → 凍結成滑溜冰面 ｜ 再施放 ⚡雷電 → 連鎖感電水域',
  ice:               '敵人踩踏會滑倒暈眩！再施放 🔥火焰 → 蒸發成遮蔽視線的濃霧蒸汽',
  steam:             '遮蔽敵人視野！再施放 ⚡雷電 → 引爆 2.2× 廣域感電雷暴',
  poison:            '持續劇毒傷害！再施放 🔥火焰 → 引爆劇毒爆燃並化為熔岩',
  magma:             '高溫灼燒地帶！再施放 ❄️寒冰／水系 → 急冷蒸發',
  electrified_water: '高壓感電水域！敵人之間自動彈跳雷弧並附加感電易傷',
  electrified_steam: '終極感電雷雲！範圍內持續連鎖電弧與高額雷傷',
  sakura:            '櫻花治癒領域：友軍站入持續回血，敵人受到花瓣斬擊與緩速',
};

export const ENEMY_NAMES = {
  slime: '青苔史萊姆', thorn: '棘芽射手', boar: '衝鋒野豬',
  moth: '月影飛蛾', skyray: '雲翼飛鰩（空中）', golem: '星晶巨像', stag: '古樹鹿王',
};

export function describeStatusPill(el, g) {
  if (!el) return null;
  for (const [cls, meta] of Object.entries(STATUS_HOVER_META)) {
    if (el.classList.contains(cls)) return { title: el.textContent.trim() || meta.title, body: meta.desc };
  }
  const p = g?.player;
  if (p?.realmRule && [...el.classList].some(c => c.startsWith('st-realm-'))) {
    return { title: `${p.realmRule.icon} 異界規則 · ${p.realmRule.name}`, body: p.realmRule.desc };
  }
  if (p?.terrainFx && [...el.classList].some(c => c.startsWith('st-terrain-'))) {
    return { title: `${p.terrainFx.icon} 地貌效果 · ${p.terrainFx.name}`, body: p.terrainFx.desc };
  }
  return { title: el.textContent.trim(), body: '當前生效的狀態效果。' };
}

export function describeSkillSlot(g, idx) {
  const p = g?.player;
  const sk = p?.hotbar?.[idx];
  const keyNames = ['右鍵', 'Q', 'E', 'C'];
  const kb = g?.settings?.keybinds;
  const keyLabel = idx === 0
    ? (kb?.sk0 && kb.sk0 !== 'rmb' ? kb.sk0.toUpperCase() : '右鍵')
    : (kb?.[`sk${idx}`]?.toUpperCase() || keyNames[idx]);
  if (!sk) {
    return {
      title: '空技能位',
      key: keyLabel,
      body: '尚未配置主動技能寶石。點擊此格或按 <b>[K]</b> 開啟技能拼圖放入主動寶石。',
      foot: '💡 拼圖中把輔助寶石貼在主動寶石旁邊即可串連強化！',
    };
  }
  const { def, mod } = sk;
  const S = p.stats || {};
  const effCd = Math.max(0.12, def.cd * (1 - (S.cdr || 0) / 100) * (1 - (mod.cdr || 0)));
  const effMana = Math.round((def.mana || 0) * (mod.bluefire ? 0.75 : 1));
  const chips = [
    `⏱ 冷卻 ${effCd.toFixed(2)}s`,
    effMana > 0 ? `💧 法力 ${effMana}` : '💧 免耗魔',
    mod.dmgMult > 1.01 ? `⚔ 傷害 ×${mod.dmgMult.toFixed(2)}` : null,
    mod.area > 0 ? `◎ 範圍 +${Math.round(mod.area * 100)}%` : null,
    mod.multi > 0 ? `⇶ 投射 +${mod.multi}` : null,
    mod.chain > 0 ? `⚡ 連鎖 +${mod.chain}` : null,
    mod.echo > 0 ? `⟳ 迴響 +${mod.echo}` : null,
  ].filter(Boolean);
  const supText = mod.supports?.length
    ? `<div class="rt-sub">🔗 連動輔助：${mod.supports.map(s => `${s.icon}${s.name}`).join('、')}</div>`
    : '';
  const circ = [];
  for (const tid of mod.triggerOnHit || []) circ.push(`命中觸發 → ${ACTIVE_GEMS[tid]?.icon || ''}${ACTIVE_GEMS[tid]?.name || tid}`);
  for (const tid of mod.triggerOnCrit || []) circ.push(`暴擊觸發 → ${ACTIVE_GEMS[tid]?.icon || ''}${ACTIVE_GEMS[tid]?.name || tid}`);
  const circText = circ.length ? `<div class="rt-accent">⚡ 邏輯電路：${circ.join(' ｜ ')}</div>` : '';
  return {
    title: `${def.icon} ${def.name}`,
    key: keyLabel,
    chips,
    body: `${def.desc}${supText}${circText}`,
    foot: '點擊直接施放 · 地面光圈為預估範圍 · 設定頁可自訂快捷鍵',
  };
}

export function describeWorldTarget(hit, g) {
  if (!hit) return null;
  const p = g?.player;
  const distM = (x, z) => p ? `${Math.round(Math.hypot(x - p.pos.x, z - p.pos.z))}m` : '';
  if (hit.kind === 'enemy') {
    const e = hit.obj;
    const baseName = e.bossName || ENEMY_NAMES[e.type] || e.type;
    const lv = e.level || (g.field ? FIELDS[g.field]?.level : 1) || 1;
    const pLv = g.meta?.p?.level || 1;
    const redZone = lv - pLv >= 6;
    const st = e.statuses || {};
    const chips = [
      `Lv.${lv}`,
      `❤️ ${Math.ceil(e.hp)}/${Math.ceil(e.maxHp)}`,
      e.elite ? '★ 精英' : e.isTideBoss ? '👑 潮汐王' : e.type === 'stag' ? '👑 首領' : null,
      e.eliteMod ? e.eliteMod.name : null,
      redZone ? '🔴 越級減傷 -45%' : null,
      st.freeze > 0 ? `❄️ 冰凍 ${st.freeze.toFixed(1)}s` : null,
      st.burn > 0 ? `🔥 灼燒 ${Math.ceil(st.burn)}s` : null,
      st.poison > 0 ? `🧪 中毒 ${Math.ceil(st.poison)}s` : null,
      st.shock > 0 ? '⚡ 感電 +25%易傷' : null,
      e.blinded > 0 ? '☁️ 失明' : null,
      e.vuln > 0 ? '🎯 易傷 +30%' : null,
    ].filter(Boolean);
    const ptxt = partStatusText(e);
    const body = [
      e.flying && e.groundedT <= 0 ? '🦅 空中目標：雙擊空白鍵跳躍／滑翔空戰可擊落並觸發 1.5× 暴擊！' : '',
      ptxt ? `✂️ 可破壞部位：${ptxt}` : '',
      e.affixes?.length ? `⚠️ 詞綴：${e.affixes.map(a => a.name || a.id).join('、')}` : '',
    ].filter(Boolean).join('<br>');
    return {
      title: `⚔️ ${e.elite ? '★ ' : ''}${baseName}`,
      key: distM(e.pos.x, e.pos.z),
      chips,
      body: body || '左鍵普通攻擊或施放技能進行討伐。',
      accent: redZone ? '#ff6a6a' : e.elite ? '#ffcf4a' : '#ff8a6a',
    };
  }
  if (hit.kind === 'remote') {
    const r = hit.obj;
    const isBot = !!r.bot;
    return {
      title: `${isBot ? '💬' : '🏮'} ${r.name}`,
      key: isBot ? '點擊／F' : distM(r.x, r.z),
      chips: [isBot ? '城鎮居民' : '線上旅人', `距離 ${distM(r.x, r.z)}`],
      body: isBot ? '點擊可直接自動走近並與其交談，獲取冒險提示與城鎮秘聞。' : '同在 Beaconfall 冒險的旅人！按 1–4 可發送可愛表情打招呼。',
      accent: '#7fe08a',
    };
  }
  if (hit.kind === 'spot') {
    const s = hit.obj;
    return { title: `✦ ${s.label || '互動物件'}`, key: '點擊／F', chips: [`距離 ${distM(s.x, s.z)}`], body: '點擊直接自動走近並互動（或靠近後按 <b>[F]</b>）。', accent: '#ffd85a' };
  }
  if (hit.kind === 'exit') {
    const x = hit.obj;
    const nextF = FIELDS[(g.field || 1) + 1], prevF = FIELDS[(g.field || 1) - 1];
    const labels = {
      item: ['🎁 稀有裝備房', '下一個地城區域獎勵為稀有以上裝備。'],
      boon: ['✨ 天賦祝福房', '下一個地城區域通關後可三選一強力祝福。'],
      heal: ['♨️ 溫泉休憩房', '下一個地城區域可回復 50% 生命並補滿藥水。'],
      run: ['🌿 晨光草原入口', '踏出燈谷鎮北門，進入常駐野外草原自由探索與刷怪。'],
      town: ['🏠 返回燈谷鎮', '免清怪直接返回溫暖的燈谷鎮整裝、鍛造與存取倉庫。'],
      prevField: [prevF ? `⬅️ 返回 ${prevF.name}` : '🏠 返回燈谷鎮', prevF ? `建議 Lv.${prevF.level}` : '返回安全城鎮'],
      nextField: [nextF ? `➡️ 前往 ${nextF.name}` : '⛵ 返回海風港鎮', nextF ? `建議 Lv.${nextF.level} · 探索更高危地貌` : '前往海風港鎮'],
      dungeon: [`⛩ 副本：${FIELDS[g.field]?.dungeon || '秘境地城'}`, `消耗 1 枚副本鑰匙（現有 ${g.meta?.p?.keys || 0} 枚）進入逐層刷寶副本。`],
    };
    const [title, desc] = labels[x.type] || ['🌀 傳送門', '走入傳送門前往下一個區域。'];
    return { title, key: distM(x.x, x.z), chips: [x.on ? '已開啟' : '需淨化區域'], body: desc, accent: '#62e8ff' };
  }
  if (hit.kind === 'sheep') {
    return { title: '🐑 蓬鬆小綿羊', key: '點擊／F', chips: ['可撫摸', `距離 ${distM(hit.obj.x, hit.obj.z)}`], body: '毛茸茸的山谷小綿羊！點擊或靠近按 <b>[F]</b> 撫摸可獲得 60 秒「軟綿祝福」（移速 +10% · 緩慢回血回魔）。', accent: '#ffe49e' };
  }
  if (hit.kind === 'prop') {
    const isBall = hit.obj.kind === 'ball';
    return { title: isBall ? '🏖️ 彩色海灘球' : '🛢️ 城鎮木酒桶', key: '可踢飛', body: isBall ? '3D 物理互動玩具！走過去或揮杖就能把它踢飛彈跳。' : '可以滾動撞飛的城鎮木桶，試著揮杖把它敲飛！', accent: '#7ae8ff' };
  }
  if (hit.kind === 'pickup') {
    const isF = hit.obj.kind === 'feather';
    return { title: isF ? '🪶 金羽毛' : '🐚 山谷貝殼', key: distM(hit.obj.x, hit.obj.z), body: isF ? '永久降低攀爬與滑翔體力消耗！靠近自動拾取。' : '珍貴的貝殼收藏，可用於城鎮兌換與成就。', accent: isF ? '#ffd23a' : '#ffb8c8' };
  }
  if (hit.kind === 'campfire') return { title: '🔥 旅人營火', key: distM(hit.obj.x, hit.obj.z), body: '溫暖的野外營火！靠近即可持續回復生命與法力。', accent: '#ffa83a' };
  if (hit.kind === 'prism') return { title: '💎 折光棱鏡', key: `${Math.ceil(hit.obj.life)}s`, body: '自動鎖定 9m 內敵人並折射連鎖光束的召喚水晶。', accent: '#ffe07a' };
  if (hit.kind === 'orb') return { title: '❤️ 生命回復球', key: distM(hit.obj.g.position.x, hit.obj.g.position.z), body: '靠近自動磁吸拾取，立即回復 14% 最大生命值。', accent: '#ff6a7a' };
  if (hit.kind === 'zone') {
    const gz = hit.obj, def = SURFACE_DEFS[gz.kind] || {};
    return { title: `✨ 元素地表 · ${def.name || gz.kind}`, key: `${Math.ceil(gz.life)}s`, body: ELEMENT_COMBO_HINTS[gz.kind] || '持續性環境元素地表區域。', accent: '#' + (gz.color || 0x7ae8ff).toString(16).padStart(6, '0') };
  }
  if (hit.kind === 'companion') return { title: '🐾 隨行夥伴', body: '忠誠陪伴你冒險的小夥伴，會自動跟隨並提供被動加成！', accent: '#ffd85a' };
  return null;
}

export function formatRichTooltip(spec) {
  if (!spec) return '';
  if (typeof spec === 'string') return `<div class="rt-body">${spec}</div>`;
  const head = spec.title
    ? `<div class="rt-head"><span class="rt-title">${spec.title}</span>${spec.key ? `<span class="rt-key">${spec.key}</span>` : ''}</div>`
    : '';
  const chips = spec.chips?.length
    ? `<div class="rt-chips">${spec.chips.map(c => `<span class="rt-chip">${c}</span>`).join('')}</div>`
    : '';
  const body = spec.body ? `<div class="rt-body">${spec.body}</div>` : '';
  const foot = spec.foot ? `<div class="rt-foot">${spec.foot}</div>` : '';
  return head + chips + body + foot;
}

export function installHoverSystem(game) {
  if (typeof document === 'undefined') return null;
  let tipEl = document.getElementById('richTip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'richTip';
    tipEl.className = 'hide';
    document.body.appendChild(tipEl);
  }

  let activeTarget = null;
  let showTimer = null;
  let lastMx = 0, lastMy = 0;
  let isUiTipVisible = false;

  const positionTip = (mx, my) => {
    const pad = 14, vw = window.innerWidth, vh = window.innerHeight;
    const rect = tipEl.getBoundingClientRect();
    let x = mx + 18, y = my - 10;
    if (x + rect.width + pad > vw) x = mx - rect.width - 16;
    if (y + rect.height + pad > vh) y = vh - rect.height - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    tipEl.style.left = Math.round(x) + 'px';
    tipEl.style.top = Math.round(y) + 'px';
  };

  const popSparks = (mx, my, icons = ['✨', '⭐']) => {
    for (let i = 0; i < 4; i++) {
      const sp = document.createElement('span');
      sp.className = 'ui-spark';
      sp.textContent = icons[i % icons.length];
      sp.style.left = mx + 'px'; sp.style.top = my + 'px';
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 22;
      sp.style.setProperty('--dx', `${Math.round(Math.cos(a) * d)}px`);
      sp.style.setProperty('--dy', `${Math.round(Math.sin(a) * d - 14)}px`);
      document.body.appendChild(sp);
      setTimeout(() => sp.remove(), 560);
    }
  };

  // 趣味 UI 點擊與懸停微互動：點頭像揮手賣萌、點 HP 條喝藥、點金幣／星砂噴火花
  document.getElementById('pcIcon')?.addEventListener('click', e => {
    game.emote?.((Math.random() * 4) | 0);
    game.player?.heroRig?.play?.('buff', { once: true, force: true });
    popSparks(e.clientX, e.clientY, ['♥', '✨', '🏮']);
  });
  document.querySelector('#pcard .pc-row.hp')?.addEventListener('click', e => {
    game.tryFlask?.();
    popSparks(e.clientX, e.clientY, ['♥', '🧪']);
  });
  document.getElementById('coinInfo')?.addEventListener('click', e => {
    game.audio?.sfx?.('orb');
    popSparks(e.clientX, e.clientY, ['🪙', '✨']);
  });
  document.getElementById('shardInfo')?.addEventListener('click', e => {
    game.audio?.sfx?.('orb');
    popSparks(e.clientX, e.clientY, ['✦', '💎']);
  });
  document.getElementById('pcFeather')?.addEventListener('pointerenter', e => {
    popSparks(e.clientX, e.clientY, ['🪶', '✨']);
  });

  const showSpec = (spec, mx, my, immediate = false) => {
    if (!spec || game.mouse?.l) { hideTip(); return; }
    const html = formatRichTooltip(spec);
    if (!html) { hideTip(); return; }
    const renderNow = () => {
      if (game.mouse?.l) { hideTip(); return; }
      if (tipEl._lastHtml !== html) {
        tipEl.innerHTML = html;
        tipEl._lastHtml = html;
      }
      tipEl.style.borderColor = spec.accent || '#ffcf4a';
      tipEl.classList.remove('hide');
      positionTip(mx, my);
    };
    clearTimeout(showTimer);
    if (immediate || !tipEl.classList.contains('hide')) renderNow();
    else showTimer = setTimeout(renderNow, 110);
  };

  const hideTip = () => {
    clearTimeout(showTimer);
    tipEl.classList.add('hide');
    tipEl._lastHtml = '';
  };

  function resolveUiSpec(el) {
    game.hoverSkillSlot = -1;
    if (!el || el === document.body || el === document.documentElement) return null;
    const g = game, p = g.player, S = p?.stats || {}, pr = g.meta?.p || {};
    const cls = CLASSES[g.character?.job ?? 0] || CLASSES[0];
    const sc2 = findSecondClass(pr.secondClass);

    // ==================== 一、左下旅人狀態卡（精簡資訊＋趣味點擊微互動） ====================
    if (el.closest?.('#pcLv')) {
      const lv = pr.level || 1, ms = nextMilestone(lv), avail = availableStatPoints(pr);
      return {
        title: `⭐ Lv.${lv}`, key: avail > 0 ? `未配點 ${avail}` : `拼圖 ${unlockedCount(lv)}/36`,
        body: ms ? `下一解鎖：Lv.${ms.lv} ${ms.title} · 點擊配點` : '點擊開啟角色屬性頁',
        accent: avail > 0 ? '#7fe08a' : '#ffcf4a',
      };
    }
    if (el.closest?.('#pcIcon') || el.closest?.('#pcard .pc-por')) {
      return { title: `${(sc2 || cls).icon} ${(sc2 || cls).name}`, key: '點擊打招呼', body: cls.summary };
    }
    if (el.closest?.('#pcName')) {
      const rk = p?.advRank || { rank: 'F', name: '見習旅人' };
      return { title: `🪪 ${g.playerName || '旅人'}`, key: `${rk.rank}級 · ⚔️${p?.combatPower || 100}` };
    }
    if (el.closest?.('#pcFeather')) {
      return { title: '🪶 體力羽毛', key: `${Math.round(p?.stamina || 0)}/100`, body: `金羽毛 ×${pr.feathers || 0}` };
    }
    if (el.closest?.('#pcard .pc-row.hp')) {
      return { title: `❤️ ${Math.ceil(p?.hp || 0)}/${S.maxHp || 62}`, key: '點擊喝藥', chips: [`🛡${S.armor || 0}%`, `💚+${S.regen || 0}/s`], accent: '#ff6a7a' };
    }
    if (el.closest?.('#pcard .pc-row.mp')) {
      const regen = (7 * (1 + (S.manaRegen || 0) / 100)).toFixed(1);
      return { title: `★ ${Math.floor(p?.mana || 0)}/${S.mana || 35}`, key: `連放 ${p?.castCombo || 0}/3`, chips: [`💧+${regen}/s`], accent: '#62b4ff' };
    }
    if (el.closest?.('#pcard .pc-row.fl')) {
      const fs = flameSnapshot(g), c = FLAME_CFG;
      const where = !fs.dark ? '安全區（城鎮／副本）' : fs.safe ? `光圈內 · ${fs.zone?.name || '光源'}` : `光圈外 · Dimming ×${fs.dim}`;
      return { title: `🔥 Flame ${Math.ceil(fs.value)}/${fs.max}`, key: where, body: `燈焰值與法力並存。普攻 +${c.gain.basicHit}、擊殺 +${c.gain.kill}；大招消耗 ${c.cost.ultimate}、被怪物打中會燒掉 ${Math.round(c.cost.hollowHitPct * 100)}%。已點亮的星燈／營火／城門有安全光圈，圈外 Flame 會慢慢燒盡並疊加 Dimming（移速、回復、視野下降）。`, chips: [`光圈內 +${c.regen.insideLightPerSec}/s`, `圈外 -${c.drain.outsideLightPerSec}/s`], accent: '#ff9a3c' };
    }
    if (el.closest?.('#pcard .pc-xp')) {
      const lv = pr.level || 1, need = xpForNextLevel(lv);
      return { title: `✨ XP ${pr.xp || 0}/${need}`, key: `拼圖 ${unlockedCount(lv)}/36` };
    }
    if (el.closest?.('#pcResWrap')) {
      const cm = cls.classMech;
      if (cm) return { title: `${cm.icon} 職業專屬機制：${cm.name}`, key: `${Math.round(p?.classRes || 0)}/${cm.max}`, body: cm.desc, accent: cm.color };
    }

    // ==================== 二、底部技能與功能快捷列 (#skills 10 個格位) ====================
    const skSlot = el.closest?.('#sk-s0, #sk-s1, #sk-s2, #sk-s3');
    if (skSlot) {
      const idx = +skSlot.id.slice(-1);
      g.hoverSkillSlot = idx;
      return describeSkillSlot(g, idx);
    }
    if (el.closest?.('#sk-r')) {
      const fl = p?.flask || { charges: 0, max: 1, prog: 0 };
      const healPct = Math.round(42 * (1 + 0.25 * (p?.boons || []).filter(b => b === 'flask').length));
      return {
        title: '🧪 藥水（點擊喝藥）',
        key: (g.settings?.keybinds?.flask || 'R').toUpperCase(),
        chips: [`剩餘 ${fl.charges}/${fl.max} 瓶`, `回復 ${healPct}% 生命`, `充能 ${Math.round((fl.prog || 0) * 100)}%`],
        body: '1 秒內快速回復大量生命值；擊殺怪物累積充能，或於城鎮水井汲取甘泉直接補滿。',
        accent: '#ff7a8a',
      };
    }
    if (el.closest?.('#sk-mount')) {
      const mDef = activeMountDef(pr);
      return mDef
        ? { title: `${mDef.icon} 坐騎：${mDef.name}`, key: 'G', chips: [g.mount ? '騎乘中' : '已收起', `T${mDef.tier}`, `移速 ×${mDef.speedMult}`], body: mDef.perk, foot: '點擊或按 [G] 召喚／收起 · 按 [I] 切換其他坐騎' }
        : { title: '🦌 坐騎系統（尚未持有）', key: 'G', body: '達到 Lv.10 且累計討伐 60 隻魔物後，即可支付金幣與香杉木鍛造鞍具馴養「林間巨鹿」！', foot: '按 [I] → 外觀與坐騎 查看 4 階坐騎里程碑與鞍具材料' };
    }
    if (el.closest?.('#sk-recall')) {
      const dest = g.lastTown === -2 ? '海風港鎮' : '燈谷鎮';
      const sp = g.tide?.sv?.spoils;
      const hasSp = sp && ((sp.coins || 0) > 0 || (sp.shards || 0) > 0);
      return {
        title: `🐚 快捷回城 → ${dest}`,
        key: (g.settings?.keybinds?.recall || 'H').toUpperCase(),
        chips: ['吟唱 2.5 秒', hasSp ? '🎒 可安全結算戰利品袋' : '安全區返城'],
        body: '吹響歸途海螺返回安全城鎮（吟唱期間移動或受擊會中斷）。',
      };
    }
    if (el.closest?.('#sk-bag')) {
      const bag = pr.bagItems || [];
      let upCnt = 0;
      for (const b of bag) {
        if (b.kind === 'gear' && b.item) {
          const cur = p?.equip?.[b.item.slot];
          if (!cur || itemScore(b.item) > itemScore(cur)) upCnt++;
        }
      }
      return {
        title: '🎒 物理背包與裝備',
        key: 'I',
        chips: [`物品 ${bag.length} 件`, upCnt > 0 ? `▲ 有 ${upCnt} 件更強裝備` : '身上已為最佳'],
        body: '檢視重力物理背包、拖曳相容物品碰撞合成、穿戴裝備、四維配點、怪物靈魂與異界副本設計台。',
        accent: upCnt > 0 ? '#7fe08a' : '#ffcf4a',
      };
    }
    if (el.closest?.('#sk-puzzle')) {
      const pz = pr.puzzle;
      const bagGems = pz?.bag?.length || 0;
      return {
        title: '💎 6×6 技能拼圖與寶石商人',
        key: 'K',
        chips: [`構築 ${(pz?.activePreset || 0) + 1}`, `解鎖 ${unlockedCount(pr.level || 1)}/36 格`, `背包寶石 ${bagGems}`],
        body: '自由排列主動與輔助聚方塊寶石，並用「命中／暴擊觸發器」串接自動連招邏輯電路！',
        accent: '#7ae8ff',
      };
    }
    if (el.closest?.('#sk-auto')) {
      const ap = g.autopilot || {};
      const modeLbl = ap.mode === 'full' ? '全自動巡遊中' : ap.mode === 'assist' ? '半自動輔助中' : '已關閉';
      return {
        title: '🏮 提燈自動巡遊',
        key: 'Z',
        chips: [modeLbl, `🔥 手動星火 ${ap.sparkStacks || 0}/5`],
        body: '開啟後角色會自動尋怪作戰並累積「手動星火」；接管手動時將引爆星火獲得 <b>×1.5 手動掉寶加成</b>！',
        foot: '按 [Z] 開關 · 按 [Shift+Z] 切換全自動／半自動',
      };
    }

    // ==================== 三、頂部狀態列、羅盤、生存時鐘與首領血條 ====================
    if (el.closest?.('#roomInfo')) {
      const f = g.field ? FIELDS[g.field] : null;
      const dng = f ? getFieldDanger(f.level, pr.level || 1) : null;
      const hs = f ? getFieldHotspot(g.field, g.hotspots) : null;
      return {
        title: `📍 ${el.textContent.trim()}`,
        key: f ? `建議 Lv.${f.level}` : '安全區',
        chips: [dng ? `${dng.icon} ${dng.label}` : null, hs ? hs.name : null].filter(Boolean),
        body: f ? `${f.desc || '常駐野外探索區。'}${hs ? `<div class="rt-accent">🔥 本區活躍熱點：${hs.bonus}</div>` : ''}` : '城鎮為完全安全區，不會受到攻擊，可鍛造、交易、二轉與存取倉庫。',
      };
    }
    if (el.closest?.('#killInfo')) {
      return { title: '⚔️ 討伐戰績', chips: [`本局 ${p?.kills || 0}`, `總累計 ${pr.kills || 0}`], body: '累計擊殺同種魔物可提升「怪物圖鑑精通」，解鎖永久帳號屬性加成！' };
    }
    if (el.closest?.('#shardInfo')) {
      return { title: '✦ 星砂（Shards）', chips: [`持有 ${pr.shards || 0}`, g.meta?.runShards ? `本局暫存 +${g.meta.runShards}` : null].filter(Boolean), body: '用於城鎮鐵匠鋪鍛造裝備、強化衝裝、Lv.10 裝備腐化與鑄造異界副本秘石。' };
    }
    if (el.closest?.('#coinInfo')) {
      return { title: '🪙 金幣（Coins）', chips: [`持有 ${pr.coins || 0}`], body: '用於寶石商人購買技能拼圖、拍賣行交易、噴泉許願與酒館料理。' };
    }
    if (el.closest?.('#dayInfo')) {
      const di = dayInfo(g.dayTime || 0.3);
      return { title: `${di.icon} 晝夜時段：${di.label}`, key: '點擊切換', body: di.isNight ? '目前為星夜：螢火蟲漫舞、提燈光圈擴大至 7.5m，夜間探索可解鎖專屬成就。' : '目前為明亮時段：視野開闊清晰，適合高速刷圖與遠眺地標。' };
    }
    if (el.closest?.('#mealInfo')) {
      return { title: '🍗 旅人持續增益', body: '來自酒館料理（每秒持續回血）、營火盛宴（回血 +50%）或公共星舟（移速 +10% · 經驗 +10%）的冒險祝福。' };
    }
    if (el.closest?.('#fieldCompass')) {
      return {
        title: '🧭 方向羅盤',
        body: g.waypoint ? `正在導航至自訂目標：<b>${g.waypoint.name}</b>（${g.waypoint.route}）。` : '自動指向本區最重要的地標（優先指向遺落墓碑，其次指向秘境副本入口）。',
        foot: '按 [M] 開啟世界星圖可自由設定或取消導航目標',
      };
    }
    if (el.closest?.('#scTime')) return { title: '⏱️ 本局生存時間', body: '在野外持續作戰的時間越長，狂潮進階階段與魔物威脅也會逐步升級！' };
    if (el.closest?.('#scStage')) return { title: '📈 狂潮難度階段', body: '隨生存時間與擊殺速度動態升溫，越後期精英與高階戰利品越豐厚。' };
    if (el.closest?.('#scCp')) return { title: '⚔️ 綜合戰力評分（CP）', body: '綜合計算你的等級、基礎與四維屬性、裝備階級／強化與天賦的整體強度指標。' };
    const bossPart = el.closest?.('#boss .epart');
    if (bossPart && g.boss?.parts?.length) {
      const pt = g.boss.parts.find(x => bossPart.textContent.includes(x.name));
      if (pt) {
        return {
          title: `${pt.icon} 首領部位：${pt.name}`,
          key: pt.broken ? '✂️ 已斬斷' : `${Math.ceil(pt.hp / pt.maxHp * 100)}%`,
          body: pt.broken ? `已成功破壞！弱化效果生效中：<b>${pt.weakenDesc}</b>` : `集中攻擊此方位可破壞該部位：<b>${pt.weakenDesc}</b>，並有機會額外掉落專屬裝備！`,
          accent: pt.broken ? '#8a7a70' : '#ffcf4a',
        };
      }
    }
    if (el.closest?.('#boss')) {
      return { title: `👑 首領戰機制`, body: '首領血量降至 <b>65%</b> 將進入 Phase 2（移速提升＋場地威脅），降至 <b>30%</b> 觸發【熾炎狂暴】！善用部位破壞大幅削弱招式。', accent: '#ff6a50' };
    }

    // ==================== 四、右上角功能鈕與右側堆疊面板 ====================
    if (el.closest?.('#btnMap')) {
      const lit = (pr.visitedFields || []).length + 5;
      const hs = g.hotspots?.hotspots?.map(h => `${h.kind === 'gold_tide' ? '🔥' : '🍗'}${FIELDS[h.fieldId]?.name || ''}`).join(' · ') || '載入中';
      const fs = getFerrySchedule(Date.now(), g.hotspots);
      return {
        title: '🗺️ 星燈雲海航海星圖',
        key: 'M',
        chips: [`已點亮 ${Math.min(WORLD_REGIONS.length, lit)}/${WORLD_REGIONS.length}`, `星舟 ${Math.floor(fs.departInSec / 60)}:${String(fs.departInSec % 60).padStart(2, '0')}`],
        body: `檢視三層雲海 22 座島嶼、搜尋 Boss／規則、一鍵星燈啟航與檢查點瞬移。<div class="rt-sub">🔥 本期熱點：${hs}</div>`,
        foot: '按 [Tab] 可開關右上角即時地區小地圖',
      };
    }
    if (el.closest?.('#btnMenu')) {
      return { title: '☰ 系統功能選單', body: '展開百科資料庫、更新日誌、遊戲設定、小隊邀請連結、音效開關與除錯工具。' };
    }
    const MENU_TIPS = {
      btnWiki: ['📖 燈谷百科資料庫', '查詢所有職業、技能拼圖、異常狀態、元素連鎖與物理背包合成配方。'],
      btnChangelog: ['📜 更新日誌', '查看《Beaconfall》歷代版本更新與新系統說明。'],
      btnSet: ['⚙ 遊戲設定', '調整像素畫質、視角預設、鏡頭震動（預設關閉）、音量、三語介面與自訂按鍵。'],
      btnInvite: ['🔗 複製組隊連結', '一鍵複製專屬組隊網址，傳給朋友即可在 5 秒內同隊出發！'],
      btnMute: ['🔊 音效開關', '立即靜音或恢復所有背景音樂與戰鬥／介面音效。'],
      btnDebug: ['🛠️ 除錯工具（F3）', '開啟開發者監控列，查看 FPS 曲線、事件日誌與測試工具。'],
      btnDonate: ['❤️ 贊助支持', '感謝支持獨立遊戲開發！點擊查看贊助資訊。'],
    };
    const mBtn = el.closest?.('#menuPop button');
    if (mBtn && MENU_TIPS[mBtn.id]) {
      return { title: MENU_TIPS[mBtn.id][0], body: MENU_TIPS[mBtn.id][1] };
    }

    if (el.closest?.('#questTracker')) {
      const ch = getCurrentChapter(pr);
      return ch
        ? { title: `📜 主線章節：${ch.def.title}`, key: `${ch.have}/${ch.def.need}`, body: ch.done ? '✅ 任務已完成！點擊此追蹤卡立即領取獎勵。' : `${ch.def.desc}<div class="rt-sub">🎁 獎勵：🪙${ch.def.reward?.coins || 0} · 💎${ch.def.reward?.shards || 0} 星砂 · +${ch.def.reward?.xp || 0} XP</div>`, accent: ch.done ? '#7fe08a' : '#ffd85a' }
        : { title: '👑 主線全章節通關', body: '你已完成所有主線試煉！繼續挑戰高危星穹島嶼與異界設計台。' };
    }
    if (el.closest?.('#btnTideUlt')) {
      const td = g.tide, u = ULTIMATES[(td?.ultIndex || 0) % ULTIMATES.length], nextU = ULTIMATES[((td?.ultIndex || 0) + 1) % ULTIMATES.length];
      return { title: `${u.icon} 狂潮大絕：${u.name}`, key: 'V', chips: [`充能 ${Math.floor(td?.ultCharge || 0)}%`, `下一個：${nextU.icon}${nextU.name}`], body: u.desc, foot: '點擊或按 [V] 施放 · [Shift+V] 切換大絕', accent: u.color };
    }
    if (el.closest?.('#btnTideCycle')) {
      return { title: '↻ 切換溫馨荒誕大絕', key: 'Shift+V', body: ULTIMATES.map(u => `${u.icon} <b>${u.name}</b>`).join(' → '), foot: '點擊立即切換下一個準備施放的大絕' };
    }
    if (el.closest?.('#btnCurse')) {
      const cs = g.tide?.sv?.curseStacks || 0;
      return { title: '👁 貪婪詛咒加碼', key: `目前 ×${cs}`, body: '主動提升怪海生成密度與壓迫感，每層額外提供 <b>+35% 戰利品倍率</b>！高風險高回報。', accent: '#d87aff' };
    }
    if (el.closest?.('#tdSpoils')) {
      const sp = g.tide?.sv?.spoils || { coins: 0, shards: 0 };
      return { title: '🎒 野外戰利品袋（未結算）', chips: [`🪙 ${Math.round(sp.coins)}`, `💎 ${Math.round(sp.shards)}`], body: '狂潮期間累積的額外紅利！<b>安全回城 100% 全額入袋</b>；若在野外陣亡將遺失 50%。', accent: '#ffd85a' };
    }
    const tdBuff = el.closest?.('#tdBuffs .td-b');
    if (tdBuff) {
      const def = MICRO_BUFFS.find(b => (tdBuff.textContent || '').includes(b.name));
      if (def) return { title: `${def.icon} 狂潮中場強化：${def.name}`, body: def.desc, accent: def.color };
    }
    if (el.closest?.('#tideHud .td-head') || el.closest?.('#tideHud .td-track')) {
      const td = g.tide;
      return { title: '🔥 餘燼潮汐熱度條', chips: [`戰利品 ×${lootMultForTide(td, pr)}`, `第 ${td?.waveStreak || 1} 波`], body: '刷怪越快熱度升越快：<b>火星躁動(25)</b> → <b>餘燼狂潮(55)</b> → <b>熾炎巔峰(100 · 潮汐王入侵)</b>，之後進入 25 秒營火休整期。' };
    }
    if (el.closest?.('#apSpark')) return { title: '🔥 手動星火機制', body: '自動巡遊擊殺累積星火（最多 5 層）；按 [Z] 接管手動時立即引爆，獲得高倍率手動掉寶加成！', accent: '#ffd85a' };
    if (el.closest?.('#apStats')) return { title: '📊 巡遊即時戰報', body: '顯示本次自動巡遊期間累積的擊殺、經驗、金幣與星砂收益（自動模式為 30% 基礎倍率，鼓勵手動衝刺）。' };
    if (el.closest?.('#comboBadge')) {
      const cnt = g.combo?.count || 0;
      return { title: `🔥 ${cnt} 連擊狂熱！`, chips: [`攻速 +${Math.min(30, cnt * 2)}%`, `暴擊 +${Math.min(22, Math.round(cnt * 1.5))}%`, `剩餘 ${(g.combo?.timer || 0).toFixed(1)}s`], body: '6 秒內持續擊殺敵人即可維持並疊高連擊獎勵！', accent: '#ff7a50' };
    }
    const pill = el.closest?.('#statusBar .st-pill');
    if (pill) return describeStatusPill(pill, g);

    // ==================== 五、地圖類介面（世界星圖與圖例） ====================
    const mapBtn = el.closest?.('#worldMap .atlas button');
    if (mapBtn && mapBtn.dataset.regId !== undefined) {
      const regId = +mapBtn.dataset.regId, f = FIELDS[regId], bp = FIELD_BLUEPRINTS[regId];
      if (f && bp) {
        const fam = FAMILY_META[bp.family] || FAMILY_META.open;
        const dng = getFieldDanger(f.level, pr.level || 1);
        const rule = f.realmRule ? getRealmRule(f.realmRule) : null;
        const hs = getFieldHotspot(regId, g.hotspots);
        const bossPoi = bp.pois?.find(x => x.k === 'boss');
        return {
          title: mapBtn.dataset.regName || f.name,
          key: `Lv.${f.level}`,
          chips: [`${dng.icon} ${dng.label}`, `${fam.icon} ${fam.name}`, hs ? hs.name : null].filter(Boolean),
          body: `${bossPoi ? `👑 守護獸：${bossPoi.t}<br>` : ''}${rule ? `${rule.icon} 規則：${rule.name}（${rule.desc}）` : (f.desc || '點擊查看檢查點與星燈航線。')}`,
          foot: '點擊選取島嶼 · 可沿星燈航線直接啟航',
          accent: fam.color,
        };
      }
      const reg = WORLD_REGIONS.find(r => r.id === regId);
      if (reg) return { title: reg.name, key: reg.level, body: reg.desc, foot: reg.route };
    }
    const layBtn = el.closest?.('#worldMap .map-layer-btn');
    if (layBtn) {
      const lay = MAP_LAYERS.find(l => layBtn.textContent.includes(l.name));
      if (lay) return { title: `${lay.icon} ${lay.name}`, body: lay.desc };
    }

    // ==================== 六、背包、屬性列與彈窗細項 ====================
    const eqCard = el.closest?.('#bagEquipStrip .eq-mini');
    if (eqCard && eqCard.dataset.eqslot) {
      const it = p?.equip?.[eqCard.dataset.eqslot];
      if (it) {
        const ti = tierInfo(it.tier || 1), R = RARITY[it.rarity];
        return { title: `<span style="color:${R.color}">[${ti.tag}] ${it.name}</span>`, key: `戰力 ${itemScore(it)}`, chips: [SLOTS[it.slot]?.name, R.name, it.corrupted ? '☠️ 已腐化' : null].filter(Boolean), body: '點擊可於右側詳情欄展開完整詞綴；拖曳背包同品階裝備可碰撞合成升級。', accent: R.color };
      }
    }
    const statRow = el.closest?.('#invStats > div');
    if (statRow) {
      const lb = statRow.querySelector('span')?.textContent?.trim() || '';
      const val = statRow.querySelector('b')?.textContent?.trim() || '';
      const STAT_TIPS = {
        '減傷': '降低所有物理與直擊傷害（上限 60%），由職業、裝備與護甲詞綴累加。',
        '冷卻縮減': '縮短所有拼圖主動技與翻滾冷卻（上限 60%）。',
        '暴擊': '攻擊觸發暴擊機率與暴擊倍率；連擊狂熱每層額外提供 +1.5% 暴擊！',
        '攻擊速度': '提高普攻與揮杖頻率；敏捷配點、連擊與狂暴祝福皆可疊加。',
        '移動速度': '提高步行、衝刺與坐騎基準移速。',
        '基礎傷害': '所有技能與普攻的傷害基數（由等級、力量／智力與武器提供）。',
        '傷害加成': '百分比乘算提升所有攻擊與技能輸出。',
        '範圍': '擴大所有範圍技能、震波與地面領域的半徑。',
        '擊中回復': '每次攻擊或技能命中敵人時立即回復的固定生命值。',
        '餘燼彈數': '每次施放投射物技能時額外發射的基礎彈道數。',
        '🔥 火抗 / ❄️ 冰抗': '降低火焰／冰霜傷害與灼燒／冰凍感染率（上限 75%；Lv.15+ 高危地圖帶 -15% 深淵穿透）。',
        '⚡ 雷抗 / ☠️ 毒抗': '降低雷電／劇毒傷害與感電／中毒感染率（上限 75%；Lv.15+ 高危地圖帶 -15% 深淵穿透）。',
      };
      if (STAT_TIPS[lb]) return { title: `📊 ${lb}`, key: val, body: STAT_TIPS[lb] };
    }
    const mmoRow = el.closest?.('.mmo-stat-row');
    if (mmoRow) {
      const def = STAT_DEFS.find(s => mmoRow.textContent.includes(s.name));
      if (def) return { title: `${def.icon} ${def.name}`, body: def.desc, foot: '點擊右側 +1 分配點數 · 可隨時免費重置' };
    }

    // ==================== 七、通用攔截（全面取代所有瀏覽器原生 title） ====================
    const tipHost = el.closest?.('[data-htip], [title]');
    if (tipHost) {
      if (tipHost.hasAttribute('title')) {
        const raw = tipHost.getAttribute('title');
        if (raw) { tipHost.dataset.htip = raw; tipHost.removeAttribute('title'); }
      }
      const txt = tipHost.dataset.htip;
      if (txt) return { title: txt.length <= 24 ? txt : '', body: txt.length <= 24 ? '' : txt };
    }
    return null;
  }

  const INTERACTIVE_SEL = 'button, .sk, .card, .sv-card, .atlas-card, .soul-card, .mount-card, .du-card, .pz-cell.filled, .pz-gem, .eq-mini, .st-pill, .hero-pin-3d, .hero-pin-btn, #questTracker, #pcLv, #pcIcon, #pcard .pc-row, #pcard .pc-xp, #pcResWrap, #topbar > span, #boss .epart';
  let lastSfxEl = null;

  document.addEventListener('pointerover', e => {
    const t = e.target;
    if (!t || !(t instanceof Element)) return;
    lastMx = e.clientX; lastMy = e.clientY;
    if (t.id === 'regionMapCanvas') return;
    const inter = t.closest(INTERACTIVE_SEL);
    if (inter && inter !== lastSfxEl && !inter.disabled) {
      lastSfxEl = inter;
      game.audio?.sfx?.('hover');
    } else if (!inter) {
      lastSfxEl = null;
    }

    const spec = resolveUiSpec(t);
    if (spec) {
      activeTarget = t;
      isUiTipVisible = true;
      showSpec(spec, e.clientX, e.clientY, false);
    } else {
      activeTarget = null;
      isUiTipVisible = false;
      game.hoverSkillSlot = -1;
      hideTip();
    }
  });

  document.addEventListener('pointermove', e => {
    lastMx = e.clientX; lastMy = e.clientY;
    if (e.target?.id === 'regionMapCanvas') return;
    if (isUiTipVisible && !tipEl.classList.contains('hide')) positionTip(e.clientX, e.clientY);
  });

  document.addEventListener('pointerout', e => {
    if (!e.relatedTarget || !(e.relatedTarget instanceof Element)) {
      activeTarget = null;
      isUiTipVisible = false;
      game.hoverSkillSlot = -1;
      hideTip();
    }
  });

  return {
    isUiActive: () => isUiTipVisible,
    showWorld(hit, mx, my) {
      if (isUiTipVisible) return;
      if (!hit) { hideTip(); return; }
      const spec = describeWorldTarget(hit, game);
      if (spec) showSpec(spec, mx, my, true);
      else hideTip();
    },
    hideWorld() { if (!isUiTipVisible) hideTip(); },
    refreshActive() {
      if (isUiTipVisible && activeTarget && document.contains(activeTarget)) {
        const spec = resolveUiSpec(activeTarget);
        if (spec) showSpec(spec, lastMx, lastMy, true);
      }
    },
  };
}
