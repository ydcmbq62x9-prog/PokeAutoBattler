/* How hard is the rival, per meeting, for each kind of player — and what does
   he do to the run? Env RATIO='[a,b,c]' overrides TUNING.rival.ratio. */
const E = require('./engine.js'); const B = require('./botlib.js');
if(process.env.RATIO) E.TUNING.rival.ratio = JSON.parse(process.env.RATIO);
const RUNS = Number(process.env.RUNS || 400);
const profiles = [['ref', {}], ['casual+lineup', { reroll:false, bench:0, reward:'random', med:'first' }]];
for(const [label, opts] of profiles){
  const met = [0,0,0], won = [0,0,0], trainer = { n:0, w:0 }; let cleared = 0;
  for(let r = 0; r < RUNS; r++){
    const G = E.newGame(r * 7 + 1); E.rollShop(G, false); let g = 0;
    while(!G.over && g++ < 220){
      B.shop(G, { reroll:true, bench:4, ...opts });
      const { sim, opp, st } = B.fight(G);
      if(opp.kind === 'rival'){ met[opp.meeting]++; if(sim.result === 'win') won[opp.meeting]++; }
      else if(st.kind === 'trainer'){ trainer.n++; if(sim.result === 'win') trainer.w++; }
      if(G.over) break; E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
  }
  console.log(`${label.padEnd(14)} rival wins ${won.map((w,i)=>`${(w/Math.max(1,met[i])*100).toFixed(0)}%`).join(' / ')}  ` +
    `(met ${met.join('/')}) · trainers ${(trainer.w/trainer.n*100).toFixed(0)}% · cleared ${(cleared/RUNS*100).toFixed(0)}%`);
}
