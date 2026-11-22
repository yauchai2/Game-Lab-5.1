import { buildPlayer } from './models.js';
import { FIELDS } from './frontier.js';
import illustration from './worldmap.svg';
import { BIOMES } from './util.js';

const regions = [
  ['燈谷鎮', '安全區', '鎮中心設有委託布告欄、鐵匠鋪與地圖桌。', 50, 55],
  ['晨光草原', '等級 1–5', '沿南路走進開闊的草原，草原洞窟藏在丘陵之間。', 49, 84],
  ['低語森林', '等級 5–10', '西側林地的樹冠高低交錯，古老的樹洞通往地底。', 20, 63],
  ['霧潮沼澤', '等級 10–15', '東側濕地常有濃霧，潮水間留有沼澤遺跡。', 81, 63],
  ['霜冬雪原', '等級 15–20', '西北高地時有暴風雪，山脊下方藏著冰窟。', 18, 26],
  ['燼煙火岩區', '等級 20–25', '東北方的赤色岩壁環抱著熔爐。', 81, 27],
  ['古樹林', '等級 25–30', '北方密林的深處，是通往鹿王樹心的入口。', 50, 19],
];

export function bindWorldMap(game) {
  const dialog = document.getElementById('worldMap');
  const atlas = dialog.querySelector('.atlas');
  const name = dialog.querySelector('.region-name');
  const detail = dialog.querySelector('.region-detail');
  atlas.innerHTML = illustration;
  const buttons = [];
  let selected = 0;
  const travel = document.createElement('button'); travel.className = 'btn small map-travel';
  const duel = document.createElement('button'); duel.className = 'btn small';
  const actions = document.createElement('div'); actions.className = 'map-actions';
  const raid=document.createElement('button');raid.className='btn small';raid.textContent='公會組隊副本';
  raid.onclick=()=>game.net.send({t:'raidJoin',code:game.party});
  actions.append(travel, duel, raid); dialog.append(actions);
  travel.onclick = () => {
    dialog.close();
    if (selected) game.enterField(selected); else game.enterTown();
  };
  duel.textContent = '接受演武挑戰';
  duel.onclick = () => {
    if (game.field !== 5 || game.dueling) return;
    dialog.close(); game.dueling=true;
    const pos=game.world.randomWalkable(game.rng, game.player.pos, 5);
    const rival=game.spawnEnemy('boar',pos,true); const actor=buildPlayer(0xb45441,0x81412f);
    game.scene.remove(rival.m.root);rival.m=actor;rival.m.mat=actor.cloak.material;
    actor.root.scale.setScalar(1.45);game.scene.add(actor.root);
    rival.rival=true; rival.level=20;
    game.ui.banner('火岩演武場','已開啟模擬對戰 · 擊敗對手結束挑戰');
  };
  function select(i) {
    selected = i; raid.hidden=!(i===0 && game.depth<0 && game.wallet);
    travel.hidden = (game.field || 0) === i && (game.field || game.depth < 0);
    travel.textContent = i ? '傳送至' + regions[i][0] : '返回燈谷鎮';
    duel.hidden = !(i === 5 && game.field === 5 && !game.dueling);
    const [label, level, description] = regions[i];
    name.textContent = label + ' · ' + level;
    const grave = game.meta.p.graves[i];
    detail.textContent = description + (grave ? ' 墓碑在此，按 F 可取回素材。' : '');
    buttons.forEach((button, j) => button.setAttribute('aria-pressed', i === j));
  }
  regions.forEach(([label, , , x, y], i) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.left = x + '%'; button.style.top = y + '%';
    button.onclick = () => select(i);
    atlas.appendChild(button); buttons.push(button);
  });
  function open() {
    if (game.state !== 'play' || game.ui.invOpen || game.ui.panelOpen || game.ui.setOpen) return;
    game.keys = {}; game.mouse.l = game.mouse.r = false;
    const town = game.depth < 0;
    dialog.querySelector('.map-location').textContent = town ? '所在位置 · 燈谷鎮（安全區）' :
      '【副本地圖】' + BIOMES[game.biomeFor(game.depth)].name + ' · 第 ' + (game.depth + 1) + ' 層（需清怪開門，或隨時撤回燈谷鎮）';
    if (game.field) dialog.querySelector('.map-location').textContent = '【常駐普通地圖】' + FIELDS[game.field].name + '（無需清怪，可隨時傳送至他區或回城）';
    buttons.forEach((b,i)=>b.classList.toggle('here', town ? i===0 : i===game.field));
    if (game.field) select(game.field);
    else if (town) select(0);
    else {
      select(0);
      buttons.forEach(button => button.setAttribute('aria-pressed', false));
      name.textContent = '副本探索中';
      detail.textContent = '選擇地圖上的區域，查看地形與建議等級。';
    }
    dialog.showModal();
  }
  document.getElementById('btnMap').onclick = open;
  dialog.querySelector('.map-close').onclick = () => dialog.close();
  game.ui.mapDialog = dialog;
  game.ui.openMap = open;
}
