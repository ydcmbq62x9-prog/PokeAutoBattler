const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 100; const gens = JSON.parse(process.argv[3] || '[1,2,3]');
const first = {}; let cleared = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { gens }); E.rollShop(G, false);
  const seen = new Set(); let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G);
    const isBoss = st.boss && (st.kind === 'gym' || st.kind === 'elite' || st.kind === 'champion');
    const { sim } = B.fight(G);
    if(isBoss){ const id = st.boss.id; if(!seen.has(id)){ seen.add(id); const f = first[id] = first[id] || { w:0, n:0, gen:st.boss.gen }; f.n++; if(sim.result === 'win') f.w++; } }
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won') cleared++;
}
console.log('gens', JSON.stringify(gens), 'cleared', (cleared / N * 100).toFixed(1) + '%');
if(process.argv[4]) for(const [id, f] of Object.entries(first)) console.log(' ', id.padEnd(10), 'g' + f.gen, 'n=' + String(f.n).padStart(3), (f.w / f.n * 100).toFixed(0).padStart(3) + '%');
