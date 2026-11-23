// 完整多語系系統：繁體中文 / English / 日本語（即時切換全部介面文案）
export const LANGS = [
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
];

export const I18N = {
  'zh-TW': {
    title: '燈谷行',
    subtitle: 'Lantern Vale · 像素風 3D 奇幻 MMORPG',
    start: '提燈出發',
    settings: '設定',
    settingsTitle: '⚙ 設定',
    worldMap: '世界地圖',
    bag: '🎒 背包與裝備',
    gear: '裝備與屬性',
    stash: '公共倉庫',
    cosmetics: '外觀造型',
    puzzle: '技能拼圖',
    recall: '歸途海螺',
    recallCast: '吟唱回城中…（移動或受擊會中斷）',
    shakeBag: '🎲 搖一搖',
    equipItem: '裝備',
    useItem: '使用',
    toStash: '存入倉庫',
    toBag: '取回背包',
    bagEmpty: '點選或拖曳背包裡的物理物件；按「搖一搖」可顛動整理！',
    stashLocked: '🔒 倉庫不在身上！請前往「燈谷鎮」或「海風港鎮」與公共倉庫箱按 F 互動開啟。',
    mapNoTeleport: '⚠ 世界總圖不可直接傳送，請點擊地點設定導航目標，徒步或至碼頭乘船前往！',
    noDirectTp: '世界總圖僅供導航，請徒步或至碼頭乘船前往',
    setNav: '設為導航目標',
    setWaypoint: '設為導航目標',
    clearWaypoint: '取消導航目標',
    waypointSet: '已設定導航目標',
    close: '關閉',
    language: '語言 Language',
    tabVideo: '畫面', tabAudio: '音效', tabKeys: '操作', tabAbout: '關於',
    rowMaster: '主音量', rowMusic: '音樂', rowSfx: '音效',
    rowPixel: '像素大小', rowCamAngle: '鏡頭視角', rowWind: '風吹草動',
    rowWater: '水波特效', rowShafts: '光柱與風線', rowShake: '畫面震動',
    rowDmg: '傷害數字', rowChat: '聊天視窗', rowMute: '靜音',
    muteOn: '已靜音 · 點擊開啟', muteOff: '開啟中 · 點擊靜音',
    optOff: '關', optOn: '開', optFine: '細', optStd: '標準', optCoarse: '粗',
    optBreeze: '微風', optGale: '強風',
    cam45: '斜 45°（PoE 2 推薦）', cam55: '高俯視 55°（經典）', cam36: '低仰角 36°（宏偉風景）',
    keyPresetArpg: 'ARPG 預設（右鍵/Q/E/C/R）',
    keyPresetPoe: 'PoE 風格（Q/E/R/T/1）',
    keyPresetMmo: 'MMO 數字列（1/2/3/4/5）',
    pressKey: '請按下新按鍵…',
    bindSk0: '技能欄 1', bindSk1: '技能欄 2', bindSk2: '技能欄 3', bindSk3: '技能欄 4',
    bindFlask: '蜜藥瓶回血', bindRecall: '快捷回城（歸途海螺）',
    resetSettings: '重設所有設定',
    aboutText: '燈谷行 Lantern Vale<br>像素風 3D 動作冒險 MMORPG<br>靈感：A Short Hike、孤山獨影等。所有角色與素材皆為原創。<br><br>設定、物理背包、倉庫與外觀皆自動儲存在瀏覽器。',
    skAttack: '普攻', skFlask: '蜜藥', skMount: '坐騎', skBag: '背包', skPuzzle: '拼圖', skRecall: '回城', skEmpty: '空位',
    kills: '擊敗', online: '線上',
    statusPoison: '🧪 中毒', statusFreeze: '❄️ 冰凍', statusChill: '🧊 緩速', statusBurn: '🔥 灼燒', statusShock: '⚡ 感電', statusOverload: '💢 魔力過載',
  },
  en: {
    title: 'Lantern Vale',
    subtitle: 'Cozy Pixel 3D Fantasy MMORPG',
    start: 'Embark',
    settings: 'Settings',
    settingsTitle: '⚙ Settings',
    worldMap: 'World Map',
    bag: 'Physics Bag',
    gear: 'Gear & Stats',
    stash: 'Town Stash',
    cosmetics: 'Cosmetics',
    puzzle: 'Skill Puzzle',
    recall: 'Recall Conch',
    recallCast: 'Channeling Recall... (moving/damage cancels)',
    shakeBag: '🎲 Shake',
    equipItem: 'Equip',
    useItem: 'Use',
    toStash: 'Store in Stash',
    toBag: 'Move to Bag',
    bagEmpty: 'Drag, toss, or click items in your physics bag. Click Shake to rearrange!',
    stashLocked: '🔒 Stash is not carried on you! Visit Lantern Vale Town or Seabreeze Harbor and press F at the Town Stash chest.',
    mapNoTeleport: '⚠ Direct map teleport is disabled. Set a compass waypoint and travel on foot or sail by ferry!',
    noDirectTp: 'Navigation only · Travel on foot or by ferry',
    setNav: 'Set Waypoint',
    setWaypoint: 'Set Waypoint',
    clearWaypoint: 'Clear Waypoint',
    waypointSet: 'Waypoint Set',
    close: 'Close',
    language: 'Language',
    tabVideo: 'Video', tabAudio: 'Audio', tabKeys: 'Controls', tabAbout: 'About',
    rowMaster: 'Master Vol', rowMusic: 'Music', rowSfx: 'SFX',
    rowPixel: 'Pixel Scale', rowCamAngle: 'Camera Angle', rowWind: 'Wind Sway',
    rowWater: 'Water Ripples', rowShafts: 'Light Shafts', rowShake: 'Screen Shake',
    rowDmg: 'Damage Numbers', rowChat: 'Chat Window', rowMute: 'Mute',
    muteOn: 'Muted · Click to Unmute', muteOff: 'Active · Click to Mute',
    optOff: 'Off', optOn: 'On', optFine: 'Fine', optStd: 'Standard', optCoarse: 'Coarse',
    optBreeze: 'Breeze', optGale: 'Gale',
    cam45: 'Oblique 45° (PoE 2)', cam55: 'Top-Down 55° (Classic)', cam36: 'Low 36° (Scenic)',
    keyPresetArpg: 'ARPG Default (RMB/Q/E/C/R)',
    keyPresetPoe: 'PoE Style (Q/E/R/T/1)',
    keyPresetMmo: 'MMO Number Row (1/2/3/4/5)',
    pressKey: 'Press any key...',
    bindSk0: 'Skill Slot 1', bindSk1: 'Skill Slot 2', bindSk2: 'Skill Slot 3', bindSk3: 'Skill Slot 4',
    bindFlask: 'Honey Flask', bindRecall: 'Town Recall Conch',
    resetSettings: 'Reset All Settings',
    aboutText: 'Lantern Vale<br>Cozy Pixel 3D Fantasy MMORPG<br>Original characters, shaders, and mechanics.<br><br>Settings, physics bag, stash, and cosmetics save automatically.',
    skAttack: 'Attack', skFlask: 'Flask', skMount: 'Mount', skBag: 'Bag', skPuzzle: 'Puzzle', skRecall: 'Recall', skEmpty: 'Empty',
    kills: 'Kills', online: 'Online',
    statusPoison: '🧪 Poisoned', statusFreeze: '❄️ Frozen', statusChill: '🧊 Chilled', statusBurn: '🔥 Burning', statusShock: '⚡ Shocked', statusOverload: '💢 Overload',
  },
  ja: {
    title: 'ランタン・ヴェイル',
    subtitle: '灯りの谷 · ピクセル3D冒険MMORPG',
    start: '灯りを持って出発',
    settings: '設定',
    settingsTitle: '⚙ 設定',
    worldMap: 'ワールドマップ',
    bag: '物理リュック',
    gear: '装備・ステータス',
    stash: '街の倉庫',
    cosmetics: '見た目変更',
    puzzle: 'スキルパズル',
    recall: '帰還の巻貝',
    recallCast: '帰還詠唱中…（移動・被弾で中断）',
    shakeBag: '🎲 整理',
    equipItem: '装備する',
    useItem: '使う',
    toStash: '倉庫へ預ける',
    toBag: 'リュックへ戻す',
    bagEmpty: 'アイテムを掴んで放り投げたり、「振って整理」で整頓できます！',
    stashLocked: '🔒 倉庫は持ち歩けません！「灯りの町」または「海風港町」の公共倉庫前で F キーを押してください。',
    mapNoTeleport: '⚠ マップからの直接ワープ不可。目的地をナビに設定し、徒歩やフェリーで向かいましょう！',
    noDirectTp: 'ワープ不可 · 徒歩やフェリーで移動',
    setNav: 'ナビに設定',
    setWaypoint: 'ナビに設定',
    clearWaypoint: 'ナビを解除',
    waypointSet: 'ナビを設定しました',
    close: '閉じる',
    language: '言語 Language',
    tabVideo: '映像', tabAudio: '音声', tabKeys: '操作', tabAbout: '概要',
    rowMaster: 'マスター音量', rowMusic: 'BGM', rowSfx: '効果音',
    rowPixel: 'ピクセル密度', rowCamAngle: 'カメラ角度', rowWind: '風の揺れ',
    rowWater: '水面エフェクト', rowShafts: '光の筋', rowShake: '画面揺れ',
    rowDmg: 'ダメージ数値', rowChat: 'チャット欄', rowMute: 'ミュート',
    muteOn: 'ミュート中 · クリックで解除', muteOff: 'オン · クリックでミュート',
    optOff: 'オフ', optOn: 'オン', optFine: '細', optStd: '標準', optCoarse: '粗',
    optBreeze: 'そよ風', optGale: '強風',
    cam45: '斜め45°（PoE 2推奨）', cam55: '見下ろし55°（定番）', cam36: '低角度36°（絶景）',
    keyPresetArpg: 'ARPG標準（右クリック/Q/E/C/R）',
    keyPresetPoe: 'PoE風（Q/E/R/T/1）',
    keyPresetMmo: 'MMO数字キー（1/2/3/4/5）',
    pressKey: '新しいキーを押してください…',
    bindSk0: 'スキル枠 1', bindSk1: 'スキル枠 2', bindSk2: 'スキル枠 3', bindSk3: 'スキル枠 4',
    bindFlask: '回復ポーション', bindRecall: '帰還の巻貝',
    resetSettings: '設定をリセット',
    aboutText: 'ランタン・ヴェイル Lantern Vale<br>ピクセル3Dアクション冒険MMORPG<br>オリジナルキャラクター＆システム。<br><br>設定・物理リュック・倉庫・見た目は自動保存されます。',
    skAttack: '通常', skFlask: '回復', skMount: '騎乗', skBag: '鞄', skPuzzle: 'パズル', skRecall: '帰還', skEmpty: '空き',
    kills: '討伐', online: 'オンライン',
    statusPoison: '🧪 毒', statusFreeze: '❄️ 凍結', statusChill: '🧊 減速', statusBurn: '🔥 炎上', statusShock: '⚡ 感電', statusOverload: '💢 過負荷',
  },
};

