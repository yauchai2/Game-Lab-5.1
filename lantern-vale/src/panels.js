// 城鎮互動面板：任務布告欄 / 鐵匠鋪 / 出發地圖桌（A Short Hike 風格的奶油色清單）
import { RARITY, SLOTS, itemLines, FORGE, forgeItem } from './loot.js';
import { MODS, MOD_MAX } from './meta.js';

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function buildPanels(g) {
  const root = $('panelM'), body = root.querySelector('.pbody'), title = root.querySelector('h3'), foot = root.querySelector('.pshards');
  let kind = null, sel = null;
  const M = g.meta;
  const head = () => { foot.innerHTML = `✦ 星砂 <b>${M.p.shards}</b>　🪶 金羽毛 <b>${M.p.feathers}</b>　🐚 貝殼 <b>${M.p.shells}</b>`; };
  const row = (html, btn) => `<div class="prow"><div class="pl">${html}</div>${btn || ''}</div>`;

  function renderQuest() {
    title.textContent = '任務布告欄 · 今日委託';
    let h = '';
    M.p.quests.list.forEach((q, i) => {
      const done = q.have >= q.need, r = M.questReward(q);
      h += row(`<div>${esc(M.questText(q))}</div><div class="pbar"><i style="width:${Math.min(100, q.have / q.need * 100)}%"></i></div><small>${q.have}/${q.need} · 獎勵 ✦${r}</small>`,
        q.claimed ? `<span class="pdone">已領取 ✔</span>` : `<button class="btn small" data-claim="${i}" ${done ? '' : 'disabled'}>領取</button>`);
    });
    h += `<div class="phr"></div>` + row(`<div>貝殼商人的交換</div><small>10 枚貝殼 → 1 根金羽毛（永久讓攀爬、滑翔更省力 −8% 體力消耗，可疊加）</small>`,
      `<button class="btn small" data-swap ${M.p.shells >= 10 ? '' : 'disabled'}>交換</button>`);
    h += `<div class="psmall">已累積：擊敗 ${M.p.kills} 隻 · 出發 ${M.p.runs} 次 · 最深 ${M.p.best.depth} 層 · 通關 ${M.p.best.wins} 次</div>`;
    body.innerHTML = h;
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => { const r = M.claim(+b.dataset.claim); if (r) { g.audio.sfx('exit'); g.ui.toast(`委託完成！星砂 +${r}`, '#ffe08a'); } render(); });
    const sw = body.querySelector('[data-swap]'); if (sw) sw.onclick = () => { if (M.p.shells >= 10) { M.p.shells -= 10; M.p.feathers++; M.save(); g.audio.sfx('exit'); g.ui.toast('換到一根金羽毛！', '#ffd23a'); } render(); };
  }

  function renderForge() {
    title.textContent = '鐵匠鋪 · 傳家寶工坊';
    const it = M.heirloom;
    if (!it) { body.innerHTML = `<div class="psmall" style="font-size:17px;line-height:1.8;text-align:center">鐵匠：「你還沒有傳家寶呢。<br>闖關結束（陣亡或通關）時，從身上裝備挑一件留下來，<br>它會陪你出發下一趟，也能拿來這裡重鑄。」</div>`; return; }
    const R = RARITY[it.rarity];
    let h = `<div class="pitem" style="border-color:${R.color}"><b style="color:${R.color};text-shadow:0 2px 0 #3b2a2a">${esc(it.name)}</b> <small>${SLOTS[it.slot].name} · T${it.tier}${it.reforged ? ` · 重鑄 ×${it.reforged}` : ''}</small><div>${itemLines(it).map(l => `<div style="color:${l.imp ? '#6a5a8a' : l.special ? '#b8561f' : '#3b2a2a'}">${esc(l.t)}</div>`).join('')}</div></div>`;
    for (const [k, f] of Object.entries(FORGE)) {
      const ok = f.ok(it), c = f.cost(it), can = ok && M.p.shards >= c;
      h += row(`<div>${f.name}</div><small>${f.desc}</small>`, `<button class="btn small" data-forge="${k}" ${can ? '' : 'disabled'}>${ok ? `✦ ${c}` : '不可'}</button>`);
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-forge]').forEach(b => b.onclick = () => {
      const k = b.dataset.forge, f = FORGE[k], cur = M.heirloom; if (!cur || !f.ok(cur) || M.p.shards < f.cost(cur)) return;
      M.p.shards -= f.cost(cur); const n = forgeItem(k, cur); M.setHeirloom(n);
      g.player.equip[n.slot] = M.heirloom; g.recalc(); g.audio.sfx('pickup'); g.ui.toast(`${f.name}完成`, RARITY[n.rarity].color); render();
    });
  }

  function renderMap() {
    title.textContent = '出發地圖桌 · 挑戰詞綴';
    let h = `<div class="psmall" style="text-align:left">最多選 ${MOD_MAX} 個詞綴：敵人更強，但星砂收益更高。（目前收益 ×${M.shardMult.toFixed(2)}）</div>`;
    for (const m of MODS) {
      const on = M.has(m.id);
      h += row(`<div><b>${m.name}</b> <small>收益 +${Math.round(m.reward * 100)}%</small></div><small>${m.desc}</small>`, `<button class="btn small ${on ? 'on' : ''}" data-mod="${m.id}">${on ? '✔ 已啟用' : '啟用'}</button>`);
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { if (!M.toggleMod(b.dataset.mod)) g.ui.toast(`最多同時啟用 ${MOD_MAX} 個詞綴`, '#ff9a8a'); else g.audio.sfx('ui'); render(); });
  }

  function render() { head(); ({ quest: renderQuest, forge: renderForge, map: renderMap })[kind](); }
  g.ui.openPanel = k => { kind = k; g.ui.panelOpen = true; root.classList.remove('hide'); render(); };
  g.ui.closePanel = () => { g.ui.panelOpen = false; root.classList.add('hide'); };
  $('btnPanelClose').onclick = () => g.ui.closePanel();
}
