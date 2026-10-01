/* v300: the real Gen 1 type chart — one main type per pokémon, 14 types, Mono runs only for types with 3+ lines. */
const E = require('./engine.js'); const T = E.TUNING, S = E.SPECIES;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
check(Object.keys(E.TYPES).length === 17 && Object.keys(E.TYPES).includes('Electric') && Object.keys(E.TYPES).includes('Poison') && Object.keys(E.TYPES).includes('Steel') && Object.keys(E.TYPES).includes('Dark'), 'seventeen types (Poison added in 3.1.0, Steel and Dark in 4.0.0), Electric not Lightning');
check(!Object.values(S).some(s => s.type === 'Lightning' || s.type === 'Colorless'), 'no pokémon is Lightning or Colorless');
const want = { bulbasaur:'Grass', butterfree:'Bug', scyther:'Bug', gyarados:'Water', pidgeot:'Flying', onix:'Rock', rhydon:'Ground', dragonite:'Dragon', gengar:'Ghost', articuno:'Ice', zapdos:'Electric', moltres:'Fire', exeggutor:'Grass', rattata:'Normal', jolteon:'Electric', machamp:'Fighting', alakazam:'Psychic' };
for(const [k, t] of Object.entries(want)) check(S[k] && S[k].type === t, `${k} is ${t}`);
check(E.singleTypeOf('Normal/Flying') === 'Flying' && E.singleTypeOf('Water/Ice') === 'Water' && E.singleTypeOf('Ghost/Poison') === 'Ghost', 'one-type rule: first type, Normal/Flying → Flying');
const dblWeak = Object.keys(E.TYPES).filter(t => E.TYPES[t].weak.length > 1);
check(dblWeak.length >= 8, `most types are now weak to several types (${dblWeak.length})`);
check(Object.keys(E.TYPES).every(t => E.TYPES[t].weak.every(w => E.typeMult(w, t) === 2)), 'every listed weakness hits ×2');
check(E.MONO_TYPES.join() === 'Normal,Fire,Water,Electric,Grass,Fighting,Ground,Flying,Poison,Bug', `Mono runs: ${E.MONO_TYPES.join(', ')}`);
check(E.MONO_TYPES.every(t => E.BUYABLE.filter(k => S[k].type === t).length >= 3), 'every Mono type has at least three buyable lines');
check(E.cleanMods({ mono:'Psychic' }).mono === undefined && E.cleanMods({ mono:'Lightning' }).mono === undefined && E.cleanMods({ mono:'Bug' }).mono === 'Bug', 'old or too-small Mono types are dropped, Bug is kept');
for(let s = 1; s < 60; s++){ const m = E.dailyMods(s); if(m.mono) check(E.monoTypesFor(E.dailyGens(s)).includes(m.mono), 'daily Mono type is valid'); }
/* re-measured factors */
check(T.gauntletRatio.length === 5, 'Elite Four and Champion ratios exist (values pinned in v320test)');
check(T.mods.richFoes > 1.1 && T.mods.nopcFoes < 1.1 && T.mods.onelifeFoes < 1.1, 'Rich, No PC and One Life factors exist (pinned in v320test)');
check(E.MONO_TYPES.every(t => T.mods.monoFoes[t] > 0.6 && T.mods.monoFoes[t] < 1.6), 'every Mono type has a factor (pinned in v320test)');
check(E.ALL_BOSSES.find(b => b.id === 'brock').calib < 1.5, 'Brock stays the gentlest gym');
/* rival still counters your team */
{ const G = E.newGame(9); E.rollShop(G, false); G.team = ['squirtle','poliwag','onix'].map(id => E.makeUnit(id, 0)); G.stage = E.rivalStages(G)[0]; G.turn = 3; E.opponentFor(G);
  check(!!S[G.rival.starter], `rival starter ${G.rival.starter} exists`); }
/* boss pools are still large enough */
for(const b of E.ALL_BOSSES) check(E.themePool(b).length >= 4, `${b.id} still has a pool (${E.themePool(b).length})`);
console.log(fails ? `${fails} FAILED` : 'v300 passed'); process.exit(fails ? 1 : 0);
