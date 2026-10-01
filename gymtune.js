// iterate each gym's calib so the reference bot's first-try win rate hits TARGET
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 300, TARGET = +process.argv[3] || 90, ROUNDS = +process.argv[4] || 4;
const gyms = E.GYMS.map(g => g.id); const start = {}; gyms.forEach(id => start[id] = E.bossById(id).calib);
function measure(){
  const first = {}; let cleared = 0;
  for(let r = 0; r < N; r++){
    const G = E.newGame(r * 7 + 1, {}); E.rollShop(G, false); const seen = new Set(); let guard = 0;
    while(!G.over && guard++ < 220){
      B.shop(G, { reroll:true, bench:4 });
      const st = E.stageOf(G); const { sim } = B.fight(G);
      if(st.kind === 'gym' && !seen.has(st.boss.id)){ seen.add(st.boss.id); const q = first[st.boss.id] = first[st.boss.id] || [0, 0]; q[1]++; if(sim.result === 'win') q[0]++; }
      if(G.over) break; E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
  }
  return { first, cleared: cleared / N * 100 };
}
for(let round = 0; round < ROUNDS; round++){
  const m = measure();
  console.log('round', round, 'cleared', m.cleared.toFixed(1) + '%', gyms.map(id => id.slice(0, 3) + ' ' + Math.round(m.first[id][0] / m.first[id][1] * 100) + '(' + E.bossById(id).calib.toFixed(2) + ')').join('  '));
  for(const id of gyms){
    const rate = m.first[id][0] / m.first[id][1] * 100, b = E.bossById(id);
    // ~5 points of win rate per 1% of calib near the top; step conservatively
    const gap = rate - TARGET; b.calib *= 1 + Math.max(-0.06, Math.min(0.12, gap * 0.012));
  }
}
console.log('FINAL', JSON.stringify(Object.fromEntries(gyms.map(id => [id, +E.bossById(id).calib.toFixed(3)]))));
