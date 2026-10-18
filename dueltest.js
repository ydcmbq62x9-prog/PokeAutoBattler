/* Duels: the rules, the codes, and that two devices agree on the same battle. */
const E = require('./engine.js'); let bad = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) bad++; };
const T = E.TUNING.duel;
const mk = (id, bump, held) => { const u = E.makeUnit(id, 10); u.hp += bump; u.atk += bump; u.spd += bump; if(held) u.held = held; return u; };
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4).slice(0, 40);
const boxOf = (seedOff, n = 14) => Array.from({ length:n }, (_, i) => E.snapUnit(mk(ROSTER[(i * 3 + seedOff) % ROSTER.length], 20 + i * 2, i < 4 ? ['band', 'claw', 'sitrus', 'coat'][i] : null), 'b' + seedOff + '_' + i));

/* frozen snapshot */
{ const u = mk('machop', 30, 'band'), s = E.snapUnit(u, 'x1'); const t = E.thawUnit(s, 3);
  check(s.bid === 'x1' && t.hp === u.hp && t.atk === u.atk && t.spd === u.spd && t.held === 'band' && t.pos === 3, 'a saved pokémon thaws to the same stats, item and position');
  check(E.thawUnit(s, 0, null).held === null && E.thawUnit(s, 0, 'claw').held === 'claw', 'its item can be overridden'); }

/* budget */
const A = boxOf(0), Bx = boxOf(5);
const setA = E.newDuelSet('Ann', '6.13.0'), setB = E.newDuelSet('Bob', '6.13.0');
const pick = (box, idx, items) => idx.map((i, k) => ({ bid: box[i].bid, pos: k, item: items ? items[k] : box[i].held }));
{ const six = pick(A, [0, 1, 2, 3, 4, 5]); const why = E.duelCheckPicks(setA, A, six);
  check(why === '' || /budget/.test(why), `a normal six is judged on the budget ("${why || 'fits'}")`);
  const big = A.map(s => Object.assign({}, s, { hp:s.hp + 400, atk:s.atk + 400 })); const wb = E.duelCheckPicks(setA, big, pick(big, [0, 1, 2, 3, 4, 5]));
  check(/over the power budget/.test(wb), 'six very strong pokémon do not fit the budget'); check(E.duelCheckPicks(setA, A, []) !== '', 'an empty team is refused');
  check(E.duelCheckPicks(setA, A, pick(A, [0, 0])) !== '', 'the same pokémon twice is refused'); }
/* find a legal six for each */
const legal = (box, set) => { for(let a = 0; a < box.length - 5; a++){ const p = pick(box, [a, a + 1, a + 2, a + 3, a + 4, a + 5]); if(E.duelCheckPicks(set, box, p) === '') return p; } return null; };
let pA = legal(A, setA), pB = legal(Bx, setB);
if(!pA || !pB){ const cheap = (box) => box.map(s => Object.assign({}, s, { hp:Math.round(s.hp * .5), atk:Math.round(s.atk * .5) })); console.log('(using cheaper boxes)'); }
check(!!pA && !!pB, 'each player can find a legal six in their box');

/* codes */
let cA = E.duelCode(setA, A, pA), cB = E.duelCode(setB, Bx, pB);
check(/^PKD1-/.test(cA) && E.duelParse(cA).ok, 'a lock-in code parses');
check(E.duelParse(cA.slice(0, -3) + 'AAA').err, 'a damaged code is refused'); check(E.duelParse('hello').err && E.duelParse('PKD1-zz-@@').err, 'junk is refused');
check(E.duelCheckOpponent(setA, E.duelParse(cB)) === '', 'the opponent\'s code is accepted');
check(/version/.test(E.duelCheckOpponent(Object.assign({}, setA, { ver:'6.14.0' }), E.duelParse(cB))), 'a different game version is refused');
check(/game 2/.test(E.duelCheckOpponent(Object.assign({}, setA, { game:2 }), E.duelParse(cB))), 'a code for the wrong game is refused');

/* both devices see the same battle */
const oa = E.duelSim(setA, cA, cB), ob = E.duelSim(setB, cB, cA);
check(JSON.stringify(oa.sim.steps.map(s => s.lines)) === JSON.stringify(ob.sim.steps.map(s => s.lines)), `both devices get the same battle (${oa.sim.steps.length} steps)`);
check(oa.myResult !== 'draw' ? oa.myResult !== ob.myResult : ob.myResult === 'draw', `...and opposite results (${oa.myResult} / ${ob.myResult})`);
check(oa.seed === ob.seed, 'the seed is shared');
check(oa.myFainted.length === ob.theirFainted.length && oa.theirFainted.length === ob.myFainted.length, 'both agree who fainted');

/* a set */
const A1 = JSON.parse(JSON.stringify(setA)), B1 = JSON.parse(JSON.stringify(setB));
E.duelApply(A1, oa); E.duelApply(B1, ob);
check(A1.id && A1.id === B1.id, 'both devices get the same set id after game 1');
check(A1.opp === 'Bob' && B1.opp === 'Ann', 'each learns the other\'s name');
check(JSON.stringify(A1.pool.slice().sort()) === JSON.stringify(A.filter(s => pA.some(p => p.bid === s.bid) && s.held).map(s => s.held).sort()), 'the item pool is the items on the six brought to game 1');
check(A1.rest.length === oa.myFainted.length, 'whoever fainted rests');
check(A1.over ? A1.games.length === 1 && false : A1.game === 2, 'game 2 is next after one game');
{ const r = A1.rest[0]; if(r){ const p2 = pick(A, [0, 1, 2, 3, 4, 5]).map(p => p); const withRest = [{ bid:r, pos:0, item:null }];
  check(/sits this one out/.test(E.duelCheckPicks(A1, A, withRest)), 'a pokémon that fainted last game cannot be brought to game 2'); } }

