// 4.4.0: Secret Gauntlet bot stats (node gauntwin.js N)
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 200;
let champ = 0, rr = 0, rb = 0, or = 0, ob = 0, both = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { gens: [1, 2], mods: { secrets: true } }); E.rollShop(G, false);
  let guard = 0, seenRed = false, seenOak = false;
  while(!G.over && guard++ < 260){
    B.shop(G, { reroll:true, bench:4 });
    if(E.stageOf(G).kind === 'red'){ if(E.secretOf(G).id === 'red') seenRed = true; else seenOak = true; }
    B.fight(G);
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won'){ champ++; }
  if(seenRed) rr++; if(seenOak) or++;
  const w = G.secWon || []; if(w.includes('red')) rb++; if(w.includes('oak')) ob++; if(w.length === 2) both++;
}
console.log('gauntlet N', N, 'champion', (champ / N * 100).toFixed(0) + '%', 'reachedRed', rr, 'beatRed', rb, (rb / Math.max(1, rr) * 100).toFixed(0) + '%', 'reachedOak', or, 'beatOak', ob, (ob / Math.max(1, or) * 100).toFixed(0) + '%', 'both', both);
