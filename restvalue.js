/* What resting on the bench is worth — the same players, the same four bench
   bodies, every rest rate, in one process so the unseeded shop rolls can't
   make the rows incomparable. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 250);
const clone = o => JSON.parse(JSON.stringify(o));
const RATES = [0, 0.15, 0.25, 0.35, 0.5];

function arrive(seed){
  const G = E.newGame(seed); E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:0 });
    if((G.stage || 0) === E.gauntletStart() && !E.inGauntlet(G)) return G;
    B.fight(G); if(G.over) return null; E.nextTurn(G);
  }
  return null;
}
/* The clever human: before the early fights, rest anyone hurt below 70% by
   swapping in a fresh bench body; before the Champion, field the best six. */
function restful(G){
  if(E.stageOf(G).kind === 'champion'){ B.interlude(G, 1.0); return; }
  for(let slot = 0; slot < G.team.length; slot++){
    const u = G.team[slot], f = E.hpFracOf(G, u);
    if(f === 0 || f >= 0.7) continue;
    let best = -1;
    for(let i = 0; i < G.pc.length; i++){
      const c = G.pc[i];
      if(c.id === u.id || E.hpFracOf(G, c) < 0.95) continue;
      if(best < 0 || B.worth(G, c) > B.worth(G, G.pc[best])) best = i;
    }
    if(best >= 0) E.pcToParty(G, best, slot);
  }
  B.interlude(G, 1.25);   // still replace the fainted
}
const POLICY = process.env.POLICY || 'plain';
function attempt(G){
  let beaten = 0;
  for(let i = 0; i < 5; i++){
    if(E.inGauntlet(G)) (POLICY === 'restful' ? restful(G) : B.interlude(G, 1.0));
    if(!E.fightersOf(G).length) break;
    const { sim } = B.fight(G);
    if(sim.result !== 'win') break;
    beaten++; if(G.over) break;
    E.nextTurn(G);
  }
  return beaten;
}
let n = 0;
const res = RATES.map(() => ({ w0:0, w4:0, w12:0 }));
for(let s = 1; n < RUNS && s < RUNS * 4; s++){
  const G0 = arrive(s * 7 + 1); if(!G0) continue; n++;
  const pool = clone(G0), offers = [];
  for(let r = 0; r < 5; r++){ E.rollDaycare(pool, false); for(const d of pool.daycare) offers.push(d.unit); }
  offers.sort((a, b) => E.unitPower(b) - E.unitPower(a));
  RATES.forEach((rate, j) => {
    E.TUNING.benchRest = rate;
    for(const [k, key] of [[0,'w0'],[4,'w4'],[12,'w12']]){
      const G = clone(G0); G.pc = clone(offers.slice(0, k));
      if(attempt(G) === 5) res[j][key]++;
    }
  });
}
console.log(`${n} players at Lorelei, one attempt, paired across every rest rate — ${POLICY} rotation`);
console.log('rest per fight   no bench   bench 4   bench 12   full PC over none');
RATES.forEach((r, j) => {
  const p = k => res[j][k] / n * 100;
  console.log(`   ${(r*100).toFixed(0).padStart(3)}%          ${p('w0').toFixed(0).padStart(3)}%       ${p('w4').toFixed(0).padStart(3)}%       ${p('w12').toFixed(0).padStart(3)}%          +${(p('w12')-p('w0')).toFixed(0)}`);
});
