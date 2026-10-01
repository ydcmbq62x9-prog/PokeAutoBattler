/* 2.1.0: Articuno and Moltres; legendaries have no tier, never level, have a higher BST and grow faster. */
const E = require('./engine.js'); const T = E.TUNING, S = E.SPECIES;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const LEG = ['zapdos','mewtwo','articuno','moltres'];
check(JSON.stringify(E.LEGENDS().sort()) === JSON.stringify([...LEG].sort()), 'the four legendaries are Zapdos, Mewtwo, Articuno and Moltres');
check(S.articuno.type === 'Ice' && S.articuno.role === 'tank' && S.moltres.type === 'Fire' && S.moltres.role === 'bruiser', 'Articuno is an Ice Tank, Moltres a Fire Bruiser');
check(LEG.every(k => S[k].tier === undefined), 'legendaries have no tier');
check(LEG.every(k => !E.BUYABLE.includes(k)), 'legendaries are not in the buyable/trainer pool');
const bst = k => S[k].hp + S[k].atk + S[k].spd;
const topReg = Math.max(...Object.keys(S).filter(k => !S[k].legendary).map(bst));
check(LEG.every(k => bst(k) > topReg * 1.3), `every legendary’s base stat total is well above the best regular pokémon (${topReg}): ${LEG.map(k => k + ' ' + bst(k)).join(', ')}`);
// never levels
const u = E.makeUnit('moltres', 0), G = E.newGame(3); G.team = [u];
const r = E.addExp(G, u, 5);
check(!r.leveled && E.unitLevel(u) === 1 && u.id === 'moltres', 'EXP never levels a legendary up');
const before = [u.hp, u.atk, u.spd]; E.applyLevelUp(G, u);
check(u.hp === before[0] && u.atk === before[1] && u.spd === before[2], 'a forced level-up does nothing to a legendary');
check(!E.canUseItem('candy', u) && E.canUseItem('candy', E.makeUnit('machop', 0)), 'Rare Candy can’t be used on a legendary (still works on others)');
const pp = E.expPipsToNext(u); check(pp.need === 0, 'no EXP pips on a legendary');
// grows faster
check(T.legend.growth > 1 && T.legend.growth <= 1.3, `legendaries grow slightly faster (×${T.legend.growth})`);
const a = E.makeUnit('moltres', 0), b = E.makeUnit('tauros', 0);   // both bruisers
const a0 = a.hp + a.atk + a.spd, b0 = b.hp + b.atk + b.spd;
for(let i = 0; i < 20; i++){ E.growUnit(a, T.expGainWin); E.growUnit(b, T.expGainWin); }
const ga = a.hp + a.atk + a.spd - a0, gb = b.hp + b.atk + b.spd - b0;
check(Math.abs(ga / gb - T.legend.growth) < 0.08, `battle EXP grows a legendary ×${(ga / gb).toFixed(2)} as fast as a regular pokémon of its role`);
// opponents never field one (2.2.0: except the Champion's own, tested in v220test)
let seen = 0;
for(let s = 1; s <= 120; s++) for(const kind of ['trainer','gym','elite','champion']){
  const t = E.generateAiTeam({ turn: 30, seed: s, badges: 8, kind, tier: 6, boss: kind === 'trainer' ? null : { id:'x' + s, theme: [['Ice','Flying'],['Psychic'],['Electric'],['Fire','Flying']][s % 4] } });
  seen += (t.team || t).filter(x => S[x.id].legendary).length; }
check(seen === 0, 'no trainer, gym or Elite Four team fields a legendary of its own choosing');
// mono-type pools
const mono = t => { const M = E.newGame(11, { mods: { mono:t } }); const got = new Set(); for(let s = 1; s < 300; s++){ M.seed = s; M.legendsMet = []; M.badges = 6; const e = E.rollEncounter(M); if(e) got.add(e.id); } return [...got].sort().join(','); };
check(mono('Fire') === 'moltres' && mono('Electric') === 'zapdos' && mono('Grass') === '' && mono('Bug') === '', 'Mono-type runs meet only their own type’s legendary');
// encounter chance keeps ~half of runs meeting one
const p = 1 - Math.pow(1 - T.legend.chance, 2);
check(p > 0.25 && p < 0.7, `about ${Math.round(p * 100)}% of runs meet a legendary before the 7th-gym guarantee`);
console.log(fails ? `${fails} FAILED` : 'v210 passed'); process.exit(fails ? 1 : 0);
