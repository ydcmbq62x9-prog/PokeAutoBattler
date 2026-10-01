/* 2.10.0: Lorelei is Ice-only, Koga is Poison + Bug without Ghosts, and the pools are visible. */
const E = require('./engine.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const pool = id => E.themePool(E.bossById(id));
const same = (a, b) => a.length === b.length && a.every(k => b.includes(k));
check(!same(pool('lorelei'), pool('misty')), 'Lorelei no longer shares Misty’s pool');
check(same(pool('lorelei'), ['seel', 'dewgong', 'shellder', 'cloyster', 'lapras', 'jynx', 'vaporeon']), 'Lorelei’s pool is the Ice pokémon (the Seel line, Shellder line, Lapras, Jynx) plus Vaporeon (3.3.0)');
check(pool('misty').length === 11 && !['seel','dewgong','shellder','cloyster','lapras'].some(k => pool('misty').includes(k)), 'Misty keeps a wide Water pool (11, 3.2.0: the icy Waters are Lorelei’s)');
check(!same(pool('koga'), pool('agatha')), 'Koga no longer shares Agatha’s pool');
check(!['gastly', 'haunter', 'gengar'].some(k => pool('koga').includes(k)), 'Koga fields no Ghosts');
check(['gastly', 'haunter', 'gengar'].every(k => pool('agatha').includes(k)), 'Agatha keeps the Gastly line');
check(['caterpie', 'scyther', 'paras'].every(k => pool('koga').includes(k)), 'Koga gets the Bug pokémon');
/* bodyguards never come from the excluded type either */
{ const b = E.bossById('koga'); let ghosts = 0;
  for(let s = 1; s <= 40; s++){ const t = E.generateAiTeam({ turn:20, seed:s, badges:5, kind:'gym', boss:b, tier:3 }).team.map(u => u.id);
    if(t.some(id => ['gastly', 'haunter', 'gengar'].includes(id))) ghosts++; }
  check(ghosts === 0, `Koga never brings a Ghost, even as a bodyguard (${ghosts} of 40)`); }
/* Lorelei always leads with her Ice line */
{ const b = E.bossById('lorelei'); let n = 0;
  for(let s = 1; s <= 30; s++){ const t = E.generateAiTeam({ turn:33, seed:s, badges:8, kind:'elite', boss:b, tier:6 }).team.map(u => u.id);
    if(t.some(id => ['lapras'].includes(id))) n++; }
  check(n === 30, `Lorelei fields Lapras in ${n} of 30 seeds`); }
/* the sheet section exists in the generator */
const fs = require('fs'); const g = fs.readFileSync('gen-reference.js', 'utf8');
check(/who can they field/.test(g) && /bossPoolHtml/.test(g), 'the Balance Sheet generator has the boss pools section');
console.log(fails ? `${fails} FAILED` : 'v2100 passed'); process.exit(fails ? 1 : 0);
