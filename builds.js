/* Same power budget, spent differently. If one allocation beats the others
   badly, the stat behind it is not a choice, it is the answer. */
const E = require('./engine.js');
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);

function baseTeam(seed, size = 6){
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for(let i = 0; i < size; i++) out.push(E.makeUnit(ROSTER[Math.floor(rnd() * ROSTER.length)], 0));
  return out;
}
/* Spend `budget` power points per unit on the given mix. The power score says
   a point of HP, ATK and SPD cost the same, so the mixes are like for like. */
function spend(team, mix, budget){
  const w = { hp:1, atk:1, spd:E.TUNING.spdPower };
  for(const u of team){
    for(const k of ['hp','atk','spd']){
      const share = mix[k] || 0;
      if(share) u[k] += Math.round(budget * share / w[k]);
    }
  }
  return team;
}
const MIXES = {
  'balanced      ': { hp:1/3, atk:1/3, spd:1/3 },
  'all speed     ': { spd:1 },
  'all attack    ': { atk:1 },
  'all HP        ': { hp:1 },
  'speed + attack': { spd:0.5, atk:0.5 },
  'HP + attack   ': { hp:0.5, atk:0.5 },
};
const BUDGET = 60;

console.log(`each build spends ${BUDGET} power per pokémon, against the balanced build\n`);
const rows = [];
for(const [name, mix] of Object.entries(MIXES)){
  let w = 0, n = 900;
  for(let i = 0; i < n; i++){
    const a = spend(baseTeam(i*2+1), mix, BUDGET);
    const b = spend(baseTeam(i*2+2), MIXES['balanced      '], BUDGET);
    if(E.simulateBattle(a, b, i*7919+13).result === 'win') w++;
  }
  rows.push([name, w / n]);
}
rows.sort((a,b) => b[1] - a[1]);
for(const [name, r] of rows)
  console.log(`  ${name}  ${(r*100).toFixed(1)}%  ${'█'.repeat(Math.round(r*40))}`);
