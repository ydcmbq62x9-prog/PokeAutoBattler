/* v360: curated bodyguards, and the boss sprite on the dock card. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const themed = E.ALL_BOSSES.filter(b => b.theme);
check(themed.every(b => Array.isArray(b.guards) && b.guards.length >= 4 && b.guards.every(k => S[k])), 'every themed leader has a list of real bodyguards');
/* nobody off-theme ever shows up unless it is on the leader's guard list */
for(const b of themed){
  const pool = E.themePool(b); let bad = new Set();
  for(let seed = 1; seed <= 60; seed++) for(const [badges, turn, kind] of [[0, 6, 'gym'], [4, 18, 'gym'], [7, 26, 'gym'], [8, 28, 'elite']]){
    if((kind === 'gym') !== E.GYMS.includes(b)) continue;
    const t = E.generateAiTeam({ turn:turn + (seed % 3), seed, badges, boss:b, kind, tier:Math.min(6, 2 + (badges >> 1)), size:6 });
    for(const u of t.team) if(!pool.includes(u.id) && !b.guards.includes(u.id) && !b.guards.some(g => E.evoFamily(g).includes(u.id))) bad.add(u.id); }
  check(!bad.size, `${b.name} only brings guards from their list${bad.size ? ' — stray: ' + [...bad].join(', ') : ''}`); }
{ let onix = 0; for(let s = 1; s <= 80; s++) for(const bd of [2, 5, 8]) onix += E.generateAiTeam({ turn:8 + bd * 3, seed:s, badges:bd, kind:'gym', boss:E.bossById('surge'), tier:5 }).team.filter(u => u.id === 'onix').length;
  check(onix === 0, 'no Onix in Lt. Surge’s gym'); }
check(E.bossById('surge').guards.includes('pidgeot') && E.bossById('giovanni').guards.includes('koffing'), 'Surge has Flying guards and Giovanni has Team Rocket’s Koffing');
/* the dock card art no longer collides with the .dock layout class */
const ui = require('fs').readFileSync('ui.js', 'utf8'), shell = require('fs').readFileSync('shell.html', 'utf8');
check(/bossArt\(b, 'dockart'\)/.test(ui) && /\.bossart\.dockart\{/.test(shell) && !/bossArt\(b, 'dock'\)/.test(ui), 'the dock art uses its own class');
check(T.gauntletRatio.join(',') === '0.3818,0.4331,0.4102,0.4057,0.4837', 'Elite Four and Champion ratios unchanged');
check(T.mods.richFoes > 1.2 && T.mods.richFoes < 1.4 && T.mods.nopcFoes > 0.9 && T.mods.nopcFoes < 1.1 && T.mods.onelifeFoes > 0.9 && T.mods.onelifeFoes < 1.1, 'Rich, No PC and One Life re-measured');   // 3.8.0: re-measured again; v380test pins the values
check(['Normal','Fire','Water','Electric','Grass','Bug','Fighting'].every(t => T.mods.monoFoes[t] > 0.6 && T.mods.monoFoes[t] < 1.2), 'Mono factors re-measured');   // 3.8.0: re-measured again
console.log(fails ? `${fails} FAILED` : 'v360 passed'); process.exit(fails ? 1 : 0);
