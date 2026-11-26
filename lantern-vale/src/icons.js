// CrispPixel_Sampler 像素圖示系統（整合 18 款 3x CrispPixel 原生 PNG 圖示，並保留 SVG 向量備援）

const wrap = body => `<svg class="ico-svg" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;
const pxImg = (name, alt = '') => `<img class="cp-ico" src="assets/ui/crisp_pixel/icons/${name}.png" alt="${alt}" decoding="async">`;

export const CRISP_ICONS = {
  map: 'map',
  menu: 'scroll',
  flask: 'potion_red',
  mount: 'star',
  conch: 'key',
  bag: 'bag',
  gem: 'gem_ruby',
  lantern: 'fire',
  book: 'book',
  scroll: 'scroll',
  gear: 'shield',
  wrench: 'sword',
  heart: 'heart',
  coin: 'coin_gold',
  chest: 'chest',
  skull: 'skull',
  helmet: 'helmet',
  check: 'check',
  close: 'close',
};

export const ICONS = {
  map: wrap(`
    <path d="M1 3h4v10H1zM6 2h4v10H6zM11 3h4v10h-4z" fill="#e0b574" stroke="#24141c" stroke-width="1.3"/>
    <path d="M3 5h1v3H3zM7 4h2v2H7zM12 7h2v2h-2z" fill="#4e8a7e"/>
    <rect x="8" y="8" width="2" height="2" fill="#e0383e"/>
  `),
  menu: wrap(`
    <rect x="2" y="3" width="12" height="2" fill="#f6d79a" stroke="#24141c" stroke-width="1"/>
    <rect x="2" y="7" width="12" height="2" fill="#f7c040" stroke="#24141c" stroke-width="1"/>
    <rect x="2" y="11" width="12" height="2" fill="#f6d79a" stroke="#24141c" stroke-width="1"/>
  `),
  flask: wrap(`
    <rect x="6" y="1" width="4" height="2" fill="#c08d54" stroke="#24141c" stroke-width="1"/>
    <path d="M6 3h4v2l3 4v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9l3-4z" fill="#f6d79a" stroke="#24141c" stroke-width="1.2"/>
    <path d="M4 10h8v3H4z" fill="#e0383e"/>
    <rect x="5" y="10" width="2" height="2" fill="#ff8274"/>
  `),
  mount: wrap(`
    <path d="M4 2l2 3M12 2l-2 3" stroke="#f7c040" stroke-width="1.8" stroke-linecap="square"/>
    <rect x="5" y="5" width="6" height="5" fill="#b9733f" stroke="#24141c" stroke-width="1.2"/>
    <rect x="6" y="10" width="4" height="4" fill="#8c4a30" stroke="#24141c" stroke-width="1.1"/>
  `),
  conch: wrap(`
    <path d="M3 10c0-4 3-7 7-7 2 0 3 1.5 3 3.5S11 11 7 12l-4 1z" fill="#f6d79a" stroke="#24141c" stroke-width="1.2"/>
    <path d="M6 9c1-2 3-3 5-3" stroke="#d08622" stroke-width="1.3" fill="none"/>
    <circle cx="9.5" cy="7" r="1.4" fill="#3d8fe8"/>
  `),
  bag: wrap(`
    <rect x="5" y="2" width="6" height="2" fill="#b9733f" stroke="#24141c" stroke-width="1.1"/>
    <rect x="3" y="4" width="10" height="10" rx="1" fill="#e0b574" stroke="#24141c" stroke-width="1.3"/>
    <rect x="7" y="7" width="2" height="3" fill="#f7c040" stroke="#24141c" stroke-width="1"/>
  `),
  gem: wrap(`
    <polygon points="8,1 14,6 8,15 2,6" fill="#e0383e" stroke="#24141c" stroke-width="1.3"/>
    <polygon points="8,1 11,6 8,11 5,6" fill="#ff8274"/>
  `),
  lantern: wrap(`
    <rect x="6" y="1" width="4" height="2" fill="#4a2a2c" stroke="#24141c" stroke-width="1"/>
    <rect x="4" y="3" width="8" height="9" rx="1" fill="#f7c040" stroke="#24141c" stroke-width="1.3"/>
    <rect x="6" y="5" width="4" height="5" fill="#fff0a0"/>
    <rect x="5" y="12" width="6" height="2" fill="#4a2a2c" stroke="#24141c" stroke-width="1"/>
  `),
  book: wrap(`
    <rect x="2" y="2" width="12" height="12" fill="#8c4a30" stroke="#24141c" stroke-width="1.3"/>
    <rect x="4" y="2" width="2" height="12" fill="#5a2c2a"/>
    <rect x="7" y="5" width="5" height="2" fill="#f7c040"/>
  `),
  scroll: wrap(`
    <rect x="3" y="2" width="10" height="12" fill="#f6d79a" stroke="#24141c" stroke-width="1.3"/>
    <rect x="2" y="2" width="12" height="2.5" fill="#d08622" stroke="#24141c" stroke-width="1"/>
  `),
  gear: wrap(`
    <circle cx="8" cy="8" r="5" fill="#c08d54" stroke="#24141c" stroke-width="1.5"/>
    <circle cx="8" cy="8" r="2" fill="#24141c"/>
  `),
  wrench: wrap(`
    <path d="M10 2a3.5 3.5 0 0 0-3 5l-4.5 4.5 2 2L9 9a3.5 3.5 0 0 0 5-3l-2 1-1.5-1.5L11.5 3.5z" fill="#f6d79a" stroke="#24141c" stroke-width="1.2"/>
  `),
  heart: wrap(`
    <path d="M8 14L2 8.5A3.2 3.2 0 0 1 8 5a3.2 3.2 0 0 1 6 3.5z" fill="#e0383e" stroke="#24141c" stroke-width="1.2"/>
  `),
};

export function applyHudIcons() {
  if (typeof document === 'undefined') return;
  const swap = (sel, crispKey, label) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const pngName = CRISP_ICONS[crispKey];
    const iconHtml = pngName ? pxImg(pngName, label || crispKey) : (ICONS[crispKey] || '');
    el.innerHTML = label != null ? `${iconHtml}<span>${label}</span>` : iconHtml;
  };
  swap('#btnMap', 'map', '地圖');
  swap('#btnMenu', 'menu', '選單');
  swap('#sk-r .ic', 'flask');
  swap('#sk-mount .ic', 'mount');
  swap('#sk-recall .ic', 'conch');
  swap('#sk-bag .ic', 'bag');
  swap('#sk-puzzle .ic', 'gem');
  swap('#sk-auto .ic', 'lantern');
  swap('#btnWiki', 'book', '百科資料庫');
  swap('#btnChangelog', 'scroll', '更新日誌');
  swap('#btnSet', 'gear', '遊戲設定');
  swap('#btnDebug', 'wrench', '除錯工具 (F3)');
  swap('#btnDonate', 'heart', '贊助支持');
}
