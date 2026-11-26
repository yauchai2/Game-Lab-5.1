// Beaconfall save schema. Storage keys (lv_profile, lv_settings, ...) never change.
// v1 = pre-rebrand saves (no schemaVersion). v2 = Beaconfall: adds lore / flame / story fields with safe defaults.
export const SAVE_SCHEMA_VERSION = 2;

export const BEACONFALL_DEFAULTS = {
  loreFragments: [],      // collected lore fragment ids (Phase 5)
  storyFlags: {},         // main-story progress flags (Phase 3)
  flame: null,            // lamp-flame resource, null until Phase 2 initialises it
  litLanterns: [],        // lit star lantern ids, respawn points (Phase 2)
};

// Returns { profile, migrated, from }. Never drops existing fields; only fills missing ones.
export function migrateProfile(raw) {
  const from = Number.isFinite(raw?.schemaVersion) ? raw.schemaVersion : 1;
  const p = { ...(raw || {}) };
  if (from >= SAVE_SCHEMA_VERSION) return { profile: p, migrated: false, from };
  for (const [k, v] of Object.entries(BEACONFALL_DEFAULTS)) {
    if (p[k] === undefined) p[k] = structuredClone(v);
  }
  p.schemaVersion = SAVE_SCHEMA_VERSION;
  return { profile: p, migrated: true, from };
}
