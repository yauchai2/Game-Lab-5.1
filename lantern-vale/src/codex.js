// 燈谷行百科資料庫（PoE2 / 自走勇者風格）、更新日誌與贊助支持視窗
import { CLASSES, ACTIVE_GEMS, SUPPORT_GEMS } from './puzzle.js';
import { SECOND_CLASSES } from './world_alive.js';
import { FIELDS } from './frontier.js';
import { BOONS } from './loot.js';
import { BAG_RECIPES } from './physbag.js';

export const GAME_VERSION = 'v0.7.0';
export const DONATE_URL = 'https://ko-fi.com/'; // 可隨時改為個人贊助頁面或 ECPay 連結

export const CHANGELOG = [
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
  { icon: '🧪', name: '中毒（Poison）', cat: '異常狀態', desc: '血瓶液體轉為毒綠並冒出黏稠氣泡，每秒造成持續毒素傷害。飲用蘋果酒或蜂王蜜可立即淨化。' },
  { icon: '❄️', name: '冰凍與碎冰（Freeze & Shatter）', cat: '異常狀態', desc: '寒霜攻擊會造成緩速並機率觸發冰凍定身；攻擊處於冰凍的敵人將觸發 1.45 倍「碎冰爆發」！' },
  { icon: '🔥', name: '灼燒（Burn）', cat: '異常狀態', desc: '火焰技能與熔岩區域會點燃敵人造成持續火焰傷害。' },
  { icon: '⚡', name: '感電（Shock）', cat: '異常狀態', desc: '雷電屬性使目標承受額外 +25% 傷害（玩家感電則承受 +20% 傷害）。' },
  { icon: '💢', name: '魔力過載（Overload）', cat: '戰鬥連動', desc: '4 秒內連續施放 3 次技能觸發：HP／MP 液體劇烈沸騰並把軟木瓶塞頂得喀喀作響，技能傷害 +25%、冷卻 -20%！' },
  { icon: '🦅', name: '空中破翼與俯衝斬', cat: '移動空戰', desc: '連按兩下空白鍵跳躍、按住滑翔；在空中攻擊或踩踏空中怪物可觸發 1.5 倍暴擊、擊落眩暈並回復體力。' },
  { icon: '🎒', name: '物理背包碰撞合成', cat: '生活系統', desc: '在背包內拖曳兩個相容物品互相撞擊（或大力拋撞）即可當場融合出進階補給品或升階裝備！' },
  { icon: '🎥', name: '微幅視角旋轉', cat: '操作技巧', desc: '按住滑鼠中鍵左右拖曳，或按 Z／X 鍵可微調旋轉視角（±35°）；按 / 鍵或雙擊中鍵立即回正。' },
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
        CLASSES.forEach(c => cards.push({ icon: c.icon, name: c.name, sub: '一轉基礎職業', desc: c.summary, color: '#d4a44a' }));
        Object.entries(SECOND_CLASSES).forEach(([, list]) => {
          list.forEach(sc => cards.push({ icon: sc.icon, name: sc.name, sub: '二轉覺醒職業', desc: sc.desc, color: '#9c7ae8' }));
        });
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
      titleEl.textContent = '❤️ 贊助與支持燈谷行';
      const sup = !!game.meta.p.supporterHeart;
      bodyEl.innerHTML = `
        <div class="cx-donate">
          <div style="font-size:48px;margin-bottom:6px">❤️🏮✨</div>
          <h3>感謝你喜歡《燈谷行 Lantern Vale》！</h3>
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
