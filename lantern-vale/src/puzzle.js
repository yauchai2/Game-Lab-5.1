// 原創職業系統與 6×6 技能拼圖（聚方塊相鄰連動，A Short Hike 奶油像素風格）
export const GRID = 6;

export const CLASSES = [
  {
    id: 0, key: 'warden', name: '守燈衛士', icon: '🛡', weapon: 'shield',
    summary: '減傷 +15% · 生命 +25',
    desc: '持盾鎮守谷口，擅長範圍震擊與續戰回血。',
    bonuses: { armor: 15, maxHp: 25 },
    starter: [
      { id: 'slam', x: 1, y: 1, rot: 0 },
      { id: 'area', x: 3, y: 1, rot: 1 },
      { id: 'leech', x: 3, y: 3, rot: 0 },
    ],
    bag: ['bolt', 'ember', 'frost'],
  },
  {
    id: 1, key: 'ranger', name: '林風遊俠', icon: '🏹', weapon: 'bow',
    summary: '移速 +12% · 暴擊 +10%',
    desc: '穿梭林冠的弓手，擅長星羽箭雨與多重齊射。',
    bonuses: { moveSpd: 12, crit: 10 },
    starter: [
      { id: 'rain', x: 1, y: 1, rot: 0 },
      { id: 'multi', x: 2, y: 2, rot: 0 },
      { id: 'haste', x: 1, y: 3, rot: 0 },
    ],
    bag: ['bolt', 'chain', 'area'],
  },
  {
    id: 2, key: 'mystic', name: '餘燼秘術師', icon: '🔥', weapon: 'staff',
    summary: '法力 +25 · 回魔 +40% · 火傷 +4',
    desc: '駕馭燈火餘燼，擅長飛彈連鎖與召喚光螢。',
    bonuses: { mana: 25, manaRegen: 40, addFire: 4 },
    starter: [
      { id: 'bolt', x: 1, y: 1, rot: 0 },
      { id: 'wisp', x: 2, y: 2, rot: 0 },
      { id: 'ember', x: 2, y: 1, rot: 0 },
    ],
    bag: ['chain', 'multi', 'mark'],
  },
  {
    id: 3, key: 'strider', name: '影刃行者', icon: '⚔', weapon: 'blades',
    summary: '攻速 +25% · 暴傷 +35% · 翻滾更快',
    desc: '雙刃疾行的獵手，擅長旋風燈舞與苔霧陷阱。',
    bonuses: { atkSpd: 25, critMult: 35, rollCdr: 25 },
    starter: [
      { id: 'whirl', x: 1, y: 1, rot: 0 },
      { id: 'trap', x: 3, y: 2, rot: 0 },
      { id: 'frost', x: 1, y: 3, rot: 0 },
    ],
    bag: ['echo', 'leech', 'haste'],
  },
];

