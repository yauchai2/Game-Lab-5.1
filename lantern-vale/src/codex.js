// Beaconfall 百科資料庫（PoE2 / 自走勇者風格）、更新日誌與贊助支持視窗
import { classWickByJob, stanceById } from './wick.js';
import { CLASSES, ACTIVE_GEMS, SUPPORT_GEMS } from './puzzle.js';
import { SECOND_CLASSES } from './world_alive.js';
import { FIELDS } from './frontier.js';
import { BOONS, TIERS } from './loot.js';
import { BAG_RECIPES } from './physbag.js';
import { MOUNTS } from './mounts.js';

export const GAME_VERSION = 'v0.12.1-alpha';
export const DONATE_URL = 'https://ko-fi.com/'; // 可隨時改為個人贊助頁面或 ECPay 連結

export const CHANGELOG = [
  {
    ver: 'v0.12.1-alpha', date: '2026-11-23',
    items: [
      { tag: '修正', text: '大幅提亮 Stylized Nature MegaKit 3D 樹木、松樹、灌木與岩石的日光色彩與環境補光（徹底消除過暗剪影），並微調樹冠高度比例。' },
      { tag: '修正', text: '排除燈谷鎮中央石磚廣場與南側小水池內的雜草與野花穿插；修正紅楓工坊谷棋盤廣場避開樹木重疊，並補上內嵌圖示消除 404。' },
    ],
  },
  {
    ver: 'v0.12.0-alpha', date: '2026-11-23',
    items: [
      { tag: '重要', text: '正式導入 Stylized Nature MegaKit 雕刻級 3D glTF 自然資產（常綠樹、松樹、開花灌木、雙款雕刻岩石、蕨類、野花叢、森林菇群），並建立專屬像素賽璐璐（Pixel-Toon）256px 貼圖與風吹著色器轉換管線！' },
      { tag: '新增', text: '支援 GPU Instancing 批次繪製與 12 大生態群系動態調色（雪原冷霜、秋楓暖橘、櫻都淡粉、草原翠綠），並保留本機離線開啟（file://）自動程序化回退機制。' },
    ],
  },
  {
    ver: 'v0.11.0-alpha', date: '2026-11-23',
    items: [
      { tag: '重要', text: '「萬象新域」大型地圖擴展！新增 3 張常駐超大地圖（總計 12 大野外區域）：🌸 櫻花水都（對稱運河、雙翼雕像與漫天櫻瓣）、🌀 蒼穹巨環谷（三重巨型碧藍天環與山坡圓頂屋）、🍁 紅楓工坊谷（棋盤石磚熔爐工坊、白樺秋楓林與放養小綿羊）！' },
      { tag: '新增', text: '新增全新 3D 魔物「星晶巨像（Crystal Golem）」與專屬震波 AI；補齊 7–12 號區域共 6 位全新野外 NPC 與支線任務（12 張地圖全覆蓋）！' },
      { tag: '新增', text: '技能拼圖大幅擴充：新增 3 顆創意主動技能寶石（🌸 櫻吹雪、⚡ 雷霆落雷、🗿 星晶震盪）與 2 顆進階輔助寶石（🩸 血月汲取、🌩 雷鳴連鎖）；新增第 4 隻里程碑坐騎「🦊 櫻風神狐」！' },
      { tag: '新增', text: '升級海港渡船為 A Short Hike 風格紅白拖船（附駕駛艙、黃煙囪與救生圈），於沉沒電光都新增太陽能屋頂水上小屋，海風港鎮補齊全部 6 座出海路牌。' },
    ],
  },
  {
    ver: 'v0.10.0-alpha', date: '2026-11-23',
    items: [
      { tag: '重要', text: '全面地形與手繪像素著色器翻新：地形網格解析度提升 2.25 倍（181×181）徹底告別大地圖鋸齒三角，新增像素草葉微點、泥土碎石柔邊道路、冷青藍雲影對比與水面水平白色水光短線！' },
      { tag: '新增', text: '3D 植被與地標大升級：新增「白樺秋楓樹」、多色層團簇像素樹冠、聚落式森林群組與「雙巨柱石階清泉遺跡」；燈谷鎮加入白樺楓樹、木柵欄、翻新試衣亭與可按 F 撫摸的「蓬鬆小綿羊（軟綿祝福）」及晴日蝴蝶！' },
      { tag: '新增', text: '野外新增三種「遠古祝福石碑」（🔥 狂暴火碑、❄️ 寒霜冰碑、💰 財富金碑），並強化戰鬥爽感：智慧柔順瞄準輔助、❄️ 碎冰爆發浮動連攜字樣、精英／頭目擊殺鏡頭微縮震動！' },
      { tag: '修正', text: '修正底部快捷列按鈕換行問題（統一為精簡 2 字標籤「坐騎／回城／背包／拼圖」）、修正滑鼠懸停資料浮標顯示，並調整燈谷鎮試衣亭座標徹底消除與布告欄重疊。' },
    ],
  },
  {
    ver: 'v0.9.0-alpha', date: '2026-11-23',
    items: [
      { tag: '重要', text: '鎖定最佳立體斜角鏡頭（camYaw = 0.62，無需手動旋轉），並全面收合簡化 HUD：右上整合為「🗺️ 地圖＋☰ 選單」抽屜，隱藏離線雜訊文字，底部動作欄更輕巧俐落。' },
      { tag: '新增', text: '全面美術氛圍升級：提亮陽光手繪色盤、地形加入緩慢飄動的立體雲影光斑、海岸水域漂浮橘白航標與救生圈、飛瀑岩池木橋與林間石圈營火。' },
      { tag: '新增', text: '新增「清怪連擊系統（Kill-Streak Combo）」：連續清怪疊加攻速（最高 +30%）、暴擊（最高 +22.5%）與掉寶率；滑翔與高速騎乘新增 A Short Hike 風格白色翼尖氣流尾跡！' },
    ],
  },
  {
    ver: 'v0.8.0', date: '2026-11-22',
    items: [
      { tag: '重要', text: '新增「3D 坐騎與里程碑解鎖系統」（林間巨鹿、雲絨角獸、星翼浮鰩，按 G 鍵隨時召喚／收起）與「T1–T6 裝備與物品分級」。' },
      { tag: '重要', text: '大型建築、巨樹、拱門與瞭望塔遮擋人物視野時，透過鏡頭射線自動半透明透視，徹底解決視線遮擋！' },
      { tag: '新增', text: '全面美化野外場景層次：植被與花草依地圖面積大幅加密，新增巨樹、巨石苔岩、遺跡八角噴泉斷柱聖壇、木造瞭望塔與海岸遮陽傘野餐區。' },
      { tag: '新增', text: '野外怪物聚落提升至 9–13 群（55–95 隻），清怪爽感大幅升級；強化雙層揮擊弧光、施法符文陣與連鎖光束特效。' },
      { tag: '修正', text: '物理背包頂部即時顯示「已穿戴裝備欄」，點選背包或裝備皆完整呈現 T1–T6 分級、詞綴詳情與戰力比較；世界地圖加入跳動「📍 你在這裡」玩家定位標記。' },
    ],
  },
  {
    ver: 'v0.7.0', date: '2026-11-22',
    items: [
      { tag: '重要', text: '新增「燈谷百科資料庫」、「更新日誌」與「贊助支持」系統，支援關鍵字搜尋與職業篩選。' },
      { tag: '新增', text: '孤山獨影風格「背包物理碰撞合成」：在物理背包中將相容物品拖曳撞擊即可當場合成進階補給或升階裝備！' },
      { tag: '新增', text: '新增持續性場上技能區域（星羽箭雨、毒孢子雲、熔岩火坑、極光霜陣）與可坐下長椅／許願噴泉／水井／可踢飛物理木桶球互動。' },
      { tag: '調整', text: '鏡頭改為穩定跟隨主角並支援「微幅左右旋轉視角」（中鍵拖曳或 Z／X 鍵，/ 鍵回正），不再跟隨滑鼠平移。' },
      { tag: '修正', text: '修復傳送門雙向對應與 1.5 秒冷卻防誤觸，抵達下張地圖時身旁即為返回上張地圖的傳送門；補齊燈谷公會大廳、覺醒祭壇與造型衣櫃 3D 實體模型。' },
    ],
  },
  {
    ver: 'v0.6.0', date: '2026-11-22',
    items: [
      { tag: '重要', text: '實作 2D 流體物理 HP／MP 玻璃試管：衝刺急停或受擊會晃動濺水花，中毒冒毒泡、冰凍結霜、魔力過載劇烈沸騰頂起瓶塞！' },
      { tag: '新增', text: '完整異常狀態系統（中毒、冰凍與 1.45× 碎冰爆發、灼燒、感電、魔力過載）與 7 種創意 3D NPC 外觀。' },
      { tag: '調整', text: '全部 9 大野外地圖再擴展 2 倍（240–400）、所有怪物皆可爬坡上下高台、聚落式魔物營地密度、南岸 3D 木造碼頭棧橋與城鎮限定倉庫。' },
      { tag: '修正', text: '完整修復繁中／English／日本語即時多語言切換。' },
    ],
  },
  {
    ver: 'v0.5.0', date: '2026-11-21',
    items: [
      { tag: '新增', text: '新增空中怪物「雲翼飛鰩」與滑翔俯衝斬擊／踏跳空戰機制；常駐野外地圖重入保留進度不重置。' },
      { tag: '調整', text: '超慢漸進 20 分鐘晝夜循環（白晝佔 70%），修正雪原與沙灘過曝問題，預設斜 45° PoE 2 視角並支援滾輪縮放。' },
    ],
  },
  {
    ver: 'v0.4.0', date: '2026-11-20',
    items: [
      { tag: '新增', text: '新增第二城鎮「海風港鎮」、3D 乘船航行系統、孤山獨影風格物理背包與 3D 外觀造型系統、自訂按鍵與歸途海螺回城。' },
    ],
  },
];

