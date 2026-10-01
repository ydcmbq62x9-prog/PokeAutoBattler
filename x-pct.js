/* How big should an X item be? The whole-team package (one of each for all six,
   24₽ — a turn's pay) at several percentages, on real arrivals at a gym and at
   the Champion. Paired: same fights, same seeds. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
const clone = o => JSON.parse(JSON.stringify(o));
const PCTS = [0, 0.10, 0.15, 0.20, 0.25];

function arriveAt(seed, stage){
  const G = E.newGame(seed); E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:0, x:'never' });
    if((G.stage || 0) === stage) return G;
    const { sim } = B.fight(G); if(G.over) return null;
    // skip the gauntlet's own mechanics: we want a fresh Champion fight to price
    if(E.inGauntlet(G) && stage === E.gauntletStart() + 4){ G.gauntlet = null; }
    E.nextTurn(G);
  }
  return null;
}
for(const [label, stage] of [['gym 7', 7*(E.TUNING.battlesPerBadge+1)-1],
                             ['the Champion, fresh', E.gauntletStart()+4]]){
  let n = 0; const w = PCTS.map(() => 0);
  for(let s = 1; n < RUNS && s < RUNS * 6; s++){
    const G0 = arriveAt(s * 11 + 3, stage); if(!G0) continue; n++;
    const opp = E.opponentFor(G0);
    PCTS.forEach((p, j) => {
      E.TUNING.xItems.atkPct = p; E.TUNING.xItems.spdPct = p;
      const G = clone(G0); G.credits = 24;
      if(p > 0) for(let i = 0; i < G.team.length; i++) for(let k = 0; k < 2; k++) E.buyBattleItem(G, k, i);
      if(E.stageBattle(G, opp, 991).result === 'win') w[j]++;
    });
  }
  console.log(`${label} (n=${n}): ` + PCTS.map((p, j) => `${p ? '+'+p*100+'%' : 'none'} ${(w[j]/n*100).toFixed(0)}%`).join('  ·  '));
}