export const ACTIVE_GEMS = {
  bolt:  { id: 'bolt',  type: 'active', name: '餘燼飛彈', short: '焰彈', icon: '🔥', color: '#e26a3c', price: 14, cd: 0.42, mana: 8,  shape: [[0,0],[1,0]], desc: '發射熾熱餘燼彈命中敵人（消耗法力 8）。' },
  slam:  { id: 'slam',  type: 'active', name: '根鬚震擊', short: '震擊', icon: '🌿', color: '#5fa85a', price: 16, cd: 4.5,  mana: 0,  shape: [[0,0],[1,0],[0,1],[1,1]], desc: '撼動地面造成範圍傷害並暈眩敵人 1.1 秒。' },
  wisp:  { id: 'wisp',  type: 'active', name: '螢火護衛', short: '光螢', icon: '✦',  color: '#e5b83b', price: 18, cd: 10.0, mana: 10, shape: [[0,0],[1,0],[2,0]], desc: '召喚環繞自身並自動追蹤敵人的光螢。' },
  rain:  { id: 'rain',  type: 'active', name: '星羽箭雨', short: '箭雨', icon: '🏹', color: '#4c94d8', price: 18, cd: 5.0,  mana: 12, shape: [[0,0],[0,1],[1,1]], desc: '在瞄準區域降下多波星羽流星造成範圍傷害。' },
  trap:  { id: 'trap',  type: 'active', name: '苔霧陷阱', short: '陷阱', icon: '🪤', color: '#8d6cc8', price: 16, cd: 4.0,  mana: 8,  shape: [[0,0],[1,0],[0,1],[1,1]], desc: '在目標地點投出燈苔陷阱，引爆並減速敵人。' },
  whirl:   { id: 'whirl',   type: 'active', name: '旋風燈舞', short: '燈舞', icon: '🌀', color: '#d85a7a', price: 18, cd: 4.2,  mana: 10, shape: [[0,0],[1,0],[2,0],[1,1]], desc: '以自身為中心釋放旋轉熾焰燈環斬擊周圍敵人。' },
  mark:    { id: 'mark',    type: 'active', name: '微弱印記', short: '印記', icon: '🎯', color: '#a84ec8', price: 12, cd: 6.0,  mana: 6,  shape: [[0,0]], desc: '詛咒目標區域，使敵人 6 秒內受到傷害 +30%。' },
  meteor:  { id: 'meteor',  type: 'active', name: '星隕天降', short: '星隕', icon: '☄',  color: '#e04f2c', price: 28, cd: 6.5,  mana: 14, shape: [[0,0],[1,0],[0,1],[1,1]], desc: '召喚燃燒隕石轟擊目標區域並留下烈焰震波。' },
  nova:    { id: 'nova',    type: 'active', name: '極光新星', short: '極光', icon: '❄',  color: '#46b0e8', price: 26, cd: 5.8,  mana: 12, shape: [[1,0],[0,1],[1,1],[2,1]], desc: '爆發雙層冰晶極光環，重創並深度冰緩周圍敵人。' },
  prism:   { id: 'prism',   type: 'active', name: '折光棱鏡', short: '棱鏡', icon: '💎', color: '#38b5a0', price: 26, cd: 7.0,  mana: 12, shape: [[0,0],[0,1],[1,1]], desc: '立起旋轉折光水晶，自動向周圍敵人折射光束。' },
  phantom: { id: 'phantom', type: 'active', name: '影霧幻陣', short: '幻陣', icon: '🌫', color: '#9c5ad8', price: 26, cd: 5.5,  mana: 10, shape: [[0,0],[1,0],[1,1]], desc: '原地留下發光幻影並瞬移閃避，片刻後引爆重創敵人。' },
};

export const SUPPORT_GEMS = {
  multi: { id: 'multi', type: 'support', name: '多重投射', short: '多重', icon: '⇶', color: '#c4843d', price: 15, shape: [[0,0],[0,1],[1,1]], desc: '相鄰主動技能額外增加 +2 投射物或箭雨波數。' },
  echo:  { id: 'echo',  type: 'support', name: '連發迴響', short: '連發', icon: '⟳', color: '#7a5cc4', price: 18, shape: [[0,0],[1,0],[2,0]], desc: '相鄰主動技能額外觸發 1 次（65% 傷害）。' },
  area:  { id: 'area',  type: 'support', name: '擴大範圍', short: '擴域', icon: '◎', color: '#3f9688', price: 14, shape: [[0,0],[1,0]], desc: '相鄰主動技能作用範圍 +35%。' },
  ember: { id: 'ember', type: 'support', name: '熾炎增幅', short: '熾炎', icon: '✴', color: '#d9543a', price: 14, shape: [[0,0]], desc: '相鄰主動技能傷害 +25% 並附加火焰傷害。' },
  chain: { id: 'chain', type: 'support', name: '連鎖跳躍', short: '連鎖', icon: '⚡', color: '#4f7ed6', price: 16, shape: [[0,0],[1,0],[1,1],[2,1]], desc: '相鄰投射物命中後額外彈跳 +2 個目標。' },
  haste: { id: 'haste', type: 'support', name: '極速詠唱', short: '極速', icon: '⏩', color: '#58a858', price: 13, shape: [[0,0]], desc: '相鄰主動技能冷卻時間縮減 18%。' },
  frost: { id: 'frost', type: 'support', name: '霜緩附魔', short: '霜緩', icon: '❄', color: '#5aa0e0', price: 14, shape: [[0,0],[1,0]], desc: '相鄰主動技能命中時緩速敵人 45%。' },
  leech: { id: 'leech', type: 'support', name: '生命汲取', short: '汲血', icon: '♥', color: '#c84862', price: 14, shape: [[0,0]], desc: '相鄰主動技能命中敵人時回復 4 點生命。' },
};

