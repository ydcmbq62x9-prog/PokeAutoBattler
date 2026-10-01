const E = require('./engine.js'), B = require('./botlib.js');
const f = +process.argv[2], N = +process.argv[3] || 300, g = +process.argv[4] || 1;
const base = E.TUNING.gymRatio.slice(); E.TUNING.gymRatio.forEach((x, i) => E.TUNING.gymRatio[i] = x * f);
if(g !== 1) E.TUNING.gauntletRatio.forEach((x, i) => E.TUNING.gauntletRatio[i] = x * g);
const first = {}; let cleared = 0, fails = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, {}); E.rollShop(G, false); const seen = new Set(); let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G); const isGym = st.kind === 'gym';
    const { sim } = B.fight(G);
    if(isGym){ if(!seen.has(st.boss.id)){ seen.add(st.boss.id); const q = first[st.boss.id] = first[st.boss.id] || [0,0]; q[1]++; if(sim.result === 'win') q[0]++; }
      if(sim.result !== 'win') fails++; }
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won') cleared++;
}
console.log('gym x' + f, 'gauntlet x' + g, 'cleared', (cleared / N * 100).toFixed(1) + '%', 'gym losses/run', (fails / N).toFixed(2),
  Object.entries(first).map(([k, [w, n]]) => k.slice(0, 3) + ' ' + Math.round(w / n * 100)).join('  '));
