const E = require('./engine.js'), B = require('./botlib.js');
const gens = JSON.parse(process.argv[2]), N = +process.argv[3] || 250; const mods = JSON.parse(process.argv[4]);
let c = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 13 + 5, { gens, mods }); E.rollShop(G, false); let g = 0;
  while(!G.over && g++ < 220){ B.shop(G, { reroll:true, bench:4 }); B.fight(G); if(G.over) break; E.nextTurn(G); }
  if(G.over === 'won') c++;
}
console.log(JSON.stringify(gens), JSON.stringify(mods), (c / N * 100).toFixed(1) + '%');
