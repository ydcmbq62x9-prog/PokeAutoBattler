const E = require('./engine.js');
if(process.env.LEG) Object.assign(E.TUNING.legend, JSON.parse(process.env.LEG));
const B = require('./botlib.js');
const N = +process.argv[2] || 600; let c = 0, met = 0, took = 0, clrW = 0, nW = 0, clrO = 0, nO = 0; const per = {};
for(let r = 0; r < N; r++){ const out = B.playRun(r * 7 + 1, { reroll:true, bench:4 }); const G = out.G;
  if(out.cleared) c++; const m = G.legendsMet || []; if(m.length) met++;
  const has = [...G.team, ...(G.pc||[])].filter(u => E.isLegend(u)); if(has.length){ took++; nW++; if(out.cleared) clrW++; } else { nO++; if(out.cleared) clrO++; }
  m.forEach(k => per[k] = (per[k]||0) + 1); }
console.log(process.env.LEG||'default', 'clear', (c/N*100).toFixed(1)+'%', 'met', (met/N*100).toFixed(0)+'%', 'recruited', (took/N*100).toFixed(0)+'%',
  'clear w/ legend', (clrW/Math.max(1,nW)*100).toFixed(0)+'%', 'without', (clrO/Math.max(1,nO)*100).toFixed(0)+'%', JSON.stringify(per));
