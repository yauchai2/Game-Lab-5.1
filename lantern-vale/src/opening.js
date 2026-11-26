import { ALL_GEMS } from './puzzle.js';

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
  game.ui.toast(id === 'leech' ? '汲血生效 · 命中恢復生命' : '霜緩生效 · 命中減慢敵人', '#ffe08a');
}

// Lock the saved-receipt check and commit together when tabs share a character.
export function commitCharacterReward(meta, alreadyClaimed, commit) {
  const run = () => {
    if (meta.key && alreadyClaimed(meta.load())) return false;
    return commit();
  };
  const locks = globalThis.navigator?.locks;
  return meta.key && locks ? locks.request(`lv:reward:${meta.key}`, run) : run();
}
