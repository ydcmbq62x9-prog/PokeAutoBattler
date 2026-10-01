/* Is a bench worth anything? Controlled: the SAME player arrives at Lorelei,
   then runs the gauntlet once with and once without four bench bodies —
   given free, so this measures the bench's value and not what it costs. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 300);
const MARGIN = Number(process.env.MARGIN || 1.25);
const clone = o => JSON.parse(JSON.stringify(o));

// play a run up to the first time it stands at Lorelei with a free choice
function arrive(seed){
  const G = E.newGame(seed); E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 220){
    if((G.stage || 0) === E.gauntletStart() && !E.inGauntlet(G)){ B.shop(G, { reroll:true, bench:0 }); return G; }
    B.shop(G, { reroll:true, bench:0 });
    B.fight(G);
    if(G.over) return null;
    E.nextTurn(G);
  }
  return null;
}
// one pass at the gauntlet, no retries: how far does it get?
function attempt(G){
  let beaten = 0;
  for(let i = 0; i < 5; i++){
    if(E.inGauntlet(G)) B.interlude(G, MARGIN);
    if(!E.fightersOf(G).length) break;
    const { sim } = B.fight(G);
    if(sim.result !== 'win') break;
    beaten++;
    if(G.over) break;
    E.nextTurn(G);
  }
  return beaten;
}

const SIZES = [0, 2, 4, 8, 12];
const wins = SIZES.map(() => 0), depth = SIZES.map(() => 0);
let n = 0;
for(let seed = 1; n < RUNS && seed < RUNS * 4; seed++){
  const G0 = arrive(seed * 7 + 1);
  if(!G0) continue;
  n++;
  // one shared pool of offers, strongest first, so a bigger bench is a strict superset
  const pool = clone(G0), offers = [];
  for(let r = 0; r < 5; r++){ E.rollDaycare(pool, false); for(const d of pool.daycare) offers.push(d.unit); }
  offers.sort((a, b) => E.unitPower(b) - E.unitPower(a));
  SIZES.forEach((k, j) => {
    const G = clone(G0);
    G.pc = clone(offers.slice(0, k));
    const got = attempt(G);
    depth[j] += got; if(got === 5) wins[j]++;
  });
}
console.log(`${n} players at Lorelei, one attempt each, bench given free, swap margin ${MARGIN}`);
SIZES.forEach((k, j) => console.log(`  bench ${String(k).padStart(2)}:  clears ${(wins[j]/n*100).toFixed(0).padStart(3)}%   reaches ${(depth[j]/n).toFixed(2)} of 5`));
