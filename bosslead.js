const E = require('./engine.js'), B = require('./botlib.js');
const lead = {}; const N = +process.argv[2] || 60;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, {}); E.rollShop(G, false); let guard = 0; const seen = new Set();
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G);
    if(st.boss && st.boss.signature && !seen.has(st.boss.id)){ seen.add(st.boss.id);
      const o = E.opponentFor(G); const ids = o.team.map(u => u.id);
      const m = lead[st.boss.id] = lead[st.boss.id] || {}; const has = ids.some(id => st.boss.signature.some(sg => E.evoLine(sg).includes(id)));
      m.n = (m.n || 0) + 1; m.has = (m.has || 0) + (has ? 1 : 0); m.ids = m.ids || {}; ids.slice(0,1).forEach(id => m.ids[id] = (m.ids[id]||0)+1); }
    B.fight(G); if(G.over) break; E.nextTurn(G);
  }
}
for(const [id,m] of Object.entries(lead)) console.log(id.padEnd(9), 'has signature line', Math.round(m.has/m.n*100)+'%', JSON.stringify(m.ids));
