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
  function select(i) {
    const [label, level, description] = regions[i];
    name.textContent = label + ' · ' + level;
    detail.textContent = description;
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
    dialog.querySelector('.map-location').textContent = town ? '所在位置 · 燈谷鎮' :
      '所在副本 · ' + BIOMES[game.biomeFor(game.depth)].name + ' · 第 ' + (game.depth + 1) + ' 層';
    buttons[0].classList.toggle('here', town);
    if (town) select(0);
    else {
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
