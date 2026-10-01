/* Party-wide X items: what the MAXIMUM package does to a fight, for each
   percentage per use and each cap on uses. Paired: same arrivals, same seeds. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
const clone = o => JSON.parse(JSON.stringify(o));
const PCTS = [0.04, 0.05, 0.06, 0.08, 0.10];
const CAPS = [1, 2, 3];

function arriveAt(seed, stage){
  const G = E.newGame(seed); E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:0, x:'never' });
    if((G.stage || 0) === stage) return G;
    B.fight(G); if(G.over) return null;
    if(E.inGauntlet(G) && stage === E.gauntletStart() + 4) G.gauntlet = null;
    E.nextTurn(G);
  }
  return null;
}
for(const [label, stage] of [['gym 7', 7*(E.TUNING.battlesPerBadge+1)-1], ['Champion', E.gauntletStart()+4]]){
  let n = 0, none = 0; const w = {};
  for(let s = 1; n < RUNS && s < RUNS * 6; s++){
    const G0 = arriveAt(s * 11 + 3, stage); if(!G0) continue; n++;
    const opp = E.opponentFor(G0);
    if(E.stageBattle(clone(G0), opp, 991).result === 'win') none++;
    for(const p of PCTS) for(const c of CAPS){
      Object.assign(E.TUNING.xItems, { pct:p, perBattle:c });
      const G = clone(G0); G.credits = 99;
      for(let k = 0; k < c; k++){ E.buyBattleItem(G, 0); E.buyBattleItem(G, 1); }
      if(E.stageBattle(G, opp, 991).result === 'win') w[p+':'+c] = (w[p+':'+c] || 0) + 1;
    }
  }
  console.log(`\n${label} (n=${n}) — no X items: ${(none/n*100).toFixed(0)}%`);
  console.log('  per use   ' + CAPS.map(c => `max ${c} of each`.padStart(16)).join(''));
  for(const p of PCTS)
    console.log(`   +${(p*100).toFixed(0).padStart(2)}%    ` + CAPS.map(c =>
      `${((w[p+':'+c]||0)/n*100).toFixed(0)}%  (+${Math.round(p*c*100)}%)`.padStart(16)).join(''));
}
