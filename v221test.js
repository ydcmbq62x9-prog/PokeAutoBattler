/* 2.2.1: One Life — every lost battle takes the life; normal runs keep their free boss rematches. */
const E = require('./engine.js'); const T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const lose = (G, kindPred) => { // put the run at the first stage matching, then lose it
  const plan = E.runPlan(); G.stage = plan.findIndex(kindPred); G.team = [E.makeUnit('machop', 0)]; E.fixSlots && E.fixSlots(G);
  const opp = E.opponentFor(G); return E.applyBattleResult(G, 'lose', opp, {}); };
{ const G = E.newGame(5, { mods: { onelife: true } }); const over = lose(G, s => s.kind === 'trainer');
  check(over === 'lost' && G.lives <= 0, 'One Life: losing a regular trainer battle ends the run'); }
{ const G = E.newGame(5, { mods: { onelife: true } }); const over = lose(G, s => s.kind === 'gym');
  check(over === 'lost' && G.lives <= 0, 'One Life: losing the FIRST gym-leader fight ends the run (no free rematch)'); }
{ const G = E.newGame(5, { mods: { onelife: true } }); G.badges = 8; const over = lose(G, s => s.kind === 'elite');
  check(over === 'lost', 'One Life: losing to an Elite Four member ends the run'); }
{ const G = E.newGame(5, { mods: { onelife: true } }); G.stage = E.runPlan().findIndex(s => s.kind === 'gym'); const n = E.nextUp(G);
  check(n.lifeAtRisk === true, 'One Life: the gym leader’s card already warns that a loss costs the life'); }
{ const G = E.newGame(5); const over = lose(G, s => s.kind === 'gym');
  check(!over && G.lives === T.startingLives, `a normal run still gets free gym rematches (lives ${G.lives}/${T.startingLives})`);
  const n = E.nextUp(G); check(n.lifeAtRisk === (G.attempt >= T.freeAttempts), 'normal runs: lifeAtRisk unchanged'); }
{ const G = E.newGame(5); const over = lose(G, s => s.kind === 'trainer'); check(!over && G.lives === T.startingLives - 1, 'a normal run loses one of five lives to a trainer'); }
check(E.freeAttemptsFor(E.newGame(1, { mods: { onelife: true } })) === 0 && E.freeAttemptsFor(E.newGame(1)) === T.freeAttempts, 'freeAttemptsFor: 0 for One Life, the normal number otherwise');
check(/any battle/i.test(E.MOD_INFO.onelife.text()), 'the rule text says it is any battle');
console.log(fails ? `${fails} FAILED` : 'v221 passed'); process.exit(fails ? 1 : 0);
