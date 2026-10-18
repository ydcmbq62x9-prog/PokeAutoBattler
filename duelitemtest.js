/* 6.19.0 — held items in Duels (Sean asked): an item is saved with the pokémon at the end of a run, works the same
   in a duel as in a run, follows the item when it is moved to another pokémon in game 2+, and a duel gives the same
   result on both phones whatever run each has open (Eviolite used to follow the open run's generations). */
const E = require('./engine.js');
const { HELD_ITEMS, SPECIES, makeUnit, snapUnit, thawUnit, heldStats, effHp, effAtk, effSpd, simulateBattle, roleOf, setActiveGens, canStillEvolve, newDuelSet, duelCode, duelSim, duelPower, TUNING } = E;
const sp = name => Object.keys(SPECIES).find(k => SPECIES[k].name === name);
const stats = u => [effHp(u), effAtk(u), effSpd(u)].join('/');
// what a player sees: the battle text and everyone's HP each step (internal ids differ between calls)
const seen = sim => JSON.stringify(sim.steps.map(st => [st.lines, (st.p || []).map(x => x.nm + ':' + x.hp + '/' + x.maxHp), (st.e || []).map(x => x.nm + ':' + x.hp + '/' + x.maxHp)]));
setActiveGens([1, 2, 3]);
let bad = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if(!ok) bad++; };
// 1. every item: a run pokémon holding it vs the same pokémon saved and thawed
const holder = id => { const h = HELD_ITEMS[id]; return h.role ? Object.keys(SPECIES).find(k => SPECIES[k].role === h.role && !SPECIES[k].legendary && !SPECIES[k].token) : id === 'evio' ? sp('Bulbasaur') : sp('Machamp'); };
for(const id of Object.keys(HELD_ITEMS)){
  const u = makeUnit(holder(id), 60); u.hp += 30; u.atk += 20; u.held = id;
  const sv = snapUnit(u), t = thawUnit(sv);        // saved with the pokémon; a run-economy item is then switched off in the duel
  check(sv.held === id && t.held === E.duelItem(id) && stats(t) === stats(u), `${HELD_ITEMS[id].name.padEnd(13)} saved and restored: run ${stats(u)}  duel ${stats(t)}${t.held ? '' : ' (off in duels)'}`);
}
// 2. battle effects: the same fight with run units and with saved-and-restored units
const team = ['Machamp', 'Blastoise', 'Venusaur', 'Alakazam', 'Snorlax', 'Gengar'].map((n, i) => { const u = makeUnit(sp(n), 60); u.pos = i; return u; });
const items = ['lefto', 'sitrus', 'focus', 'orb', 'bell', 'helmet'];
const foe = ['Golem', 'Arcanine', 'Lapras', 'Jolteon', 'Hypno', 'Dragonite'].map((n, i) => { const u = makeUnit(sp(n), 60); u.pos = i; return u; });
team.forEach((u, i) => u.held = items[i]);
const a = simulateBattle(team.map(u => Object.assign(makeUnit(u.id, u.exp), u)), foe, 1234);
const b = simulateBattle(team.map(u => thawUnit(snapUnit(u), u.pos)), foe.map(u => Object.assign(makeUnit(u.id, u.exp), u)), 1234);
check(seen(a) === seen(b), `battle items (Leftovers, Sitrus, Focus Band, Life Orb, Shell Bell, Rocky Helmet): run fight and duel fight match (${a.result}, ${a.steps.length} steps)`);
const used = JSON.stringify(b.steps).match(/Leftovers|Sitrus|Focus Band|Life Orb|Shell Bell|Rocky Helmet/g) || [];
check(new Set(used).size >= 3, `item effects show up in the duel fight: ${[...new Set(used)].join(', ')}`);
// 3. moving an item: the new holder gets it, the old one loses it
const m = makeUnit(sp('Machamp'), 60), g = makeUnit(sp('Gengar'), 60); m.held = 'band';
const sm = snapUnit(m), sg = snapUnit(g);
const g2 = thawUnit(sg, 0, 'band'), m2 = thawUnit(sm, 1, null);
check(effAtk(g2) === Math.round(g.atk * 1.25) && effAtk(m2) === m.atk, `Muscle Band moved Machamp -> Gengar: Gengar ${g.atk} -> ${effAtk(g2)}, Machamp back to ${effAtk(m2)}`);
const tank = makeUnit(Object.keys(SPECIES).find(k => SPECIES[k].role === 'tank' && !SPECIES[k].legendary), 60);
const cannon = makeUnit(Object.keys(SPECIES).find(k => SPECIES[k].role === 'cannon' && !SPECIES[k].legendary), 60);
check(effHp(thawUnit(snapUnit(tank), 0, 'plate')) > tank.hp && effHp(thawUnit(snapUnit(cannon), 0, 'plate')) === cannon.hp, 'Bulk Plate moved to a non-Tank does nothing (same rule as in a run)');
// 4. Eviolite and the generations each phone has switched on
const golbat = makeUnit(sp('Golbat'), 60); golbat.held = 'evio';
const s = snapUnit(golbat);
setActiveGens([1]); const hp1 = Math.round(duelPower([thawUnit(s)])), ev1 = canStillEvolve(s.id);
setActiveGens([1, 2]); const hp2 = Math.round(duelPower([thawUnit(s)])), ev2 = canStillEvolve(s.id);
check(hp1 === hp2, `Eviolite Golbat duel power: ${hp1} on a phone in a Gen 1 run, ${hp2} on a phone with Gen 2 on (run rule says can evolve: ${ev1} / ${ev2})`);
// the same duel game on two phones in different runs
const box = [snapUnit(golbat), ...['Machamp', 'Snorlax'].map(n => snapUnit(makeUnit(sp(n), 60)))];
const picks = box.map((x, i) => ({ bid:x.bid, item:x.held || null, pos:i }));
const opp = ['Golem', 'Arcanine', 'Lapras'].map(n => snapUnit(makeUnit(sp(n), 60)));
const op = opp.map((x, i) => ({ bid:x.bid, item:null, pos:i }));
const setA = newDuelSet('Ann', 'v'), setB = newDuelSet('Bob', 'v');
const ca = duelCode(setA, box, picks), cb = duelCode(setB, opp, op);
setActiveGens([1]); const r1 = duelSim(setA, ca, cb);
setActiveGens([1, 2, 3]); const r2 = duelSim(setB, cb, ca);
const hpOf = r => (r.sim.steps[0].p.concat(r.sim.steps[0].e).find(x => x.nm === 'Golbat') || {}).maxHp;
check(seen(r1.sim) === seen(r2.sim) && hpOf(r1) === hpOf(r2), `Eviolite Golbat max HP in the duel ${hpOf(r1)} / ${hpOf(r2)}; same duel on two phones (one in a Gen 1 run, one with Gen 2/3 on): ${r1.sim.steps.length} vs ${r2.sim.steps.length} steps, ${r1.myResult} / ${r2.myResult}`);
// 5. 6.20.0 (Sean): run-economy items are switched off in a duel: no item, no power, not in the set's item pool
setActiveGens([1, 2, 3]);
for(const id of Object.keys(HELD_ITEMS).filter(k => HELD_ITEMS[k].kind === 'economy')){
  const u = makeUnit(sp('Blissey'), 60); u.held = id; const x = snapUnit(u), y = snapUnit(makeUnit(sp('Snorlax'), 60));
  const t = thawUnit(x), bx = [x, y], pk = bx.map((q, i) => ({ bid:q.bid, item:E.duelItem(q.held), pos:i }));
  const code = duelCode(newDuelSet('Ann', 'v'), bx, pk), back = E.duelParse(code);
  check(t.held === null && duelPower([t]) === duelPower([thawUnit(x, 0, null)]) && E.duelPoolOf(bx, pk).length === 0 && back.units[0][5] === '',
    `${HELD_ITEMS[id].name}: off in a duel (no item, no power, not in the item pool, not in the lock-in code)`);
}
// 6. 6.20.0 (Sean): battle-effect items cost power by the holder's role; plain stat items cost only their stats
const cost = (name, id) => { const x = snapUnit(makeUnit(sp(name), 60)); x.held = id; const bare = duelPower([thawUnit(x, 0, null)]), u = thawUnit(x);
  return (duelPower([u]) - E.unitPower(u)) / (u.hp + u.atk + TUNING.spdPower * u.spd); };
