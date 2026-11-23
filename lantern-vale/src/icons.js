// Phase U3：燈谷暖木像素風 SVG 圖示庫（統一 16×16 視框、#3b2a2a 深棕勾邊、暖金/青綠/茜紅配色）

const wrap = body => `<svg class="ico-svg" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;

export const ICONS = {
  map: wrap(`
    <path d="M1 3h4v10H1zM6 2h4v10H6zM11 3h4v10h-4z" fill="#f3e1ba" stroke="#3b2a2a" stroke-width="1.3"/>
    <path d="M3 5h1v3H3zM7 4h2v2H7zM12 7h2v2h-2z" fill="#4e8a7e"/>
    <rect x="8" y="8" width="2" height="2" fill="#d9543a"/>
  `),
  menu: wrap(`
    <rect x="2" y="3" width="12" height="2" fill="#f3e1ba" stroke="#3b2a2a" stroke-width="1"/>
    <rect x="2" y="7" width="12" height="2" fill="#ffd85a" stroke="#3b2a2a" stroke-width="1"/>
    <rect x="2" y="11" width="12" height="2" fill="#f3e1ba" stroke="#3b2a2a" stroke-width="1"/>
  `),
  flask: wrap(`
    <rect x="6" y="1" width="4" height="2" fill="#c99a5b" stroke="#3b2a2a" stroke-width="1"/>
    <path d="M6 3h4v2l3 4v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9l3-4z" fill="#e8f5f2" stroke="#3b2a2a" stroke-width="1.2"/>
    <path d="M4 10h8v3H4z" fill="#e85848"/>
    <rect x="5" y="10" width="2" height="2" fill="#ff9e8a"/>
  `),
  mount: wrap(`
    <path d="M4 2l2 3M12 2l-2 3" stroke="#d9a65a" stroke-width="1.8" stroke-linecap="square"/>
    <rect x="5" y="5" width="6" height="5" fill="#c98548" stroke="#3b2a2a" stroke-width="1.2"/>
    <rect x="6" y="10" width="4" height="4" fill="#a86a38" stroke="#3b2a2a" stroke-width="1.1"/>
    <rect x="6" y="7" width="1.5" height="1.5" fill="#3b2a2a"/>
    <rect x="9" y="7" width="1.5" height="1.5" fill="#3b2a2a"/>
  `),
  conch: wrap(`
    <path d="M3 10c0-4 3-7 7-7 2 0 3 1.5 3 3.5S11 11 7 12l-4 1z" fill="#f5d9c6" stroke="#3b2a2a" stroke-width="1.2"/>
    <path d="M6 9c1-2 3-3 5-3" stroke="#d97b62" stroke-width="1.3" fill="none"/>
    <circle cx="9.5" cy="7" r="1.4" fill="#4e8a7e"/>
  `),
  bag: wrap(`
    <rect x="5" y="2" width="6" height="2" fill="#b87d44" stroke="#3b2a2a" stroke-width="1.1"/>
    <rect x="3" y="4" width="10" height="10" rx="1" fill="#c9884a" stroke="#3b2a2a" stroke-width="1.3"/>
    <rect x="3" y="4" width="10" height="4" fill="#a66936" stroke="#3b2a2a" stroke-width="1.1"/>
    <rect x="7" y="7" width="2" height="3" fill="#ffd85a" stroke="#3b2a2a" stroke-width="1"/>
  `),
  gem: wrap(`
    <polygon points="8,1 14,6 8,15 2,6" fill="#62d8ff" stroke="#3b2a2a" stroke-width="1.3"/>
    <polygon points="8,1 11,6 8,11 5,6" fill="#b8f0ff"/>
  `),
  lantern: wrap(`
    <rect x="6" y="1" width="4" height="2" fill="#5c4236" stroke="#3b2a2a" stroke-width="1"/>
    <rect x="4" y="3" width="8" height="9" rx="1" fill="#ffd85a" stroke="#3b2a2a" stroke-width="1.3"/>
    <rect x="6" y="5" width="4" height="5" fill="#fff6d0"/>
    <rect x="5" y="12" width="6" height="2" fill="#5c4236" stroke="#3b2a2a" stroke-width="1"/>
  `),
  book: wrap(`
    <rect x="2" y="2" width="12" height="12" fill="#4e8a7e" stroke="#3b2a2a" stroke-width="1.3"/>
    <rect x="4" y="2" width="2" height="12" fill="#35665c"/>
    <rect x="7" y="5" width="5" height="2" fill="#ffd85a"/>
    <rect x="7" y="9" width="4" height="1.5" fill="#f3e1ba"/>
  `),
  scroll: wrap(`
    <rect x="3" y="2" width="10" height="12" fill="#f5e3be" stroke="#3b2a2a" stroke-width="1.3"/>
    <rect x="2" y="2" width="12" height="2.5" fill="#d9a65a" stroke="#3b2a2a" stroke-width="1"/>
    <rect x="5" y="6" width="6" height="1.5" fill="#7a5a44"/>
    <rect x="5" y="9" width="5" height="1.5" fill="#7a5a44"/>
  `),
  gear: wrap(`
    <circle cx="8" cy="8" r="5" fill="#c9bfa8" stroke="#3b2a2a" stroke-width="1.5"/>
    <circle cx="8" cy="8" r="2" fill="#3b2a2a"/>
    <rect x="7" y="1" width="2" height="2" fill="#3b2a2a"/>
    <rect x="7" y="13" width="2" height="2" fill="#3b2a2a"/>
    <rect x="1" y="7" width="2" height="2" fill="#3b2a2a"/>
    <rect x="13" y="7" width="2" height="2" fill="#3b2a2a"/>
  `),
  wrench: wrap(`
    <path d="M10 2a3.5 3.5 0 0 0-3 5l-4.5 4.5 2 2L9 9a3.5 3.5 0 0 0 5-3l-2 1-1.5-1.5L11.5 3.5z" fill="#b8c4cc" stroke="#3b2a2a" stroke-width="1.2"/>
  `),
  heart: wrap(`
    <path d="M8 14L2 8.5A3.2 3.2 0 0 1 8 5a3.2 3.2 0 0 1 6 3.5z" fill="#e85858" stroke="#3b2a2a" stroke-width="1.2"/>
    <rect x="4" y="6" width="2" height="1.5" fill="#ffb0b0"/>
  `),
};

export function applyHudIcons() {
  if (typeof document === 'undefined') return;
  const swap = (sel, iconKey, label) => {
    const el = document.querySelector(sel);
    if (!el || !ICONS[iconKey]) return;
    el.innerHTML = label != null ? `${ICONS[iconKey]}<span>${label}</span>` : ICONS[iconKey];
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
