/* Where do runs end inside the gauntlet, and how does that change with the
   bench? `GR` (comma list) overrides TUNING.gauntletRatio for a sweep. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
if(process.env.GR) E.TUNING.gauntletRatio = process.env.GR.split(',').map(Number);

function measure(opts){
  let cleared = 0, reached = 0, attempts = 0, badges = 0;
  const fell = {}, faced = {};
  for(let r = 0; r < RUNS; r++){
    const out = B.playRun(r * 7 + 1, opts);
    if(out.cleared) cleared++;
    badges += out.badges;
    if(out.g.reached){ reached++; attempts += out.g.attempts; }
    for(const [k,v] of Object.entries(out.g.fell)) fell[k] = (fell[k]||0) + v;
  }
  return { cleared, reached, attempts, fell, badges };
}

const order = E.runPlan().slice(E.gauntletStart()).map(p => p.boss);
const label = process.env.GR ? `gauntletRatio [${process.env.GR}]` : `gauntletRatio [${(E.TUNING.gauntletRatio||[]).join(',')}]`;
console.log(label);
for(const [name, opts] of [['bench 4 + reroll', { reroll:true, bench:4 }],
                           ['no bench + reroll', { reroll:true, bench:0 }],
                           ['no bench, no reroll', { reroll:false, bench:0 }]]){
  const m = measure(opts);
  const perClear = m.cleared ? (m.attempts / m.cleared).toFixed(1) : '—';
  const falls = order.map(b => `${b.name.slice(0,7)} ${m.fell[b.id]||0}`).join('  ');
  console.log(`  ${name.padEnd(20)} cleared ${String(m.cleared).padStart(3)}/${RUNS} (${(m.cleared/RUNS*100).toFixed(0)}%)` +
    `  reached E4 ${(m.reached/RUNS*100).toFixed(0)}%  gauntlet attempts/clear ${perClear}\n      falls → ${falls}`);
}