const IP = TUNING.duel.itemPower;
for(const id of Object.keys(IP)){ const h = HELD_ITEMS[id];
  check(h && h.kind !== 'economy' && (h.kind === 'trigger' || h.cutPct || h.unresist || h.endure || h.healBoost), `${h ? h.name : id} has a battle effect, so it may have a duel cost`); }
for(const id of Object.keys(HELD_ITEMS).filter(k => !IP[k] && HELD_ITEMS[k].kind !== 'economy'))
  check(!['trigger'].includes(HELD_ITEMS[id].kind) && !HELD_ITEMS[id].cutPct, `${HELD_ITEMS[id].name} has no extra duel cost: it is a plain stat item`);
check(Math.abs(cost('Gengar', 'orb') - IP.orb.cannon) < 1e-9 && Math.abs(cost('Snorlax', 'orb') - IP.orb.tank) < 1e-9 && IP.orb.cannon > IP.orb.tank,
  `Life Orb costs more on a Cannon (${IP.orb.cannon}) than on a Tank (${IP.orb.tank})`);
check(cost('Machamp', 'band') === 0, 'Muscle Band costs only its +25% Attack');
check(cost('Gengar', 'plate') === 0, 'Bulk Plate on a non-Tank does nothing, so it costs nothing');
// the run's own setting is left as it was after a duel check (a Gen 1 run still says Golbat cannot evolve)
setActiveGens([1]); duelPower([thawUnit(s)]); duelSim(setA, ca, cb);
check(canStillEvolve(s.id) === false && E.BUYABLE.every(k => SPECIES[k].gen === 1 || !SPECIES[k].gen), 'after a duel the open run keeps its own generations');
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
