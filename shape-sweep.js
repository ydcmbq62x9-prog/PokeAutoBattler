const E = require('./engine.js'); const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 400), G0 = E.TUNING.gymRatio.slice(), A0 = E.TUNING.gauntletRatio.slice();
const rows = [['ref', {}], ['casual+lineup', { reroll:false, bench:0, reward:'random', med:'first' }],
  ['casual', { reroll:false, bench:0, reward:'random', med:'first', arrange:false }]];
for(const [kg, ka] of JSON.parse(process.env.K)){
  E.TUNING.gymRatio = G0.map(x => x * kg); E.TUNING.gauntletRatio = A0.map(x => x * ka);
  const out = rows.map(([label, opts]) => { let c = 0, r4 = 0;
    for(let r = 0; r < RUNS; r++){ const o = B.playRun(r * 7 + 1, { reroll:true, bench:4, ...opts }); if(o.cleared) c++; if(o.g.reached) r4++; }
    return `${label} ${(c/RUNS*100).toFixed(0)}%/${(r4/RUNS*100).toFixed(0)}%`; });
  console.log(`gym×${kg} gauntlet×${ka}: ` + out.join(' · '));
}
