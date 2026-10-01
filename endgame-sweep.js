/* Move difficulty from the middle of the run to the end. Two dials together:
   `kg` scales the gym ramp (how many players ARRIVE at the Elite Four) and the
   gauntlet shape (how many arrivals WIN it). Measured on the reference player. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
const BASE_GYM = E.TUNING.gymRatio.slice();
const order = E.runPlan().slice(E.gauntletStart()).map(p => p.boss);

function measure(kg, gr, opts){
  E.TUNING.gymRatio = BASE_GYM.map(x => +(x * kg).toFixed(3));
  E.TUNING.gauntletRatio = gr;
  let cleared = 0, reached = 0; const fell = {};
  for(let r = 0; r < RUNS; r++){
    const out = B.playRun(r * 7 + 1, opts);
    if(out.cleared) cleared++;
    if(out.g.reached) reached++;
    for(const [k,v] of Object.entries(out.g.fell)) fell[k] = (fell[k]||0) + v;
  }
  return { cleared: cleared/RUNS*100, reached: reached/RUNS*100, fell };
}

const configs = JSON.parse(process.env.CONFIGS);
console.log('gym×   gauntlet                      reach E4  cleared  wins it | falls: ' + order.map(b=>b.name.slice(0,6)).join(' '));
for(const [kg, gr] of configs){
  const m = measure(kg, gr, { reroll:true, bench:4 });
  console.log(`${kg.toFixed(2)}   [${gr.join(',')}]`.padEnd(37) +
    `${m.reached.toFixed(0)}%`.padStart(8) + `${m.cleared.toFixed(0)}%`.padStart(9) +
    `${m.reached ? (m.cleared/m.reached*100).toFixed(0) : 0}%`.padStart(9) + ' |       ' +
    order.map(b => String(m.fell[b.id]||0).padStart(6)).join(' '));
}
