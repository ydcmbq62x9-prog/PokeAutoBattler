// 4.2.0: a secret boss's win rate among runs that reach him (node redwin.js N '[1]' red|oak [ratio])
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 200, gens = JSON.parse(process.argv[3] || '[2]'), who = process.argv[4] || 'red';
const tbl = who === 'oak' ? E.TUNING.red.oakRatio : E.TUNING.red.ratio;
if(process.argv[5]) tbl[gens.join('+')] = +process.argv[5];
let reached = 0, beat = 0, champ = 0;
for(let r = 0; r < N; r++){
  const G = E.newGame(r * 7 + 1, { gens }); G.redFlag = who; E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 240){
    B.shop(G, { reroll:true, bench:4 });
    if(E.stageOf(G).kind === 'red') reached++;
    B.fight(G);
    if(G.over) break; E.nextTurn(G);
  }
  if(G.over === 'won'){ champ++; if(G.redResult === 'won') beat++; }
}
console.log(who, 'gens', gens.join('+'), 'ratio', tbl[gens.join('+')], 'reached', reached, 'beat', beat, (beat / Math.max(1, reached) * 100).toFixed(0) + '%');