export function t(lang, key) {
  const dict = I18N[lang] || I18N['zh-TW'];
  return dict[key] ?? I18N['zh-TW'][key] ?? key;
}

export function applyDOMLanguage(lang) {
  if (typeof document === 'undefined') return;
  const set = (sel, key) => { const el = document.querySelector(sel); if (el) el.textContent = t(lang, key); };
  set('#title h1', 'title');
  set('#title .sub', 'subtitle');
  set('#btnStart', 'start');
  set('#btnSetTitle', 'settings');
  set('#btnMap', 'worldMap');
  set('#btnSet', 'settings');
  set('#settings .shead b', 'settingsTitle');
  set('#btnClose', 'close');
  set('#settings [data-tab="video"]', 'tabVideo');
  set('#settings [data-tab="audio"]', 'tabAudio');
  set('#settings [data-tab="keys"]', 'tabKeys');
  set('#settings [data-tab="about"]', 'tabAbout');
  set('#inv [data-invtab="bag"]', 'bag');
  set('#inv [data-invtab="gear"]', 'gear');
  set('#inv [data-invtab="stash"]', 'stash');
  set('#inv [data-invtab="cos"]', 'cosmetics');
  set('#btnShakeBag', 'shakeBag');
  set('#btnShakeStash', 'shakeBag');
  set('#btnInvClose', 'close');
  set('#sk-lmb .sname', 'skAttack');
  set('#sk-r .sname', 'skFlask');
  set('#sk-bag .sname', 'skBag');
  set('#sk-puzzle .sname', 'skPuzzle');
  set('#sk-recall .sname', 'skRecall');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(lang, el.dataset.i18n);
  });
}
