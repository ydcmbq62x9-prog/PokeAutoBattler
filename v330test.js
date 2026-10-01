/* v330: tank/bruiser identities and an evolved Elite Four. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
check(S.blastoise.move.name === 'Surf' && S.blastoise.move.kind === 'all', 'Blastoise hits every enemy with Surf');
for(const k of ['onix','golem','cloyster','rhydon']){
  const m = S[k].move2; check(m.trig === 'open' && m.free && m.kind === 'shield', `${k} opens behind a free barrier (${m.name})`); }
check(S.snorlax.spd === 26 && S.snorlax.move2.name === 'Reflect' && S.snorlax.move2.trig === 'open', 'Snorlax is faster and opens with Reflect');
check(/whole team/.test(S.snorlax.move2.text(1)), 'Reflect shields the whole team');
/* the barrier really lands at the start */
{ const mk = id => E.makeUnit(id, 0); const A = E.formationSort([mk('snorlax'), mk('machop')]), B = E.formationSort([mk('pidgey')]);
  const r = E.simulateBattle(A, B, 3); check(r && r.result, 'a Snorlax battle simulates'); }
/* Elite Four: evolved only */
const isFinal = k => !E.evoNext(k).length;
for(const b of E.ELITE_FOUR){
  let un = 0, tot = 0;
  for(let seed = 1; seed <= 60; seed++){
    const t = E.generateAiTeam({ turn:24 + (seed % 10), seed, badges:8, boss:b, kind:'elite', tier:6, size:6 });
    for(const u of t.team){ tot++; if(!isFinal(u.id)) un++; } }
  check(un === 0, `${b.name} fields no unevolved pokémon (${tot} sampled)`);
  check(b.signature.every(isFinal), `${b.name}'s leads are all final forms`);
  check(E.themePool(b).filter(isFinal).length >= 4, `${b.name} has at least four finals to choose from`);
}
check(E.themePool(E.bossById('lorelei')).includes('vaporeon') && E.themePool(E.bossById('agatha')).includes('weezing') && E.themePool(E.bossById('agatha')).includes('victreebel'), 'Lorelei gains Vaporeon, Agatha gains Weezing and Victreebel');
/* gyms are unchanged: they still field earlier forms */
{ let early = 0; for(let s = 1; s <= 40; s++) early += E.generateAiTeam({ turn:8, seed:s, badges:2, kind:'gym', boss:E.bossById('brock'), tier:3 }).team.filter(u => E.evoNext(u.id).length).length;
  check(early > 0, 'gym leaders still field earlier forms'); }
console.log(fails ? `${fails} FAILED` : 'v330 passed'); process.exit(fails ? 1 : 0);
