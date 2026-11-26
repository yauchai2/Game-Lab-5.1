import { rememberGear, grantExperience } from './frontier.js';
import { drawExchange } from './guild.js';
import { buildLodge } from './lodge.js';
// 城鎮互動面板：任務布告欄 / 鐵匠鋪 / 出發地圖桌 / 公會大廳 / 二轉覺醒 / 野外委託
import { RARITY, SLOTS, itemLines, FORGE, forgeItem, CORRUPT_COST, corruptItem } from './loot.js';
import { canCorruptGear, CORRUPT_UNLOCK_LV } from './progression.js';
import { isFeatureEnabled } from './mmo_protocol.js';
import { MODS, MOD_MAX } from './meta.js';
import { CLASSES, ALL_GEMS, addGemToBag, applySupportFit, suggestSupportFit } from './puzzle.js';
import { SECOND_CLASSES, findSecondClass, checkAscendEligibility, performAscend } from './world_alive.js';
import { SANCTUARY_TALENTS, ensureTalents, talentCost, buyTalent, respecTalents, getBloodEclipseField } from './survivor.js';
import { enhanceInfo, enhanceItem, computeEnhanceResonance, AI_COMPANIONS, getCompanionBondInfo, spawnCompanion3D, recordStoryEvent, GUILD_BOUNTIES, claimGuildBounty, getGuildRepInfo, ADVENTURER_RANKS, computeAdventurerRank, claimRankReward } from './mmo_rpg.js';
import { RUNE_DEFS, RUNE_IDS, ensureRunes, socketRune, DAILY_CHESTS, ensureDailyActivity, claimDailyChest, spawnWorldBoss } from './mmo_world.js';
import { POTENTIAL_TIERS, POTENTIAL_SHARD_COST, rollPotential, formatPotentialLines, MAX_TOWER_FLOOR, towerFloorSpec, computeTowerBonuses, getPartyIds, togglePartyMember, getActivePartySynergy } from './mmo_endgame.js';
import { FIELDS } from './frontier.js';
import { MONSTER_MATS } from './mmo_rpg.js';
import { MEADOW_CAVE, meadowCaveProgress } from './meadow_cave.js';
import { MEADOW_TIERS, availableExpeditions, expeditionRoute, meadowExpedition, meadowStage, startMeadowExpedition, claimMeadowReward, syncMeadowExpedition } from './expedition.js';

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function buildPanels(g) {
  const root = $('panelM'), body = root.querySelector('.pbody'), title = root.querySelector('h3'), foot = root.querySelector('.pshards');
  let kind = null, sel = null;
  let M;
  const head = () => { foot.innerHTML = `✦ 星砂 <b>${M.p.shards}</b>　🪶 金羽毛 <b>${M.p.feathers}</b>　🐚 貝殼 <b>${M.p.shells}</b>`; };
  const row = (html, btn) => `<div class="prow"><div class="pl">${html}</div>${btn || ''}</div>`;

  function renderShards() {
    title.textContent = '區域分流';
    const net = g.net;
    if (!net.ok || !net.zoneShards || g.raid) {
      body.textContent = g.raid ? '離開組隊副本後即可切換分流。' : '連線至支援分流的多人伺服器後即可切線。';
      return;
    }
    const listing = net.shardListing;
    if (!listing || listing.zone !== net.shard?.zone) {
      body.textContent = '正在讀取目前區域的分流…';
      return;
    }
    const message = {
      full: '該線已滿或已關閉。請選擇其他分流。',
      cooldown: '剛切換過分流，請稍後再試。',
      unavailable: '區域已變更，請重新選擇分流。',
    }[listing.error];
    body.innerHTML = `<p>同區玩家會分配到不同線。隊友進入同一區時會優先分到同一線。</p>
      ${message ? `<p role="status">${message}</p>` : ''}
      <button type="button" class="btn small" data-shard-refresh>更新人數</button>`
      + listing.lines.map(line => row(
        `<b>${line.number} 線</b><small>　${line.count} / ${line.capacity} 人</small>`,
        line.id === listing.current ? '<span class="pdone">目前所在</span>'
          : `<button type="button" class="btn small" data-shard-number="${line.number}" aria-label="切換至 ${line.number} 線" ${line.count >= line.capacity ? 'disabled' : ''}>${line.count >= line.capacity ? '已滿' : '切換'}</button>`,
      )).join('');
    body.querySelector('[data-shard-refresh]').onclick = () => net.send({ t: 'shard_list' });
    for (const button of body.querySelectorAll('[data-shard-number]')) button.onclick = () => {
      const line = listing.lines.find(s => s.number === Number(button.dataset.shardNumber));
      if (!line) return;
      for (const action of body.querySelectorAll('[data-shard-number]')) action.disabled = true;
      button.textContent = '切換中…';
      net.send({ t: 'shard_switch', zone: listing.zone, id: line.id });
    };
  }

  function openRewardPuzzle() {
    g.ui.closePanel();
    g.ui.openPuzzle();
  }

  const materialText = (materials = {}) => Object.entries(materials)
    .map(([id, count]) => MONSTER_MATS[id].name + ' ×' + count).join('、');

  function renderExpeditionReward(result) {
    head();
    const fit = suggestSupportFit(M.p, result.gem.id);
    title.textContent = '遠征獎勵已領取';
    body.innerHTML = `<p><b>${result.gem.icon} ${result.gem.name}</b> · 鑰石 +${result.keys}</p>
      <p>${result.gem.desc}</p>`
      + (materialText(result.materials) ? `<p>${materialText(result.materials)} 已放入素材包，可帶到鎮上鐵匠鋪。</p>` : '')
      + (fit ? row(
        `<div>可連結 ${fit.skills.join('、')}</div><small>使用目前構築的空格</small>`,
        '<button type="button" class="btn small" data-exp-fit>裝上寶石</button>',
      ) : '<p>寶石已放進背包。可在拼圖選另一組構築或整理空格。</p>')
      + row('<div>挑戰下一段遠征，或用鑰石探索區域洞窟。</div>',
        '<button type="button" class="btn small" data-exp-next>查看遠征</button>')
      + '<button type="button" class="btn small" data-exp-puzzle>開啟技能拼圖</button>';
    body.querySelector('[data-exp-next]').onclick = renderExpedition;
    body.querySelector('[data-exp-puzzle]').onclick = openRewardPuzzle;
    const fitButton = body.querySelector('[data-exp-fit]');
    if (fitButton) fitButton.onclick = () => {
      const applied = applySupportFit(M.p, result.gemUid);
      if (!applied) { renderExpeditionReward(result); return; }
      M.save();
      g.recalc();
      g.audio.sfx('pickup');
      fitButton.closest('.prow').querySelector('.pl').textContent = '已連結 ' + applied.skills.join('、');
      fitButton.remove();
    };
  }

  function renderMeadowCave() {
    const { active, clears } = meadowCaveProgress(M.p);
    title.textContent = '草原洞窟';
    body.innerHTML = active
      ? `<p>已使用鑰石 · ${MEADOW_CAVE[active.tier].name}</p>`
        + row(`<b>繼續第 ${active.stage + 1} 段</b><br><small>${MEADOW_CAVE[active.tier].stages[active.stage].name}</small>`,
          `<button type="button" class="btn small" data-cave-tier="${active.tier}">繼續</button>`)
      : `<p>鑰石 ${M.p.keys || 0} 枚 · 每次挑戰消耗 1 枚</p>
        <p class="psmall">完成一段就會存檔。通關可獲得經驗、金幣及精鋼階鍛造素材。</p>`
        + Object.entries(MEADOW_CAVE).map(([tier, spec]) => {
          const locked = tier === 'elite' && !clears.normal;
          const materials = clears[tier] ? spec.materials : spec.firstMaterials;
          return row(`<b>${spec.name} · 建議 Lv.${spec.level}</b><br><small>${locked ? '先通過普通難度'
            : `狂豬利牙與荊棘硬木各 ×${materials} · 經驗 +${spec.xp}`}</small>`,
          `<button type="button" class="btn small" data-cave-tier="${tier}" ${locked || !(M.p.keys >= 1) ? 'disabled' : ''}>進入${spec.name}</button>`);
        }).join('')
        + (!(M.p.keys >= 1) ? '<p class="psmall">鑰石可由晨光遠征或野外精英取得。</p>' : '');
    for (const button of body.querySelectorAll('[data-cave-tier]')) {
      button.onclick = () => { if (!g.startMeadowCave(button.dataset.caveTier)) renderMeadowCave(); };
    }
  }

  function renderCaveClear() {
    const res = g.lastCaveClear;
    if (!res) { g.ui.closePanel(); return; }
    const { clears } = meadowCaveProgress(M.p);
    const nextTier = (res.tier === 'normal' && clears.normal) ? 'elite' : res.tier;
    const nextSpec = MEADOW_CAVE[nextTier];
    const canContinue = (M.p.keys || 0) >= 1;
    title.textContent = res.firstClear ? '草原洞窟首通' : '草原洞窟通關';
    body.innerHTML = `<p><b>經驗 +${res.xp} · 金幣 +${res.coins}</b></p>
      <p>狂豬利牙 ×${res.materials}、荊棘硬木 ×${res.materials} 已收入素材包（剩餘鑰石 ${M.p.keys || 0} 枚）。</p>`
      + row(`<div><b>${nextTier === 'elite' && res.tier === 'normal' ? '挑戰精英難度' : `再打一場（${nextSpec.name}）`}</b></div><small>建議 Lv.${nextSpec.level} · 消耗 1 枚鑰石直接開打</small>`,
        `<button type="button" class="btn small${canContinue ? ' on' : ''}" data-cc-next ${canContinue ? '' : 'disabled'}>${canContinue ? '立即出發' : '鑰石不足'}</button>`)
      + row('<div><b>直達燈谷鎮工坊鍛造</b></div><small>省去跑圖，直接用剛獲得的素材打造精鋼階裝備</small>',
        '<button type="button" class="btn small" data-cc-forge>前往工坊</button>')
      + row('<div><b>調整技能拼圖</b></div><small>更換寶石構築後再挑戰下一場</small>',
        '<button type="button" class="btn small" data-cc-puzzle>開啟拼圖</button>');
    body.querySelector('[data-cc-next]').onclick = () => { if (!g.startMeadowCaveDirect(nextTier)) renderCaveClear(); };
    body.querySelector('[data-cc-forge]').onclick = () => {
      g.ui.closePanel();
      g.state = 'transition'; g.audio.sfx('warp');
      g.ui.wipe(() => { g.enterTown(); g.ui.openPanel('workshop'); });
    };
    body.querySelector('[data-cc-puzzle]').onclick = openRewardPuzzle;
  }

  function renderExpedition() {
    const { active } = meadowExpedition(M.p);
    const stage = meadowStage(active);
    title.textContent = '區域遠征';
    if (stage === 'choose') {
      const available = availableExpeditions(M.p);
      if (!available.length) {
        body.innerHTML = '<p>目前開放的區域遠征已完成。用鑰石前往區域洞窟，試試新的技能構築。</p>'
          + '<button type="button" class="btn small" data-exp-puzzle>開啟技能拼圖</button>';
        body.querySelector('[data-exp-puzzle]').onclick = openRewardPuzzle;
        return;
      }
      body.innerHTML = available.map(tier => {
        const def = MEADOW_TIERS[tier];
        return `<p><b>${def.name}</b> · 建議 Lv.${def.level}</p>
          <p class="psmall">討伐${def.champion}後可選一顆寶石，另獲 ${def.xp} 經驗、${def.coins} 金幣與 ${def.keys} 枚鑰石。</p>`
          + Object.keys(def.routes).map(id => {
            const route = expeditionRoute(tier, id);
            return row(`<div><b>${route.title}</b></div><small>${route.summary}</small>`,
              `<button type="button" class="btn small" data-exp-tier="${tier}" data-exp-route="${id}">接下${route.title}</button>`);
          }).join('');
      }).join('<div class="phr"></div>');
      for (const button of body.querySelectorAll('[data-exp-route]')) button.onclick = () => {
        const tier = Number(button.dataset.expTier);
        const def = MEADOW_TIERS[tier];
        if (!startMeadowExpedition(M.p, tier, button.dataset.expRoute)) return;
        M.save();
        syncMeadowExpedition(g);
        g.ui.closePanel();
        g.ui.banner(def.name, g.field === def.field ? '沿指引前往目標。' : `前往${FIELDS[def.field].name}，跟隨畫面指引。`);
      };
      return;
    }
    const route = expeditionRoute(active.tier, active.route);
    const reward = MEADOW_TIERS[active.tier];
    title.textContent = reward.name;
    if (stage === 'reward') {
      body.innerHTML = `<p>${reward.champion}已倒下。選一顆寶石帶進技能拼圖。</p>
        <p class="psmall">另獲 ${reward.xp} 經驗、${reward.coins} 金幣及 ${reward.keys} 枚鑰石。</p>`
        + (reward.materials ? `<p>${materialText(reward.materials)}${active.partBroken ? '，另有孢囊破壞獎勵 ' + materialText({ [reward.partBonus.id]: reward.partBonus.count }) : ''}。</p>` : '')
        + reward.gems.map(id => {
          const gem = ALL_GEMS[id];
          const fit = suggestSupportFit(M.p, id);
          const preview = fit ? ` · 可連結 ${fit.skills.join('、')}` : '';
          return row(`<div><b>${gem.icon} ${gem.name}</b></div><small>${gem.desc}${preview}</small>`,
            `<button type="button" class="btn small" data-exp-gem="${id}">選擇${gem.name}</button>`);
        }).join('');
      for (const button of body.querySelectorAll('[data-exp-gem]')) button.onclick = () => {
        const result = claimMeadowReward(M.p, button.dataset.expGem);
        if (!result) return;
        grantExperience(g, result.xp);
        M.save();
        g.audio.sfx('classup');
        renderExpeditionReward(result);
      };
      return;
    }
    const location = g.field === reward.field ? '循指引靠近目標。' : `前往${FIELDS[reward.field].name}。`;
    body.innerHTML = stage === 'route'
      ? `<p><b>${route.title} · ${active.completed.length}/${route.need}</b></p><p>${route.summary} ${location}</p>`
      : `<p><b>討伐${reward.champion}</b></p><p>${reward.tactics} ${location}</p>`;
  }

  function renderQuest() {
    title.textContent = '任務布告欄 · 今日委託';
    const claimable = M.p.quests.list.filter(q => !q.claimed && q.have >= q.need).length;
    let h = claimable >= 2 ? `<div style="text-align:right;margin-bottom:6px"><button class="btn small" data-claim-all>✦ 一鍵領取全部 (${claimable})</button></div>` : '';
    M.p.quests.list.forEach((q, i) => {
      const done = q.have >= q.need, r = M.questReward(q);
      h += row(`<div>${esc(M.questText(q))}</div><div class="pbar"><i style="width:${Math.min(100, q.have / q.need * 100)}%"></i></div><small>${q.have}/${q.need} · 獎勵 ✦${r}</small>`,
        q.claimed ? `<span class="pdone">已領取 ✔</span>` : `<button class="btn small" data-claim="${i}" ${done ? '' : 'disabled'}>領取</button>`);
    });
    h += `<div class="phr"></div>` + row(`<div>貝殼商人的交換</div><small>10 枚貝殼 → 1 根金羽毛（攀爬與滑翔的體力消耗永久減少 8%，可疊加）</small>`,
      `<button class="btn small" data-swap ${M.p.shells >= 10 ? '' : 'disabled'}>交換</button>`);
    h += `<div class="psmall">已累積：擊敗 ${M.p.kills} 隻 · 出發 ${M.p.runs} 次 · 最深 ${M.p.best.depth} 層 · 通關 ${M.p.best.wins} 次</div>`;
    body.innerHTML = h;
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => { const r = M.claim(+b.dataset.claim); if (r) { g.audio.sfx('exit'); g.ui.toast(`委託完成！星砂 +${r}`, '#ffe08a'); } render(); });
    const ca = body.querySelector('[data-claim-all]'); if (ca) ca.onclick = () => { let tot = 0; M.p.quests.list.forEach((q, i) => { if (!q.claimed && q.have >= q.need) tot += M.claim(i) || 0; }); if (tot) { g.audio.sfx('perfect'); g.ui.toast(`全部委託領取完成！星砂 +${tot}`, '#ffe08a'); } render(); };
    const sw = body.querySelector('[data-swap]'); if (sw) sw.onclick = () => { if (M.p.shells >= 10) { M.p.shells -= 10; M.p.feathers++; M.save(); g.audio.sfx('exit'); g.ui.toast('換到一根金羽毛！', '#ffd23a'); } render(); };
  }

  function renderForge() {
    title.textContent = '鐵匠鋪 · 裝備精煉與腐化';
    const eq = g.player?.equip || {};
    const avail = Object.keys(SLOTS).filter(k => eq[k]);
    if (!sel || !eq[sel]) sel = avail[0] || null;
    const it = sel ? eq[sel] : M.heirloom;
    if (!it) { body.innerHTML = `<div class="psmall" style="font-size:16px;line-height:1.8;text-align:center">身上尚無可鍛造的裝備，先點上方「素材鍛造與武器」打造一把吧！</div>`; return; }
    const R = RARITY[it.rarity];
    const res = computeEnhanceResonance(eq);
    const fs = M.p.enhanceFailstack || 0;
    const tabs = avail.map(k => `<button type="button" class="btn small ${k === sel ? 'on' : ''}" data-fslot="${k}">${SLOTS[k].icon} ${SLOTS[k].name}${eq[k]?.enhance ? ` +${eq[k].enhance}` : ''}</button>`).join('');
    let h = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tabs}</div>`;
    h += `<div class="psmall" style="margin-bottom:8px;padding:6px 10px;background:rgba(255,216,90,.16);border:1px solid #c99228;border-radius:6px">
      ${res.active ? `<b style="color:${res.active.color}">${res.active.icon} 全身強化共鳴：${res.active.name}</b>` : `<b>🔷 全身強化共鳴：尚未啟動</b>`}
      ${res.next ? ` · 下一階：3 部位皆達 +${res.next.minLv}（目前最低 +${res.minLv}）` : ' · 已達最高共鳴！'}
      ${fs > 0 ? ` · <b style="color:#c85418">🔥 疊層保底 ×${fs}（+${Math.min(50, fs * 6)}% 成功率）</b>` : ''}
    </div>`;
    h += `<div class="pitem" style="border-color:${R.color}"><b style="color:${R.color};text-shadow:0 2px 0 #3b2a2a">${esc(it.name)}${it.enhance ? ` +${it.enhance}` : ''}</b> <small>${SLOTS[it.slot].name} · T${it.tier}${it.reforged ? ` · 重鑄 ×${it.reforged}` : ''}</small><div>${itemLines(it).map(l => `<div class="${l.corrupt ? 'corrupt' : l.imp ? 'imp' : l.special ? 'spc' : 'mod'}">${esc(l.t)}</div>`).join('')}</div></div>`;
    // MMORPG 裝備精煉強化（+0 → +10，含疊層保底與鍛造宗師副職加成）
    const smithLv = M.p.lifeSkills?.smith?.lv || 1;
    const eh = enhanceInfo(it.enhance || 0, fs, smithLv);
    const oreHave = (M.p.mats?.ore || 0), charmHave = (M.p.protectCharms || 0);
    const canEnh = !eh.max && !it.bricked && (M.p.coins || 0) >= eh.coins && oreHave >= eh.ore && (M.p.shards || 0) >= eh.shards;
    const enhCostTxt = eh.max ? '已滿階' : `🪙${eh.coins} ⛏️${eh.ore}${eh.shards ? ` 💎${eh.shards}` : ''}`;
    const charmHint = eh.downgradeOnFail ? ` · 🛡️保護符：${charmHave}（有則自動防降階）` : '';
    h += row(`<div><b style="color:#9a3e06">✨ 裝備精煉強化（+${it.enhance || 0} → +${eh.nextLv || 10}）</b> <small>🔨鍛造宗師 Lv.${smithLv}</small></div><small>${eh.risk}（星紋礦：${oreHave}${charmHint}）</small>`,
      `<button class="btn small" style="background:#d98026" data-enhance ${canEnh ? '' : 'disabled'}>${enhCostTxt}</button>`);
    // 🎲 裝備潛能覺醒與魔方洗詞綴（R → SR → SSR → UR）
    const curPot = it.potential;
    const potTierDef = curPot ? POTENTIAL_TIERS[curPot.tier] : null;
    const cubesHave = M.p.cubes || 0;
    const canPot = !it.bricked && (cubesHave > 0 || (M.p.shards || 0) >= POTENTIAL_SHARD_COST);
    const potLinesTxt = curPot ? formatPotentialLines(curPot).map(l => l.t).join(' ｜ ') : '尚未覺醒（可洗出 2 條百分比強詞綴，並有機率跳升至 SSR/UR！）';
    h += row(`<div><b style="color:${potTierDef ? potTierDef.color : '#5e2498'}">🎲 裝備潛能魔方${potTierDef ? `【${potTierDef.name}】` : ''}</b> <small>（魔方：🎲${cubesHave}）</small></div><small>${esc(potLinesTxt)}</small>`,
      `<button class="btn small" style="background:#7a4ac0" data-roll-pot ${canPot ? '' : 'disabled'}>${cubesHave > 0 ? '🎲 魔方洗潛能' : `💎${POTENTIAL_SHARD_COST} 洗潛能`}</button>`);
    // 💠 裝備符文石鑲嵌（6 種符文石）
    const runeBag = ensureRunes(M.p);
    const curRune = it.rune ? RUNE_DEFS[it.rune] : null;
    const runeBtns = RUNE_IDS.map(rid => {
      const rd = RUNE_DEFS[rid], cnt = runeBag[rid] || 0, isCur = it.rune === rid;
      return `<button type="button" class="btn small ${isCur ? 'on' : ''}" data-socket-rune="${rid}" title="${rd.desc}" ${cnt <= 0 || isCur || it.bricked ? 'disabled' : ''}>${rd.icon}${rd.name.slice(0, 2)} ×${cnt}</button>`;
    }).join('');
    h += `<div class="prow" style="flex-direction:column;align-items:stretch;gap:6px"><div><b style="color:#2c2a7e">💠 符文石鑲嵌</b> <small>（目前：${curRune ? `${curRune.icon} ${curRune.name} · ${curRune.desc}` : '未鑲嵌，擊殺精英／世界王或日課寶箱取得'}）</small></div><div style="display:flex;gap:5px;flex-wrap:wrap">${runeBtns}</div></div>`;
    for (const [k, f] of Object.entries(FORGE)) {
      const ok = f.ok(it), c = f.cost(it), can = ok && M.p.shards >= c;
      h += row(`<div>${f.name}</div><small>${f.desc}</small>`, `<button class="btn small" data-forge="${k}" ${can ? '' : 'disabled'}>${ok ? `✦ ${c}` : '不可'}</button>`);
    }
    const corruptEnabled = isFeatureEnabled(g.features, 'corrupt');
    const corruptUnlocked = canCorruptGear(g);
    const canCorrupt = corruptEnabled && corruptUnlocked && !it.corrupted && M.p.shards >= CORRUPT_COST;
    const corruptBar = `<div class="corrupt-bar" title="四種不可逆結果機率各 25%"><span style="background:#b8245c">25% 神話</span><span style="background:#d98026">25% 超頻</span><span style="background:#3e7d72">25% 穩固</span><span style="background:#5a4848">25% 碎裂</span></div>`;
    const cBtnText = !corruptEnabled ? '⚠️ 維護中' : it.corrupted ? '已腐化' : !corruptUnlocked ? `🔒 Lv.${CORRUPT_UNLOCK_LV} 解鎖` : `✦ ${CORRUPT_COST}`;
    h += row(`<div><b style="color:#961444">☠️ 裝備腐化改造（不可逆賭博）</b>${corruptBar}</div><small>${corruptUnlocked ? '神諭詞綴 / 全詞綴 ×1.45 / 保持穩固 / 碎裂報廢（各 25%）' : `旅人等級達 Lv.${CORRUPT_UNLOCK_LV} 後解鎖（保護新手初期裝備不會意外碎裂）`}</small>`,
      `<button class="btn small" style="background:#9b2458" data-corrupt ${canCorrupt ? '' : 'disabled'}>${cBtnText}</button>`);
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
    const ehBtn = body.querySelector('[data-enhance]');
    if (ehBtn) ehBtn.onclick = () => {
      const cur = sel ? eq[sel] : M.heirloom; if (!cur) return;
      const resEnh = enhanceItem(M.p, cur, Math.random, (M.p.protectCharms || 0) > 0);
      if (!resEnh.ok) { g.ui.toast(resEnh.reason, '#ff8a8a'); return; }
      saveGear(cur);
      recordStoryEvent(M.p, 'enhance', 1);
      g.audio.sfx(resEnh.success ? 'classup' : resEnh.downgraded ? 'corruptBrick' : 'ui');
      g.ui.toast(resEnh.msg, resEnh.success ? '#ffd85a' : '#ff8a8a');
      if (resEnh.lifeUp) g.ui.toast(`🔨 鍛造宗師升級至 Lv.${resEnh.lifeUp.lv}！精煉成功率與基礎傷害永久提升！`, '#7fe08a');
      render();
    };
    const potBtn = body.querySelector('[data-roll-pot]');
    if (potBtn) potBtn.onclick = () => {
      const cur = sel ? eq[sel] : M.heirloom; if (!cur) return;
      const resP = rollPotential(M.p, cur, Math.random);
      if (!resP.ok) { g.ui.toast(resP.reason, '#ff8a8a'); return; }
      saveGear(cur);
      g.vfx?.spawnPotentialCubeBurst(g.player.pos.x, g.player.y || 0, g.player.pos.z, resP.tier);
      g.audio.sfx(resP.tierUp ? 'corruptGod' : 'classup');
      g.ui.toast(resP.msg, POTENTIAL_TIERS[resP.tier]?.color || '#ffd85a');
      render();
    };
    body.querySelectorAll('[data-socket-rune]').forEach(b => b.onclick = () => {
      const cur = sel ? eq[sel] : M.heirloom; if (!cur) return;
      const resR = socketRune(M.p, cur, b.dataset.socketRune);
      if (!resR.ok) { g.ui.toast(resR.reason, '#ff8a8a'); return; }
      saveGear(cur);
      g.vfx?.spawnPotentialCubeBurst(g.player.pos.x, g.player.y || 0, g.player.pos.z, 'SR');
      g.audio.sfx('classup');
      g.ui.toast(resR.msg, resR.def.color);
      if (resR.lifeUp) g.ui.toast(`🔨 鍛造宗師升級至 Lv.${resR.lifeUp.lv}！`, '#7fe08a');
      render();
    });
    const cb = body.querySelector('[data-corrupt]');
    if (cb) cb.onclick = () => {
      const cur = sel ? eq[sel] : M.heirloom; if (!cur || cur.corrupted || M.p.shards < CORRUPT_COST) return;
      M.p.shards -= CORRUPT_COST;
      const resC = corruptItem(cur);
      if (!resC.ok) return;
      saveGear(resC.item);
      g.audio.sfx(resC.outcome === 'brick' ? 'corruptBrick' : resC.outcome === 'godroll' ? 'corruptGod' : 'classup');
      g.ui.toast(resC.label, resC.outcome === 'brick' ? '#ff6a6a' : '#ff8ad8');
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
    const rep = getGuildRepInfo(M.p);
    const cp = g.player?.combatPower || 100;
    const advRk = computeAdventurerRank(M.p, cp);
    body.replaceChildren();
    const addRow = (h, btn) => { const d = document.createElement('div'); d.className = 'prow'; d.innerHTML = `<div class="pl">${h}</div>`; if (btn) d.append(btn); body.append(d); return d; };
    // 🏅 公會聲望條＋永久被動
    addRow(`<div><b>🏅 公會聲望 Lv.${rep.lv} · ${rep.title}</b> <small>（聲望 ${rep.rep}${rep.next ? `/${rep.next.needRep}` : ' MAX'}）</small></div>
      <div class="pbar"><i style="width:${Math.round(rep.prog * 100)}%"></i></div>
      <small>永久公會被動：全傷害 +${rep.dmgPct}% · 最大生命 +${rep.maxHp} · 掉星砂 +${rep.shardBonus}%</small>`);
    // 📅 每日活躍度四段寶箱（25 / 50 / 75 / 100）
    const da = ensureDailyActivity(M.p);
    const daWrap = document.createElement('div'); daWrap.className = 'prow'; daWrap.style.cssText = 'flex-direction:column;align-items:stretch;gap:6px';
    daWrap.innerHTML = `<div><b>📅 每日活躍度（${da.pts}/100）</b> <small>打怪／採集／精煉／懸賞累積 · 跨日自動重置</small></div><div class="pbar" style="width:100%"><i style="width:${da.pts}%"></i></div>`;
    const daBtns = document.createElement('div'); daBtns.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap';
    for (const ch of DAILY_CHESTS) {
      const claimed = da.claimed.includes(ch.pt), ready = da.pts >= ch.pt && !claimed;
      const cb = document.createElement('button'); cb.className = 'btn small' + (ready ? ' on' : '');
      cb.textContent = claimed ? `${ch.icon} ${ch.pt}✔` : `${ch.icon} ${ch.pt}分箱`;
      cb.disabled = !ready;
      cb.title = `${ch.name}：🪙${ch.reward.coins} · 💎${ch.reward.shards} · ⛏️${ch.reward.ore}${ch.reward.runes ? ` · 💠符文×${ch.reward.runes}` : ''}${ch.reward.charms ? ` · 🛡️保護符×${ch.reward.charms}` : ''}`;
      cb.onclick = () => {
        const r = claimDailyChest(M.p, ch.pt);
        if (r.ok) {
          M.save(); g.audio.sfx('classup');
          const rTxt = r.gainedRunes.length ? ` · 💠${r.gainedRunes.map(x => x.name).join('、')}` : '';
          g.ui.toast(`🎁 領取【${ch.name}】！+🪙${r.reward.coins} · +💎${r.reward.shards}${rTxt}`, '#ffd85a');
          render();
        }
      };
      daBtns.append(cb);
    }
    daWrap.append(daBtns); body.append(daWrap);
    // 🗼 50 層無盡試煉秘境塔（1F → 50F）
    const twBon = computeTowerBonuses(M.p);
    const nextF = Math.min(MAX_TOWER_FLOOR, twBon.best + 1);
    const fSpec = towerFloorSpec(nextF);
    const twBtn = document.createElement('button'); twBtn.className = 'btn small on';
    twBtn.textContent = `🗼 挑戰 ${nextF}F${fSpec.isBoss ? '(王)' : ''}`;
    twBtn.onclick = () => { g.ui.closePanel(); g.state = 'transition'; g.audio.sfx('warp'); g.ui.wipe(() => g.startTowerFloor(nextF)); };
    addRow(`<div><b>🗼 無盡試煉秘境塔（最高 ${twBon.best}/${MAX_TOWER_FLOOR}F）</b></div><small>永久被動：全傷害 +${twBon.dmgPct}% · 最大生命 +${twBon.maxHp} ｜ 下一層 ${nextF}F（血量 ×${fSpec.hpScale}）首通贈🎲潛能魔方與星砂！</small>`, twBtn);
    // 📯 野外世界王號角
    const wbBtn = document.createElement('button'); wbBtn.className = 'btn small';
    wbBtn.textContent = g.field ? '📯 立即召喚世界王' : '需於野外吹響';
    wbBtn.disabled = !g.field;
    wbBtn.onclick = () => { g.ui.closePanel(); spawnWorldBoss(g); };
    addRow('<div><b>🐉 野外世界王討伐令</b></div><small>野外每 3 分鐘自動降臨世界王（或吹響號角立即召喚），依貢獻領 S/A/B 級傳奇寶箱與巨獸星心！</small>', wbBtn);
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
    // 🎖️ 冒險者階級晉升領獎（F → SS）
    const hRk = document.createElement('div');
    hRk.style.cssText = 'margin:12px 0 6px;padding-top:10px;border-top:2px dashed rgba(59,42,42,.35);font-weight:900';
    hRk.innerHTML = `🎖️ 冒險者階級晉升獎勵（目前：<b style="color:${advRk.color}">${advRk.rank}級 ${advRk.name}</b> · 積分 ${advRk.score}）`;
    body.append(hRk);
    const claimedRanks = M.p.claimedRanks || [];
    for (const rk of ADVENTURER_RANKS.filter(r => r.promoReward)) {
      const reached = advRk.score >= rk.minScore;
      const done = claimedRanks.includes(rk.rank);
      const rBtn = document.createElement('button');
      rBtn.className = 'btn small' + (reached && !done ? ' on' : '');
      rBtn.textContent = done ? '已領取 ✔' : reached ? '領取晉升寶箱' : `需 ${rk.minScore} 分`;
      rBtn.disabled = done || !reached;
      rBtn.onclick = () => {
        const res = claimRankReward(M.p, rk.rank, cp);
        if (res.ok) {
          M.save(); g.audio.sfx('classup');
          g.ui.toast(`🎖️ ${rk.rank}級晉升寶箱！+🪙${res.reward.coins} · +💎${res.reward.shards}${res.reward.charms ? ` · +🛡️${res.reward.charms}保護符` : ''}`, '#ffd85a');
          render();
        }
      };
      addRow(`<div><b style="color:${rk.color}">${rk.rank}級 · ${rk.name}</b> <small>（全傷 +${rk.bonusDmgPct}%）</small></div><small>晉升寶箱：🪙${rk.promoReward.coins} · 💎${rk.promoReward.shards}${rk.promoReward.charms ? ` · 🛡️${rk.promoReward.charms}` : ''}</small>`, rBtn);
    }
    // 👥 MMORPG 3 人冒險小隊編成（可同時出戰 2 名 AI 隊友 ＋ 三大陣型光環！）
    const partyIds = getPartyIds(M.p);
    const activeSyn = getActivePartySynergy(M.p);
    const hComp = document.createElement('div');
    hComp.style.cssText = 'margin:12px 0 6px;padding-top:10px;border-top:2px dashed rgba(59,42,42,.35);font-weight:900';
    hComp.innerHTML = `👥 3 人冒險小隊編成（已出戰 ${partyIds.length}/2 · 金幣：🪙${M.p.coins || 0}）${activeSyn ? `<br><small style="color:#2f8a4e">✨ 陣型啟動：${activeSyn.icon} ${activeSyn.name}（${activeSyn.desc}）</small>` : '<br><small>同時編入 2 名 AI 隊友可啟動專屬 3 人陣型光環！</small>'}`;
    body.append(hComp);
    for (const c of AI_COMPANIONS) {
      const isCur = partyIds.includes(c.id);
      const bond = getCompanionBondInfo(M.p, c.id);
      const btn = document.createElement('button');
      btn.className = 'btn small' + (isCur ? ' on' : '');
      btn.textContent = isCur ? '出戰中 ✔（離隊）' : `編入 🪙${c.cost}`;
      btn.disabled = !isCur && (M.p.coins || 0) < c.cost;
      btn.onclick = () => {
        const res = togglePartyMember(M.p, c.id, c.cost);
        if (!res.ok) { g.ui.toast(res.reason, '#ff8a8a'); return; }
        M.save(); g.recalc(); spawnCompanion3D(g);
        g.audio.sfx(res.action === 'joined' ? 'classup' : 'ui');
        const synNow = getActivePartySynergy(M.p);
        if (res.action === 'joined' && synNow) g.vfx?.spawnWaterShield(g.player.pos.x, g.player.y || 0, g.player.pos.z, 2.6, 'holy');
        g.ui.toast(res.action === 'joined'
          ? `👥 ${c.icon} ${c.name} 加入小隊！${synNow ? `啟動【${synNow.icon}${synNow.name}】！` : ''}`
          : `已將 ${c.name} 移出小隊`, res.action === 'joined' ? '#7fe08a' : '#e8dcc8');
        render();
      };
      addRow(`<div><b>${c.icon} ${c.name}</b> <small>[${c.role} · 羈絆 Lv.${bond.lv}/10 · 戰力 ×${bond.mult}]</small></div><small>${c.desc}<br>💖 ${c.bondDesc}</small>`, btn);
    }
    // 🎯 5 大公會重複懸賞討伐令（穩定產出星紋礦、聲望與祝福保護符！）
    const hBnt = document.createElement('div');
    hBnt.style.cssText = 'margin:12px 0 6px;padding-top:10px;border-top:2px dashed rgba(59,42,42,.35);font-weight:900';
    hBnt.textContent = `🎯 公會懸賞委託板（祝福保護符：🛡️${M.p.protectCharms || 0}）`;
    body.append(hBnt);
    const bp = M.p.bountyProg || {};
    for (const bnt of GUILD_BOUNTIES) {
      const have = bp[bnt.statKey] || 0;
      const ready = have >= bnt.need;
      const bBtn = document.createElement('button');
      bBtn.className = 'btn small' + (ready ? ' on' : '');
      bBtn.textContent = ready ? '領取賞金' : `${have}/${bnt.need}`;
      bBtn.disabled = !ready;
      bBtn.onclick = () => {
        const res = claimGuildBounty(M.p, bnt.id);
        if (res.ok) {
          M.save(); g.recalc(); g.audio.sfx('classup');
          g.ui.toast(`🎯 懸賞完成！+🪙${res.reward.coins} · +⛏️${res.reward.ore} · +🏅${res.reward.rep}聲望${res.reward.charms ? ` · +🛡️${res.reward.charms}` : ''}`, '#ffd85a');
          if (res.repUp) g.ui.toast(`🏅 公會聲望升級至 Lv.${res.repUp.lv}「${res.repUp.title}」！永久全傷 +${res.repUp.dmgPct}%`, '#7fe08a');
          render();
        }
      };
      addRow(`<div><b>${bnt.icon} ${bnt.name}</b></div><div class="pbar"><i style="width:${Math.min(100, (have / bnt.need) * 100)}%"></i></div><small>${bnt.desc} · 獎勵 🪙${bnt.reward.coins} ⛏️${bnt.reward.ore} 🏅+${bnt.reward.rep}聲望${bnt.reward.charms ? ` 🛡️${bnt.reward.charms}` : ''}</small>`, bBtn);
    }
  }

  function renderAscend() {
    const cls = CLASSES[g.character?.job ?? 0] || CLASSES[0];
    const cur2 = findSecondClass(M.p.secondClass);
    title.textContent = `星燈覺醒祭壇 · ${cls.icon} ${cls.name}二轉試煉`;
    body.replaceChildren();
    const info = document.createElement('div'); info.className = 'psmall';
    info.innerHTML = cur2
      ? `目前已覺醒：<b>${cur2.icon} ${cur2.name}</b>（稱號：${cur2.title || cur2.name} · ${cur2.desc}）`
      : `<b>⚠️ 二轉為重大職業晉升</b>：需同時達成 <b>Lv.12</b>、<b>40 隻魔物討伐</b>、<b>3 隻高危精英</b>、<b>職業專屬試煉</b>，並支付 <b>🪙300 金幣 + 💎45 星砂</b>。`;
    body.append(info);
    for (const sc of SECOND_CLASSES[cls.id] || []) {
      const isCur = M.p.secondClass === sc.id;
      const elig = checkAscendEligibility(M.p, sc, !!g.dev?.on);
      const d = document.createElement('div'); d.className = 'prow';
      const chkHtml = elig.checks.map(c => `<span style="display:inline-block;margin:2px 6px 2px 0;font-size:11.5px;color:${c.ok ? '#267346' : '#a83434'};font-weight:${c.ok ? '700' : '600'}">${c.ok ? '✔' : '✖'} ${esc(c.label)}</span>`).join('');
      d.innerHTML = `<div class="pl"><b>${sc.icon} ${sc.name}</b> <small>（稱號：${esc(sc.title || '')}）</small><br><small>${esc(sc.desc)}</small><div class="pbar" style="margin:4px 0"><i style="width:${Math.round(elig.prog * 100)}%"></i></div><div>${chkHtml}</div></div>`;
      const b = document.createElement('button'); b.className = 'btn small' + (isCur || elig.eligible ? ' on' : '');
      b.textContent = isCur ? '已覺醒 ✔' : elig.eligible ? '✨ 執行覺醒儀式' : `🔒 試煉 ${elig.passed}/${elig.total}`;
      b.disabled = isCur || !elig.eligible;
      b.onclick = () => {
        const res = performAscend(M.p, sc.id, !!g.dev?.on);
        if (!res.ok) { g.ui.toast(res.reason || '尚未達成試煉條件', '#ff8a8a'); return; }
        recordStoryEvent(M.p, 'ascend', 1);
        M.save(); g.recalc(); g.audio.sfx('classup');
        g.vfx?.spawnKiAscension(g.player.pos.x, g.player.y || 0, g.player.pos.z, 'holy');
        g.ui.toast(`✨ 二轉覺醒完成：${sc.icon} ${sc.name}！獲贈寶石「${ALL_GEMS[sc.gem].name}」與稱號「${sc.title}」`, '#ffd85a');
        render();
      };
      d.append(b); body.append(d);
    }

    // 🌟 星燈聖殿・永久天賦樹（吸血鬼倖存者 × MMO 跨局成長）
    const h2 = document.createElement('div');
    h2.style.cssText = 'margin:14px 0 6px;padding-top:10px;border-top:2px dashed rgba(59,42,42,.35);display:flex;justify-content:space-between;align-items:center;font-weight:900';
    h2.innerHTML = `<span>🌟 星燈聖殿・永久天賦（星砂：💎${M.p.shards || 0}）</span>`;
    const rBtn = document.createElement('button'); rBtn.className = 'btn small'; rBtn.textContent = '♻️ 免費洗點';
    rBtn.onclick = () => {
      const ref = respecTalents(M.p);
      M.save(); g.recalc(); g.audio.sfx('ui');
      g.ui.toast(ref > 0 ? `♻️ 已免費洗點，退還 💎${ref} 星砂！` : '尚未點亮任何天賦', '#ffd85a');
      render();
    };
    h2.append(rBtn); body.append(h2);
    const bt = M.p.bestTide || { maxWave: 1, maxStreak: 0, maxMin: 0 };
    const ec = getBloodEclipseField();
    const ecName = FIELDS[ec.fieldId]?.name || `#${ec.fieldId}`;
    const recDiv = document.createElement('div'); recDiv.className = 'psmall';
    recDiv.innerHTML = `🏆 無盡潮汐紀錄：最高 <b>Wave ${bt.maxWave}</b> · 最高連殺 <b>${bt.maxStreak}</b> · 最長生存 <b>${bt.maxMin || 0} 分鐘</b><br>`
      + (ec.active ? `🩸 <b style="color:#c83434">血月蝕進行中！【${ecName}】掉寶 ×2.5（剩 ${Math.floor(ec.remainSec/60)}分${ec.remainSec%60}秒）</b>` : `🌙 下次血月蝕：【${ecName}】（倒數 ${Math.floor(ec.remainSec/60)}分${ec.remainSec%60}秒）`);
    body.append(recDiv);
    const tal = ensureTalents(M.p);
    for (const def of SANCTUARY_TALENTS) {
      const lv = tal[def.id] || 0;
      const cost = talentCost(def.id, lv);
      const row = document.createElement('div'); row.className = 'prow';
      row.innerHTML = `<div class="pl"><b>${def.icon} ${def.name}</b> <small>Lv.${lv}/${def.max}</small><br><small>${def.desc}</small></div>`;
      const btn = document.createElement('button'); btn.className = 'btn small' + (lv >= def.max ? ' on' : '');
      btn.textContent = lv >= def.max ? '已滿級' : `升級 💎${cost}`;
      btn.disabled = lv >= def.max || (M.p.shards || 0) < cost;
      btn.onclick = () => {
        const res = buyTalent(M.p, def.id);
        if (res.ok) {
          M.save(); g.recalc(); g.audio.sfx('perfect');
          g.ui.toast(`🌟 天賦升級：${def.icon} ${def.name} Lv.${res.level}！`, '#ffd85a');
          render();
        }
      };
      row.append(btn); body.append(row);
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

  function render() {
    M = g.meta;
    foot.hidden = ['map', 'shards', 'expedition', 'meadowCave', 'caveClear', 'field_quest'].includes(kind);
    head();
    if (kind === 'shards') { renderShards(); return; }
    if (kind === 'expedition') { renderExpedition(); return; }
    if (kind === 'meadowCave') { renderMeadowCave(); return; }
    if (kind === 'caveClear') { renderCaveClear(); return; }
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
  g.ui.openPanel = k => {
    kind = k; g.ui.guildMarketOpen = k === 'exchange';
    g.ui.panelOpen = true; root.classList.remove('hide'); render();
    if (k === 'shards' && g.net.zoneShards) g.net.send({ t: 'shard_list' });
  };
  g.ui.refreshShardPanel = request => {
    if (kind !== 'shards' || !g.ui.panelOpen) return;
    renderShards();
    if (request && g.net.shard) g.net.send({ t: 'shard_list' });
  };
  g.ui.drawGuildMarket=()=>drawExchange(g,body,title);
  g.ui.closePanel = () => { g.ui.guildMarketOpen=false; g.ui.panelOpen = false; root.classList.add('hide'); };
}
