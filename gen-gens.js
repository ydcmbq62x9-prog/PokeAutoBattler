// 4.1.0: per-gens run measurements for the Balance Sheet.  node gen-gens.js N '[1,2]' > gens-<key>.json
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 200, gens = JSON.parse(process.argv[3] || '[1]');
const bosses = {}; let cleared = 0, reachedE4 = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { gens }); E.rollShop(G, false);
  const seen = new Set(); let guard = 0, e4 = false;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G); const isBoss = st.boss && ['gym','elite','champion'].includes(st.kind);
    const stage0 = G.stage || 0;
    if(st.kind === 'elite' || st.kind === 'champion') e4 = true;
    const { sim } = B.fight(G);
    if(isBoss && !seen.has(st.boss.id)){ seen.add(st.boss.id);
      const slot = st.kind === 'gym' ? 'G' + (st.badge + 1) : st.kind === 'elite' ? 'E' + (stage0 - E.TUNING.badgesToWin * (E.TUNING.battlesPerBadge + 1) + 1) : 'C';
      const f = bosses[st.boss.id] = bosses[st.boss.id] || { n:0, w:0, slots:{} }; f.n++; if(sim.result === 'win') f.w++;
      const s = f.slots[slot] = f.slots[slot] || { n:0, w:0 }; s.n++; if(sim.result === 'win') s.w++; }
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won') cleared++;
  if(e4) reachedE4++;
}
console.log(JSON.stringify({ gens, N, cleared: cleared / N, reachedE4: reachedE4 / N, bosses }));
