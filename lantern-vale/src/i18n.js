// 多語系切換系統（繁體中文 / English / 日本語）
export const LANGS = [
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
];

export const DICT = {
  'zh-TW': {
    title: '燈谷行',
    subtitle: '像素原野 · 物理背包 · 雙城航行 · 技能拼圖',
    start: '踏入燈谷',
    settings: '設定',
    map: '世界總圖',
    regionMap: '地區地圖',
    bag: '物理背包',
    gear: '裝備與屬性',
    stash: '倉庫',
    cosmetics: '外觀造型',
    puzzle: '技能拼圖',
    recall: '回城',
    recallCast: '吹響歸途海螺中…（移動或受擊將中斷）',
    recallDone: '已搭乘星燈微風返回城鎮',
    recallCancel: '回城吟唱已中斷',
    noDirectTp: '地圖僅供檢視與設定導航標記！請經由區域道路、乘船或按 H 回城移動。',
    setWaypoint: '設為導航目標',
    clearWaypoint: '清除導航標記',
    waypointSet: '已設定導航目標',
    shakeBag: '🎲 搖一搖整理',
    equipItem: '裝備',
    useItem: '使用',
    toStash: '存入倉庫',
    toBag: '取回背包',
    bagEmpty: '拖曳物品可拋擲，點擊選取操作；按「搖一搖」可重新重力堆疊！',
    harborName: '海風港鎮',
    townName: '燈谷鎮',
    sailingToHarbor: '⛵ 正乘著木船航向「海風港鎮」…',
    sailingToTown: '⛵ 正乘著木船返航「燈谷鎮」…',
    boardFerryHarbor: '乘船航向海風港鎮（第二城鎮）',
    boardFerryTown: '乘船返航燈谷鎮',
    keyPresetArpg: '推薦 ARPG（右鍵/Q/E/C）',
    keyPresetPoe: 'PoE 風格（Q/E/R/T）',
    keyPresetMmo: 'MMO 數字（1/2/3/4）',
    language: '遊戲語言',
    pressKey: '請按下新按鍵…',
  },
  en: {
    title: 'Lantern Vale',
    subtitle: 'Cozy 3D Action · Physics Bag · Twin Towns · Skill Puzzle',
    start: 'Enter Vale',
    settings: 'Settings',
    map: 'World Map',
    regionMap: 'Region Map',
    bag: 'Physics Bag',
    gear: 'Gear & Stats',
    stash: 'Stash',
    cosmetics: 'Cosmetics',
    puzzle: 'Skill Puzzle',
    recall: 'Recall',
    recallCast: 'Sounding Return Conch… (Move or damage cancels)',
    recallDone: 'Returned safely to town on the lantern breeze',
    recallCancel: 'Recall channel interrupted',
    noDirectTp: 'Map is for navigation waypoints only! Travel via gates, ferry boat, or press H to Recall.',
    setWaypoint: 'Set Waypoint',
    clearWaypoint: 'Clear Waypoint',
    waypointSet: 'Navigation waypoint set',
    shakeBag: '🎲 Shake Up Bag',
    equipItem: 'Equip',
    useItem: 'Use',
    toStash: 'Store in Stash',
    toBag: 'Move to Bag',
    bagEmpty: 'Drag & toss items with gravity! Click an item to equip/store, or press Shake!',
    harborName: 'Sea-Breeze Harbor',
    townName: 'Lantern Vale Town',
    sailingToHarbor: '⛵ Sailing across the bay to Sea-Breeze Harbor…',
    sailingToTown: '⛵ Sailing back to Lantern Vale Town…',
    boardFerryHarbor: 'Board Ferry to Sea-Breeze Harbor (2nd Town)',
    boardFerryTown: 'Board Ferry back to Lantern Vale Town',
    keyPresetArpg: 'ARPG Default (RMB/Q/E/C)',
    keyPresetPoe: 'PoE Style (Q/E/R/T)',
    keyPresetMmo: 'MMO Numbers (1/2/3/4)',
    language: 'Language',
    pressKey: 'Press any key…',
  },
  ja: {
    title: 'ランタン谷',
    subtitle: 'ピクセル原野・物理リュック・二大拠点・スキルパズル',
    start: '旅に出る',
    settings: '設定',
    map: 'ワールド地図',
    regionMap: 'エリア地図',
    bag: '物理リュック',
    gear: '装備・能力',
    stash: '倉庫',
    cosmetics: '見た目衣装',
    puzzle: 'スキルパズル',
    recall: '帰還',
    recallCast: '帰還の貝笛を吹いています…（移動・被弾で中断）',
    recallDone: 'ランタンの風に乗って町へ帰還しました',
    recallCancel: '帰還詠唱が中断されました',
    noDirectTp: '地図からの直接ワープは不可！道・船・または H キー帰還で旅しましょう。',
    setWaypoint: '目的地に設定',
    clearWaypoint: '目的地を解除',
    waypointSet: 'ナビ目的地を設定しました',
    shakeBag: '🎲 振って整理',
    equipItem: '装備する',
    useItem: '使う',
    toStash: '倉庫へ預ける',
    toBag: 'リュックへ戻す',
    bagEmpty: 'ドラッグで投げたり、重力で積み重なります！クリックで操作できます。',
    harborName: '海風港町',
    townName: 'ランタンの町',
    sailingToHarbor: '⛵ 木造船で「海風港町」へ航海中…',
    sailingToTown: '⛵ 木造船で「ランタンの町」へ帰航中…',
    boardFerryHarbor: '船に乗って海風港町へ（第二の町）',
    boardFerryTown: '船に乗ってランタンの町へ戻る',
    keyPresetArpg: 'ARPG標準 (右/Q/E/C)',
    keyPresetPoe: 'PoE風 (Q/E/R/T)',
    keyPresetMmo: 'MMO数字 (1/2/3/4)',
    language: '言語',
    pressKey: '新しいキーを押してください…',
  },
};

export function t(lang, key) {
  return DICT[lang]?.[key] ?? DICT['zh-TW'][key] ?? key;
}

export function applyDOMLanguage(lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  const setTxt = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(lang, key); };
  const h1 = document.querySelector('#title h1'); if (h1) h1.textContent = t(lang, 'title');
  const sub = document.querySelector('#title .sub'); if (sub) sub.textContent = t(lang, 'subtitle');
  setTxt('btnStart', 'start');
  setTxt('btnSetTitle', 'settings');
  const mapBtn = document.getElementById('btnMap'); if (mapBtn) mapBtn.title = t(lang, 'map') + ' (M)';
  const setBtn = document.getElementById('btnSet'); if (setBtn) setBtn.title = t(lang, 'settings') + ' (Esc)';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (k) el.textContent = t(lang, k);
  });
}
