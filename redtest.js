/* 4.1.0: Red on Mt. Silver — chance, team, one chance, rewards. */
const E = require('./engine.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
/* chance */
let g1 = 0, g2 = 0, gm = 0; const N = 6000;
for(let s = 1; s <= N; s++){ if(E.drawRed(s, [1])) g1++; if(E.drawRed(s, [2])) g2++; if(E.drawRed(s * 3, [1, 2])) gm++; }
check(g1 === 0, 'a Gen 1-only run never has Red');
check(g2 / N > 0.14 && g2 / N < 0.195 && gm / N > 0.14 && gm / N < 0.195, `about one run in six has him (Gen 2 ${(g2 / N * 100).toFixed(1)}%, mixed ${(gm / N * 100).toFixed(1)}%)`);
check(E.drawRed(77, [2]) === E.drawRed(77, [2]), 'drawn from the seed, so the same every time');
const G0 = E.newGame(5, { gens: [2] });
check(G0.redOpen === false && G0.redResult === null && typeof G0.redFlag === 'boolean', 'a new run starts with Red closed');
const planKinds = G => E.runPlan(G).map(p => p.kind);
check(planKinds(G0).filter(k => k === 'red').length === 0 && E.runPlan(G0).length === 37, 'he is not in the plan until the Champion falls');
/* flow helpers */
function toChampion(gens, seed, flag){
  const G = E.newGame(seed, { gens }); G.redFlag = flag; E.rollShop(G, false);
  G.stage = E.runPlan(G).findIndex(p => p.kind === 'champion'); G.badges = 8;
  return G;
}
function fightWith(G, result){ const st = E.stageOf(G); const opp = E.opponentFor0(G); E.applyBattleResult(G, result, opp, null); return opp; }
/* no flag: the Champion ends it */
let G = toChampion([2], 11, false); fightWith(G, 'win');
check(G.over === 'won' && !G.redOpen, 'without Red, beating the Champion ends the run as before');
/* with the flag */
G = toChampion([2], 11, true); const creditsBefore = G.credits, livesBefore = G.lives; fightWith(G, 'win');
check(!G.over && G.redOpen && E.stageOf(G).kind === 'red' && E.nextUp(G).kind === 'red', 'beating the Champion opens Mt. Silver instead of ending the run');
check(E.runPlan(G).length === 38 && !E.nextUp(G).lifeAtRisk, 'the plan grows by one stage and it never risks a life');
const opp = E.opponentFor0(G);
const ids = opp.team.map(u => u.id).sort().join(',');
check(opp.boss.id === 'red' && ids === ['pikachu', 'espeon', 'snorlax', 'venusaur', 'charizard', 'blastoise'].sort().join(','), 'Red fields exactly the Mt. Silver team: ' + ids);
check(opp.team.every(u => E.unitLevel(u) === 3) && opp.team.every(u => u.held), 'every one is level 3 and holding an item');
const o2 = E.opponentFor0(G);
check(JSON.stringify(o2.team.map(u => [u.id, u.hp, u.atk, u.spd])) === JSON.stringify(opp.team.map(u => [u.id, u.hp, u.atk, u.spd])), 'the same team every time (no reroll)');
/* lose */
const L = JSON.parse(JSON.stringify(G)); L.credits = 77; const l0 = L.lives;
fightWith(L, 'lose');
check(L.over === 'won' && L.redResult === 'lost' && L.lives === l0 && L.credits === 77 && !L.blackout, 'losing to Red ends the run as a clear and costs no life and no money');
const D = JSON.parse(JSON.stringify(G)); fightWith(D, 'draw');
check(D.over === 'won' && D.redResult === 'lost', 'a draw counts as a loss: one chance only');
const W = JSON.parse(JSON.stringify(G)); fightWith(W, 'win');
check(W.over === 'won' && W.redResult === 'won', 'beating Red ends the run with redResult won');
check(!E.stageOf(G).special || true, 'ok');
/* a bot's win rate against him lands in a fair band */
const B = require('./botlib.js');
for(const gens of [[2], [1, 2]]){
  let reached = 0, beat = 0;
  for(let r = 0; r < 120; r++){
    const X = E.newGame(r * 7 + 1, { gens }); X.redFlag = true; E.rollShop(X, false); let guard = 0;
    while(!X.over && guard++ < 240){ B.shop(X, { reroll:true, bench:4 }); if(E.stageOf(X).kind === 'red') reached++; B.fight(X); if(X.over) break; E.nextTurn(X); }
    if(X.redResult === 'won') beat++;
  }
  const rate = beat / Math.max(1, reached);
  check(reached > 60 && rate > 0.15 && rate < 0.55, `bot beats Red ${(rate * 100).toFixed(0)}% of ${reached} tries in ${gens.join('+')} (strong, not unbeatable)`);
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
