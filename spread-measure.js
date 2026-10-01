const E = require('./engine.js'); const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 1000);
const rows = [['reference (focus medicine, rewards in best order)', {}],
  ['medicine to whoever is first', { med:'first' }],
  ['rewards picked at random', { reward:'random' }],
  ['no rerolls, no bench', { reroll:false, bench:0 }],
  ['party left in the order bought', { arrange:false }],
  ['no rerolls, no bench, random rewards, medicine first', { reroll:false, bench:0, reward:'random', med:'first', arrange:false }]];
for(const [label, opts] of rows){ let c = 0, r4 = 0;
  for(let r = 0; r < RUNS; r++){ const o = B.playRun(r * 7 + 1, { reroll:true, bench:4, ...opts }); if(o.cleared) c++; if(o.g.reached) r4++; }
  console.log(label.padEnd(56), `cleared ${(c/RUNS*100).toFixed(0)}%  reach E4 ${(r4/RUNS*100).toFixed(0)}%`); }
