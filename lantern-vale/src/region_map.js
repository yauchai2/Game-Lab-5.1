import { teleportToCheckpoint } from './frontier.js';
import { uvToWorld } from './field_blueprints.js';
import { describeMapTarget, mapAreaName, mapExitDestination, mapExitLabel, navigationTarget } from './map_navigation.js';
import { canvasUiFont } from './ui_typography.js';

const COLORS = {
  travel: '#91e9da', checkpoint: '#48bcff', activity: '#f9d371',
  danger: '#ff8281', ally: '#f3f7ff', virtual: '#48f0c8', navigation: '#ffeb92',
};
const terrainCache = new WeakMap();

export function regionMapProjection(g, width, height) {
  const worldHalf = g.world?.half || 30;
  const halfX = g.interior ? g.interior.halfW + 0.7 : worldHalf;
  const halfZ = g.interior ? g.interior.halfD + 0.7 : worldHalf;
  const scale = Math.min((width - 24) / (halfX * 2), (height - 24) / (halfZ * 2));
  return {
    x: x => width / 2 + x * scale,
    y: z => height / 2 + z * scale,
    world: (x, y) => ({ x: (x - width / 2) / scale, z: (y - height / 2) / scale }),
    halfX, halfZ, scale,
  };
}

function drawTerrain(g, canvas, view) {
  const W = canvas.width, H = canvas.height;
  const base = canvas.ownerDocument.createElement('canvas');
  base.width = W;
  base.height = H;
  const ctx = base.getContext('2d');
  ctx.fillStyle = '#282926';
  ctx.fillRect(0, 0, W, H);
  if (g.interior) {
    ctx.fillStyle = '#a37454';
    ctx.fillRect(view.x(-view.halfX), view.y(-view.halfZ), 2 * view.halfX * view.scale, 2 * view.halfZ * view.scale);
    ctx.fillStyle = '#82564a';
    ctx.fillRect(view.x(-view.halfX / 2), view.y(-view.halfZ / 2), view.halfX * view.scale, view.halfZ * view.scale);
    return base;
  }

  const world = g.world;
  const floors = ['#294653', '#757951', '#596345', '#9a8d75'];
  const hue = g.caveRun ? '#77736a' : g.biome?.key === 'snow' ? '#acbfc1' : floors[1];
  for (let py = 12; py < H - 12; py += 2) for (let px = 12; px < W - 12; px += 2) {
    const point = view.world(px, py);
    const k = world.idx(point.x, point.z);
    const t = k >= 0 ? world.T?.[k] || 0 : 0;
    const cell = world.bpCell?.[k];
    ctx.fillStyle = cell === 1 ? '#61a1ab' : cell === 5 ? '#c9c3ab' : t === 1 ? hue : floors[t] || floors[0];
    ctx.fillRect(px, py, 2, 2);
  }

  const segment = (a, b) => {
    ctx.beginPath();
    ctx.moveTo(view.x(a.x), view.y(a.z));
    ctx.lineTo(view.x(b.x), view.y(b.z));
    ctx.stroke();
  };
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#bcac7c';
  for (const [a, b] of world.paths || []) segment(a, b);
  ctx.strokeStyle = '#ead080';
  ctx.lineWidth = 3;
  for (const b of world.bridges || []) segment({ x: b.x0, z: b.z0 }, { x: b.x1, z: b.z1 });
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#b1edf1';
  ctx.setLineDash([4, 3]);
  for (const gl of world.bp?.glides || []) {
    const a = uvToWorld(gl[0], gl[1], world.half);
    const m = uvToWorld(gl[2], gl[3], world.half);
    const b = uvToWorld(gl[4], gl[5], world.half);
    ctx.beginPath();
    ctx.moveTo(view.x(a.x), view.y(a.z));
    ctx.quadraticCurveTo(view.x(m.x), view.y(m.z), view.x(b.x), view.y(b.z));
    ctx.stroke();
  }
  return base;
}

