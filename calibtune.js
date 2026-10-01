// tune each boss's calib so the reference bot's FIRST-try win rate hits a target curve
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 500, IT = +process.argv[3] || 5, OFF = +process.argv[4] || 0;
const T = { brock:88, misty:88, surge:86, erika:85, koga:83, sabrina:80, blaine:78, giovanni:76, lorelei:84, bruno:80, agatha:78, lance:74, blue:62 };
if(process.argv[5]) Object.assign(T, JSON.parse(process.argv[5]));
function measure(){
  const first = {}; let cleared = 0;
  for(let r = 0; r < N; r++){
    const G = E.newGame(r * 7 + 1, { mods:{} }); E.rollShop(G, false);
    const seen = new Set(); let guard = 0;
    while(!G.over && guard++ < 220){
      B.shop(G, { reroll:true, bench:4 });
      const st = E.stageOf(G); const isBoss = st.boss && ['gym','elite','champion'].includes(st.kind);
      const { sim } = B.fight(G);
      if(isBoss && !seen.has(st.boss.id)){ seen.add(st.boss.id); const f = first[st.boss.id] = first[st.boss.id] || { w:0, n:0 }; f.n++; if(sim.result === 'win') f.w++; }
      if(G.over) break; E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
  }
  return { first, clear: cleared / N * 100 };
}
for(let it = 0; it < IT; it++){
  const m = measure(); const line = [];
  for(const b of E.ALL_BOSSES){ const f = m.first[b.id]; if(!f) continue;
    const w = f.w / f.n * 100, tgt = Math.min(99, T[b.id] + OFF);
    line.push(`${b.id} ${w.toFixed(0)}/${tgt}`);
    if(f.n >= 120) b.calib = +Math.max(0.6, Math.min(2.6, (b.calib || 1) * (1 + (w - tgt) / 100 * 0.45))).toFixed(3);
  }
  console.log('iter', it, 'clear', m.clear.toFixed(1) + '%', line.join('  '));
}
console.log('CALIB', JSON.stringify(Object.fromEntries(E.ALL_BOSSES.map(b => [b.id, b.calib]))));
