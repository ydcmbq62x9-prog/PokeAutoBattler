// per-boss first-attempt win rate for the reference bot (reroll, bench 4)
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 400; const mods = JSON.parse(process.argv[3] || '{}');
const first = {}, fights = {};   // id -> {w, n}
let cleared = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { mods }); E.rollShop(G, false);
  const seen = new Set(); let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G);
    const isBoss = st.boss && (st.kind === 'gym' || st.kind === 'elite' || st.kind === 'champion');
    const { sim } = B.fight(G);
    if(isBoss){ const id = st.boss.id; const f = fights[id] = fights[id] || { w:0, n:0, first:0, firstN:0 };
      f.n++; if(sim.result === 'win') f.w++;
      if(!seen.has(id)){ seen.add(id); f.firstN++; if(sim.result === 'win') f.first++; } }
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won') cleared++;
}
console.log('cleared', (cleared / N * 100).toFixed(1) + '%');
for(const b of E.ALL_BOSSES){ const f = fights[b.id]; if(!f) continue;
  console.log(b.id.padEnd(9), 'reached', String(f.firstN).padStart(4), ' first-try win', (f.first / f.firstN * 100).toFixed(0).padStart(3) + '%', ' any-fight win', (f.w / f.n * 100).toFixed(0).padStart(3) + '%'); }
