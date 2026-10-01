/* 2.5.0: one move name = one effect, on every pokémon that has it. Only percentages may differ. */
const E = require('./engine.js'); const S = E.SPECIES;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const by = {};
for(const [id, sp] of Object.entries(S)){
  for(const [slot, m] of [['main', sp.move], ['second', sp.move2]]){
    if(!m) continue;
    (by[m.name] = by[m.name] || []).push({ id, slot, sig: m.sig, m });
    if(m.basic) (by[m.basic.name] = by[m.basic.name] || []).push({ id, slot: slot + ' basic', sig: 'hit', m });   // a charge move's filler is a plain hit
  }
}
let bad = 0;
for(const [name, list] of Object.entries(by)){
  const sigs = [...new Set(list.map(x => x.sig))];
  if(sigs.length > 1){ bad++; check(false, `"${name}" has ${sigs.length} different effects: ` + list.map(x => `${x.id}(${x.sig})`).join(', ')); }
}
check(bad === 0, `all ${Object.keys(by).length} move names each mean one effect everywhere`);
const need = (id, slot, name) => check((slot === 'main' ? S[id].move : S[id].move2).name === name, `${id}'s ${slot} move is ${name}`);
need('jolteon', 'second', 'Thunderbolt'); need('raichu', 'main', 'Thunderbolt');
check(S.jolteon.move2.sig === S.raichu.move.sig, 'Jolteon and Raichu Thunderbolts are the same kind of move (hits every enemy)');
need('magneton', 'main', 'Flash Cannon'); need('bulbasaur', 'main', 'Absorb'); need('venusaur', 'second', 'Poison Powder');
check(S.bulbasaur.role === 'tank' && S.ivysaur.role === 'tank' && S.venusaur.role === 'tank', 'Bulbasaur line is a Tank');
check(S.squirtle.role === 'bruiser' && S.wartortle.role === 'bruiser' && S.blastoise.role === 'bruiser', 'Squirtle line is a Bruiser');
check(!['Withdraw', 'Reflect'].includes(S.squirtle.move.name) && S.squirtle.move2.name !== 'Reflect', 'Squirtle no longer has Withdraw or Reflect');
check(!['Absorb', 'Mega Drain'].includes(S.oddish.move.name) && !['Absorb', 'Mega Drain'].includes(S.gloom.move.name), 'Oddish and Gloom no longer borrow the drain moves\' names');
check(S.bulbasaur.move.kind === 'drain' && S.ivysaur.move.kind === 'drain', 'Absorb and Mega Drain heal the user (drain)');
check(Object.values(S).every(sp => [sp.move, sp.move2].every(m => !m || m.name !== 'Solar Beam' || m.kind === 'charge')), 'Solar Beam is always a charge move');
console.log(fails ? `${fails} FAILED` : 'move names passed'); process.exit(fails ? 1 : 0);