export function regionMapMarkers(g, options = { activity: true, danger: true, people: true }) {
  const pins = [];
  const add = (point, key, group, label, options = {}) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return;
    pins.push({ key, x: point.x, z: point.z, group, label, ...options });
  };
  if (g.raid) {
    add(g.raid.boss.root.position, 'raid-boss', 'danger', '共鳴守護獸', { major: true });
    for (const [id, player] of g.raid.allies) {
      if (player.root.visible) add(player.root.position, `raid-ally-${id}`, 'ally', '隊友');
    }
  }
  if (!g.interior) {
    for (const [i, exit] of (g.exits || []).entries()) {
      add(exit, `exit-${i}`, 'travel', mapExitLabel(g, exit), { locked: !exit.on, pinnable: !!exit.on });
    }
    for (const cp of g.checkpoints || []) {
      add(cp, `cp-${cp.idx}`, 'checkpoint', cp.name, { cpIdx: cp.idx, locked: !cp.unlocked, pinnable: true });
    }
    for (const [i, air] of (g.updrafts || []).entries()) add(air, `air-${i}`, 'travel', '上升氣流', { pinnable: true });
    if (options.activity) for (const [i, fire] of (g.campfires || []).entries()) add(fire, `fire-${i}`, 'activity', '旅人營火', { pinnable: true });
    if (g.worldBoss?.active && !g.worldBoss.enemy?.dead && g.worldBoss.enemy?.pos) {
      add(g.worldBoss.enemy.pos, 'world-boss', 'danger', g.worldBoss.def?.name || '世界首領');
    }
    if (options.activity && g.dynEvent?.active && g.dynEvent.pos) add(g.dynEvent.pos, 'event', 'activity', g.dynEvent.def?.name || '區域奇遇', { pinnable: true });
    for (const [i, e] of (g.enemies || []).entries()) {
      const major = !!(e.elite || e.expeditionId || e.legendary);
      if (e.dead || e === g.worldBoss?.enemy || (!options.danger && !major)) continue;
      add(e.pos, `enemy-${i}`, 'danger', e.bossName || e.expeditionName || (e.elite ? '精英魔物' : '魔物'), { major });
    }
    if (options.people) {
      for (const [id, player] of g.remotes || []) {
        if (!player.bot && player.m?.root?.visible) add(player, `remote-${id}`, 'ally', player.name);
      }
      for (const a of g._simAdvs || []) add(a, `sim-${a.def.id}`, 'virtual', `${a.def.name} · 虛擬冒險者`);
    }
  }
  for (const [i, spot] of (g.spots || []).entries()) {
    if (spot.mesh?.visible === false || spot.kind === 'checkpoint' || spot.kind === 'meadowCave') continue;
    const travel = spot.kind === 'exit_house' || mapExitDestination(g, spot) != null;
    if (travel || spot.kind === 'grave' || options.activity) add(spot, `spot-${i}`, spot.kind === 'grave' ? 'danger' : travel ? 'travel' : 'activity',
      spot.label || '互動點', { pinnable: true, major: spot.kind === 'grave' });
  }
  return pins;
}

export function drawRegionMap(g, canvas, options) {
  const W = canvas.width, H = canvas.height;
  const view = regionMapProjection(g, W, H);
  const ctx = canvas.getContext('2d');
  const terrainKey = g.interior || g.world.T;
  let terrain = terrainCache.get(canvas);
  if (terrain?.key !== terrainKey || !terrain || terrain.base.width !== W || terrain.base.height !== H) {
    terrain = { key: terrainKey, base: drawTerrain(g, canvas, view) };
    terrainCache.set(canvas, terrain);
  }
  ctx.drawImage(terrain.base, 0, 0);

  const target = navigationTarget(g);
  const px = view.x(g.player.pos.x), py = view.y(g.player.pos.z);
  if (target) {
    const x = view.x(target.x), y = view.y(target.z);
    ctx.strokeStyle = COLORS.navigation;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#352a1e';
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 5, y - 5, 10, 10);
    ctx.strokeStyle = COLORS.navigation;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 5, y - 5, 10, 10);
  }

  const points = regionMapMarkers(g, options);
  for (const pin of points) {
    pin.sx = view.x(pin.x);
    pin.sy = view.y(pin.z);
    const selected = pin.key === options.selected;
    const small = pin.group === 'virtual' || pin.group === 'danger' && !pin.major;
    const r = selected ? 6 : small ? 2 : 4;
    ctx.globalAlpha = pin.locked ? 0.55 : 1;
    ctx.fillStyle = '#272026';
    ctx.fillRect(pin.sx - r - 1, pin.sy - r - 1, r * 2 + 2, r * 2 + 2);
    ctx.fillStyle = selected ? COLORS.navigation : COLORS[pin.group];
    ctx.fillRect(pin.sx - r, pin.sy - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - g.player.facing);
  ctx.fillStyle = '#fff8e4'; ctx.strokeStyle = '#2b1d33'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff2c9';
  ctx.font = canvasUiFont(12, 700);
  ctx.fillText('N', 8, 13);
  const scaleMark = g.interior ? 2 : g.field ? 50 : 10;
  ctx.fillText(`${scaleMark}m`, 9, H - 12);
  ctx.fillRect(9, H - 8, scaleMark * view.scale, 1);
  return { points, view };
}

