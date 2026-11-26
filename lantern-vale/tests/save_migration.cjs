// Beaconfall: save migration + brand regression (pure Node, no browser)
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const { migrateProfile, SAVE_SCHEMA_VERSION } = await import(pathToFileURL(path.join(__dirname, '../src/save_schema.js')));
  const old = { level: 12, coins: 500, shards: 33, kills: 80, secondClass: 'bastion', inventory: [1, 2] };
  const r = migrateProfile(old);
  assert.equal(r.migrated, true); assert.equal(r.from, 1);
  assert.equal(r.profile.schemaVersion, SAVE_SCHEMA_VERSION);
  for (const k of Object.keys(old)) assert.deepEqual(r.profile[k], old[k], 'existing field kept: ' + k);
  assert.deepEqual(r.profile.loreFragments, []);
  const again = migrateProfile(r.profile);
  assert.equal(again.migrated, false);
  assert.equal(migrateProfile(null).profile.schemaVersion, SAVE_SCHEMA_VERSION);
  // storage keys must stay stable
  const acct = fs.readFileSync(path.join(__dirname, '../src/account.js'), 'utf8');
  assert.ok(acct.includes("'lv_profile'"), 'lv_profile key unchanged');
  // glossary sanity
  const g = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/glossary.json'), 'utf8'));
  assert.equal(g.brand.name, 'Beaconfall'); assert.equal(g.tiers.length, 16); assert.equal(Object.keys(g.classes).length, 5); assert.equal(Object.keys(g.subclasses).length, 10);
  // no legacy brand in player-facing entry points
  for (const f of ['src/index.html', 'src/i18n.js']) {
    const t = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!/燈谷行|Lantern Vale|LANTERN VALE/.test(t), 'legacy brand left in ' + f);
  }
  console.log('save_migration: ok');
})().catch(e => { console.error(e); process.exit(1); });
