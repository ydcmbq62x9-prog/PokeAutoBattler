/* 2.10.1: boss blurbs match the rosters. */
const E = require('./engine.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
check(!E.ALL_BOSSES.some(b => /Leech/i.test(b.blurb)), 'no blurb mentions Leech Seed');
for(const b of E.ALL_BOSSES.filter(b => b.signature)){
  const lead = b.signature.map(k => E.SPECIES[k].name);
  const shown = ['Starmie', 'Onix', 'Vileplume', 'Victreebel'].filter(n => lead.includes(n));
  check(b.blurb.length > 20 && b.blurb.length < 110, `${b.name}'s blurb is a sensible length (${b.blurb.length})`);
}
for(const [id, name] of [['blaine', 'Arcanine'], ['lance', 'Dragonite'], ['agatha', 'Gengar'], ['bruno', 'Machamp'], ['sabrina', 'Alakazam'], ['lorelei', 'Lapras'], ['misty', 'Starmie'], ['giovanni', 'Rhydon']])
  check(E.bossById(id).blurb.includes(name), `${E.bossById(id).name}'s blurb names ${name}`);
console.log(fails ? `${fails} FAILED` : 'v2101 passed'); process.exit(fails ? 1 : 0);
