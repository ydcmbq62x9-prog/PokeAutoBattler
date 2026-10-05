/* 4.12.0: Mew + challenge rules, engine side. */
const E = require('./engine.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const S = E.SPECIES.mew;
check(S && S.legendary && !S.gen2 && (S.gen || 1) === 1 && S.role === 'support' && S.type === 'Psychic', 'Mew: Gen 1 legendary Support, Psychic');
check(S.move.name === 'Barrier Aura' && S.move2.name === 'Transform' && S.move2.trig === 'allyFaint', 'Mew has Barrier Aura and Transform');
E.useGens(E.newGame(1, { gens:[1] })); check(E.LEGENDS().includes('mew'), 'Mew is in the Gen 1 legendary pool');
E.useGens(E.newGame(1, { gens:[2] })); check(!E.LEGENDS().includes('mew'), 'and not in a Gen 2-only run');
E.useGens(E.newGame(1, { gens:[1] }));
// Transform: let an ally faint and see Mew copy its move
let tf = 0, copied = 0, bar = 0;
for(let sd = 1; sd <= 30; sd++){
  const mew = E.makeUnit('mew', 2), ally = E.makeUnit('charmander', 0);
  const r = E.simulateBattle([ally, mew], [E.makeUnit('machamp', 2), E.makeUnit('golem', 2), E.makeUnit('onix', 1)], sd);
  const L = r.steps.flatMap(s => s.lines);
  if(L.some(l => /Mew transformed into Charmander/.test(l))) tf++;
  if(L.some(l => /^Mew used Ember/.test(l))) copied++;
  if(L.some(l => /protected by a barrier/.test(l))) bar++;
  if(L.filter(l => /used Transform/.test(l)).length > 1){ check(false, 'Transform fired twice in one battle (seed ' + sd + ')'); break; }
}
check(bar >= 25, `Barrier Aura puts up barriers (${bar}/30 battles)`);
check(tf >= 10, `Transform copies a fallen ally (${tf}/30 battles)`);
check(copied >= tf, `…and uses its move (${copied} battles saw Mew use Ember)`);
const m0 = E.SPECIES.charmander.move.name; check(/Ember/.test(m0), 'charmander move is Ember (' + m0 + ')');
// rules
check(JSON.stringify(E.cleanMods({ noitems:1, nolegend:1, hardgyms:1, tight:1, bogus:1 })) === '{"noitems":true,"nolegend":true,"hardgyms":true,"tight":true}', 'cleanMods keeps the four new challenges and nothing else');
const ni = E.newGame(7, { mods:{ noitems:true } }); E.rollShop ? E.rollShop(ni, false) : 0;
for(let t = 0; t < 5; t++){ ni.mart = []; E.rollMart(ni, false); }
check(ni.mart.length > 0 && ni.mart.every(s => !s.held), 'No Held Items: the Mart has no held items');
check(!E.BADGE_REWARDS.find(r => r.id === 'gift').ok(ni), 'No Held Items: no Gift Item reward');
const nl = E.newGame(7, { mods:{ nolegend:true } }); nl.badges = 7; check(E.rollEncounter(nl) === null && !nl.encounter, 'No Legendaries: no encounter even at the pity badge');
const pl = E.newGame(7, {}); pl.badges = 7; check(!!E.rollEncounter(pl), 'a plain run still gets one');
const ti = E.newGame(7, { mods:{ tight:true } }), pt = E.newGame(7, {});
check(E.incomeFor(ti).base === E.incomeFor(pt).base - E.TUNING.mods.tightCut, 'Tight Budget: base income is cut');
// Hard Gyms: same seed, gym stage — bosses stronger, trainers untouched
const hg = E.newGame(9, { mods:{ hardgyms:true } }), pg = E.newGame(9, {});
const sum = o => o.team.reduce((n, u) => n + u.hp + u.atk, 0);
const tr1 = sum(E.opponentFor(hg)), tr0 = sum(E.opponentFor(pg));
check(tr1 === tr0, `Hard Gyms leaves ordinary trainers alone (${tr1} vs ${tr0})`);
const gi = E.runPlan(hg).findIndex(p => p.kind === 'gym'); hg.stage = pg.stage = gi;
const g1 = sum(E.opponentFor(hg)), g0 = sum(E.opponentFor(pg));
check(g1 > g0 * 1.05, `Hard Gyms makes the gym leader stronger (${g1} vs ${g0})`);
check(E.HANDICAPS.every(k => E.MOD_INFO[k] && E.MOD_INFO[k].name() && E.MOD_INFO[k].text()), 'every challenge has a name and text');
console.log(fails ? fails + ' FAILED' : 'all good'); process.exit(fails ? 1 : 0);
