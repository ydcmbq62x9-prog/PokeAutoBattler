const E = require('./engine.js');
const code = process.argv[2];
const base = E.importTeam(code).team;
const clone = t => t.map(u => ({ ...u }));
function spread(team){
  const t = clone(team), r = t.find(u => u.id === 'raichu');
  const others = t.filter(u => u !== r);
  const avgAtk = others.reduce((n,u)=>n+u.atk,0)/others.length, avgSpd = others.reduce((n,u)=>n+u.spd,0)/others.length;
  const xa = r.atk - avgAtk, xs = r.spd - avgSpd;
  r.atk = avgAtk; r.spd = avgSpd;
  for(const u of t){ u.atk = Math.round(u.atk + xa/6); u.spd = Math.round(u.spd + xs/6); }
  return t;
}
function noRaichuBoost(team){ const t = clone(team), r = t.find(u => u.id === 'raichu');
  const o = t.filter(u => u !== r); r.atk = Math.round(o.reduce((n,u)=>n+u.atk,0)/5); r.spd = Math.round(o.reduce((n,u)=>n+u.spd,0)/5); return t; }
const plan = E.runPlan();
const stages = plan.map((p,i)=>({p,i})).filter(x => x.p.boss && x.p.kind !== 'gym');
for(const turn of [30, 36, 42]){
  const row = [];
  for(const [label, team] of [['as sent', base], ['spread evenly', spread(base)], ['Raichu unboosted', noRaichuBoost(base)]]){
    const res = stages.map(({p,i}) => { let w = 0;
      for(let s = 0; s < 150; s++){
        const G = E.newGame(s * 11 + 5); G.turn = turn; G.badges = 8; G.stage = i; G.team = clone(team); G.pc = [];
        const opp = E.opponentFor(G);
        if(E.simulateBattle(G.team, opp.team, s + 1).result === 'win') w++; }
      return `${p.boss.name.slice(0,7)} ${Math.round(w/1.5)}%`; });
    row.push(`  ${label.padEnd(17)} ${res.join('  ')}`);
  }
  console.log(`turn ${turn} (player power ${E.playerPowerAt(turn)}):\n` + row.join('\n'));
}