export function bindRegionMap(g) {
  const $ = id => document.getElementById(id);
  const root = $('regionMap');
  const canvas = $('regionMapCanvas');
  const picker = $('rmPoi');
  const info = $('rmInfo');
  const pinButton = $('rmPin');
  const travel = $('rmTravel');
  const clear = $('rmClear');
  const worldMap = $('rmWorld');
  const options = { activity: true, danger: false, people: false, selected: null };
  let map;
  let keyList = '';
  let scene;
  let manual = null;
  let previewKey = null;
  const selected = () => manual || map?.points.find(pin => pin.key === options.selected);

  function syncDetails() {
    const pin = selected();
    const preview = map?.points.find(point => point.key === previewKey) || pin;
    const text = preview
      ? `${preview.label} · ${preview.locked ? '未開通 · ' : ''}${describeMapTarget(g.player.pos, preview)}`
      : '在圖上選取路標，或點地面設標記。';
    if (info.textContent !== text) info.textContent = text;
    pinButton.hidden = !pin?.pinnable;
    travel.hidden = pin?.cpIdx == null || pin.locked;
    clear.hidden = !g.mapPin;
  }

  function refresh() {
    if (!g.ui.regionMapOpen) return;
    const terrain = g.interior || g.world.T;
    if (scene !== terrain) {
      scene = terrain;
      options.selected = null;
      manual = null;
      previewKey = null;
    }
    worldMap.hidden = !!g.raid;
    const name = mapAreaName(g);
    if ($('rmTitle').textContent !== name) $('rmTitle').textContent = name;
    map = drawRegionMap(g, canvas, options);
    const sites = map.points.filter(pin => pin.pinnable || pin.locked);
    const signature = sites.map(pin => `${pin.key}/${pin.label}/${pin.locked}`).join('|');
    if (signature !== keyList || picker.options.length === 0) {
      keyList = signature;
      picker.replaceChildren(new Option('選取地區路標', ''), ...sites.map(pin => new Option(pin.label, pin.key)));
    }
    const value = sites.some(pin => pin.key === options.selected) ? options.selected : '';
    if (picker.value !== value) picker.value = value;
    syncDetails();
  }

  picker.onchange = () => { manual = null; options.selected = picker.value; refresh(); };
  function hitAt(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = (event.clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth;
    const sy = (event.clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight;
    let nearest = null;
    let distance = 10;
    for (const pin of map.points) {
      const d = Math.hypot(pin.sx - sx, pin.sy - sy);
      if (d < distance) { nearest = pin; distance = d; }
    }
    return { sx, sy, nearest };
  }
  canvas.addEventListener('pointermove', event => {
    if (!map || event.pointerType !== 'mouse') return;
    const preview = hitAt(event).nearest?.key || null;
    if (preview !== previewKey) { previewKey = preview; syncDetails(); }
  });
  canvas.addEventListener('pointerleave', () => { previewKey = null; syncDetails(); });
  canvas.addEventListener('click', event => {
    if (!map) return;
    const { sx, sy, nearest } = hitAt(event);
    previewKey = null;
    options.selected = nearest?.key || null;
    manual = null;
    if (!nearest) {
      const point = map.view.world(sx, sy);
      const onMap = g.interior ? Math.abs(point.x) <= g.interior.halfW && Math.abs(point.z) <= g.interior.halfD
        : g.world.isLand(point.x, point.z);
      if (onMap) manual = { ...point, label: '自訂標記', pinnable: true };
    }
    refresh();
    if (manual) pinButton.click();
  });
  pinButton.onclick = () => {
    const pin = selected();
    if (!pin?.pinnable) return;
    g.mapPin = { x: pin.x, z: pin.z, label: pin.label };
    refresh();
  };
  clear.onclick = () => { g.mapPin = null; refresh(); };
  travel.onclick = () => {
    const cp = selected();
    if (cp?.cpIdx != null && teleportToCheckpoint(g, cp.cpIdx)) g.ui.toggleRegionMap(g);
  };
  for (const button of root.querySelectorAll('[data-map-filter]')) {
    button.onclick = () => {
      const filter = button.dataset.mapFilter;
      options[filter] = !options[filter];
      button.setAttribute('aria-pressed', String(options[filter]));
      refresh();
    };
  }
  worldMap.onclick = () => { g.ui.toggleRegionMap(g); g.ui.openMap(); };
  return refresh;
}
