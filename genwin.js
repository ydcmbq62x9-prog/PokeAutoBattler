// 4.0.0: per-boss first-try win rate by slot, for any mix of gens  (node genwin.js N '[1,2]')
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 300, gens = JSON.parse(process.argv[3] || '[1]');
const by = {}; let cleared = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { gens }); E.rollShop(G, false);
  const seen = new Set(); let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G); const isBoss = st.boss && ['gym','elite','champion'].includes(st.kind);
    const stage0 = G.stage || 0;
    const { sim } = B.fight(G);
    if(isBoss && !seen.has(st.boss.id)){ seen.add(st.boss.id);
      const slot = st.kind === 'gym' ? 'G' + (st.badge + 1) : st.kind === 'elite' ? 'E' + (stage0 - E.TUNING.badgesToWin * (E.TUNING.battlesPerBadge + 1) + 1) : 'C';
      const f = by[st.boss.id] = by[st.boss.id] || { n:0, w:0, slots:{} }; f.n++; if(sim.result === 'win') f.w++;
      const s = f.slots[slot] = f.slots[slot] || { n:0, w:0 }; s.n++; if(sim.result === 'win') s.w++; }
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won') cleared++;
}
console.log('gens', gens.join('+'), 'cleared', (cleared / N * 100).toFixed(1) + '%');
for(const [id, f] of Object.entries(by).sort((a, b) => b[1].n - a[1].n))
  console.log(id.padEnd(9), String(f.n).padStart(4), (f.w / f.n * 100).toFixed(0).padStart(4) + '%', ' ', Object.entries(f.slots).sort().map(([k, s]) => `${k}:${(s.w / s.n * 100).toFixed(0)}%(${s.n})`).join(' '));
