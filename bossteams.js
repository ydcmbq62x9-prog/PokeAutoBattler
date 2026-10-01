const E = require('./engine.js'), B = require('./botlib.js');
const seen = {};
for(const r of [0, 5, 9]){
  const G = E.newGame(r * 7 + 1, {}); E.rollShop(G, false); let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G);
    if(st.boss && !(seen[st.boss.id + r])){ seen[st.boss.id + r] = 1;
      const o = E.opponentFor(G);
      console.log(String(st.boss.id).padEnd(8), 't' + G.turn, o.team.map(u => u.id + '/L' + E.unitLevel(u)).join(' '), ' pow', Math.round(E.teamPower(o.team)), 'vs you', Math.round(E.teamPower(G.team))); }
    B.fight(G); if(G.over) break; E.nextTurn(G);
  }
}
