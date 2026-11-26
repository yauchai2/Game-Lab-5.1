// Beaconfall save schema. Storage keys (lv_profile, lv_settings, ...) never change.
// v1 = pre-rebrand saves (no schemaVersion).
// v2 = Beaconfall: adds lore / flame / story fields with safe defaults.
// v3 = Phase 2 lamp: flame becomes { v } and litLanterns is back-filled from the already unlocked checkpoints.
export const SAVE_SCHEMA_VERSION = 3;

export const BEACONFALL_DEFAULTS = {
  loreFragments: [],      // collected lore fragment ids (Phase 5)
  storyFlags: {},         // main-story progress flags (Phase 3)
  flame: { v: null },     // lamp-flame resource; v = null means "start full" (src/flame.js initialises it)
  litLanterns: [],        // lit star lantern ids '<field>:<idx>', respawn points (Phase 2)
};

// One step per version bump. Each step only fills or reshapes new fields and never drops existing data.
const STEPS = {
  // v1 -> v2
  1(p) {
    for (const k of ['loreFragments', 'storyFlags', 'litLanterns']) if (p[k] === undefined) p[k] = structuredClone(BEACONFALL_DEFAULTS[k]);
    if (p.flame === undefined) p.flame = null;
  },
  // v2 -> v3
  2(p) {
    if (!p.flame || typeof p.flame !== 'object') p.flame = { v: null };
    if (!Array.isArray(p.litLanterns)) p.litLanterns = [];
    const cps = p.unlockedCps && typeof p.unlockedCps === 'object' ? p.unlockedCps : {};
    for (const [field, list] of Object.entries(cps)) {
      if (!Array.isArray(list)) continue;
      for (const idx of list) { const id = `${field}:${idx}`; if (!p.litLanterns.includes(id)) p.litLanterns.push(id); }
    }
  },
};

// Returns { profile, migrated, from }. Never drops existing fields; only fills missing ones.
export function migrateProfile(raw) {
  const from = Number.isFinite(raw?.schemaVersion) ? raw.schemaVersion : 1;
  const p = { ...(raw || {}) };
  if (from >= SAVE_SCHEMA_VERSION) return { profile: p, migrated: false, from };
  for (let v = from; v < SAVE_SCHEMA_VERSION; v++) STEPS[v]?.(p);
  p.schemaVersion = SAVE_SCHEMA_VERSION;
  return { profile: p, migrated: true, from };
}