export const ALL_GEMS = { ...ACTIVE_GEMS, ...SUPPORT_GEMS };

// 6×6 棋盤由中央 4×4（16 格）螺旋向外解鎖至全 36 格
export const SPIRAL_ORDER = [
  [2,2],[3,2],[3,3],[2,3],[1,3],[1,2],[1,1],[2,1],[3,1],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],
  [0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5],[1,5],[0,5],
];

export function unlockedCount(level = 1) {
  return Math.min(36, 16 + Math.floor(Math.max(1, level) / 1.4));
}

export function unlockedSet(level = 1) {
  const n = unlockedCount(level);
  const set = new Set();
  for (let i = 0; i < n; i++) set.add(SPIRAL_ORDER[i][0] + ',' + SPIRAL_ORDER[i][1]);
  return set;
}

export function rotateCells(shape, rot = 0) {
  let pts = shape.map(([x, y]) => [x, y]);
  const turns = ((rot % 4) + 4) % 4;
  for (let t = 0; t < turns; t++) pts = pts.map(([x, y]) => [-y, x]);
  const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
  return pts.map(([x, y]) => [x - minX, y - minY]);
}

export function defaultPuzzle(classId = 0) {
  const cls = CLASSES[classId] || CLASSES[0];
  let uid = 1;
  const placed = cls.starter.map(s => ({ uid: uid++, id: s.id, x: s.x, y: s.y, rot: s.rot || 0 }));
  const bag = cls.bag.map(id => ({ uid: uid++, id, rot: 0 }));
  return {
    activePreset: 0,
    nextUid: uid,
    presets: [placed, [], []],
    bag,
    initializedClass: cls.id,
  };
}

export function ensurePuzzle(profile, classId = 0) {
  if (!profile.puzzle || !Array.isArray(profile.puzzle.presets)) {
    profile.puzzle = defaultPuzzle(classId);
  }
  if (!profile.puzzle.nextUid) profile.puzzle.nextUid = 100;
  return profile.puzzle;
}

export function addGemToBag(profile, gemId) {
  const pz = ensurePuzzle(profile, 0);
  if (!ALL_GEMS[gemId]) return null;
  const entry = { uid: pz.nextUid++, id: gemId, rot: 0 };
  pz.bag.push(entry);
  return entry;
}

export function occupiedMap(placed) {
  const map = new Map();
  for (const item of placed) {
    const def = ALL_GEMS[item.id];
    if (!def) continue;
    for (const [dx, dy] of rotateCells(def.shape, item.rot)) {
      map.set((item.x + dx) + ',' + (item.y + dy), item);
    }
  }
  return map;
}

export function canPlace(placed, gemId, x, y, rot, level = 1, ignoreUid = null) {
  const def = ALL_GEMS[gemId];
  if (!def) return false;
  const open = unlockedSet(level);
  const occ = occupiedMap(placed.filter(p => p.uid !== ignoreUid));
  for (const [dx, dy] of rotateCells(def.shape, rot)) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return false;
    const key = cx + ',' + cy;
    if (!open.has(key) || occ.has(key)) return false;
  }
  return true;
}