const MECHANICS = [
  { icon: '🔌', name: '技能即積木（邏輯電路）', cat: '構築系統', desc: '在技能拼圖 (K) 中相鄰擺放主動與輔助寶石（分裂稜鏡、環繞軌道、命中觸發 CoH、暴擊觸發 CoC）即可組成連鎖邏輯電路，或點擊「⚡ 一鍵推薦構築」自動排盤！' },
  { icon: '☠️', name: '裝備不可逆腐化賭博', cat: '裝備系統', desc: '在鐵匠鋪或背包 (I) 消耗 ✦15 星砂進行不可逆改造：25% 誕生隱藏神諭詞綴、25% 全詞綴 ×1.45 超頻、25% 穩固封存、25% 碎裂報廢！' },
  { icon: '👻', name: '怪物靈魂吸收（青魔道士）', cat: '構築系統', desc: '擊敗 7 種生態魔物機率吸收靈魂卡，按 I → 怪物靈魂 鑲嵌至「移動模組」或「戰鬥模組」，直接改寫翻滾與攻擊行為！' },
  { icon: '🗺️', name: '終局副本設計台（印鈔機）', cat: '終局玩法', desc: '按 I → 副本設計台（或互動北門地圖桌）自訂怪物密度（最高 ×2.3）並自由疊加 5 種賽季機制（腐化裂隙、靈魂狩獵、雙重祭壇、鍍金寶庫、雙王試煉）。' },
  { icon: '✂️', name: '部位破壞與精準掉落', cat: '戰鬥策略', desc: '從特定方位專攻頭目與大型魔物（如鹿王鹿角／後肢、晶岩魔像光刃右臂／核心、野豬獠牙），斬斷後永久弱化其招式並必掉專屬傳奇裝備！' },
  { icon: '🌊', name: '環境元素連鎖反應', cat: '戰鬥策略', desc: '地形就是武器！下雨／積水＋冰凍→「極寒冰面（滑倒暈眩）」；水／冰＋火→「濃密蒸汽（敵人失明）」；蒸汽／水＋雷→「大範圍感電雷暴」；毒霧＋火→「劇毒爆燃」！' },
  { icon: '🧪', name: '中毒（Poison）', cat: '異常狀態', desc: '血瓶液體轉為毒綠並冒出黏稠氣泡，每秒造成持續毒素傷害。飲用蘋果酒或蜂王蜜可立即淨化。' },
  { icon: '❄️', name: '冰凍與碎冰（Freeze & Shatter）', cat: '異常狀態', desc: '寒霜攻擊會造成緩速並機率觸發冰凍定身；攻擊處於冰凍的敵人將觸發 1.45 倍「碎冰爆發」！' },
  { icon: '🔥', name: '灼燒（Burn）', cat: '異常狀態', desc: '火焰技能與熔岩區域會點燃敵人造成持續火焰傷害。' },
  { icon: '⚡', name: '感電（Shock）', cat: '異常狀態', desc: '雷電屬性使目標承受額外 +25% 傷害（玩家感電則承受 +20% 傷害）。' },
  { icon: '💢', name: '魔力過載（Overload）', cat: '戰鬥連動', desc: '4 秒內連續施放 3 次技能觸發：HP／MP 液體劇烈沸騰並把軟木瓶塞頂得喀喀作響，技能傷害 +25%、冷卻 -20%！' },
  { icon: '🦅', name: '空中破翼與俯衝斬', cat: '移動空戰', desc: '連按兩下空白鍵跳躍、按住滑翔；在空中攻擊或踩踏空中怪物可觸發 1.5 倍暴擊、擊落眩暈並回復體力。' },
  { icon: '🎒', name: '物理背包碰撞合成與一鍵換裝', cat: '生活系統', desc: '在背包內拖曳兩個相容物品互相撞擊即可融合成進階補給或升階裝備；亦可點擊「⚡ 一鍵裝備最強」自動換上更高戰力裝備！' },
  { icon: '🗿', name: '遠古祝福石碑（Shrines）', cat: '野外探索', desc: '野外地圖散落三種遠古石碑（狂暴火碑、寒霜冰碑、財富金碑），按 F 啟動可獲得 25 秒強力戰鬥與掉寶祝福！' },
  { icon: '🐑', name: '蓬鬆小綿羊（軟綿祝福）', cat: '城鎮生態', desc: '燈谷鎮草地上有自由漫步的蓬鬆小綿羊，靠近按 F 撫摸即可獲得 60 秒「軟綿祝福」（移速 +10% 與持續回復）！' },
  { icon: '🎥', name: '鎖定黃金立體斜角鏡頭', cat: '操作技巧', desc: '鏡頭固定於最具立體景深的黃金斜角（支援滑鼠滾輪拉近／拉遠），大型建築與巨樹遮擋人物時自動半透明透視。' },
];

