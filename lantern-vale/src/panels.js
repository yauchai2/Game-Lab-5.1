import { rememberGear } from './frontier.js';
import { drawExchange } from './guild.js';
import { buildLodge } from './lodge.js';
// 城鎮互動面板：任務布告欄 / 鐵匠鋪 / 出發地圖桌 / 公會大廳 / 二轉覺醒 / 野外委託
import { RARITY, SLOTS, itemLines, FORGE, forgeItem, CORRUPT_COST, corruptItem } from './loot.js';
import { MODS, MOD_MAX } from './meta.js';
import { CLASSES, ALL_GEMS, addGemToBag } from './puzzle.js';
import { SECOND_CLASSES, findSecondClass } from './world_alive.js';

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function buildPanels(g) {
  const root = $('panelM'), body = root.querySelector('.pbody'), title = root.querySelector('h3'), foot = root.querySelector('.pshards');
  let kind = null, sel = null;
  let M;
  const head = () => { foot.innerHTML = `✦ 星砂 <b>${M.p.shards}</b>　🪶 金羽毛 <b>${M.p.feathers}</b>　🐚 貝殼 <b>${M.p.shells}</b>`; };
  const row = (html, btn) => `<div class="prow"><div class="pl">${html}</div>${btn || ''}</div>`;

  function renderQuest() {
    title.textContent = '任務布告欄 · 今日委託';
    const claimable = M.p.quests.list.filter(q => !q.claimed && q.have >= q.need).length;
    let h = claimable >= 2 ? `<div style="text-align:right;margin-bottom:6px"><button class="btn small" data-claim-all>✦ 一鍵領取全部 (${claimable})</button></div>` : '';
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
    const ca = body.querySelector('[data-claim-all]'); if (ca) ca.onclick = () => { let tot = 0; M.p.quests.list.forEach((q, i) => { if (!q.claimed && q.have >= q.need) tot += M.claim(i) || 0; }); if (tot) { g.audio.sfx('perfect'); g.ui.toast(`全部委託領取完成！星砂 +${tot}`, '#ffe08a'); } render(); };
    const sw = body.querySelector('[data-swap]'); if (sw) sw.onclick = () => { if (M.p.shells >= 10) { M.p.shells -= 10; M.p.feathers++; M.save(); g.audio.sfx('exit'); g.ui.toast('換到一根金羽毛！', '#ffd23a'); } render(); };
  }

  function renderForge() {
    title.textContent = '鐵匠鋪 · 裝備鍛造與腐化';
    const eq = g.player?.equip || {};
    const avail = Object.keys(SLOTS).filter(k => eq[k]);
    if (!sel || !eq[sel]) sel = avail[0] || null;
    const it = sel ? eq[sel] : M.heirloom;
    if (!it) { body.innerHTML = `<div class="psmall" style="font-size:16px;line-height:1.8;text-align:center">身上尚無可鍛造的裝備，先點上方「素材鍛造與武器」打造一把吧！</div>`; return; }
    const R = RARITY[it.rarity];
    const tabs = avail.map(k => `<button type="button" class="btn small ${k === sel ? 'on' : ''}" data-fslot="${k}">${SLOTS[k].icon} ${SLOTS[k].name}</button>`).join('');
    let h = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tabs}</div>`;
    h += `<div class="pitem" style="border-color:${R.color}"><b style="color:${R.color};text-shadow:0 2px 0 #3b2a2a">${esc(it.name)}</b> <small>${SLOTS[it.slot].name} · T${it.tier}${it.reforged ? ` · 重鑄 ×${it.reforged}` : ''}</small><div>${itemLines(it).map(l => `<div style="color:${l.corrupt ? '#c82868' : l.imp ? '#6a5a8a' : l.special ? '#b8561f' : '#3b2a2a'}">${esc(l.t)}</div>`).join('')}</div></div>`;
    for (const [k, f] of Object.entries(FORGE)) {
      const ok = f.ok(it), c = f.cost(it), can = ok && M.p.shards >= c;
      h += row(`<div>${f.name}</div><small>${f.desc}</small>`, `<button class="btn small" data-forge="${k}" ${can ? '' : 'disabled'}>${ok ? `✦ ${c}` : '不可'}</button>`);
    }
    const canCorrupt = !it.corrupted && M.p.shards >= CORRUPT_COST;
    h += row(`<div><b style="color:#b8245c">☠️ 裝備腐化改造（不可逆賭博）</b></div><small>25% 誕生毀天滅地神諭詞綴 · 25% 全詞綴 ×1.45 超頻 · 25% 穩固 · 25% 碎裂報廢！</small>`,
      `<button class="btn small" style="background:#9b2458" data-corrupt ${canCorrupt ? '' : 'disabled'}>${it.corrupted ? '已腐化' : `✦ ${CORRUPT_COST}`}</button>`);
    body.innerHTML = h;
    body.querySelectorAll('[data-fslot]').forEach(b => b.onclick = () => { sel = b.dataset.fslot; g.audio.sfx('ui'); render(); });
    const saveGear = nextIt => {
      g.player.equip[nextIt.slot] = nextIt;
      if (M.heirloom && M.heirloom.slot === nextIt.slot) M.setHeirloom(nextIt);
      rememberGear(g); M.save(); g.recalc();
    };
    body.querySelectorAll('[data-forge]').forEach(b => b.onclick = () => {
      const k = b.dataset.forge, f = FORGE[k], cur = sel ? eq[sel] : M.heirloom; if (!cur || !f.ok(cur) || M.p.shards < f.cost(cur)) return;
      M.p.shards -= f.cost(cur); const n = forgeItem(k, cur); saveGear(n);
      g.audio.sfx('pickup'); g.ui.toast(`${f.name}完成`, RARITY[n.rarity].color); render();
    });
    const cb = body.querySelector('[data-corrupt]');
    if (cb) cb.onclick = () => {
      const cur = sel ? eq[sel] : M.heirloom; if (!cur || cur.corrupted || M.p.shards < CORRUPT_COST) return;
      M.p.shards -= CORRUPT_COST;
      const res = corruptItem(cur);
      if (!res.ok) return;
      saveGear(res.item);
      g.audio.sfx(res.outcome === 'brick' ? 'corruptBrick' : res.outcome === 'godroll' ? 'corruptGod' : 'classup');
      g.ui.toast(res.label, res.outcome === 'brick' ? '#ff6a6a' : '#ff8ad8');
      render();
    };
  }

  function renderMap() {
    g.ui.closePanel();
    g.ui.openInvTab?.(g, 'atlas');
  }

  function renderGuildHall() {
    title.textContent = '燈谷公會大廳 · 柏叔';
    const guildName = M.p.guildName || '';
    body.replaceChildren();
    const addRow = (h, btn) => { const d = document.createElement('div'); d.className = 'prow'; d.innerHTML = `<div class="pl">${h}</div>`; if (btn) d.append(btn); body.append(d); return d; };
    if (!guildName) {
      const inp = document.createElement('input'); inp.placeholder = '輸入公會名稱（如：星燈旅團）'; inp.maxLength = 12; inp.style.cssText = 'font:inherit;padding:4px 8px;background:#fff3d4;border:1px solid #927659;color:#3b2a2a';
      const joinBtn = document.createElement('button'); joinBtn.className = 'btn small'; joinBtn.textContent = '創立／加入公會';
      joinBtn.onclick = () => { M.p.guildName = (inp.value.trim() || '星燈旅團'); M.save(); g.audio.sfx('classup'); g.ui.toast(`已加入公會「${M.p.guildName}」！經驗 +10%`, '#ffd85a'); render(); };
      const r = addRow('<div><b>尚未加入公會</b></div><small>加入後常駐享有「公會增益：經驗 +10% · 採集產量 +1」，並可組隊挑戰共鳴樹庭副本。</small>');
      r.append(inp, joinBtn);
    } else {
      const leaveBtn = document.createElement('button'); leaveBtn.className = 'btn small'; leaveBtn.textContent = '退出公會';
      leaveBtn.onclick = () => { M.p.guildName = ''; M.save(); render(); };
      addRow(`<div><b>🏛 公會：${esc(guildName)}</b></div><small>公會增益生效中：擊殺經驗 +10% · 採集額外 +1</small>`, leaveBtn);
    }
    const raidBtn = document.createElement('button'); raidBtn.className = 'btn small'; raidBtn.textContent = g.wallet ? '進入共鳴樹庭' : '需連線伺服器'; raidBtn.disabled = !g.wallet;
    raidBtn.onclick = () => { g.ui.closePanel(); g.net.send({ t: 'raidJoin', code: g.party || M.p.guildName || '燈谷公會' }); };
    addRow('<div><b>公會組隊副本：共鳴樹庭</b></div><small>最多 4 人連線合作討伐共鳴守護獸，獲勝取得公會幣與共鳴琥珀。</small>', raidBtn);
    const exBtn = document.createElement('button'); exBtn.className = 'btn small'; exBtn.textContent = '公會交易所'; exBtn.disabled = !g.wallet;
    exBtn.onclick = () => g.ui.openPanel('exchange');
    addRow('<div><b>公會真人交易所</b></div><small>與連線旅人自由掛單交易共鳴琥珀（10% 交易稅）。</small>', exBtn);
    addRow('<div><b>一般地圖副本怎麼進？</b></div><small>在 6 個常駐普通地圖找到發光地標「副本入口」，帶著 1 顆鑰石（擊敗精英掉落或工坊製作）步入即可挑戰逐層副本！</small>');
  }

  function renderAscend() {
    const cls = CLASSES[g.character?.job ?? 0] || CLASSES[0];
    const cur2 = findSecondClass(M.p.secondClass);
    title.textContent = `星燈覺醒祭壇 · ${cls.icon} ${cls.name}二轉`;
    body.replaceChildren();
    const deeds = M.p.deeds || {};
    const info = document.createElement('div'); info.className = 'psmall';
    info.textContent = cur2 ? `目前二轉：${cur2.icon} ${cur2.name}（${cur2.desc}）` : `目前等級 Lv.${M.p.level} · 完美採集 ${deeds.perfectGather || 0} 次 · 穿過星環 ${deeds.skyRing || 0} 次 · 擊殺 ${M.p.kills || 0} 隻`;
    body.append(info);
    for (const sc of SECOND_CLASSES[cls.id] || []) {
      const unlocked = M.p.level >= 10 || (deeds.perfectGather || 0) >= 1 || (deeds.skyRing || 0) >= 1 || (M.p.kills || 0) >= 5;
      const isCur = M.p.secondClass === sc.id;
      const d = document.createElement('div'); d.className = 'prow';
      d.innerHTML = `<div class="pl"><b>${sc.icon} ${sc.name}</b> <small>試煉：${sc.trial}</small><br><small>${sc.desc}</small></div>`;
      const b = document.createElement('button'); b.className = 'btn small' + (isCur ? ' on' : '');
      b.textContent = isCur ? '已覺醒' : unlocked ? '覺醒二轉' : '試煉覺醒';
      b.disabled = isCur;
      b.onclick = () => {
        M.p.secondClass = sc.id;
        addGemToBag(M.p, sc.gem);
        M.save(); g.recalc(); g.audio.sfx('classup');
        g.ui.toast(`✨ 二轉覺醒：${sc.icon} ${sc.name}！獲贈寶石「${ALL_GEMS[sc.gem].name}」`, '#ffd85a');
        render();
      };
      d.append(b); body.append(d);
    }
  }

  function renderFieldQuest() {
    const fq = g._activeFieldNpc;
    if (!fq) { g.ui.closePanel(); return; }
    const q = fq.quest;
    title.textContent = `${fq.name} · ${q.title}`;
    body.replaceChildren();
    M.p.fieldQuests = M.p.fieldQuests || {};
    const st = M.p.fieldQuests[q.id] || { have: 0, done: false };
    const p = document.createElement('div'); p.className = 'prow';
    p.innerHTML = `<div class="pl"><div>${esc(q.desc)}</div><div class="pbar"><i style="width:${Math.min(100, (st.have / q.need) * 100)}%"></i></div><small>進度 ${Math.min(q.need, st.have)}/${q.need} · 獎勵 🪙${q.rewardCoins} · 經驗 +${q.rewardXp} · 隨機拼圖寶石 ×1</small></div>`;
    const b = document.createElement('button'); b.className = 'btn small';
    if (st.done) { b.textContent = '已完成 ✔'; b.disabled = true; }
    else if (st.have >= q.need) {
      b.textContent = '領取獎勵';
      b.onclick = () => {
        st.done = true; M.p.fieldQuests[q.id] = st;
        M.p.coins += q.rewardCoins; M.p.xp += q.rewardXp;
        const pool = Object.keys(ALL_GEMS); const gemId = pool[Math.floor(Math.random() * pool.length)];
        addGemToBag(M.p, gemId);
        M.save(); g.audio.sfx('perfect');
        g.ui.toast(`野外委託完成！金幣 +${q.rewardCoins} · 寶石「${ALL_GEMS[gemId].name}」`, '#ffd85a');
        render();
      };
    } else { b.textContent = '進行中'; b.disabled = true; }
    p.append(b); body.append(p);
  }

  function render() { M = g.meta; head();
    if (kind === 'exchange') { drawExchange(g,body,title); return; }
    if (kind === 'guild') { renderGuildHall(); return; }
    if (kind === 'ascend') { renderAscend(); return; }
    if (kind === 'field_quest') { renderFieldQuest(); return; }
    if (['home','market','workshop'].includes(kind)) { buildLodge(g, body, title, kind); return; }
    ({ quest: renderQuest, forge: renderForge, map: renderMap })[kind]();
    if (kind === 'forge') {
      const b = document.createElement('button'); b.className = 'btn small'; b.textContent = '素材鍛造與武器';
      b.onclick = () => g.ui.openPanel('workshop'); body.prepend(b);
    }
  }
  g.ui.openPanel = k => { kind = k; g.ui.guildMarketOpen=k==='exchange'; g.ui.panelOpen = true; root.classList.remove('hide'); render(); };
  g.ui.drawGuildMarket=()=>drawExchange(g,body,title);
  g.ui.closePanel = () => { g.ui.guildMarketOpen=false; g.ui.panelOpen = false; root.classList.add('hide'); };
  $('btnPanelClose').onclick = () => g.ui.closePanel();
}