// 計算棋盤上所有主動技能與相鄰（上下左右邊相連）的輔助寶石加成
export function computeBoard(placed) {
  const occ = occupiedMap(placed);
  const skills = [];
  for (const item of placed) {
    const def = ACTIVE_GEMS[item.id];
    if (!def) continue;
    const linkedUids = new Set();
    const linkedDefs = [];
    for (const [dx, dy] of rotateCells(def.shape, item.rot)) {
      const cx = item.x + dx, cy = item.y + dy;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        const nb = occ.get(nx + ',' + ny);
        if (nb && nb.uid !== item.uid && SUPPORT_GEMS[nb.id] && !linkedUids.has(nb.uid)) {
          linkedUids.add(nb.uid);
          linkedDefs.push(SUPPORT_GEMS[nb.id]);
        }
      }
    }
    const mod = { multi: 0, echo: 0, area: 0, dmgMult: 1, fire: def.id === 'bolt', chain: 0, cdr: 0, frost: 0, leech: 0, supports: linkedDefs };
    for (const s of linkedDefs) {
      if (s.id === 'multi') mod.multi += 2;
      if (s.id === 'echo') mod.echo += 1;
      if (s.id === 'area') mod.area += 0.35;
      if (s.id === 'ember') { mod.dmgMult += 0.25; mod.fire = true; }
      if (s.id === 'chain') mod.chain += 2;
      if (s.id === 'haste') mod.cdr = Math.min(0.6, mod.cdr + 0.18);
      if (s.id === 'frost') mod.frost += 1;
      if (s.id === 'leech') mod.leech += 4;
    }
    skills.push({ uid: item.uid, id: def.id, def, mod });
  }
  return skills;
}

