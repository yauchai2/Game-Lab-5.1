import { ALL_GEMS } from './puzzle.js';
import { recordDevEvent } from './dev_diagnostics.js';

export const OPENING_BADGE = {
  id: 'opening_lantern_badge', name: '巡燈徽章', base: '巡燈徽章',
  tier: 1, rarity: 1, slot: 'charm', reqLevel: 2,
  implicit: { k: 'baseDmg', v: 2 }, mods: [],
};

export function beginOpening(profile) {
  if (profile.opening || profile.level !== 1 || profile.kills || profile.runs
    || profile.meadowExpedition?.active || Object.keys(profile.meadowExpedition?.cleared || {}).length) return;
  profile.opening = { version: 1, practice: 'lamp' };
}

export function openingStep(profile) {
  const opening = profile.opening;
  if (profile.meadowExpedition?.active) return null;
  if (profile.meadowCave?.active) return 'resume';
  if (opening?.finished) return null;
  const firstExpedition = profile.meadowExpedition?.cleared?.[1];
  if (!firstExpedition && opening?.practice === 'lamp') return 'lamp';
  if (!firstExpedition && opening?.practice === 'spar') return 'spar';
  if (opening?.badge === 'ready') return 'badge';
  if (opening?.badge === 'crafted') return 'next';
  if (firstExpedition && !profile.meadowCave?.clears?.normal
    && Object.keys(profile.meadowExpedition.cleared).length === 1) return 'support';
  return null;
}

export function openingDestination(profile) {
  return openingStep(profile) === 'next' && profile.opening.nextDestination === 'cave' && profile.keys > 0
    ? 'cave' : null;
}

export function openingPracticeOpponent(g) {
  if (g.field !== 1 || g.state !== 'play' || g.interior) return null;
  return g.enemies.find(enemy => enemy.openingPractice && !enemy.dead
    && enemy.practiceChargeStarted && Math.hypot(enemy.pos.x - g.player.pos.x, enemy.pos.z - g.player.pos.z) < 11) || null;
}

export function recordOpeningEvent(g, event, detail) {
  if (!g.meta.p.opening || (g.meta.p.opening.finished && event !== 'next_destination')) return;
  const coarse = typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches;
  recordDevEvent('log', 'game', ['[OPENING]', event, coarse ? 'touch-capable' : 'keyboard-mouse', detail || '']);
}

export function openingSupport(profile) {
  const receipt = profile.meadowExpedition?.cleared?.[1];
  const gem = ALL_GEMS[receipt?.gemId];
  if (!gem) return null;
  const puzzle = profile.puzzle;
  const matches = puzzle?.bag?.filter(item => item.id === gem.id) || [];
  const uid = receipt.gemUid ?? (matches.length === 1 ? matches[0].uid : null);
  return { gem, gemUid: uid };
}

export function creditOpeningClear(profile) {
  if (profile.opening?.version !== 1 || profile.opening.badge) return;
  profile.opening.practice = 'done';
  profile.opening.badge = 'ready';
}

export function craftOpeningBadge(profile, fmt) {
  if (profile.opening?.badge !== 'ready') return null;
  profile.opening.badge = 'crafted';
  return {
    ...OPENING_BADGE,
    implicit: { ...OPENING_BADGE.implicit, fmt: fmt(OPENING_BADGE.implicit.k) },
    mods: [],
  };
}

export function recordOpeningSupportUse(game, id, effective) {
  if (!effective || !game.caveRun || game.caveRun.tier !== 'normal') return;
  const profile = game.meta.p;
  const opening = profile.opening;
  if (!opening || opening.supportUsed || openingSupport(profile)?.gem.id !== id || profile.meadowCave?.clears?.normal) return;
  opening.supportUsed = id;
  game.meta.save();
  game.ui.showOpeningSupport(id);
  recordOpeningEvent(game, 'support_effect', id);
}

// Lock the saved-receipt check and commit together when tabs share a character.
export function commitCharacterReward(meta, alreadyClaimed, commit) {
  const run = () => {
    if (!meta.canSave() || (meta.key && alreadyClaimed(meta.load()))) return false;
    return commit();
  };
  const locks = globalThis.navigator?.locks;
  return meta.key && locks ? locks.request(`lv:reward:${meta.key}`, run) : run();
}
