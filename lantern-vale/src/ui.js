import { FIELDS, rememberGear, xpForNextLevel } from './frontier.js';
import { bindTouch } from './touch.js';
import { cleanPartyCode } from './net.js';
import { bindWorldMap } from './worldmap.js';
import { bindCharacters } from './characters.js';
import { buildPanels } from './panels.js';
import { loadSettings, applySettings, buildSettingsUI, syncHotbarKeyLabels } from './settings.js';
import { CLASSES, bindPuzzleUI } from './puzzle.js';
import { dayInfo, findSecondClass } from './world_alive.js';
import { bindRegionMap } from './region_map.js';
import { navigationTarget, describeMapTarget } from './map_navigation.js';
import { COSMETICS } from './harbor.js';
import { applyCosmetics } from './models.js';
import { PhysicsContainer, ensurePhysicsStorage, useBagItem, transferBagItem, synthesizeBagItems, autoEquipBest, salvageTrashGear } from './physbag.js';
import { bindCodexUI } from './codex.js';
import { StatusCard } from './statuscard.js';
import { t } from './i18n.js';
import * as THREE from 'three';
import { resolveArtId, itemIconUrl } from './itemdb.js';
import { RARITY, SLOTS, itemLines, itemScore, BOONS, deserializeItem, tierInfo, CORRUPT_COST, corruptItem } from './loot.js';
import { activeMountDef, mountStatuses, unlockMountSaddle } from './mounts.js';
import { MONSTER_SOULS, SOUL_SLOTS, ensureSouls, equipSoul, unequipSoul, soulTier } from './souls.js';
import { DENSITY_TIERS, LEAGUE_MECHANICS, ensureAtlas, setAtlasDensity, toggleAtlasMechanic, computeAtlasSummary, atlasCraftCost } from './atlas.js';
import { TIDE_PHASES, ULTIMATES, MICRO_BUFFS, lootMultForTide, castUltimate, cycleUltimate, activateCurseShrine } from './tide.js';
import { getKillStreakTier, getEscalationProfile } from './survivor.js';
import { STAT_DEFS, ensureMmoState, availableStatPoints, allocateStat, resetStatPoints, getCurrentChapter, claimChapterReward, BESTIARY_DEFS, bestiaryRank, computeEnhanceResonance, getGuildRepInfo, getCompanionBondInfo, AI_COMPANIONS } from './mmo_rpg.js';
import { LIFE_SKILLS, LIFE_SKILL_IDS, getLifeSkillInfo, TITLE_DEFS, ensureTitles, equipTitle, computeTitleBonuses, spawnWorldBoss, getSimAdventurers, getSimConfig, DEFAULT_SIM_COUNT, setSimConfig, triggerSimEvent, assistSimTask } from './mmo_world.js';
import { spawnDynamicEvent, getPartyIds, getActivePartySynergy, computeTowerBonuses } from './mmo_endgame.js';
import { ALL_GEMS, addGemToBag } from './puzzle.js';
import { MEADOW_CAVE } from './meadow_cave.js';
import { MEADOW_TIERS, expeditionRoute, isMeadowIntro, meadowExpedition, meadowStage } from './expedition.js';
import { getActiveAccount, slotKeys } from './account.js';
import { canCorruptGear, CORRUPT_UNLOCK_LV, nextMilestone } from './progression.js';
import { applyHudIcons } from './icons.js';
import { installHoverSystem } from './hover.js';
import { computeCozyMvps, getWeeklySpireInfo, contributeLighthouse, getLighthouseTitle, getClassTeamRole, isFeatureEnabled } from './mmo_protocol.js';

const $ = id => document.getElementById(id);
import { bindGameLayers, openTextDialog } from './ui_layers.js';

const v3 = new THREE.Vector3();

function showExpeditionTracker(g) {
  const profile = g.meta.p;
  return isMeadowIntro(profile) && (!!meadowExpedition(profile).active || g.field === 1 || g.depth < 0);
}

