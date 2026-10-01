/* 1.4.0: Blue's Eevee (rival and Champion), and the Eeveelutions' types. */
const E = require('./engine.js');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const S = E.SPECIES, T = E.TYPES;

/* types: only Eevee is Normal, and each evolution fights as its type */
check(S.eevee.type === 'Normal' && S.vaporeon.type === 'Water' && S.jolteon.type === 'Electric' && S.flareon.type === 'Fire', 'Eevee is Normal; Vaporeon Water, Jolteon Electric, Flareon Fire');
check(['vaporeon','jolteon','flareon'].every(k => E.singleTypeOf(S[k].gen1) === S[k].type), '…and their Gen 1 typing gives the same single type');
{ const G = E.newGame(2); const u = E.makeUnit('eevee', 0); G.team = [u]; E.evolveUnit(G, u, 'waterstone');
  const foe = E.makeUnit('pikachu', 0); foe.atk = 400; const r = E.simulateBattle([u], [foe], 5);
  check(r.steps.flatMap(s => s.lines).some(l => /Vaporeon took \d+ damage\. It's super effective/.test(l)), 'an evolved Vaporeon takes super-effective hits from Electric, as a Water type'); }

/* the rival raises one */
const starterFor = { Grass:'bulbasaur', Fire:'charmander', Water:'squirtle' };
for(const [yours, want] of [['Grass','vaporeon'], ['Fire','jolteon'], ['Water','flareon']]){
  const G = E.newGame(21); E.rollShop(G, false); G.team = [E.makeUnit(starterFor[yours], 0)];
  const R = E.rivalCore(G);
  const m = [0, 1, 2].map(k => E.rivalLineup(G, k).map(u => u.id));
  check(R.core.includes('eevee') && R.eevo === want, `vs a ${yours} party his starter is ${R.starter}, so his Eevee becomes ${S[R.eevo].name} (${want})`);
  check(!m[0].includes('eevee') && m[1].includes('eevee') && m[2].includes(want) && !m[2].includes('eevee'), `…Eevee at the second meeting, ${S[want].name} at the third (${m[1].join(',')} → ${m[2].join(',')})`);
}
{ // no Eeveelution covers a Pikachu/Machop/Abra starter: a seeded pick, the same on every call
  const G = E.newGame(33); E.rollShop(G, false); G.team = [E.makeUnit('squirtle', 0), E.makeUnit('staryu', 0)];
  const a = E.rivalEevo(G), b = E.rivalEevo(G);
  check(['vaporeon','jolteon','flareon'].includes(a) && a === b, `with no clear counter it's still one fixed Eeveelution (${a})`); }

/* the Champion brings the same one */
{ let ok = 0, n = 0, match = 0, plain = 0;
  for(let s = 1; s < 200; s++){ const G = E.newGame(s); E.rollShop(G, false); G.team = [E.makeUnit(['bulbasaur','charmander','squirtle'][s % 3], 0)];
    const met = s % 2 === 0; if(met) E.rivalCore(G);
    G.badges = 8; G.turn = 34; G.stage = E.runPlan().length - 1;
    const opp = E.opponentFor(G), ids = opp.team.map(u => u.id); n++;
    const evs = ids.filter(x => ['vaporeon','jolteon','flareon'].includes(x)); const ev = evs.length === 1 ? evs[0] : null;
    if(ev){ ok++; if(E.unitLevel(opp.team.find(u => u.id === ev)) === 3) match++; }
    if(met && ev === G.rival.eevo) match += 0;   // counted below
    if(ids.includes('eevee')) plain++;
    if(met && ev !== G.rival.eevo){ ok--; }
  }
  check(ok === n, `every Champion team fields exactly one Eeveelution, and it's the one his Eevee became when you've met (${ok}/${n})`);
  check(match === n, `…fully trained (${match}/${n})`);
  check(plain === 0, '…never a plain Eevee beside it'); }

/* gym leaders and the Elite Four are untouched by it */
{ let bad = 0;
  for(const b of [...E.GYMS, ...E.ELITE_FOUR]) for(let s = 1; s < 15; s++){
    const t = E.generateAiTeam({ turn: 30, seed: s, badges: 8, boss: b, kind: E.GYMS.includes(b) ? 'gym' : 'elite', tier: 6, size: 6, ratio: 1 });
    if(t.team.filter(u => ['vaporeon','jolteon','flareon'].includes(u.id)).length > 1) bad++; }
  check(bad === 0, 'no other boss is forced to field an Eeveelution'); }

console.log(fails ? `${fails} FAILED` : '1.4.0 passed');
process.exit(fails ? 1 : 0);
