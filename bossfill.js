const E = require('./engine.js'), B = require('./botlib.js');
const stats = {}; const N = +process.argv[2] || 120;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, {}); E.rollShop(G, false); let guard = 0; const seen = new Set();
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G);
    if(st.boss && !seen.has(st.boss.id) && st.boss.theme){ seen.add(st.boss.id);
      const o = E.opponentFor(G), pool = new Set(E.themePool(st.boss.theme));
      const s = stats[st.boss.id] = stats[st.boss.id] || { n:0, on:0, size:0, fill:{}, sp:{}, dup:0 };
      s.n++; s.size += o.team.length; const ids = o.team.map(u => u.id);
      s.dup += ids.length - new Set(ids).size;
      for(const id of ids){ s.sp[id] = (s.sp[id] || 0) + 1; if(pool.has(id)) s.on++; else s.fill[id] = (s.fill[id] || 0) + 1; } }
    B.fight(G); if(G.over) break; E.nextTurn(G);
  }
}
for(const [id, s] of Object.entries(stats)){
  const top = Object.entries(s.fill).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + Math.round(v / s.n * 100) + '%').join(', ');
  console.log(id.padEnd(9), 'teams', String(s.n).padStart(3), 'size', (s.size / s.n).toFixed(1), 'on-theme', Math.round(s.on / s.size * 100) + '%', 'dups/team', (s.dup / s.n).toFixed(2), '| filler:', top); }