export class UI {
  constructor() {
    this.nums = [];
    this.invOpen = false;
    this.invTab = 'bag';
    this.boonChoices = null;
  }
  bind(game) {
    this.game = game;
    this.atStash = false;
    this.status = new StatusCard(this);
    applyHudIcons();
    this.hover = installHoverSystem(game);
    this.refreshRegionMap = bindRegionMap(game);
    game.settings = loadSettings(); buildPanels(game); buildSettingsUI(game); applySettings(game);
    const menuBtn = $('btnMenu'), menuPop = $('menuPop');
    const menuPages = [...menuPop.querySelectorAll('[data-menu-page]')];
    const showMenuPage = page => {
      for (const button of menuPages) {
        const active = button.dataset.menuPage === page;
        button.setAttribute('aria-pressed', String(active));
        $(button.getAttribute('aria-controls')).hidden = !active;
      }
    };
    for (const button of menuPages) button.onclick = () => showMenuPage(button.dataset.menuPage);
    const setMenu = (open, restore = false) => {
      if (open) showMenuPage('adventure');
      menuPop.classList.toggle('hide', !open);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (restore) menuBtn.focus({ preventScroll: true });
    };
    menuBtn.onclick = () => {
      game.audio.sfx('ui');
      setMenu(menuPop.classList.contains('hide'));
    };
    menuPop.addEventListener('click', event => {
      if (event.target.closest('.menu-section button')) setMenu(false, true);
    }, true);
    addEventListener('click', event => {
      if (!menuPop.contains(event.target) && !menuBtn.contains(event.target)) setMenu(false);
    });
    addEventListener('keydown', event => {
      if (menuPop.classList.contains('hide') || document.querySelector('dialog[open]')) return;
      if (event.key === 'Tab') {
        event.stopImmediatePropagation();
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setMenu(false, true);
    }, true);
    $('btnMute').onclick = () => { game.audio.init(); const m = game.audio.toggleMute(); $('btnMute').textContent = m ? '🔇 音效：關' : '🔊 音效：開'; };
    const dbgBtn = $('btnDebug'); if (dbgBtn) dbgBtn.onclick = () => { $('menuPop')?.classList.add('hide'); game.dbg?.toggle?.(); };
    const rosBtn = $('btnSimRoster'); if (rosBtn) rosBtn.onclick = () => { $('menuPop')?.classList.add('hide'); this.toggleSimRoster(game); };
    $('btnZoneShards').onclick = () => this.openPanel('shards');
    const netBox = $('netBox'); if (netBox) netBox.onclick = () => {
      game.audio?.sfx?.('ui');
      if (game.net.zoneShards) this.openPanel('shards');
      else this.toggleSimRoster(game);
    };
    const inspX = $('btnSimInspClose'); if (inspX) inspX.onclick = () => this.closeSimInspect();
    const rosX = $('btnSimRosterClose'); if (rosX) rosX.onclick = () => this.closeSimRoster();
    // Phase M4C：1 秒網址拉人組隊（?join=CODE）＋一鍵複製組隊邀請連結
    try {
      const joinCode = new URLSearchParams(location.search).get('join');
      if (joinCode && $('inParty')) {
        const cleanCode = cleanPartyCode(joinCode);
        $('inParty').value = cleanCode;
        game.party = cleanCode;
        setTimeout(() => this.toast(`🏮 已透過邀請連結加入小隊「${cleanCode}」`, '#ffd85a'), 400);
      }
    } catch (e) { /* ignore */ }
    const invBtn = $('btnInvite');
    if (invBtn) invBtn.onclick = async () => {
      const code = cleanPartyCode(game.party || $('inParty')?.value) || ('LV-' + Math.floor(1000 + Math.random() * 9000));
      game.party = code;
      if ($('inParty')) $('inParty').value = code;
      const url = `${location.origin}${location.pathname}?join=${encodeURIComponent(code)}`;
      try {
        await navigator.clipboard.writeText(url);
        this.toast(`已複製小隊連結（代碼 ${code}）`, '#7fe08a');
      } catch (_) {
        openTextDialog({ title: '小隊邀請', description: '複製連結給隊友。', value: url, readOnly: true });
      }
    };
    $('btnMute').textContent = game.audio.muted ? '🔇 音效：關' : '🔊 音效：開';
    bindWorldMap(game); bindTouch(game); bindPuzzleUI(game); bindCodexUI(game);
    $('btnChatSend').onclick = () => this.finishChat(true);
    $('btnChatClose').onclick = () => this.finishChat(false);
    const pzBtn = $('sk-puzzle'); if (pzBtn) pzBtn.onclick = () => { if (this.puzzleOpen) this.closePuzzle(); else this.openPuzzle(); };
    const pzX = $('btnPuzzleX'); if (pzX) pzX.onclick = () => this.closePuzzle?.();
    const pnX = $('btnPanelX'); if (pnX) pnX.onclick = () => this.closePanel?.();
    const autoBtn = $('sk-auto'); if (autoBtn) autoBtn.onclick = () => game.toggleAutopilot?.();
    const apModeBtn = $('apToggleMode'); if (apModeBtn) apModeBtn.onclick = () => { const ap = game.autopilot; if (ap) game.toggleAutopilot?.(ap.mode === 'full' ? 'assist' : 'full'); };
    const apSalvBtn = $('apToggleSalv'); if (apSalvBtn) apSalvBtn.onclick = () => { const ap = game.autopilot; if (ap) { ap.autoSalvage = !ap.autoSalvage; game.ui.toast(ap.autoSalvage ? '♻️ 已開啟掛機自動分解白／綠裝' : '♻️ 已關閉掛機自動分解', '#e8dcc8'); } };
    const apCozyBtn = $('apToggleCozy'); if (apCozyBtn) apCozyBtn.onclick = () => { const ap = game.autopilot; if (ap) { ap.cozyCam = !ap.cozyCam; ap.idleT = 0; game.ui.toast(ap.cozyCam ? '🎥 已開啟桌寵觀賞鏡頭（20秒無操作啟動）' : '🎥 已關閉桌寵觀賞鏡頭', '#e8dcc8'); } };
    $('quickTideUlt').onclick = () => $('btnTideUlt').click();
    const apStopBtn = $('apStop'); if (apStopBtn) apStopBtn.onclick = () => game.toggleAutopilot?.('off');
    const bagBtn = $('sk-bag'); if (bagBtn) bagBtn.onclick = () => this.toggleInv(game, 'bag');
    const lvBtn = $('pcLv'); if (lvBtn) lvBtn.onclick = () => { game.audio.sfx('ui'); this.toggleInv(game, 'bag'); };
    const flBtn = $('sk-r'); if (flBtn) flBtn.onclick = () => game.tryFlask?.();
    const recBtn = $('sk-recall'); if (recBtn) recBtn.onclick = () => game.startRecall?.();
    const mntBtn = $('sk-mount'); if (mntBtn) mntBtn.onclick = () => game.toggleMount?.();
    const tuBtn = $('btnTideUlt'); if (tuBtn) tuBtn.onclick = () => castUltimate(game);
    const tcBtn = $('btnTideCycle'); if (tcBtn) tcBtn.onclick = () => cycleUltimate(game);
    const csBtn = $('btnCurse'); if (csBtn) csBtn.onclick = () => activateCurseShrine(game);
    const wbBan = $('worldBossBanner');
    if (wbBan) wbBan.onclick = () => {
      if (game.field && !game.worldBoss?.active) spawnWorldBoss(game);
      else if (game.worldBoss?.active) this.toast(`🐉 世界王正在野外肆虐，快前往討伐累積 S 級貢獻！`, '#ffd85a');
    };
    const deBan = $('dynEventBanner');
    if (deBan) deBan.onclick = () => {
      if (game.field && !game.dynEvent?.active) spawnDynamicEvent(game);
      else if (game.dynEvent?.active) this.toast(`⚡ 動態奇遇【${game.dynEvent.def?.name}】進行中！快完成目標領魔方大獎！`, '#ffd85a');
    };
    const swBtn = $('btnSwitchChar'); if (swBtn) swBtn.onclick = () => { game.audio?.sfx?.('ui'); this.returnToCharSelect?.(); };
    const qtEl = $('questTracker');
    $('btnMeadowExpedition').onclick = () => this.openPanel('expedition');
    if (qtEl) qtEl.onclick = () => {
      if (showExpeditionTracker(game)) {
        this.openPanel('expedition');
        return;
      }
      const cur = getCurrentChapter(game.meta?.p);
      if (!cur || !cur.done) return;
      const rew = claimChapterReward(game.meta.p);
      if (!rew) return;
      let gemMsg = '';
      if (rew.gem && ALL_GEMS[rew.gem]) {
        addGemToBag(game.meta.p, rew.gem);
        gemMsg = ` · 寶石【${ALL_GEMS[rew.gem].icon}${ALL_GEMS[rew.gem].name}】`;
      }
      game.meta.save();
      game.recalc();
      game.audio.sfx('classup');
      this.banner(`🎉 主線完成！`, `+🪙${rew.coins} · +💎${rew.shards} 星砂 · +${rew.xp} XP${gemMsg}`);
    };
    const dayBtn = $('dayInfo'); if (dayBtn) dayBtn.onclick = () => {
      if (game.net?.ok && !game.photoMode) {
        game.ui.toast('🌐 線上模式採全服統一晝夜時鐘（開啟 P 拍照模式可本地預覽光影）', '#ffe08a');
        return;
      }
      game.dayTime = ((game.dayTime || 0) + 0.25) % 1; const d = dayInfo(game.dayTime); game.ui.toast(`時間推進至 ${d.icon} ${d.label}`, '#ffe9a0');
    };
    for (let i = 0; i < 4; i++) {
      const slot = $('sk-s' + i);
      const triggerSlot = touch => {
        if (touch && (game.raid || !game.canUseTouchControls())) return;
        if (!game.player.hotbar?.[i] && !(i === 0 && (touch || game.ambushTrial))) {
          game.audio.sfx('ui');
          this.openPuzzle?.();
        } else {
          if (touch) game.aimForTouch();
          game.castHotbar(i);
        }
      };
      slot.addEventListener('touchstart', event => {
        if (game.canUseTouchControls()) event.preventDefault();
      }, { passive: false });
      slot.addEventListener('contextmenu', event => event.preventDefault());
      slot.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        event.preventDefault();
        triggerSlot(true);
      });
      slot.onclick = event => {
        if (event.pointerType === 'touch' || event.pointerType === 'pen') return;
        const touch = matchMedia('(pointer: coarse)').matches && event.detail > 0;
        triggerSlot(touch);
      };
    }
    // 點擊彈窗外部深色遮罩即可快速關閉
    [['inv', () => this.invOpen && this.toggleInv(game)], ['puzzleM', () => this.puzzleOpen && this.closePuzzle?.()], ['panelM', () => this.panelOpen && this.closePanel?.()], ['settings', () => this.setOpen && this.closeSettings?.()], ['codexModal', () => this.codexOpen && this.closeCodex?.()], ['simInspectModal', () => this.simInspectOpen && this.closeSimInspect()], ['simRosterModal', () => this.simRosterOpen && this.closeSimRoster()]].forEach(([mid, fn]) => {
      const m = $(mid); if (m) m.addEventListener('click', e => { if (e.target === m) fn(); });
    });
    this._bindInvTabs(game);
    const enterCharacter = game.ambushTrial ? null : bindCharacters(game);
    $('btnTown2').onclick = () => { $('dead').classList.add('hide'); game.party = ''; game.enterTown(); };
    $('btnTown3').onclick = () => { $('win').classList.add('hide'); game.enterTown(); };
    bindGameLayers(game, [
      ['settings', () => { if (!this.cancelSettingsRebind()) this.closeSettings(); }, '#btnSettingsX'],
      ['panelM', () => this.closePanel(), '#btnPanelX'],
      ['puzzleM', () => this.closePuzzle(), '#btnPuzzleX', ['KeyK', 'KeyR']],
      ['inv', () => this.toggleInv(game), '[data-invtab].on', ['KeyI']],
      ['codexModal', () => this.closeCodex(), '#btnCodexClose'],
      ['simRosterModal', () => this.closeSimRoster(), '#btnSimRosterClose'],
      ['simInspectModal', () => this.closeSimInspect(), '#btnSimInspClose'],
      ['accountModal', () => $('btnAcctClose').click(), '#acctUser'],
      ['delCharModal', () => $('btnDelCancel').click(), '#btnDelCancel'],
      ['boons', null, null, ['Digit1', 'Digit2', 'Digit3']],
      ['dead', null, '#btnRetry'],
      ['win', null, '#btnAgain'],
    ]);
    $('btnStart').onclick = () => {
      if (!enterCharacter) return;
      game.audio.init(); game.audio.sfx('ui');
      game.playerName = ($('inName').value.trim() || '旅人').slice(0, 12); game.party = cleanPartyCode($('inParty').value);
      enterCharacter();
      game.net.connect(game.playerName, game.hoodIdx, game.party);
      $('title').classList.add('hide'); $('hud').classList.remove('hide'); game.enterTown();
      syncHotbarKeyLabels(game);
    };
    $('btnRetry').onclick = () => { $('dead').classList.add('hide'); game.startRun(); };
    $('btnAgain').onclick = () => { $('win').classList.add('hide'); game.startRun(); };
    document.querySelectorAll('[data-scale]').forEach(b => b.onclick = () => {
      game.pipe.setPixelScale(+b.dataset.scale);
      document.querySelectorAll('[data-scale]').forEach(x => x.classList.toggle('on', x === b));
    });
  }
  _bindInvTabs(game) {
    const bagCv = $('bagCanvas'), stashCv = $('stashCanvas');
    const selMap = { bagItems: null, stashItems: null };
    const itemPickers = { bagItems: $('bagItemPicker'), stashItems: $('stashItemPicker') };
    const showSel = (boxId, btnsId, item, fromKey, isPreview = false) => {
      if (!isPreview) {
        selMap[fromKey] = item;
        itemPickers[fromKey].value = item?.uid == null ? '' : String(item.uid);
      }
      const targetItem = item || selMap[fromKey];
      const info = $(boxId), btns = $(btnsId);
      if (!info || !btns) return;
      const lang = game.settings?.lang || 'zh-TW';
      if (!targetItem) { info.textContent = t(lang, 'bagEmpty'); btns.innerHTML = ''; return; }
      if (targetItem.kind === 'gear' && targetItem.item) {
        const gear = deserializeItem(targetItem.item);
        info.innerHTML = (isPreview && item ? `<div style="font-size:10px;opacity:.65;margin-bottom:2px">🔍 懸停預覽對比</div>` : '') + this.itemHTML(gear, game.player.equip[gear.slot]);
      } else {
        const ti = tierInfo(targetItem.tier || 1);
        const art = this.artImg(targetItem, 256, 'tip-art');
        info.innerHTML = `<div class="tip-head rar-0">${art}<div class="tip-title"><div class="iname"><span class="tier-tag" style="color:${ti.color}">${ti.tag}</span>${art ? '' : (targetItem.icon || '') + ' '}${targetItem.name}${(targetItem.qty || 1) > 1 ? ` <small>×${targetItem.qty}</small>` : ''}</div><div class="ibase">${ti.name} · 消耗品</div></div></div><div class="sep"></div><div class="mod-desc">${targetItem.desc || '物理背包物品'}</div>`;
      }
      if (isPreview) return;
      btns.innerHTML = '';
      const act = document.createElement('button'); act.className = 'btn small';
      act.textContent = targetItem.kind === 'gear' ? t(lang, 'equipItem') : t(lang, 'useItem');
      act.onclick = () => { useBagItem(game, targetItem, fromKey); this.syncPhysBags(game); this.renderBagEquipStrip(game); this.renderInv(game, true); showSel(boxId, btnsId, null, fromKey); };
      btns.appendChild(act);
      if (this.atStash) {
        const otherKey = fromKey === 'bagItems' ? 'stashItems' : 'bagItems';
        const mv = document.createElement('button'); mv.className = 'btn small'; mv.style.background = 'var(--teal)';
        mv.textContent = otherKey === 'stashItems' ? t(lang, 'toStash') : t(lang, 'toBag');
        mv.onclick = () => { transferBagItem(game, targetItem, fromKey, otherKey); this.syncPhysBags(game); showSel(boxId, btnsId, null, fromKey); };
        btns.appendChild(mv);
      }
    };
    for (const [key, picker] of Object.entries(itemPickers)) {
      const bag = key === 'bagItems';
      picker.onchange = () => {
        const item = game.meta.p[key]?.find(candidate => String(candidate.uid) === picker.value);
        showSel(bag ? 'bagSelInfo' : 'stashSelInfo', bag ? 'bagBtns' : 'stashBtns', item || null, key);
      };
    }
    if (bagCv) {
      this.bagPhys = new PhysicsContainer(bagCv, {
        theme: 'bag',
        onSelect: it => showSel('bagSelInfo', 'bagBtns', it, 'bagItems'),
        onHover: it => showSel('bagSelInfo', 'bagBtns', it, 'bagItems', true),
        onDoubleClick: it => { useBagItem(game, it, 'bagItems'); this.syncPhysBags(game); this.renderBagEquipStrip(game); this.renderInv(game, true); },
        onSynthesize: (a, b, mx, my) => { synthesizeBagItems(game, a, b, 'bagItems', mx, my); this.syncPhysBags(game); showSel('bagSelInfo', 'bagBtns', null, 'bagItems'); },
      });
    }
    if (stashCv) {
      this.stashPhys = new PhysicsContainer(stashCv, {
        theme: 'stash',
        onSelect: it => showSel('stashSelInfo', 'stashBtns', it, 'stashItems'),
        onHover: it => showSel('stashSelInfo', 'stashBtns', it, 'stashItems', true),
        onDoubleClick: it => { transferBagItem(game, it, 'stashItems', 'bagItems'); this.syncPhysBags(game); },
        onSynthesize: (a, b, mx, my) => { synthesizeBagItems(game, a, b, 'stashItems', mx, my); this.syncPhysBags(game); showSel('stashSelInfo', 'stashBtns', null, 'stashItems'); },
      });
    }
    const ae = $('btnAutoEquip'); if (ae) ae.onclick = () => {
      const res = autoEquipBest(game);
      if (res.count > 0) {
        rememberGear(game); game.audio.sfx('perfect');
        this.syncPhysBags(game); this.renderBagEquipStrip(game); this.renderInv(game, true);
        this.toast(`⚡ 已自動換上 ${res.count} 件更強裝備！`, '#7fe08a');
      } else {
        game.audio.sfx('ui'); this.toast('目前身上已是背包中戰力最高的裝備', '#ffe08a');
      }
    };
    const sv = $('btnSalvageBag'); if (sv) sv.onclick = () => openTextDialog({
      title: '分解低階裝備',
      description: '背包中分數低於同欄已裝備物品的白色與藍色裝備會轉成星砂。腐化裝備保留。',
      action: '分解裝備',
      danger: true,
      submit() {
        const res = salvageTrashGear(game);
        if (res.count > 0) {
          game.audio.sfx('synth');
          game.ui.syncPhysBags(game); game.ui.renderInv(game, true);
          game.ui.toast(`♻️ 已分解 ${res.count} 件低階裝備，獲得 ✦ 星砂 +${res.shards}！`, '#ffd85a');
        } else {
          game.audio.sfx('ui'); game.ui.toast('背包中沒有可分解的多餘白／藍裝備', '#ffe08a');
        }
      },
    });
    const sb = $('btnShakeBag'); if (sb) sb.onclick = () => { this.bagPhys?.shake(); game.audio.sfx('roll'); };
    const ss = $('btnShakeStash'); if (ss) ss.onclick = () => { this.stashPhys?.shake(); game.audio.sfx('roll'); };
    const bc = $('btnInvClose'); if (bc) bc.onclick = () => this.toggleInv(game);
    document.querySelectorAll('[data-invtab]').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.invtab === 'stash' && !this.atStash) {
          game.audio.sfx('ui');
          this.toast(t(game.settings?.lang, 'stashLocked'), '#ffd85a');
          return;
        }
        this.setInvTab(game, btn.dataset.invtab); game.audio.sfx('ui');
      };
    });
  }
  // 物品圖示 <img>（透明 PNG）；沒有圖時回傳空字串由呼叫端用欄位字剪影
  artImg(o, size = 128, cls = 'eq-art') {
    const id = resolveArtId(o), url = id && itemIconUrl(id, size);
    return url ? `<img class="${cls}" src="${url}" alt="" draggable="false" decoding="async">` : '';
  }
  renderBagEquipStrip(game) {
    const el = $('bagEquipStrip'); if (!el) return;
    const eq = game.player.equip, S = game.player.stats || {};
    const cls = CLASSES[game.character?.job ?? 0] || CLASSES[0];
    const cell = k => {
      const it = eq[k], sl = SLOTS[k];
      if (!it) return `<button type="button" class="eq-mini eq-slot empty" data-eqslot="${k}" aria-label="${sl.name}（空）"><i class="eq-glyph">${sl.icon}</i><small class="eq-name">${sl.name}</small></button>`;
      const ti = tierInfo(it.tier || 1);
      const art = this.artImg(it, 128);
      return `<button type="button" class="eq-mini eq-slot rar-${it.rarity}${it.corrupted ? ' corrupted' : ''}" data-eqslot="${k}" aria-label="${it.name}">${art || `<i class="eq-glyph">${sl.icon}</i>`}<b class="eq-tier" style="color:${ti.color}">${ti.tag}</b>${it.enhance ? `<b class="eq-enh">+${it.enhance}</b>` : ''}${it.corrupted ? '<b class="eq-skull">☠</b>' : ''}</button>`;
    };
    el.innerHTML = `<div class="hero-card"><div class="hero-ribbon">英雄 HERO</div>
      <div class="hero-grid">
        <div class="hero-col">${['head', 'body', 'hands', 'feet'].map(cell).join('')}</div>
        <div class="hero-mid">
          <div class="hero-portrait"><span>${cls.icon || '🧙'}</span></div>
          <div class="hero-stat"><span>攻擊</span><b>${Math.round((S.baseDmg || 0) + (S.addFire || 0))}</b></div>
          <div class="hero-stat"><span>減傷</span><b>${S.armor || 0}%</b></div>
          <div class="hero-stat"><span>移速</span><b>+${S.moveSpd || 0}%</b></div>
          <div class="hero-stat pow"><span>戰力</span><b>${game.player.combatPower || 0}</b></div>
        </div>
        <div class="hero-col">${['staff', 'cloak', 'charm', 'relic'].map(cell).join('')}</div>
      </div></div>`;
    const shards = game.meta.p.shards || 0;
    el.querySelectorAll('.eq-mini').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.eqslot, it = eq[k], info = $('bagSelInfo'), btns = $('bagBtns');
        el.querySelectorAll('.eq-slot.sel').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        if (!info) return;
        if (btns) btns.innerHTML = '';
        info.innerHTML = it ? `<div class="eq-note">目前已穿戴</div>` + this.itemHTML(it) : `<div class="eq-note">${SLOTS[k].name}欄位目前為空。把背包裡的${SLOTS[k].name}雙擊即可裝備。</div>`;
        if (!it || !btns) return;
        if (it.corrupted) { btns.innerHTML = `<span class="eq-corrupted-tag">☠️ 已腐化</span>`; return; }
        if (!canCorruptGear(game)) { btns.innerHTML = `<span class="eq-corrupted-tag dim">🔒 Lv.${CORRUPT_UNLOCK_LV} 解鎖腐化</span>`; return; }
        const cb = document.createElement('button');
        cb.type = 'button'; cb.className = 'btn small corrupt-btn eq-corrupt'; cb.dataset.corruptSlot = k;
        cb.textContent = `☠️ 腐化 ✦${CORRUPT_COST}`; cb.disabled = (game.meta.p.shards || 0) < CORRUPT_COST;
        cb.onclick = () => {
          const cur = eq[k];
          if (!cur || cur.corrupted || (game.meta.p.shards || 0) < CORRUPT_COST) return;
          game.meta.p.shards -= CORRUPT_COST;
          const res = corruptItem(cur);
          if (!res.ok) return;
          game.player.equip[k] = res.item;
          rememberGear(game); game.meta.save(); game.recalc();
          game.audio.sfx(res.outcome === 'brick' ? 'corruptBrick' : res.outcome === 'godroll' ? 'corruptGod' : 'classup');
          this.toast(res.label, res.outcome === 'brick' ? '#ff6a6a' : '#ff8ad8');
          this.renderBagEquipStrip(game); this.renderInv(game, true);
        };
        btns.appendChild(cb);
      };
    });
  }
  renderMounts(game) {
    const root = $('mountsRoot'); if (!root) return;
    const list = mountStatuses(game.meta.p);
    const curId = activeMountDef(game.meta.p)?.id;
    root.innerHTML = `<div style="margin-bottom:10px;font-size:13px;color:#5a3826">達成全部冒險里程碑並支付鞍具鍛造材料即可永久馴養坐騎！按 <b>G 鍵</b>隨時召喚／收起。</div><div class="mount-grid">${list.map(m => {
      const u = m.status.unlocked, owned = m.owned, usable = owned && u, on = curId === m.id;
      const chkHtml = (m.status.checks || []).map(c => `<span style="display:inline-block;margin-right:6px;font-size:11px;color:${c.ok ? '#267346' : '#a83434'};font-weight:700">${c.ok ? '✔' : '✖'} ${c.label}</span>`).join('');
      let actHtml = '<span style="font-size:12px;opacity:.7">🔒 尚未達成全部里程碑</span>';
      if (usable) {
        actHtml = `<button type="button" class="btn small ${on ? 'on' : ''}" data-mid="${m.id}">${on ? '✓ 使用中（點此召喚）' : '選擇並召喚'}</button>`;
      } else if (u) {
        actHtml = `<button type="button" class="btn small ${m.canCraft ? 'on' : ''}" data-craft-mid="${m.id}" ${m.canCraft ? '' : 'disabled'}>🔨 馴養／鍛造鞍具（${m.saddleText}）</button>`;
      }
      return `<div class="mount-card ${on ? 'on' : ''} ${usable ? '' : 'locked'}">
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:28px">${m.icon}</span><div><span class="tier-tag" style="color:#ffd85a">T${m.tier}</span><b>${m.name}</b><div style="font-size:11px;color:#7a5a46">${usable ? '✔ 已馴養持有' : m.status.text}</div></div></div>
        <div class="mount-prog"><i style="width:${Math.round(m.status.prog * 100)}%"></i></div>
        <div>${chkHtml}</div>
        <div style="font-size:11.5px;color:#8a4f1f"><b>鞍具材料：</b>${m.saddleText}</div>
        <div style="font-size:12px;color:#2c5a9a"><b>坐騎特性：</b>${m.perk}</div>
        <div>${actHtml}</div>
      </div>`;
    }).join('')}</div>`;
    root.querySelectorAll('[data-mid]').forEach(b => {
      b.onclick = () => {
        game.meta.p.mountId = b.dataset.mid; game.meta.save();
        if (game.mount) game.toggleMount(true);
        this.toggleInv(game);
        game.toggleMount();
      };
    });
    root.querySelectorAll('[data-craft-mid]').forEach(b => {
      b.onclick = () => {
        const res = unlockMountSaddle(game.meta.p, b.dataset.craftMid);
        if (!res.ok) { this.toast(res.reason || '鞍具材料不足', '#ff8a8a'); return; }
        game.meta.save(); game.audio.sfx('classup');
        this.toast(`🎉 馴養成功！獲得坐騎「${res.mount.icon} ${res.mount.name}」（按 G 鍵召喚）`, '#ffd85a');
        this.renderMounts(game);
      };
    });
  }
  openInvTab(game, tab) {
    const mapped = (tab === 'cosmetics' || tab === 'cos' || tab === 'mounts') ? 'style' : tab === 'gear' ? 'bag' : tab;
    this.atStash = (mapped === 'stash');
    this.invOpen = true;
    $('inv').classList.remove('hide');
    this.setInvTab(game, mapped);
  }
  renderSouls(game) {
    const root = $('soulsRoot'); if (!root) return;
    const s = ensureSouls(game.meta.p);
    const slotBar = Object.entries(SOUL_SLOTS).map(([slotKey, meta]) => {
      const eqId = s.equipped[slotKey], eqDef = eqId ? MONSTER_SOULS[eqId] : null;
      return `<div class="soul-card ${eqDef ? 'on' : ''}">
        <div><b>${meta.icon} ${meta.name}</b> <small style="color:#4e2e20">（${meta.desc}）</small></div>
        ${eqDef ? `<div><b style="color:${eqDef.color};text-shadow:0 1px 0 #2b1d22">${eqDef.icon} ${eqDef.name} — ${eqDef.title}</b><div style="font-size:12px;margin-top:3px">${eqDef.desc}</div></div>
          <button type="button" class="btn small" data-unequip-soul="${slotKey}">卸下靈魂</button>`
          : '<div style="color:#4e2e20;font-size:12px">尚未鑲嵌靈魂（擊敗魔物吸收後點擊下方卡片即可鑲嵌）</div>'}
      </div>`;
    }).join('');
    const cards = Object.values(MONSTER_SOULS).map(def => {
      const owned = s.owned.includes(def.id);
      const isEq = s.equipped[def.slot] === def.id;
      const st = owned ? soulTier(game.meta.p, def.id) : null;
      const starLine = st ? `<span style="color:#b86b08;font-weight:900">${'★'.repeat(st.tier)}${'☆'.repeat(5 - st.tier)}</span> <small style="color:#4e2e20">${st.nextNeed ? `碎片 ${st.shards}/${st.nextNeed}` : '滿階覺醒 ×2.2'}</small>` : '';
      return `<div class="soul-card ${isEq ? 'on' : ''} ${owned ? '' : 'locked'}">
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:26px">${def.icon}</span><div><b>${def.name}</b><div style="font-size:11px;color:#4e2e20">${SOUL_SLOTS[def.slot].icon} ${SOUL_SLOTS[def.slot].name} ${starLine}</div></div></div>
        <div style="font-size:12px;color:#3b2218"><b>${def.title}</b>：${def.desc}</div>
        <div>${isEq ? '<span style="color:#ffe89a;font-weight:900">✔ 鑲嵌生效中</span>' : owned ? `<button type="button" class="btn small" data-equip-soul="${def.id}">鑲嵌至${SOUL_SLOTS[def.slot].name}</button>` : '<span style="font-size:12px;color:#5a3826">🔒 擊敗對應魔物吸收取得</span>'}</div>
      </div>`;
    }).join('');
    root.innerHTML = `<div style="margin-bottom:8px;font-size:13px;color:#5a3826">「怪物即技能」青魔道士系統：擊敗魔物機率吸收靈魂，鑲嵌後直接改造你的移動或攻擊模組！（已收集 <b>${s.owned.length}/${Object.keys(MONSTER_SOULS).length}</b>）</div>
      <div class="soul-grid" style="margin-bottom:12px">${slotBar}</div>
      <div class="soul-grid">${cards}</div>`;
    root.querySelectorAll('[data-equip-soul]').forEach(b => b.onclick = () => {
      if (equipSoul(game.meta.p, b.dataset.equipSoul)) {
        game.meta.save(); game.recalc(); game.audio.sfx('classup');
        const def = MONSTER_SOULS[b.dataset.equipSoul];
        this.toast(`👻 已鑲嵌 ${def.icon} ${def.name}（${def.title}）`, '#d8a8ff');
        this.renderSouls(game);
      }
    });
    root.querySelectorAll('[data-unequip-soul]').forEach(b => b.onclick = () => {
      if (unequipSoul(game.meta.p, b.dataset.unequipSoul)) { game.meta.save(); game.recalc(); game.audio.sfx('ui'); this.renderSouls(game); }
    });
  }
  renderAtlas(game) {
    const root = $('atlasRoot'); if (!root) return;
    const p = game.meta.p, a = ensureAtlas(p), sum = computeAtlasSummary(a);
    const ws = getWeeklySpireInfo();
    const lhPts = p.lighthousePts || 0, lhTitle = getLighthouseTitle(lhPts);
    const mentorOn = !!p.mentorOn, mentorOk = (p.level || 1) >= 10 || game.dev?.on;
    const mmoStrip = `<div class="atlas-bar" style="background:rgba(78,138,126,.14);border-color:#4e8a7e;margin-bottom:8px;flex-wrap:wrap;gap:6px">
      <div><b>🗼 每週無盡星穹塔</b> · ${ws.theme.name}（種子 #${ws.seed} · ${ws.resetInHours}h 後重置）<br><small>${ws.theme.desc}</small></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="btn small" id="btnRunSpire" style="background:#7a4ac0">🗼 挑戰本週星穹塔</button>
        <button type="button" class="btn small ${mentorOn ? 'on' : ''}" id="btnMentor" ${mentorOk ? '' : 'disabled'} title="Lv.10 解鎖：老帶新動態壓等並獲得暖心徽章">${mentorOn ? '🏮 導師開啟中' : mentorOk ? '🏮 提燈導師' : '🔒 Lv.10 導師'}</button>
      </div>
    </div>
    <div class="atlas-bar" style="background:rgba(255,216,90,.14);border-color:#c99228;margin-bottom:10px;flex-wrap:wrap;gap:6px">
      <div><b>✨ 全服星燈光網建設</b> · 貢獻 <b>${lhPts}</b> 點 · 稱號：<b>${lhTitle}</b>（暖心徽章 ${p.mentorBadges || 0}）</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <button type="button" class="btn small" data-lh="wood" ${(p.goods?.wood || 0) >= 2 ? '' : 'disabled'}>🪵 捐木×2</button>
        <button type="button" class="btn small" data-lh="ore" ${(p.goods?.ore || 0) >= 2 ? '' : 'disabled'}>⛏️ 捐礦×2</button>
        <button type="button" class="btn small" data-lh="fish" ${(p.goods?.fish || 0) >= 2 ? '' : 'disabled'}>🐟 捐魚×2</button>
      </div>
    </div>`;
    const cost = atlasCraftCost(a);
    const canAffordAtlas = game.dev?.on || cost.isFree || ((p.coins || 0) >= cost.coins && (p.shards || 0) >= cost.shards);
    const costLabel = cost.isFree ? '免費入場 · 6 門' : `🪙${cost.coins} ✦${cost.shards} · 6 門`;
    const summaryBar = `<div class="atlas-bar">
      <div><b>${sum.dangerLabel}</b> · 密度 <b>×${sum.densityMult}</b> · 星砂 <b>×${sum.shardMult}</b> · 掉寶 <b>+${Math.round(sum.lootBonus * 100)}%</b> · 靈魂掉率 <b>×${sum.soulDropMult}</b></div>
      <button type="button" class="btn small" id="btnRunAtlas" style="background:#e8734a" ${canAffordAtlas ? '' : 'disabled'}>⛩ 鑄造秘石開啟（${costLabel}）</button>
    </div>`;
    const densCards = DENSITY_TIERS.map(d => `<div class="atlas-card ${a.density === d.id ? 'on' : ''}">
      <div><b>${d.icon} ${d.name}</b> <small>（密度 ×${d.densityMult}）</small></div>
      <div style="font-size:13.5px">${d.desc}</div>
      <button type="button" class="btn small ${a.density === d.id ? 'on' : ''}" data-atlas-dens="${d.id}">${a.density === d.id ? '✔ 已選用' : '套用此密度'}</button>
    </div>`).join('');
    const mechCards = LEAGUE_MECHANICS.map(m => {
      const on = a.mechanics.includes(m.id);
      return `<div class="atlas-card ${on ? 'on' : ''}">
        <div><b>${m.icon} ${m.name}</b> <small style="color:#b8452f">+${Math.round(m.shardBonus * 100)}% 星砂</small></div>
        <div style="font-size:13.5px">${m.desc}</div>
        <button type="button" class="btn small ${on ? 'on' : ''}" data-atlas-mech="${m.id}">${on ? '✔ 疊加中（點此關閉）' : '+ 疊加此賽季機制'}</button>
      </div>`;
    }).join('');
    root.innerHTML = `${mmoStrip}<div style="margin-bottom:6px;font-size:13px;color:#5a3826">自由設計你的「刷寶印鈔機」副本！所有設定會即時套用於逐層副本的怪物密度、賽季事件、腐化掉落與雙王試煉。</div>
      ${summaryBar}<h3>1. 選擇怪物密度</h3><div class="atlas-grid" style="margin-bottom:12px">${densCards}</div>
      <h3>2. 自由疊加賽季機制（可複選）</h3><div class="atlas-grid">${mechCards}</div>`;
    root.querySelectorAll('.atlas-card').forEach(card => {
      const db = card.querySelector('[data-atlas-dens]');
      const mb = card.querySelector('[data-atlas-mech]');
      if (db) card.onclick = () => { setAtlasDensity(game.meta.p, db.dataset.atlasDens); game.meta.save(); game.audio.sfx('ui'); this.renderAtlas(game); };
      if (mb) card.onclick = () => { toggleAtlasMechanic(game.meta.p, mb.dataset.atlasMech); game.meta.save(); game.audio.sfx('ui'); this.renderAtlas(game); };
    });
    const runBtn = $('btnRunAtlas');
    if (runBtn) runBtn.onclick = () => {
      if (!cost.isFree && !game.dev?.on) {
        if ((p.coins || 0) < cost.coins || (p.shards || 0) < cost.shards) { this.toast('金幣或星砂不足以鑄造此異界秘石', '#ff9a8a'); return; }
        p.coins -= cost.coins; p.shards -= cost.shards; game.meta.save();
      }
      this.toggleInv(game); game.state = 'transition'; game.audio.sfx('warp'); this.wipe(() => game.startRun());
    };
    const spireBtn = $('btnRunSpire');
    if (spireBtn) spireBtn.onclick = () => {
      if (!isFeatureEnabled(game.features, 'weeklySpire')) { this.toast('⚠️ 伺服器維護中：每週星穹塔暫時關閉', '#ff9a8a'); return; }
      this.toggleInv(game); game.state = 'transition'; game.audio.sfx('warp'); this.wipe(() => game.startRun({ weeklySeed: ws.seed }));
    };
    const mBtn = $('btnMentor');
    if (mBtn) mBtn.onclick = () => {
      if (!mentorOk) return;
      p.mentorOn = !p.mentorOn; game.meta.save(); game.audio.sfx('ui');
      this.toast(p.mentorOn ? '🏮 已開啟提燈導師！低等區自動壓等，擊殺精英可得暖心徽章' : '已關閉提燈導師模式', '#ffd85a');
      this.renderAtlas(game);
    };
    root.querySelectorAll('[data-lh]').forEach(b => b.onclick = () => {
      const res = contributeLighthouse(p, b.dataset.lh, 2);
      if (res.ok) {
        game.meta.save(); game.audio.sfx('pickup');
        this.toast(`✨ 已捐獻星燈光網！光網進度 +${res.ptsGain} · 星砂 +${res.ptsGain}（稱號：${res.title}）`, '#ffd85a');
        this.renderAtlas(game);
      }
    });
  }
  setInvTab(game, tab) {
    if (tab === 'gear') tab = 'bag';
    if (tab === 'mounts' || tab === 'cos' || tab === 'cosmetics') tab = 'style';
    if (tab === 'stash' && !this.atStash) tab = 'bag';
    this.invTab = tab;
    const stBtn = document.querySelector('[data-invtab="stash"]');
    if (stBtn) stBtn.style.display = this.atStash ? '' : 'none';
    document.querySelectorAll('[data-invtab]').forEach(button => {
      const selected = button.dataset.invtab === tab;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    ['bag', 'souls', 'atlas', 'style', 'stash'].forEach(k => {
      const pane = $('pane-' + k);
      if (pane) pane.classList.toggle('hide', k !== tab);
    });
    if (tab === 'bag') { this.syncPhysBags(game); this.renderBagEquipStrip(game); this.renderInv(game, true); }
    if (tab === 'stash') this.syncPhysBags(game);
    if (tab === 'souls') this.renderSouls(game);
    if (tab === 'atlas') this.renderAtlas(game);
    if (tab === 'style') { this.renderMounts(game); this.renderCosmetics(game); }
  }
  refreshLanguage(game) {
    const lang = game.settings?.lang || 'zh-TW';
    const bi = $('bagSelInfo'); if (bi && !this.bagPhys?.selectedUid) bi.textContent = t(lang, 'bagEmpty');
    if (this.invOpen && this.invTab === 'bag') this.renderInv(game, true);
  }
  syncPhysBags(game) {
    const st = ensurePhysicsStorage(game.meta.p);
    this.bagPhys?.sync(st.bag);
    this.stashPhys?.sync(st.stash);
    const bc = $('bagCount'); if (bc) bc.textContent = String(st.bag.reduce((n, x) => n + (x.qty || 1), 0));
    for (const [id, items] of [['bagItemPicker', st.bag], ['stashItemPicker', st.stash]]) {
      const picker = $(id);
      const selected = picker.value;
      picker.replaceChildren(new Option(t(game.settings?.lang, items.length ? 'chooseItem' : 'noItems'), ''));
      for (const item of items) picker.add(new Option(item.name || '物品', String(item.uid)));
      if (items.some(item => String(item.uid) === selected)) picker.value = selected;
      else if (selected) picker.dispatchEvent(new Event('change'));
      picker.disabled = items.length === 0;
    }
  }
  renderCosmetics(game) {
    const root = $('cosmeticsRoot'); if (!root) return;
    const p = game.meta.p; p.cosmetics = p.cosmetics || { hat: 'hood', back: 'none', aura: 'none' };
    const section = (title, key, list) => `<h3>${title}</h3><div class="cos-grid">${list.map(c =>
      `<button type="button" class="cos-btn ${p.cosmetics[key] === c.id ? 'on' : ''}" data-ckey="${key}" data-cid="${c.id}"><div style="font-size:22px">${c.icon}</div><div>${c.name}</div></button>`
    ).join('')}</div>`;
    root.innerHTML = `<div style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 10px;background:rgba(255,216,90,.16);border:2px solid #c99228;border-radius:8px">
      <span style="font-size:13px;font-weight:800;color:#5a3822">✨ 自由混搭 36 組可愛立體服飾、髮型、瞳色與武器</span>
      <button type="button" class="btn small" id="btnOpen3DWardrobe" style="background:#5a78b8">🪞 開啟 3D 木屋換裝工坊</button>
    </div>` + section('🎩 帽子與頭飾', 'hat', COSMETICS.hats) + section('🎒 背飾與羽翼', 'back', COSMETICS.backs) + section('✨ 提燈與武器光效', 'aura', COSMETICS.auras);
    const w3d = $('btnOpen3DWardrobe');
    if (w3d) w3d.onclick = () => { this.toggleInv(game); game.ui.openWardrobe3D?.(); };
    root.querySelectorAll('.cos-btn').forEach(b => {
      b.onclick = () => {
        p.cosmetics[b.dataset.ckey] = b.dataset.cid;
        game.meta.save();
        applyCosmetics(game.player.m, p.cosmetics);
        game.audio.sfx('pickup');
        this.renderCosmetics(game);
      };
    });
  }
  netStatus(s) {
    const el = $('netStat');
    if (s.ok) { el.textContent = '● 線上'; el.className = 'net on'; el.classList.remove('hide'); }
    else if (s.reason === 'no-server' || s.reason === 'idle') { el.classList.add('hide'); }
    else { el.textContent = '○ 連線中斷'; el.className = 'net off'; el.classList.remove('hide'); if (s.reason === 'closed') this.addChat('', '與伺服器的連線中斷了', true); }
  }
  setOnline(n) {
    const { ok, shard } = this.game.net;
    $('onlineN').textContent = !ok ? '離線' : shard ? `${shard.number} 線 · ${shard.count ?? 1} 人` : `線上 ${n} 人`;
  }
  openSimInspect(game, adv) {
    if (!adv) return;
    this.simInspectOpen = true;
    const modal = $('simInspectModal'), title = $('simInspTitle'), body = $('simInspBody');
    if (!modal || !body) return;
    const d = adv.def, tk = adv.task;
    const pct = tk ? Math.round((tk.have / Math.max(1, tk.need)) * 100) : 0;
    if (title) title.textContent = `${d.name} · Lv.${d.lv}`;
    body.innerHTML = `<div class="pitem" style="margin:6px 0">
      <b>[${d.title}] ${d.name}</b> <small>&lt;${d.guild}&gt;</small>
      <div class="mod">職業：${d.job}（${d.role === 'melee' ? '近戰前排' : '遠程輸出'}）</div>
      <div class="spc">招牌裝備：${d.gear}</div>
    </div>
    <div class="sim-meta-grid">
      <div class="sim-meta-cell"><small>戰鬥力評分</small><b>⚔️ ${d.cp} CP</b></div>
      <div class="sim-meta-cell"><small>已完成委託</small><b>📜 ${adv.tasksDone || 0} 個${adv.squadId ? ` · 小隊 #${adv.squadId}` : ''}</b></div>
    </div>
    ${tk ? `<div class="prow" style="margin:6px 0;flex-direction:column;align-items:stretch;gap:4px">
      <div><b>${tk.icon} 進行中任務：${tk.name}</b> <small>（${tk.have}/${tk.need}）</small></div>
      <div class="pbar" style="width:100%"><i style="width:${pct}%"></i></div>
    </div>` : ''}
    <div class="sim-actions">
      <button type="button" class="btn small" id="simActWave">👋 打招呼</button>
      <button type="button" class="btn small ${adv.following ? 'on' : ''}" id="simActFollow">${adv.following ? '✔ 跟隨中' : '👥 邀請同行'}</button>
      <button type="button" class="btn small" id="simActAssist">🤝 協助任務</button>
    </div>`;
    modal.classList.remove('hide');
    const bW = $('simActWave'), bF = $('simActFollow'), bA = $('simActAssist');
    if (bW) bW.onclick = () => {
      adv.hopT = 0.45;
      adv.f = Math.atan2(game.player.pos.x - adv.x, game.player.pos.z - adv.z);
      const reply = d.lines[Math.floor(Math.random() * d.lines.length)];
      if (adv.bub) { adv.bub.textContent = `👋 ${reply}`; adv.sayT = 4.5; }
      this.addChat(`[${d.guild}] ${d.name}`, `👋 嗨 ${game.playerName || '旅人'}！${reply}`, false, 'world');
      game.audio?.sfx?.('emote');
    };
    if (bF) bF.onclick = () => {
      adv.following = !adv.following;
      adv.hopT = 0.45;
      if (adv.bub) { adv.bub.textContent = adv.following ? '👥 收到！我跟著你一起冒險！' : '👋 好的，我先自由探索囉～'; adv.sayT = 4.2; }
      this.toast(adv.following ? `👥 ${d.name} 已加入同行跟隨！` : `已讓 ${d.name} 恢復自由行動`, adv.following ? '#7fe08a' : '#ffe08a');
      game.audio?.sfx?.('ui');
      this.openSimInspect(game, adv);
    };
    if (bA) bA.onclick = () => {
      assistSimTask(game, adv);
      this.openSimInspect(game, adv);
    };
  }
  closeSimInspect() { this.simInspectOpen = false; $('simInspectModal')?.classList.add('hide'); }
  toggleSimRoster(game, force) {
    this.simRosterOpen = typeof force === 'boolean' ? force : !this.simRosterOpen;
    const modal = $('simRosterModal');
    if (!modal) return;
    modal.classList.toggle('hide', !this.simRosterOpen);
    if (this.simRosterOpen) this.renderSimRoster(game);
  }
  closeSimRoster() { this.simRosterOpen = false; $('simRosterModal')?.classList.add('hide'); }
  renderSimRoster(game) {
    const raw = game.interior ? [] : getSimAdventurers(game);
    const count = getSimConfig(game).count ?? DEFAULT_SIM_COUNT;
    const pPos = game.player?.pos || { x: 0, z: 0 };
    const sorted = raw.map((a, idx) => ({ a, idx, dist: Math.round(Math.hypot(a.x - pPos.x, a.z - pPos.z)) })).sort((u, v) => u.dist - v.dist);
    const title = $('simRosterTitle'), ctrl = $('simRosterCtrl'), box = $('simRosterList');
    if (title) title.textContent = `虛擬冒險者 · 本區 ${raw.length} 人`;
    if (ctrl) {
      const counts = [0, 12, 24, 36, 48];
      ctrl.innerHTML = `<span style="font-size:12px;font-weight:700">每區人數</span>`
        + counts.map(n => `<button type="button" class="btn small ${count === n ? 'on' : ''}" data-sim-n="${n}">${n === 0 ? '關閉' : n + '人'}</button>`).join('')
        + `<button type="button" class="btn small" data-sim-ev="enhance_wave">✨ 強化金光</button>`
        + `<button type="button" class="btn small" data-sim-ev="wave_me">👋 附近靠攏</button>`;
      ctrl.querySelectorAll('[data-sim-n]').forEach(b => b.onclick = () => {
        setSimConfig(game, { count: Number(b.dataset.simN) });
        this.renderSimRoster(game);
      });
      ctrl.querySelectorAll('[data-sim-ev]').forEach(b => b.onclick = () => {
        triggerSimEvent(game, b.dataset.simEv);
        this.closeSimRoster();
      });
    }
    if (box) {
      if (!sorted.length) {
        box.textContent = count === 0 ? '虛擬 MMO 已關閉。' : '虛擬冒險者會在城鎮和野外出現。';
      } else {
        box.innerHTML = sorted.map(({ a, idx, dist }) => `<div class="prow">
          <div class="pl"><b>${a.def.name}</b> <small>Lv.${a.def.lv} · ${a.def.job} · &lt;${a.def.guild}&gt; · 距 ${dist}m</small><br><small>${a.activity}${a.following ? ' · 💚跟隨中' : ''}</small></div>
          <div style="display:flex;gap:4px">
            <button type="button" class="btn small" data-ros-go="${idx}" title="瞬移至該冒險者旁巡視其任務">⚡ 旁觀</button>
            <button type="button" class="btn small" data-ros-insp="${idx}">檢視</button>
            <button type="button" class="btn small ${a.following ? 'on' : ''}" data-ros-fol="${idx}">${a.following ? '✔同行' : '同行'}</button>
          </div>
        </div>`).join('');
        box.querySelectorAll('[data-ros-go]').forEach(b => b.onclick = () => {
          const a = raw[Number(b.dataset.rosGo)];
          if (!a || !game.player) return;
          const tx = a.x + 2.2, tz = a.z + 2.2;
          const y = game.world?.isLand(tx, tz) ? game.world.gh(tx, tz) : a.y;
          game.player.pos.set(tx, y, tz); game.player.y = y;
          game.audio?.sfx?.('warp');
          this.toast(`⚡ 已瞬移至 ${a.def.name} 身旁（${a.activity}）`, '#48f0c8');
          this.closeSimRoster();
        });
        box.querySelectorAll('[data-ros-insp]').forEach(b => b.onclick = () => {
          const a = raw[Number(b.dataset.rosInsp)];
          this.closeSimRoster(); this.openSimInspect(game, a);
        });
        box.querySelectorAll('[data-ros-fol]').forEach(b => b.onclick = () => {
          const a = raw[Number(b.dataset.rosFol)];
          if (!a) return;
          a.following = !a.following; a.hopT = 0.4;
          this.renderSimRoster(game);
        });
      }
    }
  }
  addChat(name, text, sys, zone) {
    const log = $('chatLog'); const d = document.createElement('div'); d.className = 'cl' + (sys ? ' sys' : '');
    if (sys) d.textContent = text; else { const b = document.createElement('b'); b.textContent = name + '：'; d.append(b, document.createTextNode(text)); }
    log.appendChild(d); while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = 1e6;
    setTimeout(() => d.classList.add('old'), 12000);
  }
  focusChat() { const i = $('chatIn'); i.classList.remove('hide'); i.focus(); $('chatLog').classList.add('open'); return true; }
  chatKey(e) {
    if (e.isComposing) return;
    this.finishChat(e.code === 'Enter');
    e.preventDefault();
  }
  finishChat(send) {
    const i = $('chatIn');
    if (send) {
      const message = i.value.trim();
      i.value = '';
      if (message) this.game.sendChat(message);
    }
    i.blur(); i.classList.add('hide'); $('chatLog').classList.remove('open');
  }
  screenPos(x, y, z) {
    v3.set(x, y, z).project(this.game.camera);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
  }
  clearDamageNumbers() {
    for (const number of this.nums) number.el.remove();
    this.nums.length = 0;
  }
  dmgNum(x, y, z, val, cls) {
    if (this.game && this.game.settings && !this.game.settings.dmg) return;
    const el = document.createElement('div');
    el.className = 'num ' + (cls || '');
    el.textContent = cls === 'crit' ? `${val}!` : val;
    $('nums').appendChild(el);
    this.nums.push({ el, x: x + (Math.random() - 0.5) * 0.6, y, z, t: 0 });
  }
  toast(text, color = '#fff') {
    const box = $('toasts');
    if (!box) return;
    this.toastQueue ||= [];
    if ([...box.children].some(el => el.textContent === text) ||
      this.toastQueue.some(item => item.text === text)) return;
    if (this.toastQueue.length >= 4) this.toastQueue.shift();
    this.toastQueue.push({ text, color });
    this.flushToasts(box);
  }

  flushToasts(box) {
    while (box.children.length < 2 && this.toastQueue.length) {
      const { text, color } = this.toastQueue.shift();
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = text;
      el.style.setProperty('--toast-tone', color);
      box.appendChild(el);
      setTimeout(() => { el.remove(); this.flushToasts(box); }, Math.min(5500, 2800 + text.length * 32));
    }
  }
  banner(title, sub) {
    const b = $('banner'); b.querySelector('h2').textContent = title; b.querySelector('p').textContent = sub;
    const bossOn = !$('boss')?.classList.contains('hide');
    b.style.top = bossOn ? '23%' : '13%';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  bossBar(on, name, frac, parts) {
    const b = $('boss'); b.classList.toggle('hide', !on);
    if (name) b.querySelector('.name').textContent = name;
    if (frac !== undefined) b.querySelector('.fill').style.width = (Math.max(0, frac) * 100) + '%';
    const bp = b.querySelector('.bparts');
    if (bp && parts) {
      const html = parts.map(pt => {
        const pct = Math.ceil(pt.hp / pt.maxHp * 100);
        const cls = pt.broken ? ' brk' : pct <= 35 ? ' crit' : '';
        return `<span class="epart${cls}" style="font-size:11px;padding:1px 6px">${pt.icon} ${pt.name} ${pt.broken ? '✂️已斷' : pct + '%'}</span>`;
      }).join('');
      if (bp._last !== html) { bp.innerHTML = html; bp._last = html; }
    }
  }
  wipe(mid) {
    const w = $('wipe'); w.classList.add('in');
    setTimeout(() => { mid(); w.classList.remove('in'); }, 450);
  }
  exitHint(g) {
    const el = $('exitHint');
    if ((g.exitCooldown || 0) > 0) { el.style.display = 'none'; return; }
    let near = null;
    for (const x of g.exits) if (x.on && Math.hypot(g.player.pos.x - x.x, g.player.pos.z - x.z) < 5) near = x;
    if (!near || (g.field === 1 && near.type === 'dungeon')) { el.style.display = 'none'; return; }
    const [sx, sy] = this.screenPos(near.x, 4.4, near.z);
    el.style.display = 'block'; el.style.left = sx + 'px'; el.style.top = sy + 'px';
    const nextF = FIELDS[(g.field || 1) + 1];
    const prevF = FIELDS[(g.field || 1) - 1];
    el.textContent = {
      item: '前路：稀有裝備', boon: '前路：天賦祝福', heal: '前路：溫泉休憩',
      run: '前往晨光草原（常駐普通地圖）', town: '返回燈谷鎮（免清怪）',
      prevField: prevF ? `返回上一區：${prevF.name}（Lv.${prevF.level}）` : '返回燈谷鎮',
      nextField: nextF ? `前往下一區：${nextF.name}（Lv.${nextF.level}）` : '返回海風港鎮',
      nextTower: `🗼 前往試煉之塔第 ${(g.towerFloor || 1) + 1} 層`,
      dungeon: '消耗 1 鑰石 · 進入副本地圖',
      caveReturn: '返回晨光草原',
    }[near.type] || '傳送門';
    if (near.type === 'dungeon' && FIELDS[g.field]) el.textContent = '【副本地圖】' + FIELDS[g.field].dungeon + ' · 鑰石 ×1';
    el.className = 'exitHint ' + near.type;
  }
  spotHint(g) {
    const el = $('spotHint'), s = this.panelOpen || this.invOpen || this.setOpen || this.puzzleOpen || g.sailing ? null : g.nearSpot();
    if (!s) { el.style.display = 'none'; return; }
    const [sx, sy] = this.screenPos(s.x, s.top || 2.6, s.z);
    el.style.display = 'block'; el.style.left = sx + 'px'; el.style.top = sy + 'px';
    el.textContent = s.kind === 'talk' ? `[F] 與 ${s.label} 交談` : `[F] ${s.label}`;
  }
  heirUI(g, id) {
    const box = $(id); box.innerHTML = '';
    const sh = g.bankedShards ?? 0;
    const info = document.createElement('div'); info.className = 'heirInfo';
    info.textContent = `星砂 +${sh}${g.lostShards ? `（陣亡損失 ${g.lostShards}）` : ''} · 挑一件裝備作為傳家寶，下次出發就帶著它：`; box.appendChild(info);
    const cur = g.meta.p.heirloom;
    for (const it of Object.values(g.player.equip)) if (it) {
      const b = document.createElement('button'); b.className = 'btn small heirBtn'; b.style.color = RARITY[it.rarity].color;
      b.textContent = it.name + (cur && cur.name === it.name ? ' ✔' : '');
      b.onclick = () => { g.meta.setHeirloom(it); g.audio.sfx('pickup'); this.heirUI(g, id); };
      box.appendChild(b);
    }
  }
  update(g) {
    const lang = g.settings?.lang || 'zh-TW';
    // 物理背包／倉庫 60fps 重力模擬
    if (this.invOpen) {
      if (this.invTab === 'bag' && this.bagPhys) { this.bagPhys.step(1 / 60); this.bagPhys.draw(); }
      if (this.invTab === 'stash' && this.stashPhys) { this.stashPhys.step(1 / 60); this.stashPhys.draw(); }
    }
    // 敵人頭頂動態血條與可破壞部位即時狀態（受損、精英、或具可破壞部位且在 16m 內的敵人）
    const ebRoot = $('enemyBars');
    if (ebRoot) {
      this._ebPool = this._ebPool || [];
      const showBars = g.state === 'play' && !g.interior && !this.invOpen && !this.puzzleOpen && !this.panelOpen && !this.setOpen;
      const pPos = g.player?.pos;
      const visibleEnemies = (showBars && pPos) ? g.enemies.filter(e => !e.dead && e.type !== 'stag' && ((e.state === 'rest' && e.t < e.chargeRecoveryS) || e.hp < e.maxHp || e.elite || (e.parts?.length && e.pos.distanceTo(pPos) < 9)) && e.pos.distanceTo(pPos) < 16).slice(0, 8) : [];
      for (let i = 0; i < visibleEnemies.length; i++) {
        const e = visibleEnemies[i];
        let node = this._ebPool[i];
        if (!node) {
          node = document.createElement('div');
          node.className = 'ebar';
          node.innerHTML = '<div class="ebar-recovery" hidden><span></span><i></i></div><div class="ebar-affix"></div><div class="ebar-parts"></div><div class="ebar-track"><div class="ebar-fill"></div></div>';
          ebRoot.appendChild(node);
          this._ebPool.push(node);
        }
        const [sx, sy] = this.screenPos(e.pos.x, (e.pos.y || 0) + (e.type === 'golem' ? 2.6 : 1.7) * (e.m?.root?.scale?.x || 1), e.pos.z);
        node.style.display = (sx < -40 || sx > innerWidth + 40 || sy < -40 || sy > innerHeight + 40) ? 'none' : 'flex';
        node.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-100%)`;
        node.className = 'ebar' + (e.elite ? ' elite' : '');
        node.querySelector('.ebar-fill').style.width = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100)) + '%';
        const recovery = node.firstElementChild;
        recovery.hidden = e.state !== 'rest' || !(e.t < e.chargeRecoveryS);
        if (!recovery.hidden) {
          const progress = Math.max(0, 1 - e.t / e.chargeRecoveryS);
          recovery.lastElementChild.style.transform = `scaleX(${progress})`;
        }
        const aEl = node.querySelector('.ebar-affix');
        const aHtml = e.eliteMod ? `<span class="eaffix">${e.eliteMod.name}</span>` : '';
        if (aEl._last !== aHtml) { aEl.innerHTML = aHtml; aEl._last = aHtml; }
        const pEl = node.querySelector('.ebar-parts');
        const showParts = e.parts?.length && (e.elite || e.hp < e.maxHp || e.pos.distanceTo(pPos) < 8);
        const pHtml = showParts ? e.parts.map(pt => {
          const pct = Math.ceil(pt.hp / pt.maxHp * 100);
          const cls = pt.broken ? ' brk' : pct <= 35 ? ' crit' : '';
          return `<span class="epart${cls}">${pt.icon}${pt.broken ? '已斷' : pct + '%'}</span>`;
        }).join('') : '';
        if (pEl._last !== pHtml) { pEl.innerHTML = pHtml; pEl._last = pHtml; }
      }
      for (let i = visibleEnemies.length; i < this._ebPool.length; i++) this._ebPool[i].style.display = 'none';
    }
    // floating numbers
    for (const n of this.nums) {
      n.t += 1 / 60;
      const [sx, sy] = this.screenPos(n.x, n.y + n.t * 1.6, n.z);
      n.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${n.t < 0.1 ? 1.4 : 1})`;
      n.el.style.opacity = n.t > 0.55 ? 1 - (n.t - 0.55) / 0.3 : 1;
      if (n.t > 0.85) n.el.remove();
    }
    this.nums = this.nums.filter(n => n.t <= 0.85);
    if (g.state === 'title') return;
    const p = g.player, S = p.stats;
    const st = p.statuses || {};
    if (this.status) this.status.update(g);
    $('hpText').textContent = `${Math.ceil(p.hp)}/${S.maxHp}`;
    $('mpText').textContent = `${Math.floor(p.mana)}/${S.mana}`;
    { const c0 = CLASSES[g.character?.job ?? 0] || CLASSES[0], c2 = findSecondClass(g.meta.p.secondClass), ic = (c2 || c0).icon;
      const ie = $('pcIcon'); if (ie && ie._v !== ic) { ie.textContent = ic; ie._v = ic; }
      const lv = $('pcLv'); if (lv) lv.textContent = g.meta.p.level;
      const nm = $('pcName'); const nv = g.character?.name || (c2 || c0).name; if (nm && nm._v !== nv) { nm.textContent = nv; nm._v = nv; }
      const cm = c0.classMech;
      if (cm) {
        const rl = $('pcResLabel'), rf = $('pcResFill'), rn = $('pcResNum');
        const cur = Math.round(p.classRes || 0);
        if (rl) rl.textContent = `${cm.icon} ${cm.name}`;
        if (rf) { rf.style.width = `${Math.min(100, (cur / cm.max) * 100)}%`; rf.style.background = cm.color; }
        if (rn) rn.textContent = `${cur}/${cm.max}`;
      } }
    const sbEl = $('statusBar');
    if (sbEl) {
      const lang = g.settings?.lang || 'zh-TW';
      const pills = [];
      if (st.poison > 0) pills.push(`<span class="st-pill st-poison">${t(lang, 'statusPoison')} ${Math.ceil(st.poison)}s</span>`);
      if (st.freeze > 0) pills.push(`<span class="st-pill st-freeze">${t(lang, 'statusFreeze')} ${st.freeze.toFixed(1)}s</span>`);
      else if (st.chill > 0) pills.push(`<span class="st-pill st-chill">${t(lang, 'statusChill')} ${Math.ceil(st.chill)}s</span>`);
      if (st.burn > 0) pills.push(`<span class="st-pill st-burn">${t(lang, 'statusBurn')} ${Math.ceil(st.burn)}s</span>`);
      if (st.shock > 0) pills.push(`<span class="st-pill st-shock">${t(lang, 'statusShock')} ${Math.ceil(st.shock)}s</span>`);
      if (st.overload > 0) pills.push(`<span class="st-pill st-overload">${t(lang, 'statusOverload')} ${Math.ceil(st.overload)}s</span>`);
      const sb = g.shrineBuffs || {};
      if (sb.fury > 0) pills.push(`<span class="st-pill st-buff-fury">🔥 狂暴 ${Math.ceil(sb.fury)}s</span>`);
      if (sb.frost > 0) pills.push(`<span class="st-pill st-buff-frost">❄️ 寒霜附魔 ${Math.ceil(sb.frost)}s</span>`);
      if (sb.gold > 0) pills.push(`<span class="st-pill st-buff-gold">💰 雙倍掉寶 ${Math.ceil(sb.gold)}s</span>`);
      if (sb.sheep > 0) pills.push(`<span class="st-pill st-buff-sheep">🐑 軟綿祝福 ${Math.ceil(sb.sheep)}s</span>`);
      if (p.galeBuff) pills.push(`<span class="st-pill st-buff-gold">💨 疾風強化 +60%</span>`);
      if ((g.autopilot?.sparkBuffT || 0) > 0 && g.autopilot?.mode === 'off') pills.push(`<span class="st-pill st-spark">✨ 歸來星火 ×1.5 (${Math.ceil(g.autopilot.sparkBuffT)}s)</span>`);
      if (p.realmRule) pills.push(`<span class="st-pill ${p.realmRule.pillClass || 'st-realm-sea'}">${p.realmRule.icon} ${p.realmRule.short}</span>`);
      if (p.terrainFx) pills.push(`<span class="st-pill ${p.terrainFx.pillClass || 'st-terrain-water'}">${p.terrainFx.icon} ${p.terrainFx.short}</span>`);
      const html = pills.join('');
      if (sbEl._last !== html) { sbEl.innerHTML = html; sbEl._last = html; }
    }
    const cd = (id, cur, max, locked) => {
      const el = $(id); if (!el) return;
      el.classList.toggle('locked', !!locked);
      const c = el.querySelector('.cd'); if (c) c.style.height = (max > 0 ? Math.min(1, cur / max) * 100 : 0) + '%';
    };
    const hotbar = p.hotbar || [];
    for (let i = 0; i < 4; i++) {
      const el = $('sk-s' + i); if (!el) continue;
      const sk = hotbar[i];
      const trialBolt = g.ambushTrial && i === 0 && !sk;
      el.hidden = !(sk || trialBolt);
      const ic = el.querySelector('.ic'), sn = el.querySelector('.sname'), sup = el.querySelector('.sup');
      if (trialBolt) {
        ic.textContent = '🔥'; sn.textContent = '餘燼彈'; sup.hidden = true; el.title = '餘燼彈';
        cd('sk-s0', p.cds.bolt, 0.78 / (1 + S.atkSpd / 200), p.mana < 8);
      } else if (sk) {
        ic.textContent = sk.def.icon; sn.textContent = sk.def.short;
        const sc = sk.mod.supports.length;
        sup.hidden = !sc; if (sc) sup.textContent = '+' + sc;
        el.title = `${sk.def.name}：${sk.def.desc}${sc ? '（連動輔助：' + sk.mod.supports.map(s => s.name).join('、') + '）' : ''}`;
        const maxCd = sk.def.cd * (1 - S.cdr / 100) * (1 - sk.mod.cdr);
        cd('sk-s' + i, p.skillCds?.[i] || 0, Math.max(0.1, maxCd), false);
      } else {
        ic.textContent = '+'; sn.textContent = t(lang, 'skEmpty'); sup.hidden = true; el.title = '點擊開啟技能拼圖 (K) 裝備技能';
        cd('sk-s' + i, 0, 1, true);
      }
    }
    $('sk-r').querySelector('.cnt').textContent = `${p.flask.charges}/${p.flask.max}`;
    $('sk-r').classList.toggle('locked', p.flask.charges === 0);
    $('sk-r').querySelector('.cd').style.height = (p.flask.charges >= p.flask.max ? 0 : (1 - p.flask.prog) * 100) + '%';
    // 回城吟唱進度條
    const rbar = $('recallBar');
    if (rbar) {
      rbar.classList.toggle('hide', !(g.recallT > 0));
      if (g.recallT > 0) {
        rbar.querySelector('.rtxt').textContent = '🐚 ' + t(g.settings?.lang, 'recallCast');
        rbar.querySelector('.rfill').style.width = ((1 - g.recallT / 2.5) * 100) + '%';
      }
    }
    const stage = Math.floor(g.depth / 3) + 1, room = g.depth % 3 + 1;
    $('roomInfo').textContent = g.raid ? '共鳴樹庭' : g.sailing ? '航行中'
      : g.interior ? (g.interior.kind === 'tavern' ? '楓的蘋果酒館' : '旅人小屋')
      : g.field ? g.biome.name : g.depth === -2 ? '海風港鎮' : g.depth < 0 ? '燈谷鎮'
      : g.caveRun ? `草原洞窟 · ${MEADOW_CAVE[g.caveRun.tier].name}`
      : g.depth === 9 ? '鹿王林地' : `副本 · ${stage}-${room}`;
    const dayEl = $('dayInfo'); if (dayEl) { const di = dayInfo(g.dayTime || 0.3); dayEl.textContent = `${di.icon} ${di.label}`; }
    if (this.regionMapOpen && g.time >= (this._nextMapDraw || 0)) {
      this._nextMapDraw = g.time + 0.12;
      this.refreshRegionMap();
    }
    $('killInfo').textContent = `${t(lang, 'kills')} ${p.kills}`;
    const th = $('tideHud');
    const svClock = $('svClock'), dv = $('dangerVig'), qt = $('questTracker'), wbEl = $('worldBossBanner');
    if (wbEl) {
      const showWb = !!(g.field && g.state === 'play' && !g.interior && !g.photoMode && g.worldBoss);
      wbEl.classList.toggle('hide', !showWb);
      if (showWb) {
        const wb = g.worldBoss;
        wbEl.classList.toggle('active', !!(wb.active && wb.enemy && !wb.enemy.dead));
        if (wb.active && wb.enemy && !wb.enemy.dead) {
          const hpPct = Math.max(1, Math.ceil((wb.enemy.hp / Math.max(1, wb.enemy.maxHp)) * 100));
          const dist = Math.round(Math.hypot(wb.enemy.pos.x - p.pos.x, wb.enemy.pos.z - p.pos.z));
          wbEl.textContent = `${wb.def.icon} ${wb.def.name} · HP ${hpPct}% · 距 ${dist}m`;
        } else {
          const sec = Math.max(0, Math.ceil(wb.timer || 0));
          wbEl.textContent = `📯 下隻野外世界王 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}（點擊立即召喚）`;
        }
      }
    }
    // ⚡ 野外動態奇遇追蹤條（FATEs）
    const deEl = $('dynEventBanner');
    if (deEl) {
      const showDe = !!(g.field && g.state === 'play' && !g.interior && !g.photoMode && g.dynEvent);
      deEl.classList.toggle('hide', !showDe);
      if (showDe) {
        const de = g.dynEvent;
        deEl.classList.toggle('active', !!de.active);
        if (de.active && de.def) {
          const rem = Math.max(0, Math.ceil(de.timeLeft || 0));
          deEl.textContent = `${de.def.icon} ${de.def.name} · 進度 ${de.killed}/${de.total} · 剩 ${rem}s`;
        } else {
          const cdSec = Math.max(0, Math.ceil(de.timer || 0));
          deEl.textContent = `⚡ 野外奇遇倒數 ${Math.floor(cdSec / 60)}:${String(cdSec % 60).padStart(2, '0')}（點擊立即觸發）`;
        }
      }
    }
    // 👥 左側 MMORPG 3 人小隊狀態框架
    const phEl = $('partyHud');
    if (phEl) {
      const pids = getPartyIds(g.meta?.p);
      const showPh = !!(g.state === 'play' && !g.interior && !g.photoMode && pids.length > 0);
      phEl.classList.toggle('hide', !showPh);
      if (showPh) {
        const syn = getActivePartySynergy(g.meta?.p);
        const phKey = `${pids.join(',')}|${Math.ceil(p.hp)}/${S.maxHp}|${syn?.id || ''}`;
        if (phEl._lastKey !== phKey) {
          phEl._lastKey = phKey;
          const memHtml = pids.map(cid => {
            const cd = AI_COMPANIONS.find(c => c.id === cid);
            const bd = getCompanionBondInfo(g.meta?.p, cid);
            return `<div class="ph-row"><span>${cd?.icon || '👥'} ${cd?.name?.split(' · ')[0] || cid}</span><b style="color:#7fe08a">絆Lv.${bd.lv}</b></div>`;
          }).join('');
          phEl.innerHTML = `<div class="ph-head"><span>👥 冒險小隊 (${pids.length + 1}/3)</span><span>⚔️${p.combatPower || 100}</span></div>` + memHtml + (syn ? `<div class="ph-syn">${syn.icon} ${syn.name}</div>` : '');
        }
      }
    }
    if (dv) dv.classList.toggle('on', !!(g.state === 'play' && g.depth >= 0 && p.stats?.maxHp > 0 && (p.hp / p.stats.maxHp) < 0.35));
    const activity = $('worldActivity');
    activity.hidden = g.state !== 'play' || !!g.photoMode;
    $('qtRank').textContent = `${p.advRank?.rank || 'F'}級 · ⚔️${p.combatPower || 100}`;
    const activityTitle = $('worldActivityTitle');
    const activityLabel = t(lang, g.worldBoss?.active ? 'worldBossLiving' : g.dynEvent?.active ? 'worldEventActive' : g.field ? 'worldActivity' : 'travelStatus');
    if (activityTitle.textContent !== activityLabel) activityTitle.textContent = activityLabel;
    if (qt) {
      const showQt = !!(g.state === 'play' && !g.interior && !g.photoMode);
      qt.classList.toggle('hide', !showQt);
      if (showQt) {
        const curCh = getCurrentChapter(g.meta?.p);
        const showExpedition = showExpeditionTracker(g);
        qt.disabled = !!g.caveRun || (!showExpedition && !curCh?.done);
        const qTi = $('qtTitle'), qDs = $('qtDesc'), qFl = $('qtFill');
        if (g.caveRun) {
          const cave = MEADOW_CAVE[g.caveRun.tier];
          const stage = g.caveRun.stage;
          qt.classList.toggle('done', g.cleared);
          qt.dataset.stage = 'cave';
          qt.title = '';
          qTi.textContent = `草原洞窟 · ${cave.name}`;
          qDs.textContent = g.cleared ? '通關 · 前往返程門' : `${stage + 1}/${cave.stages.length} · ${cave.stages[stage].name}`;
          qFl.style.width = `${g.cleared ? 100 : stage * 100 / cave.stages.length}%`;
        } else if (showExpedition) {
          const { active } = meadowExpedition(g.meta.p);
          const stage = meadowStage(active);
          const def = MEADOW_TIERS[active?.tier || 1];
          const route = active && expeditionRoute(active.tier, active.route);
          qt.classList.toggle('done', stage === 'reward');
          qt.title = def.name;
          qt.dataset.stage = stage;
          qTi.textContent = stage === 'reward' ? '遠征獎勵' : '區域遠征';
          qDs.textContent = stage === 'choose' ? '選擇清剿前哨或重燃路燈'
            : g.field !== def.field && stage !== 'reward' ? `前往${FIELDS[def.field].name}`
            : stage === 'route' ? `${route.title} · ${active.completed.length}/${route.need}`
            : stage === 'champion' ? `討伐${def.champion}` : '選一顆寶石並領取鑰石';
          qFl.style.width = stage === 'route' ? `${(active.completed.length / route.need) * 65}%`
            : stage === 'champion' ? '65%' : stage === 'reward' ? '100%' : '0%';
        } else if (curCh) {
          qt.title = '';
          qt.dataset.stage = 'story';
          qt.classList.toggle('done', !!curCh.done);
          if (qTi) qTi.textContent = curCh.done ? `✨ 點擊領獎：${curCh.def.title}` : `📜 ${curCh.def.title}`;
          if (qDs) qDs.textContent = `${curCh.def.desc}（${curCh.have}/${curCh.def.need}）`;
          if (qFl) qFl.style.width = `${Math.min(100, (curCh.have / Math.max(1, curCh.def.need)) * 100)}%`;
        } else {
          qt.title = '';
          qt.dataset.stage = 'complete';
          qt.classList.remove('done');
          if (qTi) qTi.textContent = '👑 主線全章節通關';
          if (qDs) qDs.textContent = `目標：挑戰高危星穹島嶼、衝裝 +10 與 S 級冒險者！`;
          if (qFl) qFl.style.width = '100%';
        }
      }
    }
    $('quickTideUlt').hidden = !(g.field && g.state === 'play' && !g.interior && !g.photoMode && g.tide?.ultCharge >= 100);
    if (th) {
      const td = g.tide;
      const showTide = !!(g.field && g.state === 'play' && !g.interior && td);
      th.classList.toggle('hide', !showTide);
      if (svClock) svClock.classList.toggle('hide', !showTide);
      if (showTide) {
        if (td.sv) {
          const s = Math.floor(td.sv.survivalSec || 0);
          const tmEl = $('scTime');
          if (tmEl) tmEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
          const esc = getEscalationProfile(s);
          const stgEl = $('scStage');
          if (stgEl) stgEl.textContent = esc.label;
          const cpEl = $('scCp');
          if (cpEl) cpEl.textContent = `⚔️ 戰力 ${p.combatPower || 100}`;
        }
        const ph = td.lullTimer > 0 ? { name: `🌿 潮退休整 ${Math.ceil(td.lullTimer)}s`, color: '#7fe08a' }
          : td.apexTimer > 0 ? { name: `🔥 熾炎巔峰 ${Math.ceil(td.apexTimer)}s`, color: '#ff5a68' }
          : (TIDE_PHASES[td.phase] || TIDE_PHASES[0]);
        const phEl = $('tdPhase');
        if (phEl) { phEl.textContent = (td.waveStreak > 1 ? `W${td.waveStreak} · ` : '') + ph.name; phEl.style.color = ph.color; }
        const mlEl = $('tdMult');
        if (mlEl) mlEl.textContent = `戰利品 ×${lootMultForTide(td, g.meta?.p)}`;
        const flEl = $('tdFill');
        if (flEl) {
          const pct = td.lullTimer > 0 ? (td.lullTimer / 25) * 100 : td.apexTimer > 0 ? (td.apexTimer / 35) * 100 : td.heat;
          flEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        }
        const sv = td.sv;
        if (sv) {
          const stEl = $('tdStreak');
          if (stEl) {
            const st = getKillStreakTier(sv.streakKills || 0);
            stEl.textContent = sv.streakKills >= 10 ? `${st.label || '連殺'} ${sv.streakKills}` : (sv.curseStacks ? `👁 詛咒 ×${sv.curseStacks}` : '');
            stEl.style.color = st.color || '#ffd85a';
          }
          const spEl = $('tdSpoils');
          if (spEl) {
            const hasSp = (sv.spoils?.coins || 0) > 0 || (sv.spoils?.shards || 0) > 0;
            const spHtml = hasSp ? `<span>🎒 戰利品袋：🪙${Math.round(sv.spoils.coins)} 💎${Math.round(sv.spoils.shards)}</span><span>陣亡掉一半</span>` : '';
            if (spEl._last !== spHtml) { spEl.innerHTML = spHtml; spEl._last = spHtml; }
          }
        }
        const u = ULTIMATES[td.ultIndex % ULTIMATES.length];
        const ub = $('btnTideUlt');
        if (ub) {
          const ready = td.ultCharge >= 100;
          ub.classList.toggle('ready', ready);
          ub.textContent = `${u.icon} [V] ${u.name} ${ready ? 'READY!' : Math.floor(td.ultCharge) + '%'}`;
        }
        const bf = $('tdBuffs');
        if (bf) {
          const html = MICRO_BUFFS.filter(b => (td.microBuffs?.[b.id] || 0) > 0)
            .map(b => `<span class="td-b">${b.icon} ${b.name} ${Math.ceil(td.microBuffs[b.id])}s</span>`).join('');
          if (bf._last !== html) { bf.innerHTML = html; bf._last = html; }
        }
      }
    }
    // 🏮 提燈自動巡遊 HUD 戰報卡片與快捷鍵亮燈
    const ah = $('autoHud');
    const ap = g.autopilot;
    const autoOn = !!(ap && ap.mode !== 'off' && g.state === 'play');
    $('apStop').hidden = !autoOn || !!g.photoMode;
    const skAuto = $('sk-auto');
    if (skAuto) skAuto.classList.toggle('on', autoOn);
    if (ah) {
      ah.classList.toggle('hide', !autoOn);
      if (autoOn) {
        const secFloor = Math.floor(ap.stats.sec);
        const key = `${ap.mode}|${ap.cozyActive}|${secFloor}|${ap.stats.kills}|${ap.stats.xp}|${ap.stats.coins}|${ap.stats.shards}|${ap.sparkStacks}|${ap.autoSalvage}|${ap.cozyCam}`;
        if (ah._lastKey !== key) {
          ah._lastKey = key;
          const mins = Math.floor(secFloor / 60), secs = secFloor % 60;
          const am = $('apMode'); if (am) am.textContent = ap.mode === 'full' ? (ap.cozyActive ? '🎥 桌寵巡遊 (30%)' : '🏮 全自動巡遊 (30%)') : '🏮 半自動輔助 (30%)';
          const at = $('apTime'); if (at) at.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          const as = $('apStats');
          if (as) as.innerHTML = `<span>⚔️ 擊殺 ${ap.stats.kills}</span><span>✨ 經驗 +${ap.stats.xp}</span><span>🪙 金幣 +${ap.stats.coins}</span><span>💎 星砂 +${ap.stats.shards}</span>`;
          const asp = $('apSpark');
          if (asp) asp.textContent = `🔥 手動星火：${'🔥'.repeat(ap.sparkStacks)}${'▫️'.repeat(5 - ap.sparkStacks)} (${ap.sparkStacks}/5)`;
          const mBtn = $('apToggleMode'); if (mBtn) mBtn.textContent = ap.mode === 'full' ? '🔄 切半自動' : '🔄 切全自動';
          const sBtn = $('apToggleSalv'); if (sBtn) sBtn.classList.toggle('on', !!ap.autoSalvage);
          const cBtn = $('apToggleCozy'); if (cBtn) cBtn.classList.toggle('on', !!ap.cozyCam);
        }
      }
    }
    const cbEl = $('comboBadge');
    if (cbEl) {
      const cnt = g.combo?.count || 0;
      const show = cnt >= 2 && (g.combo?.timer || 0) > 0;
      cbEl.classList.toggle('hide', !show);
      if (show && cbEl._last !== cnt) {
        cbEl._last = cnt;
        cbEl.innerHTML = `🔥 ${cnt} 連擊！<small>攻速 +${Math.min(30, cnt * 2)}% · 暴擊 +${Math.min(22, Math.round(cnt * 1.5))}%</small>`;
        cbEl.style.transform = 'scale(1.12)';
        setTimeout(() => { cbEl.style.transform = 'scale(1)'; }, 110);
      }
    }
    const target = $('fieldTarget');
    let nearest = null, distance = 7;
    if (g.field && g.state === 'play') for (const enemy of g.enemies) {
      const d = enemy.pos.distanceTo(p.pos);
      if (!enemy.dead && d < distance) { nearest = enemy; distance = d; }
    }
    target.hidden = !nearest;
    if (nearest) target.textContent = (nearest.expeditionName || (nearest.rival ? '演武旅人' : nearest.legendary ? '傳奇' : nearest.elite ? '精英' : '普通')) + ' · Lv.' + nearest.level + '　' + Math.ceil(nearest.hp) + ' / ' + Math.ceil(nearest.maxHp);
    const M = g.meta, pr = M.p;
    $('shardInfo').textContent = `✦ ${pr.shards}${M.runShards ? ` (+${M.runShards})` : ''}` + (g.depth >= 0 && pr.mods.length ? ' · ' + M.activeMods().map(m => m.name).join('') : '');
    const coinEl = $('coinInfo'); if (coinEl) coinEl.textContent = `🪙 ${pr.coins}`;
    const mealEl = $('mealInfo');
    if (mealEl) {
      const now = Date.now();
      const leftMeal = pr.mealUntil ? Math.ceil((pr.mealUntil - now) / 1000) : 0;
      const leftFerry = pr.ferryBuffUntil ? Math.ceil((pr.ferryBuffUntil - now) / 1000) : 0;
      const parts = [];
      if (leftMeal > 0) parts.push(`${(pr.mealBoost || 1) > 1 ? '🍗 盛宴' : '🐟 回血'} ${Math.floor(leftMeal / 60)}:${String(leftMeal % 60).padStart(2, '0')}`);
      if (leftFerry > 0) parts.push(`⛵ 同舟 ${Math.floor(leftFerry / 60)}:${String(leftFerry % 60).padStart(2, '0')}`);
      mealEl.hidden = parts.length === 0;
      if (parts.length) mealEl.textContent = parts.join(' · ');
    }
    const compass = $('fieldCompass');
    const destination = navigationTarget(g);
    compass.hidden = !destination;
    if (destination) {
      const label = `${destination.label} · ${describeMapTarget(p.pos, destination)}`;
      if (compass.textContent !== label) compass.textContent = label;
    }
    // ground item tooltip（支援懸停任一掉落裝備即時展開完整對比卡，或靠近自動顯示）
    const d = g.state === 'play' && !this.invOpen ? (g.hoveredDrop || g.nearestDrop()) : null;
    const tip = $('tip');
    if (d) { tip.classList.remove('hide'); if (tip.dataset.id != d.item.id) { tip.dataset.id = d.item.id; tip.innerHTML = this.itemHTML(d.item, p.equip[d.item.slot]); } }
    else { tip.classList.add('hide'); tip.dataset.id = ''; }
    if ((this._hovTick = (this._hovTick || 0) + 1) % 15 === 0) this.hover?.refreshActive?.();
    if (this.invOpen && this.invTab === 'bag') this.renderInv(g);
  }
  itemHTML(it, cur) {
    const R = RARITY[it.rarity], ti = tierInfo(it.tier || 1);
    const lines = itemLines(it).map(l => `<div class="${l.corrupt ? 'corrupt' : l.imp ? 'imp' : l.special ? 'spc' : 'mod'}">${l.t}</div>`).join('');
    let cmp = '';
    if (cur !== undefined) {
      const diff = itemScore(it) - itemScore(cur);
      let deltaHtml = '';
      if (cur) {
        const STAT_LABELS = {
          baseDmg: ['攻擊', ''], addFire: ['火傷', ''], dmgPct: ['傷害', '%'], atkSpd: ['攻速', '%'],
          crit: ['暴擊', '%'], critMult: ['暴傷', '%'], maxHp: ['生命', ''], armor: ['減傷', '%'],
          moveSpd: ['移速', '%'], cdr: ['冷卻', '%'], mana: ['法力', ''], area: ['範圍', '%'],
          regen: ['回血', ''], lifeOnHit: ['擊回', ''], proj: ['彈數', ''],
        };
        const collectStats = g => {
          const m = {};
          if (!g) return m;
          if (g.implicit) m[g.implicit.k] = (m[g.implicit.k] || 0) + g.implicit.v;
          if (g.corruptImplicit) m[g.corruptImplicit.k] = (m[g.corruptImplicit.k] || 0) + g.corruptImplicit.v;
          for (const md of g.mods || []) m[md.k] = (m[md.k] || 0) + md.v;
          return m;
        };
        const sNew = collectStats(it), sCur = collectStats(cur);
        const keys = new Set([...Object.keys(sNew), ...Object.keys(sCur)]);
        const chips = [];
        for (const k of keys) {
          const d = Math.round(((sNew[k] || 0) - (sCur[k] || 0)) * 10) / 10;
          if (!d || !STAT_LABELS[k]) continue;
          const [lb, unit] = STAT_LABELS[k];
          chips.push(`<span class="cmp-chip ${d > 0 ? 'up' : 'down'}">${lb} ${d > 0 ? '▲+' + d : '▼' + d}${unit}</span>`);
        }
        if (chips.length) deltaHtml = `<div class="cmp-deltas">${chips.join('')}</div>`;
      }
      cmp = `<div class="cmp ${diff >= 0 ? 'up' : 'down'}">${cur ? (diff >= 0 ? `▲ 戰力比目前好 +${diff}` : `▼ 戰力比目前差 ${diff}`) : '▲ 空欄位'}</div>${deltaHtml}<div class="hint">雙擊或點擊按鈕裝備（舊裝備自動收入物理背包）</div>`;
    }
    const art = this.artImg(it, 256, 'tip-art');
    return `<div class="tip-head rar-${it.rarity}">${art}<div class="tip-title"><div class="iname" style="color:${R.color}"><span class="tier-tag" style="color:${ti.color}">${ti.tag}</span>${it.name}</div><div class="ibase">${ti.name} · ${R.name} · ${SLOTS[it.slot].name} · ${it.base} · 戰力 ${itemScore(it)}</div></div></div><div class="sep"></div>${lines}${cmp}`;
  }
  toggleRegionMap(g) {
    this.regionMapOpen = !this.regionMapOpen;
    const el = $('regionMap');
    el.classList.toggle('hide', !this.regionMapOpen);
    if (this.regionMapOpen) {
      this._regionMapReturnFocus = document.activeElement;
      this.refreshRegionMap();
      $('btnRegionMapClose').focus({ preventScroll: true });
    } else if (el.contains(document.activeElement) || document.activeElement === document.body) {
      const previous = this._regionMapReturnFocus;
      const trigger = previous?.getClientRects().length && previous !== document.body ? previous : $('btnMenu');
      trigger.focus({ preventScroll: true });
    }
  }
  toggleInv(g, tab) {
    if (tab && this.invOpen && this.invTab !== tab) { this.setInvTab(g, tab); return; }
    this.invOpen = !this.invOpen;
    this.atStash = false;
    $('inv').classList.toggle('hide', !this.invOpen);
    if (this.invOpen) this.setInvTab(g, tab || (this.invTab === 'stash' ? 'bag' : this.invTab) || 'bag');
  }
  renderInv(g, force) {
    if (!force && (this._invT = (this._invT || 0) + 1) % 15) return;
    const p = g.player, S = p.stats, shards = g.meta.p.shards || 0;
    const eqEl = $('invEquip');
    if (eqEl) eqEl.innerHTML = '';
    const progress = g.meta.p, cls = CLASSES[g.character?.job ?? 0] || CLASSES[0], sc2 = findSecondClass(progress.secondClass);
    const curAcct = getActiveAccount();
    const rows = [
      ['帳號 / 角色', `${curAcct.isGuest ? '👤 訪客' : '👤 ' + curAcct.username} · ${g.playerName || '旅人'}`],
      ['職業', sc2 ? `${cls.icon} ${cls.name} → ${sc2.icon} ${sc2.name}` : `${cls.icon} ${cls.name}`],
      ['公會 / 聲望', `${progress.guildName || '未加入'} · Lv.${getGuildRepInfo(progress).lv} ${getGuildRepInfo(progress).title}`],
      ['全身強化共鳴', (() => { const er = computeEnhanceResonance(p.equip); return er.active ? `${er.active.icon} ${er.active.name}` : `未啟動（最低 +${er.minLv}）`; })()],
      ['冒險小隊', (() => { const pids = getPartyIds(progress); if (!pids.length) return '無（可至公會大廳編入 2 名隊友）'; const syn = getActivePartySynergy(progress); return pids.map(id => { const cd = AI_COMPANIONS.find(c => c.id === id); return `${cd?.icon || ''}${cd?.name?.split(' · ')[0] || id}`; }).join(' + ') + (syn ? ` · ${syn.icon}${syn.name}` : ''); })()],
      ['試煉之塔 / 魔方', (() => { const tw = computeTowerBonuses(progress); return `最高 ${tw.best}F（全傷 +${tw.dmgPct}%）· 🎲魔方 ${progress.cubes || 0}`; })()],
      ['職業被動', cls.summary],
      ['團隊光環', `${getClassTeamRole(cls.id).icon} ${getClassTeamRole(cls.id).name}（${getClassTeamRole(cls.id).desc}）`],
      ['等級 / 經驗', progress.level === 30 ? '30 · 滿級' : progress.level + ' · ' + progress.xp + '/' + xpForNextLevel(progress.level)],
      ...(nextMilestone(progress.level) ? [['下一里程碑', `Lv.${nextMilestone(progress.level).lv} · ${nextMilestone(progress.level).title}`]] : []),
      ['金幣 / 鑰石', progress.coins + ' / ' + progress.keys],
      ['木材 / 礦石 / 魚', progress.goods.wood + ' / ' + progress.goods.ore + ' / ' + progress.goods.fish],
      ['生命', `${Math.ceil(p.hp)} / ${S.maxHp}`], ['法力', `${S.mana}`], ['基礎傷害', `${S.baseDmg + S.addFire}`], ['傷害加成', `+${S.dmgPct}%`],
      ['攻擊速度', `+${S.atkSpd}%`], ['暴擊', `${S.crit}% × ${S.critMult}%`], ['範圍', `+${S.area}%`], ['移動速度', `+${S.moveSpd}%`],
      ['冷卻縮減', `${S.cdr}%`], ['減傷', `${S.armor}%`], ['擊中回復', `${S.lifeOnHit}`], ['餘燼彈數', `${S.proj}`],
      ['🔥 火抗 / ❄️ 冰抗', `${S.resFire || 0}% / ${S.resIce || 0}%`],
      ['⚡ 雷抗 / ☠️ 毒抗', `${S.resLightning || 0}% / ${S.resPoison || 0}%`],
    ];
    $('invStats').innerHTML = rows.map((r, i) => `<div${i < 3 ? ' class="wide"' : ''}><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    // 經典 MMORPG 四維屬性配點（STR/DEX/INT/VIT）＋ 套裝效果 ＋ 圖鑑精通
    const boonsEl = $('invBoons');
    if (boonsEl) {
      const mmoP = ensureMmoState(progress);
      const availPt = availableStatPoints(mmoP);
      const rk = p.advRank || { rank: 'F', name: '見習旅人' };
      const setsHtml = (p.activeSets || []).length
        ? (p.activeSets.map(s => `<span class="chip" style="border-color:${s.def.color}">${s.def.icon} ${s.def.name} (${s.count}/3)${s.full ? ' ★全套' : ''}</span>`).join(''))
        : '<span class="empty">尚未啟動裝備套裝（穿戴同套裝 2–3 件啟動）</span>';
      const bestHtml = Object.entries(BESTIARY_DEFS).map(([k, d]) => {
        const kc = mmoP.bestiary?.[k] || 0;
        const lv = bestiaryRank(k, kc);
        return `<span class="chip" title="${d.bonusText}">${d.icon}${d.name} Lv.${lv} (${kc})</span>`;
      }).join('');
      const allocRows = STAT_DEFS.map(st => {
        const val = mmoP.allocStats?.[st.id] || 0;
        return `<div class="mmo-stat-row" title="${st.desc}"><span><b>${st.icon} ${st.name}</b>：${val}</span><button type="button" class="mmo-stat-btn" data-alloc="${st.id}" ${availPt <= 0 ? 'disabled' : ''}>+1</button></div>`;
      }).join('');
      const lifeHtml = LIFE_SKILL_IDS.map(lid => {
        const li = getLifeSkillInfo(progress, lid);
        return `<div class="mmo-stat-row" title="${li.def.desc}"><span><b>${li.def.icon} ${li.def.name}</b> Lv.${li.lv}</span><small style="opacity:.8">${li.need ? `${li.xp}/${li.need}` : 'MAX'}</small></div>`;
      }).join('');
      const tState = ensureTitles(progress);
      const tBon = computeTitleBonuses(progress);
      const titlesHtml = TITLE_DEFS.map(td => {
        const has = tState.unlocked.includes(td.id), eqOn = tState.active === td.id;
        return `<button type="button" class="chip" data-title-id="${td.id}" title="${td.cond}" style="cursor:${has ? 'pointer' : 'not-allowed'};opacity:${has ? 1 : .45};background:${eqOn ? '#ffd85a' : ''};font-weight:${eqOn ? 900 : 600}">${td.icon} ${td.name}${eqOn ? ' ✔' : ''}</button>`;
      }).join('');
      boonsEl.innerHTML = `<div class="mmo-alloc" style="width:100%">
        <div class="mmo-alloc-head"><span>⚔️ 四維屬性配點（剩餘 <b style="color:#c85418">${availPt}</b> 點 · ${rk.rank}級 ${rk.name}）</span><button type="button" class="mmo-stat-btn" id="btnResetAlloc">♻️ 免費重置</button></div>
        <div class="mmo-alloc-grid">${allocRows}</div>
        <div style="margin-top:8px;font-weight:900;font-size:12px">⛏️ 四大生活副職業專精（採集／鍛造升級，永久加成戰力與成功率）</div>
        <div class="mmo-alloc-grid" style="margin-top:4px">${lifeHtml}</div>
        <div style="margin-top:8px;font-weight:900;font-size:12px">🏷️ 稱號收藏館（已解鎖 ${tBon.count}/${TITLE_DEFS.length} · 永久全傷 +${tBon.dmgPct}% · 生命 +${tBon.maxHp} · 點擊佩戴）</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${titlesHtml}</div>
        <div style="margin-top:8px;font-weight:900;font-size:12px">🛡️ 已啟動裝備套裝</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${setsHtml}</div>
        <div style="margin-top:8px;font-weight:900;font-size:12px">📖 怪物圖鑑精通（永久賬號屬性）</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${bestHtml}</div>
      </div>`;
      boonsEl.querySelectorAll('[data-alloc]').forEach(btn => {
        btn.onclick = () => {
          const r = allocateStat(g.meta.p, btn.dataset.alloc, 1);
          if (r.ok) { g.meta.save(); g.recalc(); g.audio.sfx('ui'); this.renderInv(g, true); }
        };
      });
      boonsEl.querySelectorAll('[data-title-id]').forEach(btn => {
        btn.onclick = () => {
          const resT = equipTitle(g.meta.p, btn.dataset.titleId);
          if (!resT.ok) { this.toast(resT.reason || '尚未解鎖此稱號', '#ff8a8a'); return; }
          g.meta.save(); g.audio.sfx('ui');
          this.toast(`🏷️ 已佩戴頭頂稱號：【${resT.def.icon} ${resT.def.name}】`, '#ffd85a');
          this.renderInv(g, true);
        };
      });
      const rBtn = $('btnResetAlloc');
      if (rBtn) rBtn.onclick = () => { resetStatPoints(g.meta.p); g.meta.save(); g.recalc(); g.audio.sfx('ui'); this.renderInv(g, true); };
    }
  }
  showBoons(g, choices) {
    this.boonChoices = choices;
    const el = $('boons'); el.classList.remove('hide');
    el.querySelector('.cards').innerHTML = choices.map((b, i) => `<button class="card" data-i="${i}"><div class="bicon">${b.icon}</div><div class="bname">${b.name}</div><div class="bdesc">${b.desc}</div><div class="key">${i + 1}</div></button>`).join('');
    el.querySelectorAll('.card').forEach(c => c.onclick = () => this.pickBoonIndex(+c.dataset.i));
  }
  pickBoonIndex(i) {
    if (!this.boonChoices || !this.boonChoices[i]) return;
    const b = this.boonChoices[i]; this.boonChoices = null;
    $('boons').classList.add('hide');
    this.game.takeBoon(b);
  }
  runSummary(g) {
    const p = g.player; const secs = Math.round((performance.now() - g.runStart) / 1000);
    return `抵達 ${Math.floor(g.depth / 3) + 1}-${g.depth % 3 + 1} · 擊敗 ${p.kills} · 總傷害 ${p.dmgDealt} · ${Math.floor(secs / 60)}分${secs % 60}秒`;
  }
  showDead(g) { this.heirUI(g, 'deadHeir'); $('deadSum').textContent = this.runSummary(g); $('dead').classList.remove('hide'); this.saveBest(g); }
  showWin(g) {
    this.heirUI(g, 'winHeir');
    const mvps = computeCozyMvps(g.runStats);
    const mvpLine = ' ｜ 溫馨高光：' + mvps.map(b => `${b.icon}${b.title}`).join(' · ');
    $('winSum').textContent = this.runSummary(g) + mvpLine;
    $('win').classList.remove('hide');
    this.saveBest(g, true);
  }
  saveBest(g, won) {
    try {
      const key = slotKeys(g.slot || 0).bestKey;
      const best = JSON.parse(localStorage.getItem(key) || '{"depth":0,"wins":0}');
      best.depth = Math.max(best.depth, g.depth); if (won) best.wins++;
      localStorage.setItem(key, JSON.stringify(best));
    } catch (e) { /* storage unavailable */ }
  }
}
