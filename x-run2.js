const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 300);
function measure(x){
  let cleared = 0, reached = 0;
  for(let r = 0; r < RUNS; r++){
    const out = B.playRun(r * 7 + 1, { reroll:true, bench:4, x });
    if(out.cleared) cleared++; if(out.g.reached) reached++;
  }
  return `cleared ${(cleared/RUNS*100).toFixed(0).padStart(3)}%   reach E4 ${(reached/RUNS*100).toFixed(0).padStart(3)}%`;
}
Object.assign(E.TUNING.xItems, { pct:0.05, perBattle:3 });
console.log('never buys X items                          ' + measure('never'));
for(const cost of [2, 3]){
  E.TUNING.xItems.cost = cost;
  console.log(`+5% ×3 at ${cost}₽ · max package before every boss  ` + measure('bosses'));
  console.log(`+5% ×3 at ${cost}₽ · only when retrying a boss      ` + measure('stuck'));
}