export function bindPuzzleUI(g) {
  const modal = document.getElementById('puzzleM');
  if (!modal) return;
  const gridEl = modal.querySelector('.pz-grid');
  const bagEl = modal.querySelector('.pz-bag');
  const shopEl = modal.querySelector('.pz-shop');
  const presetsEl = modal.querySelector('.pz-presets');
  const infoEl = modal.querySelector('.pz-info');
  const unlockEl = modal.querySelector('.pz-unlock');
  const coinsEl = modal.querySelector('.pz-coins');
  let holding = null; // { source:'bag'|'board', uid, id, rot, origX?, origY? }
  let modeTab = 'bag'; // 'bag' | 'shop'
  let gemFilter = 'all'; // 'all' | 'active' | 'support'

  const getPz = () => ensurePuzzle(g.meta.p, g.character?.job ?? 0);
  const currentPlaced = () => {
    const pz = getPz();
    return pz.presets[pz.activePreset] || (pz.presets[pz.activePreset] = []);
  };
  const setHolding = h => {
    holding = h;
    document.body.classList.toggle('holding-gem', !!h);
  };
  const returnHolding = () => {
    if (!holding) return;
    const pz = getPz();
    if (holding.source === 'board') {
      const placed = currentPlaced();
      if (canPlace(placed, holding.id, holding.origX, holding.origY, holding.origRot, g.meta.p.level)) {
        placed.push({ uid: holding.uid, id: holding.id, x: holding.origX, y: holding.origY, rot: holding.origRot });
      } else {
        pz.bag.push({ uid: holding.uid, id: holding.id, rot: 0 });
      }
    }
    setHolding(null);
  };

  function renderShapePreview(shape, rot, color) {
    const cells = rotateCells(shape, rot);
    const w = Math.max(...cells.map(c => c[0])) + 1;
    const h = Math.max(...cells.map(c => c[1])) + 1;
    const box = document.createElement('span');
    box.className = 'pz-mini';
    box.style.gridTemplateColumns = `repeat(${w}, 9px)`;
    box.style.gridTemplateRows = `repeat(${h}, 9px)`;
    const set = new Set(cells.map(c => c[0] + ',' + c[1]));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = document.createElement('i');
      if (set.has(x + ',' + y)) d.style.background = color;
      else d.style.opacity = '0';
      box.append(d);
    }
    return box;
  }

  function render() {
    const pz = getPz(), level = g.meta.p.level || 1;
    const placed = currentPlaced();
    const open = unlockedSet(level);
    const occ = occupiedMap(placed);
    const computed = computeBoard(placed);
    const linkCount = new Map(computed.map(s => [s.uid, s.mod.supports.length]));

    unlockEl.textContent = `已解鎖 ${unlockedCount(level)}/36 格（升級自動擴充）· 棋盤上主動技能會自動裝備至下方技能欄`;
    coinsEl.textContent = `🪙 金幣 ${g.meta.p.coins}`;

    // Presets
    presetsEl.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('button');
      b.className = 'btn small' + (pz.activePreset === i ? ' on' : '');
      b.textContent = `構築 ${i + 1}`;
      b.onclick = () => {
        returnHolding();
        pz.activePreset = i;
        g.meta.save(); g.recalc(); render();
      };
      presetsEl.append(b);
    }

    // Info bar
    if (holding) {
      const def = ALL_GEMS[holding.id];
      infoEl.innerHTML = `<b>手持：${def.icon} ${def.name}</b>（${def.type === 'active' ? '主動' : '輔助'}）— ${def.desc} <small>點棋盤放下 · 右鍵或按 R 旋轉</small>`;
    } else {
      const activeNames = computed.slice(0, 4).map((s, idx) => `${['右鍵','Q','E','C'][idx]} ${s.def.icon}${s.def.short}${s.mod.supports.length ? '(+' + s.mod.supports.length + ')' : ''}`);
      infoEl.textContent = activeNames.length
        ? '目前技能欄：' + activeNames.join('　')
        : '點選下方寶石放入 6×6 棋盤；將「輔助寶石」放在「主動技能」上下左右相鄰格即可連動強化！';
    }

    // 6x6 Grid
    gridEl.replaceChildren();
    const anchorSeen = new Set();
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pz-cell';
        const key = x + ',' + y;
        const isOpen = open.has(key);
        const item = occ.get(key);
        if (!isOpen) {
          cell.classList.add('locked');
          cell.disabled = true;
          cell.textContent = '🔒';
        } else if (item) {
          const def = ALL_GEMS[item.id];
          cell.classList.add('filled', def.type);
          cell.style.background = def.color;
          cell.title = `${def.name}（${def.type === 'active' ? '主動' : '輔助'}）：${def.desc}`;
          if (!anchorSeen.has(item.uid)) {
            anchorSeen.add(item.uid);
            const lc = linkCount.get(item.uid) || 0;
            cell.innerHTML = `<span class="pz-ic">${def.icon}</span><span class="pz-lb">${def.short}${lc ? '+' + lc : ''}</span>`;
          } else {
            cell.innerHTML = `<span class="pz-dot"></span>`;
          }
          cell.onclick = () => {
            if (holding) return;
            const idx = placed.findIndex(p => p.uid === item.uid);
            if (idx >= 0) {
              const [removed] = placed.splice(idx, 1);
              setHolding({ source: 'board', uid: removed.uid, id: removed.id, rot: removed.rot, origX: removed.x, origY: removed.y, origRot: removed.rot });
              g.audio.sfx('ui'); g.meta.save(); g.recalc(); render();
            }
          };
        } else {
          if (holding && canPlace(placed, holding.id, x, y, holding.rot, level)) cell.classList.add('can');
          cell.onclick = () => {
            if (!holding) return;
            if (!canPlace(placed, holding.id, x, y, holding.rot, level)) { g.ui.toast('此位置無法放入該形狀', '#ff9a8a'); return; }
            if (holding.source === 'bag') {
              const bi = pz.bag.findIndex(b => b.uid === holding.uid);
              if (bi >= 0) pz.bag.splice(bi, 1);
            }
            placed.push({ uid: holding.uid, id: holding.id, x, y, rot: holding.rot });
            setHolding(null);
            g.audio.sfx('pickup'); g.meta.save(); g.recalc(); render();
          };
        }
        cell.oncontextmenu = e => {
          e.preventDefault();
          if (holding) { holding.rot = (holding.rot + 1) % 4; g.audio.sfx('ui'); render(); }
        };
        gridEl.append(cell);
      }
    }

    // Tabs visibility
    modal.querySelectorAll('[data-pztab]').forEach(b => b.classList.toggle('on', b.dataset.pztab === modeTab));
    modal.querySelectorAll('[data-pzflt]').forEach(b => b.classList.toggle('on', b.dataset.pzflt === gemFilter));
    bagEl.hidden = modeTab !== 'bag';
    shopEl.hidden = modeTab !== 'shop';

    // Bag
    bagEl.replaceChildren();
    const filteredBag = pz.bag.filter(b => {
      const def = ALL_GEMS[b.id];
      return def && (gemFilter === 'all' || def.type === gemFilter);
    });
    if (!filteredBag.length) {
      const empty = document.createElement('div');
      empty.className = 'psmall';
      empty.textContent = '目前背包沒有未放置的寶石，可切換至「寶石商人」購買或擊敗精英怪取得！';
      bagEl.append(empty);
    }
    for (const item of filteredBag) {
      const def = ALL_GEMS[item.id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pz-gem' + (holding?.uid === item.uid ? ' on' : '');
      card.title = def.desc;
      card.append(renderShapePreview(def.shape, 0, def.color));
      const txt = document.createElement('span');
      txt.innerHTML = `<b>${def.icon} ${def.name}</b><small>${def.type === 'active' ? '主動' : '輔助'}</small>`;
      card.append(txt);
      card.onclick = () => {
        if (holding?.uid === item.uid) { setHolding(null); render(); return; }
        returnHolding();
        setHolding({ source: 'bag', uid: item.uid, id: item.id, rot: item.rot || 0 });
        g.audio.sfx('ui'); render();
      };
      bagEl.append(card);
    }

    // Shop
    shopEl.replaceChildren();
    for (const def of Object.values(ALL_GEMS)) {
      if (gemFilter !== 'all' && def.type !== gemFilter) continue;
      const card = document.createElement('div');
      card.className = 'pz-shop-item';
      const head = document.createElement('div');
      head.className = 'pz-shop-head';
      head.append(renderShapePreview(def.shape, 0, def.color));
      const meta = document.createElement('div');
      meta.innerHTML = `<b>${def.icon} ${def.name}</b> <small>${def.type === 'active' ? '主動' : '輔助'}</small><br><small>${def.desc}</small>`;
      head.append(meta);
      const buy = document.createElement('button');
      buy.className = 'btn small';
      buy.textContent = `🪙 ${def.price}`;
      buy.disabled = g.meta.p.coins < def.price;
      buy.onclick = () => {
        if (g.meta.p.coins < def.price) return;
        g.meta.p.coins -= def.price;
        addGemToBag(g.meta.p, def.id);
        g.meta.save(); g.audio.sfx('pickup');
        g.ui.toast(`購得寶石：${def.name}`, '#ffd85a');
        render();
      };
      card.append(head, buy);
      shopEl.append(card);
    }
  }

  modal.querySelector('#pzRotate').onclick = () => { if (holding) { holding.rot = (holding.rot + 1) % 4; g.audio.sfx('ui'); render(); } };
  modal.querySelector('#pzTake').onclick = () => {
    if (!holding) return;
    if (holding.source === 'board') {
      getPz().bag.push({ uid: holding.uid, id: holding.id, rot: 0 });
      setHolding(null); g.meta.save(); g.recalc(); g.audio.sfx('ui'); render();
    } else {
      setHolding(null); render();
    }
  };
  modal.querySelector('#pzClear').onclick = () => {
    returnHolding();
    const pz = getPz(), placed = currentPlaced();
    while (placed.length) {
      const it = placed.pop();
      pz.bag.push({ uid: it.uid, id: it.id, rot: 0 });
    }
    g.meta.save(); g.recalc(); g.audio.sfx('ui'); render();
  };
  modal.querySelectorAll('[data-pztab]').forEach(b => b.onclick = () => { modeTab = b.dataset.pztab; g.audio.sfx('ui'); render(); });
  modal.querySelectorAll('[data-pzflt]').forEach(b => b.onclick = () => { gemFilter = b.dataset.pzflt; g.audio.sfx('ui'); render(); });
  modal.querySelector('#btnPuzzleClose').onclick = () => g.ui.closePuzzle();

  g.ui.openPuzzle = () => {
    if (g.state !== 'play') return;
    g.keys = {}; g.mouse.l = g.mouse.r = false;
    g.ui.puzzleOpen = true; modal.classList.remove('hide'); render();
  };
  g.ui.closePuzzle = () => {
    returnHolding();
    g.ui.puzzleOpen = false; modal.classList.add('hide');
  };
  g.ui.rotateHeldGem = () => {
    if (!g.ui.puzzleOpen || !holding) return false;
    holding.rot = (holding.rot + 1) % 4; g.audio.sfx('ui'); render(); return true;
  };
}
