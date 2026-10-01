/* The run-level cost of each X item option, for a player who uses them the way
   a person would: when coming back to a boss that just beat them. */
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
const set = (pct, perBattle) => { Object.assign(E.TUNING.xItems, { atkPct:pct, spdPct:pct, perMon:1, perBattle }); };
set(0.25, Infinity);
console.log('never buys X items                         ' + measure('never'));
set(0.10, Infinity);
console.log('D · +10%, once per pokémon    (on retries) ' + measure('stuck'));
set(0.25, 3);
console.log('A · +25%, max 3 per battle    (on retries) ' + measure('stuck'));
set(0.25, Infinity);
console.log('  · +25%, once per pokémon    (on retries) ' + measure('stuck'));
