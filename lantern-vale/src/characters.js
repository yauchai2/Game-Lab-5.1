import * as THREE from 'three';
import { buildPlayer } from './models.js';
import { Meta } from './meta.js';
import { CLASSES, ensurePuzzle } from './puzzle.js';

export const HOODS = [[0x2f8a7e,0x23695f],[0xd9543a,0xa83f2c],[0x6a6ad0,0x4a4aa0],[0xe0a030,0xb07f20],[0xc060b0,0x904488],[0x58a858,0x3f823f],[0x4aa0d8,0x3478a8],[0x8a6a50,0x65503c]];
const fields = {
  job: CLASSES.map(c => `${c.icon} ${c.name}`),
  skin: ['暖米', '蜂蜜', '赤陶', '深棕'],
  hair: ['栗棕', '炭黑', '秋金', '銀灰'],
  style: ['短瀏海', '側分', '雙髻'],
  brow: ['平眉', '揚眉', '濃眉'],
  face: ['圓臉', '長臉', '寬臉'],
};
const $ = id => document.getElementById(id);
const key = slot => slot === 0 ? 'lv_prof' : 'lv_prof_' + slot;
function read(id) {
  try { return JSON.parse(localStorage.getItem(id)); } catch { return null; }
}
function index(value, count) {
  return Number.isInteger(value) && value >= 0 && value < count ? value : 0;
}

export function bindCharacters(game) {
  const slots = $('characterSlot');
  let slot = index(read('lv_active_slot'), 3);
  for (let i = 0; i < 3; i++) {
    slots.add(new Option(read(key(i))?.name || ('旅人欄位 ' + (i + 1)), i));
  }
  slots.value = slot;
  const renderer = new THREE.WebGLRenderer({ canvas: $('portrait'), alpha: true, antialias: false });
  renderer.setSize(170, 170, false);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.84, 0.84, 1.07, -0.61, 0.1, 20);
  camera.position.set(1.2, 1.5, 4);
  camera.lookAt(0, 0.37, 0);
  scene.add(new THREE.HemisphereLight(0xfff1d8, 0xe2b58a, 2));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(-2, 4, 3); scene.add(sun);
  let portrait;
  function clearPortrait() {
    if (!portrait) return;
    scene.remove(portrait);
    const geometries = new Set(), materials = new Set();
    portrait.traverse(node => {
      if (node.isMesh) { geometries.add(node.geometry); materials.add(node.material); }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }
  function draw() {
    clearPortrait();
    portrait = buildPlayer(...HOODS[game.hoodIdx], undefined, game.character).root;
    scene.add(portrait);
    renderer.render(scene, camera);
    [...$('swatches').children].forEach((b, i) => b.setAttribute('aria-pressed', i === game.hoodIdx));
    const cls = CLASSES[game.character?.job ?? 0] || CLASSES[0];
    const perk = $('jobPerk');
    if (perk) perk.innerHTML = `<b>${cls.icon} ${cls.name}</b>：${cls.summary}<br><small style="color:#6a4a30">${cls.desc}</small>`;
  }
  for (const [field, labels] of Object.entries(fields)) {
    const select = $(field);
    labels.forEach((label, i) => select.add(new Option(label, i)));
    select.onchange = () => { game.character[field] = +select.value; draw(); };
  }
  HOODS.forEach(([color], i) => {
    const button = document.createElement('button');
    button.style.background = '#' + color.toString(16).padStart(6, '0');
    button.setAttribute('aria-label', '披風：' + ['松綠','磚紅','靛藍','金黃','莓紫','草綠','湖藍','栗棕'][i]);
    button.onclick = () => { game.hoodIdx = i; draw(); };
    $('swatches').append(button);
  });
  function selectSlot() {
    slot = +slots.value;
    const saved = read(key(slot)) || {};
    $('inName').value = saved.name || '';
    game.hoodIdx = index(saved.hood, HOODS.length);
    game.character = {};
    for (const [field, labels] of Object.entries(fields)) {
      game.character[field] = index(saved[field], labels.length);
      $(field).value = game.character[field];
    }
    draw();
  }
  slots.onchange = selectSlot;
  $('randomLook').onclick = () => {
    for (const [field, labels] of Object.entries(fields)) {
      if (field === 'job') continue;
      $(field).value = game.character[field] = Math.floor(Math.random() * labels.length);
    }
    game.hoodIdx = Math.floor(Math.random() * HOODS.length);
    draw();
  };
  selectSlot();
  return () => {
    game.slot = slot;
    game.meta = new Meta(slot);
    const cls = CLASSES[game.character?.job ?? 0] || CLASSES[0];
    const isNew = !game.meta.p.puzzle;
    ensurePuzzle(game.meta.p, cls.id);
    if (isNew) { game.meta.p.weapon = cls.weapon; game.meta.save(); }
    try {
      localStorage.setItem(key(slot), JSON.stringify({ ...game.character, name: game.playerName, hood: game.hoodIdx }));
      localStorage.setItem('lv_active_slot', JSON.stringify(slot));
    } catch { /* Offline play also works without persistent storage. */ }
    clearPortrait(); renderer.dispose(); renderer.forceContextLoss();
  };
}