export function bindCodexUI(game) {
  const modal = document.getElementById('codexModal');
  if (!modal) return;
  const titleEl = modal.querySelector('.cx-title');
  const tabsEl = modal.querySelector('.cx-tabs');
  const filterEl = modal.querySelector('.cx-filter');
  const bodyEl = modal.querySelector('.cx-body');
  const searchEl = modal.querySelector('#cxSearch');

  let mode = 'wiki'; // 'wiki' | 'changelog' | 'donate'
  let wikiTab = 'gems';
  let logFilter = '全部';

  const open = (nextMode = 'wiki') => {
    mode = nextMode;
    game.ui.codexOpen = true;
    modal.classList.remove('hide');
    game.audio.sfx('ui');
    render();
  };
  const close = () => {
    game.ui.codexOpen = false;
    modal.classList.add('hide');
  };
  modal.querySelector('#btnCodexClose').onclick = close;
  game.ui.openCodex = open;
  game.ui.closeCodex = close;

  const wireBtn = (id, m) => { const el = document.getElementById(id); if (el) el.onclick = () => { open(m); el.blur(); }; };
  wireBtn('btnWiki', 'wiki');
  wireBtn('btnChangelog', 'changelog');
  wireBtn('btnDonate', 'donate');

  if (searchEl) searchEl.oninput = () => render();

  const render = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    tabsEl.innerHTML = '';
    filterEl.innerHTML = '';
    bodyEl.innerHTML = '';
    if (searchEl) searchEl.style.display = mode === 'wiki' ? '' : 'none';

    if (mode === 'wiki') {
      titleEl.textContent = `📖 燈谷百科資料庫 · ${GAME_VERSION}`;
      const tabs = [
        ['gems', '💎 技能寶石'],
        ['classes', '🛡️ 職業與二轉'],
        ['mounts', '🦌 坐騎與分級'],
        ['recipes', '⚗️ 背包碰撞合成'],
        ['mech', '⚙️ 異常與機制'],
        ['zones', '🗺️ 區域與生態'],
        ['boons', '✨ 副本祝福'],
      ];
      tabs.forEach(([id, label]) => {
        const b = document.createElement('button');
        b.className = 'cx-tab' + (wikiTab === id ? ' on' : '');
        b.textContent = label;
        b.onclick = () => { wikiTab = id; game.audio.sfx('ui'); render(); };
        tabsEl.appendChild(b);
      });

      const cards = [];
      if (wikiTab === 'gems') {
        Object.values(ACTIVE_GEMS).forEach(g => cards.push({
          icon: g.icon, name: g.name, sub: `主動技能 · 冷卻 ${g.cd}s · 法力 ${g.mana || 0}`,
          desc: g.desc + (['rain', 'trap', 'meteor', 'nova'].includes(g.id) ? '（場上持續效果區域）' : ''), color: g.color,
        }));
        Object.values(SUPPORT_GEMS).forEach(g => cards.push({
          icon: g.icon, name: g.name, sub: '輔助拼圖寶石（相鄰主動即連動）',
          desc: g.desc, color: g.color,
        }));
      } else if (wikiTab === 'classes') {
        CLASSES.forEach(c => { const w = classWickByJob(c.id); cards.push({ icon: c.icon, name: c.name, sub: '一轉基礎職業', desc: c.summary + (w ? `　🕯️ 燈芯「${w.name}」：${w.desc}` : ''), color: '#d4a44a' }); });
        Object.entries(SECOND_CLASSES).forEach(([, list]) => {
          list.forEach(sc => { const st = stanceById(sc.id); cards.push({ icon: sc.icon, name: sc.name, sub: '二轉覺醒職業', desc: sc.desc + (st ? `　${st.vow} 🕯️ ${st.gain} 🌑 ${st.price}` : ''), color: '#9c7ae8' }); });
        });
      } else if (wikiTab === 'mounts') {
        MOUNTS.forEach(m => cards.push({ icon: m.icon, name: `[T${m.tier}] ${m.name}`, sub: `解鎖里程碑：${m.milestone}`, desc: m.perk + '（遊戲中按 G 鍵召喚／收起）', color: '#ffd85a' }));
        TIERS.slice(1).forEach(ti => cards.push({ icon: '🏷️', name: `${ti.tag} · ${ti.name}`, sub: `裝備與補給分級倍率 ×${ti.mult}`, desc: '裝備掉落、鍛造升階與物理背包合成皆具備階級標示（T1–T12 成長階，E1–E4 終局星燈階）。', color: ti.color }));
      } else if (wikiTab === 'recipes') {
        BAG_RECIPES.forEach(r => cards.push({
          icon: r.out.icon, name: r.out.name, sub: `碰撞合成：${r.label}`,
          desc: r.out.desc, color: r.out.color || '#ffd85a',
        }));
        cards.push({
          icon: '⚒️', name: '同稀有度裝備升階鍛造', sub: '碰撞合成：任意兩件同稀有度裝備（白／藍／金）',
          desc: '在物理背包中將兩件相同稀有度的裝備互相拖曳撞擊，即可融合成高一階稀有度的新裝備！', color: '#ff9a50',
        });
      } else if (wikiTab === 'mech') {
        MECHANICS.forEach(m => cards.push({ icon: m.icon, name: m.name, sub: m.cat, desc: m.desc, color: '#6cb8ff' }));
      } else if (wikiTab === 'zones') {
        FIELDS.slice(1).forEach((f, idx) => cards.push({
          icon: '🗺️', name: `${idx + 1}. ${f.name}`, sub: `Lv.${f.level}+ · 尺寸 ${f.size}×${f.size} · 副本：${f.dungeon}`,
          desc: `主要魔物：${f.beast} · 生態異常屬性：${f.status || '一般'}（含高密度魔物聚落與傳奇守護獸）`, color: '#62b85a',
        }));
      } else if (wikiTab === 'boons') {
        BOONS.forEach(b => cards.push({ icon: b.icon, name: b.name, sub: '副本天賦祝福', desc: b.desc, color: '#c08cff' }));
      }

      const filtered = q ? cards.filter(c => (c.name + c.sub + c.desc).toLowerCase().includes(q)) : cards;
      bodyEl.innerHTML = `<div class="cx-grid">${filtered.map(c =>
        `<div class="cx-card" style="border-left:5px solid ${c.color || '#a8744a'}">
          <div class="cx-ch"><span class="cx-ic">${c.icon}</span><div><b>${c.name}</b><div class="cx-sub">${c.sub}</div></div></div>
          <div class="cx-desc">${c.desc}</div>
        </div>`
      ).join('') || '<div class="cx-empty">找不到符合的條目</div>'}</div>`;
    } else if (mode === 'changelog') {
      titleEl.textContent = `📜 更新日誌 · ${GAME_VERSION}`;
      ['全部', '重要', '新增', '調整', '修正'].forEach(tag => {
        const b = document.createElement('button');
        b.className = 'cx-tab' + (logFilter === tag ? ' on' : '');
        b.textContent = tag;
        b.onclick = () => { logFilter = tag; game.audio.sfx('ui'); render(); };
        tabsEl.appendChild(b);
      });
      const tagCol = { 重要: '#d94862', 新增: '#3a9e52', 調整: '#c97a2b', 修正: '#4a7ec8' };
      const html = CHANGELOG.map(entry => {
        const list = logFilter === '全部' ? entry.items : entry.items.filter(it => it.tag === logFilter);
        if (!list.length) return '';
        return `<div class="cx-log-card">
          <div class="cx-log-head"><b>${entry.ver}</b><span>${entry.date}</span></div>
          ${list.map(it => `<div class="cx-log-row"><span class="cx-badge" style="background:${tagCol[it.tag] || '#666'}">${it.tag}</span><span>${it.text}</span></div>`).join('')}
        </div>`;
      }).join('');
      bodyEl.innerHTML = html || '<div class="cx-empty">此分類暫無更新紀錄</div>';
    } else if (mode === 'donate') {
      titleEl.textContent = '❤️ 贊助與支持 Beaconfall';
      const sup = !!game.meta.p.supporterHeart;
      bodyEl.innerHTML = `
        <div class="cx-donate">
          <div style="font-size:48px;margin-bottom:6px">❤️🏮✨</div>
          <h3>感謝你喜歡《Beaconfall》！</h3>
          <p>這是一款 100% 原創、無廣告、可在瀏覽器直接遊玩的獨立 3D 像素奇幻 MMORPG。你的每一份鼓勵都會用來開發更多新地圖、二轉技能與線上多人內容。</p>
          <div class="cx-donate-btns">
            <a class="btn" href="${DONATE_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block">☕ 前往贊助頁面</a>
            <button type="button" class="btn" id="btnSupHeart" style="background:${sup ? '#d94862' : 'var(--teal)'}">${sup ? '💖 已配戴支持者愛心徽章' : '💝 領取免費支持者愛心徽章'}</button>
          </div>
          <small style="opacity:.75;display:block;margin-top:12px">贊助連結可於 src/codex.js 的 DONATE_URL 自由更換為 ECPay／Ko-fi／BuyMeACoffee。</small>
        </div>`;
      const btn = bodyEl.querySelector('#btnSupHeart');
      if (btn) btn.onclick = () => {
        game.meta.p.supporterHeart = !game.meta.p.supporterHeart;
        game.meta.save();
        game.audio.sfx('perfect');
        game.ui.toast(game.meta.p.supporterHeart ? '💖 已啟用支持者愛心稱號！' : '已隱藏支持者愛心稱號', '#ff8aa8');
        render();
      };
    }
  };
}
