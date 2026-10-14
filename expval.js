// node expval.js N variant   variants: base | inc1 | inc2 | inc4 | egg | egg3 | share1 | share3 | candy1 | candy3 | manual1
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 300, V = process.argv[3] || 'base'; if(process.env.EGGCAP) E.TUNING.eggCap = +process.env.EGGCAP;
let cleared = 0, badges = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { gens:[1,2,3] }); E.rollShop(G, false);
  let guard = 0, gift = false;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:4 });
    if(G.team.length){
      if(V === 'egg' || V === 'egg3'){ const t = G.team.filter(u => !u.held); if(t.length && (G.turn <= 2)){ t[0].held = 'egg'; } }
    }
    if(!gift && G.turn >= 6 && G.team.length){
      gift = true;
      const k = { share1:1, share2:2, share3:3, candy1:1, candy3:3 }[V] || 0;
      for(let i = 0; i < k; i++){
        if(V.startsWith('share')) E.ITEMS.expshare.apply(null, E.makeGameApi ? E.makeGameApi(G) : G);
        if(V.startsWith('candy')) E.makeGameApi(G).addExp(G.team[0], 1);
      }
    }
    B.fight(G);
    if(G.over) break; E.nextTurn(G);
    const inc = { inc1:1, inc2:2, inc4:4 }[V] || 0; if(inc && !G.over) G.credits += inc;
  }
  if(G.over === 'won') cleared++; badges += G.badges || 0;
}
console.log(V.padEnd(7), 'N', N, 'cleared', (cleared / N * 100).toFixed(1) + '%', 'avg badges', (badges / N).toFixed(2));
