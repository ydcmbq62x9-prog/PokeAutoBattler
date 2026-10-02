// 4.2.0: Red's win rate among runs that reach him (node redwin.js N '[2]' [ratio])
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 200, gens = JSON.parse(process.argv[3] || '[2]');
if(process.argv[4]) E.TUNING.red.ratio[gens.join('+')] = +process.argv[4];
let reached = 0, beat = 0, champ = 0, runs = 0, steps = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { gens }); G.redFlag = true; E.rollShop(G, false); runs++;
  let guard = 0;
  while(!G.over && guard++ < 240){
    B.shop(G, { reroll:true, bench:4 });
    const st = E.stageOf(G);
    if(st.kind === 'red') reached++;
    B.fight(G);
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won'){ champ++; if(G.redResult === 'won') beat++; }
}
console.log('gens', gens.join('+'), 'ratio', E.TUNING.red.ratio, 'cleared champ', champ, 'reached Red', reached, 'beat Red', beat, (beat / Math.max(1, reached) * 100).toFixed(0) + '%');