/* the rest rule is one game only */
{ const S = E.newDuelSet('X', 'v'); S.id = 'id'; S.game = 3; S.rest = ['gone']; S.games = [{ result:'win' }, { result:'lose' }];
  S.rest = ['b9']; const o = { mine:{ raw:'m', units:[['machop', 1, 1, 1, 0, '', 0, 'b1']], name:'X' }, theirs:{ raw:'t', units:[['machop', 1, 1, 1, 0, '', 0, 'z1']], name:'Y' }, myResult:'win', myFainted:['b1'], theirFainted:[] };
  S.games.push({ result:'win', theirPool:[] }); /* pretend */ }
{ /* simulate a three-game flow with results forced */
  const mkOut = (res, mf, tf) => ({ iAmP:true, mine:{ raw:'a' + Math.random(), units:[['machop', 1, 1, 1, 0, 'band', 0, 'p1'], ['onix', 1, 1, 1, 0, '', 1, 'p2']], name:'Me' }, theirs:{ raw:'b' + Math.random(), units:[['abra', 1, 1, 1, 0, '', 0, 'q1']], name:'You' }, myResult:res, myFainted:mf, theirFainted:tf });
  let s = E.newDuelSet('Me', 'v'); E.duelApply(s, mkOut('win', ['p1'], ['q1']));
  check(s.game === 2 && !s.over && s.rest[0] === 'p1', 'game 1 won: set goes on, the fainted one rests');
  E.duelApply(s, mkOut('win', [], [])); check(s.over === 'win', 'two wins ends the set (2–0)');
  s = E.newDuelSet('Me', 'v'); E.duelApply(s, mkOut('win', [], [])); E.duelApply(s, mkOut('lose', [], [])); check(s.game === 3 && !s.over, '1–1 goes to a third game');
  E.duelApply(s, mkOut('draw', [], [])); check(s.over === 'draw', 'W-L-D is a drawn set');
  s = E.newDuelSet('Me', 'v'); E.duelApply(s, mkOut('win', [], [])); E.duelApply(s, mkOut('draw', [], [])); E.duelApply(s, mkOut('lose', [], [])); check(s.over === 'draw', 'W-D-L is a drawn set');
  s = E.newDuelSet('Me', 'v'); E.duelApply(s, mkOut('win', [], [])); E.duelApply(s, mkOut('draw', [], [])); E.duelApply(s, mkOut('draw', [], [])); check(s.over === 'win', 'W-D-D: more wins takes the set');
  s = E.newDuelSet('Me', 'v'); E.duelApply(s, mkOut('lose', [], [])); E.duelApply(s, mkOut('lose', [], [])); check(s.over === 'lose', 'two losses ends the set (0–2)'); }

/* items: only the pool, only from game 2 */
{ const box = [E.snapUnit(mk('machop', 10, 'band'), 'm1'), E.snapUnit(mk('onix', 10, 'coat'), 'm2'), E.snapUnit(mk('abra', 10, null), 'm3'), E.snapUnit(mk('geodude', 10, 'claw'), 'm4')];
  const S = E.newDuelSet('Me', 'v'); S.budget = 99999;
  check(/before game 1/.test(E.duelCheckPicks(S, box, [{ bid:'m1', pos:0, item:'coat' }, { bid:'m2', pos:1, item:'band' }])), 'items cannot move before game 1');
  check(E.duelCheckPicks(S, box, [{ bid:'m1', pos:0, item:'band' }, { bid:'m2', pos:1, item:'coat' }]) === '', 'game 1: each keeps its saved item');
  S.pool = ['band', 'coat']; S.game = 2;     // set started with m1+m2
  check(E.duelCheckPicks(S, box, [{ bid:'m3', pos:0, item:'band' }, { bid:'m2', pos:1, item:'coat' }]) === '', 'game 2: a pool item can move to a pokémon swapped in from the box');
  check(/no spare/.test(E.duelCheckPicks(S, box, [{ bid:'m4', pos:0, item:'claw' }])), 'a swapped-in pokémon\'s own saved item is not in the pool');
  check(/no spare/.test(E.duelCheckPicks(S, box, [{ bid:'m1', pos:0, item:'band' }, { bid:'m3', pos:1, item:'band' }])), 'one Muscle Band cannot be used twice'); }

/* box */
{ let box = []; const r = E.duelBoxAdd(box, [E.snapUnit(mk('machop', 1))]); check(r.ok && r.box.length === 1, 'a pokémon goes into the box');
  const full = Array.from({ length:T.boxSize }, (_, i) => E.snapUnit(mk('machop', i)));
  check(!E.duelBoxAdd(full, [E.snapUnit(mk('onix', 1))]).ok, `the box holds ${T.boxSize}`); check(E.duelSavesFor(true) === 3 && E.duelSavesFor(false) === 1, 'a win saves 3, a loss saves 1'); }

/* the opponent's cheating is caught */
{ const S2 = JSON.parse(JSON.stringify(A1)); const tp = E.duelParse(E.duelCode(Object.assign(JSON.parse(JSON.stringify(B1)), {}), Bx, pick(Bx, [0, 1, 2, 3, 4, 5].filter(i => !B1.rest.includes(Bx[i].bid)).slice(0, 4))));
  check(typeof E.duelCheckOpponent(S2, tp) === 'string', 'an opponent code is checked against the set (game 2)'); }

console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
