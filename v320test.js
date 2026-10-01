/* v320: the roster stat pass and the new boss benches. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const st = (k, hp, atk, spd) => check(S[k].hp === hp && S[k].atk === atk && S[k].spd === spd, `${k} is ${hp}/${atk}/${spd}`);
st('starmie', 32, 31, 68); st('electrode', 26, 22, 72);
st('electabuzz', 28, 31, 66); st('hitmonlee', 26, 35, 54); st('pidgeot', 34, 34, 56); st('gengar', 30, 44, 70); st('arcanine', 38, 40, 60);
/* pools */
const pool = id => E.themePool(E.bossById(id));
const names = (id, ks) => check(ks.every(k => pool(id).includes(k)), `${id} fields ${ks.join(', ')}`);
names('bruno', ['machop','mankey','primeape','hitmonlee','hitmonchan','onix']); check(!pool('bruno').includes('geodude'), 'Bruno keeps only Onix of the Rock');
names('koga', ['caterpie','scyther','paras','koffing','weezing']); check(!['bulbasaur','oddish','zubat'].some(k => pool('koga').includes(k)), 'Koga has no Grass-Poisons or bats');
names('agatha', ['gastly','gengar','zubat','golbat','drowzee','hypno']);
names('erika', ['bulbasaur','oddish','bellsprout','exeggcute','tangela']); check(!['caterpie','scyther','paras'].some(k => pool('erika').includes(k)), 'Erika has no Bugs');
names('lorelei', ['seel','dewgong','shellder','cloyster','lapras','jynx']); names('sabrina', ['abra','drowzee','jynx','exeggcute']);
check(!pool('giovanni').includes('geodude') && !pool('giovanni').includes('onix') && pool('giovanni').includes('rhydon'), 'Giovanni leaves the Rock walls to Brock but keeps Rhydon');
check(!pool('lance').includes('zubat') && !pool('lance').includes('scyther') && pool('lance').includes('dragonite'), 'Lance drops the bats and bugs');
const ids = E.ALL_BOSSES.filter(b => b.id !== 'blue');
check(Object.keys(S).filter(k => !S[k].legendary && E.inGens(k, [1])).every(k => ids.some(b => pool(b.id).includes(k))), 'every Gen 1 pokémon is in at least one Gen 1 gym or Elite Four pool');
{ E.setActiveGens([1, 2]); const all = [...E.EVERY_BOSS].filter(b => b.theme);   // 4.0.0
  const miss = Object.keys(S).filter(k => !S[k].legendary && S[k].gen === 2 && !all.some(b => E.themePool(b).includes(k) || (b.guards || []).includes(k)));
  check(!miss.length, `every Gen 2 pokémon can turn up on some leader's bench or as a bodyguard (${miss.join(', ') || 'all'})`); E.setActiveGens([1]); }
{ let worst = 0; for(const a of ids) for(const b of ids) if(a !== b){ const A = pool(a.id), B = pool(b.id); worst = Math.max(worst, A.filter(k => B.includes(k)).length / Math.min(A.length, B.length)); }
  check(worst <= 0.4, `no two leaders share more than 40% of a bench (worst ${Math.round(worst * 100)}%)`); }
/* excluded species never turn up as bodyguards */
for(const [id, bad] of [['misty', ['seel','dewgong','shellder','cloyster','lapras']], ['giovanni', ['geodude','graveler','golem','onix']]]){
  let seen = 0; for(let s = 1; s <= 40; s++) seen += E.generateAiTeam({ turn:22, seed:s, badges:6, kind:'gym', boss:E.bossById(id), tier:4 }).team.filter(u => bad.includes(u.id)).length;
  check(seen === 0, `${id} never brings ${bad[0]} & co. even as a bodyguard`); }
console.log(fails ? `${fails} FAILED` : 'v320 passed'); process.exit(fails ? 1 : 0);
