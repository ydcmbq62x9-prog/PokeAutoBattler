const E = require('./engine.js'); const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 500), G0 = E.TUNING.gymRatio.slice(), A0 = E.TUNING.gauntletRatio.slice();
const rows = [['reference', {}], ['medicine first', { med:'first' }], ['random rewards', { reward:'random' }],
  ['no reroll/bench', { reroll:false, bench:0 }], ['no formation', { arrange:false }], ['casual (all of those)', { reroll:false, bench:0, reward:'random', med:'first', arrange:false }]];
for(const k of JSON.parse(process.env.K)){
  E.TUNING.gymRatio = G0.map(x => x * k); E.TUNING.gauntletRatio = A0.map(x => x * k);
  const out = rows.map(([label, opts]) => { let c = 0, r4 = 0;
    for(let r = 0; r < RUNS; r++){ const o = B.playRun(r * 7 + 1, { reroll:true, bench:4, ...opts }); if(o.cleared) c++; if(o.g.reached) r4++; }
    return `${label} ${(c/RUNS*100).toFixed(0)}%/${(r4/RUNS*100).toFixed(0)}%`; });
  console.log(`×${k}: ` + out.join(' · '));
}
