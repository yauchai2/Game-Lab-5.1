// Beaconfall Phase 3: lore text rules and region quest logic (pure Node, no browser).
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const L = await import(pathToFileURL(path.join(__dirname, '../src/lore.js')));
  const { migrateProfile } = await import(pathToFileURL(path.join(__dirname, '../src/save_schema.js')));
  const { FIELD_BLUEPRINTS } = await import(pathToFileURL(path.join(__dirname, '../src/field_blueprints.js')));
  const glossary = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/glossary.json'), 'utf8'));
  const D = L.LORE_DATA, lim = D.limits;
  const words = s => s.trim().split(/\s+/).length;
  const sentences = s => (s.match(/[。！？]/g) || []).length;
  const KINDS = ['kill', 'elite', 'boss', 'gather', 'chest', 'talk', 'lantern', 'fragment'];

  // ---- text rules from the plan: title <= 5 English words, desc <= 2 sentences, goals <= 3, fixed reward ----
  const npcIds = new Set(['hale']);
  for (const f of L.LORE_FIELDS) for (const n of L.regionNpcs(f)) { assert.ok(!npcIds.has(n.id), 'unique npc id ' + n.id); npcIds.add(n.id); }
  const qids = new Set(), fids = new Set();
  for (const f of L.LORE_FIELDS) {
    const r = L.regionLore(f); assert.ok(r, 'region ' + f);
    assert.equal(r.name, glossary.zones[f], 'region name matches glossary ' + f);
    assert.equal(r.legacy, glossary.zoneLegacy[f]);
    assert.ok(L.bossLore(r.boss), 'boss exists for region ' + f);
    assert.equal(L.bossLoreForField(f).field, f);
    assert.ok(L.morvaneStage(f), 'Morvane reveal stage covers region ' + f);
    const qs = L.regionQuests(f);
    assert.ok(qs.length >= 6 && qs.length <= 8, `region ${f} has 6-8 quests (${qs.length})`);
    assert.equal(qs[qs.length - 1].goals[0].k, 'boss', 'last quest of each region is the boss quest');
    const lanterns = (FIELD_BLUEPRINTS[f].checkpoints || []).length;
    const frags = L.regionFragments(f);
    assert.ok(frags.length >= lim.fragmentsPerRegion[0] && frags.length <= lim.fragmentsPerRegion[1], `region ${f} fragments ${frags.length}`);
    const kinds = new Set(); let bosses = 0;
    qs.forEach((q, qi) => {
      assert.ok(!qids.has(q.id), 'unique quest id ' + q.id); qids.add(q.id);
      assert.ok(q.id.startsWith('r' + f + 'q'));
      assert.ok(words(q.title) <= lim.titleWords && /^[A-Za-z' ]+$/.test(q.title), 'title rule: ' + q.title);
      assert.ok(sentences(q.desc) >= 1 && sentences(q.desc) <= lim.descSentences, 'desc sentences: ' + q.id);
      assert.ok(!/[!！]/.test(q.desc + q.title), 'system text has no exclamation: ' + q.id);
      assert.ok(q.goals.length >= 1 && q.goals.length <= lim.goalsMax, 'goals count ' + q.id);
      assert.ok(q.reward && q.reward.xp > 0 && q.reward.coins > 0, 'fixed reward ' + q.id);
      for (const g of q.goals) {
        assert.ok(KINDS.includes(g.k), 'goal kind ' + g.k); assert.ok(g.n >= 1 && g.text, 'goal text ' + q.id);
        kinds.add(g.k);
        if (g.k === 'talk') assert.ok(npcIds.has(g.npc), 'goal npc ' + g.npc);
        if (g.k === 'lantern') assert.ok(g.n <= lanterns - 1, `lantern goal ${q.id} needs ${g.n}, field has ${lanterns - 1} beyond the first`);
        if (g.k === 'boss') bosses++;
        if (g.k === 'fragment') {
          const earlier = new Set(qs.slice(0, qi).map(x => x.id));
          const reachable = frags.filter(fr => fr.src.k !== 'boss' && (fr.src.k !== 'quest' || earlier.has(fr.src.id))).length;
          assert.ok(g.n <= reachable, `fragment goal ${q.id} needs ${g.n}, only ${reachable} reachable before it`);
        }
      }
    });
    assert.equal(bosses, 1, 'exactly one boss goal per region');
    for (const fr of frags) {
      assert.ok(!fids.has(fr.id), 'unique fragment id ' + fr.id); fids.add(fr.id);
      assert.ok(fr.id.startsWith('lf_' + f + '_'));
      assert.ok(sentences(fr.text) >= 1 && sentences(fr.text) <= 2, 'fragment is 1-2 sentences: ' + fr.id);
      const s = fr.src;
      if (s.k === 'quest') assert.ok(qs.some(q => q.id === s.id), 'fragment quest source in region ' + fr.id);
      if (s.k === 'lantern') assert.ok(s.idx >= 1 && s.idx < lanterns, 'fragment lantern idx ' + fr.id);
      if (s.k === 'talk') assert.ok(npcIds.has(s.npc), 'fragment npc ' + fr.id);
      if (s.k === 'boss') bosses++;
    }
    assert.equal(frags.filter(x => x.src.k === 'boss').length, 1, 'one boss fragment per region');
    const npcs = L.regionNpcs(f); assert.ok(npcs.length >= 2 && npcs.length <= 4);
    for (const n of npcs) { assert.ok(n.lines.length >= 2 && n.lines.length <= 4); for (const l of n.lines) assert.ok(l.length <= 40, 'one-liner is short: ' + l); }
  }
  for (const [k, b] of Object.entries(D.bosses)) { assert.ok(b.name && b.intro && b.defeat && b.role, 'boss text ' + k); }
  for (const k of ['cleaver_tusk', 'hookthorn_elder', 'sporebloat_colossus', 'orld']) assert.equal(D.bosses[k].name, glossary.bosses[k], 'boss name matches glossary ' + k);
  assert.equal(D.bosses.orld.field, 6, 'Orld is the sixth-region boss, not the final boss');
  assert.ok(!/最終/.test(D.bosses.orld.role) || /不是最終/.test(D.bosses.orld.role));
  const all = fs.readFileSync(path.join(__dirname, '../data/lore.json'), 'utf8');
  assert.ok(!/燈谷行|Lantern Vale/.test(all), 'no legacy brand in lore text');
  assert.equal(fids.size, L.allFragments().length);

  // ---- save compatibility: old profiles load, state is namespaced, round-trips through JSON ----
  const old = migrateProfile({ level: 9, coins: 100, shards: 5, keys: 1 }).profile;
  const rq0 = L.ensureLoreState(old);
  assert.deepEqual(old.loreFragments, []); assert.deepEqual(rq0.q, {});
  assert.equal(old.coins, 100, 'ensureLoreState does not touch existing fields');
  assert.equal(migrateProfile(old).migrated, false, 'no schema bump needed');

  // ---- play region 1 end to end ----
  const mk = () => migrateProfile({ coins: 0, shards: 0, keys: 0, litLanterns: ['1:0'] }).profile;
  const p = mk();
  const ev = (e, field = 1) => L.recordLoreEvent(p, { field, ...e });
  assert.equal(L.activeQuest(p, 1).id, 'r1q1');
  ev({ kind: 'kill' });                                              // town quest must not progress in the field
  assert.equal(L.questProgress(p, L.activeQuest(p, 1))[0].have, 0, 'town goal ignores field events');
  let r = ev({ kind: 'talk', npc: 'hale' }, 0);
  assert.equal(r.quests.length, 1); assert.equal(r.xp, 60); assert.equal(p.coins, 20);
  assert.ok(p.loreFragments.includes('lf_1_01'), 'talking to Hale yields the notice fragment');
  assert.equal(L.activeQuest(p, 1).id, 'r1q2');
  r = ev({ kind: 'talk', npc: 'hale' }, 0); assert.equal(r.xp, 0, 'repeat talk never re-rewards');
  p.litLanterns.push('1:1'); r = ev({ kind: 'lantern', idx: 1 });
  assert.ok(p.loreFragments.includes('lf_1_04'));
  assert.equal(L.activeQuest(p, 1).id, 'r1q2', 'one of two lanterns is not enough');
  p.litLanterns.push('1:2'); r = ev({ kind: 'lantern', idx: 2 });
  assert.equal(r.quests[0].id, 'r1q2'); assert.equal(p.shards, 5);
  for (let i = 0; i < 12; i++) ev({ kind: 'kill' });
  assert.equal(L.activeQuest(p, 1).id, 'r1q4');
  for (let i = 0; i < 3; i++) ev({ kind: 'gather' });
  assert.equal(L.activeQuest(p, 1).id, 'r1q4', 'still needs the Bo hand-in');
  ev({ kind: 'talk', npc: 'bo' }); assert.ok(p.loreFragments.includes('lf_1_02'), 'quest-sourced fragment');
  ev({ kind: 'kill', elite: true }); ev({ kind: 'talk', npc: 'yuzu' });
  assert.equal(L.activeQuest(p, 1).id, 'r1q6');
  ev({ kind: 'chest' }); for (let i = 0; i < 10; i++) ev({ kind: 'kill' });
  assert.equal(L.activeQuest(p, 1).id, 'r1q7');
  r = ev({ kind: 'kill', boss: true });
  assert.equal(r.quests.at(-1).id, 'r1q7'); assert.equal(p.keys, 1);
  assert.ok(L.regionDone(p, 1)); assert.equal(L.trackerLine(p, 1), null);
  assert.ok(p.loreFragments.includes('lf_1_06'), 'boss fragment');
  assert.ok(L.fragmentCount(p, 1) >= 7, 'most region 1 fragments found: ' + L.fragmentCount(p, 1));
  assert.equal(new Set(p.loreFragments).size, p.loreFragments.length, 'no duplicate fragments');
  const rt = JSON.parse(JSON.stringify(p));
  assert.equal(L.activeQuest(rt, 2).id, 'r2q1', 'regions are independent lines');
  assert.deepEqual(L.questProgress(rt, L.questById('r1q7')).map(x => x.done), [true]);

  // ---- other regions: a quest line can be finished by events alone, in order ----
  const sim = region => {
    const q = mk(); q.litLanterns = [region + ':0'];
    const lant = (FIELD_BLUEPRINTS[region].checkpoints || []).length;
    const rec = e => L.recordLoreEvent(q, { field: region, ...e });
    let guard = 0;
    while (L.activeQuest(q, region) && guard++ < 400) {
      const a = L.activeQuest(q, region);
      for (const pr of L.questProgress(q, a)) {
        if (pr.done) continue;
        const g = pr.goal;
        if (g.k === 'lantern') for (let i = 1; i < lant; i++) { if (!q.litLanterns.includes(region + ':' + i)) q.litLanterns.push(region + ':' + i); rec({ kind: 'lantern', idx: i }); }
        else if (g.k === 'talk') L.recordLoreEvent(q, { field: g.at === 'town' ? 0 : region, kind: 'talk', npc: g.npc });
        else if (g.k === 'boss') rec({ kind: 'kill', boss: true });
        else if (g.k === 'elite') rec({ kind: 'kill', elite: true });
        else if (g.k === 'kill') rec({ kind: 'kill' });
        else if (g.k === 'gather') rec({ kind: 'gather' });
        else if (g.k === 'chest') rec({ kind: 'chest' });
        else if (g.k === 'fragment') { rec({ kind: 'sync' }); for (const fr of L.regionFragments(region)) { if (fr.src.k === 'talk') rec({ kind: 'talk', npc: fr.src.npc }); } }
      }
    }
    return q;
  };
  for (const f of L.LORE_FIELDS) {
    const q = sim(f);
    assert.ok(L.regionDone(q, f), `region ${f} quest line completes`);
    assert.ok(L.fragmentCount(q, f) >= 6, `region ${f} gives 6+ fragments by playing its quests (${L.fragmentCount(q, f)})`);
  }
  // Codex cards render for a fresh and a finished profile
  const fresh = L.loreCards(mk()); assert.ok(fresh.length > 60 && fresh.every(c => c.name && c.desc && c.icon));
  assert.ok(fresh.some(c => c.name === '？？？'), 'unfound fragments are hidden');
  assert.ok(L.loreCards(p).some(c => c.name === 'Guard Notice'), 'found fragments show their title');
  console.log('lore_logic: ok');
})().catch(e => { console.error(e); process.exit(1); });
