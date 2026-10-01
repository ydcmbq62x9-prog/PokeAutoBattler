/* What is a point of each stat actually worth?
   Build two comparable teams, give one side N extra points of a single stat,
   and measure how far the win rate moves. Repeat over many seeds so the answer
   is a number and not a feeling. */
const E = require('./engine.js');

const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
function team(seed, size = 6){
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for(let i = 0; i < size; i++){
    const u = E.makeUnit(ROSTER[Math.floor(rnd() * ROSTER.length)], 0);
    const bump = 8 + Math.floor(rnd() * 8);          // a mid-run team
    u.hp += bump * 3; u.atk += bump * 3; u.spd += bump * 2;
    out.push(u);
  }
  return out;
}
const clone = t => t.map(u => Object.assign({}, u));

function winRate(mut, n = 1200){
  let w = 0, d = 0;
  for(let i = 0; i < n; i++){
    const a = clone(team(i * 2 + 1)), b = clone(team(i * 2 + 2));
    if(mut) mut(a);
    const r = E.simulateBattle(a, b, i * 7919 + 13);
    if(r.result === 'win') w++; else if(r.result === 'draw') d++;
  }
  return { win: w / n, draw: d / n };
}

const base = winRate(null);
console.log(`baseline win rate ${(base.win*100).toFixed(1)}%  (draws ${(base.draw*100).toFixed(1)}%)\n`);

console.log('what one team-wide point of each stat buys, in win rate:');
console.log('  stat   +1/unit   +5/unit   +15/unit    per point');
for(const [stat, label] of [['hp','HP '], ['atk','ATK'], ['spd','SPD']]){
  const row = [];
  for(const n of [1, 5, 15]){
    const r = winRate(t => t.forEach(u => { u[stat] += n; }));
    row.push(r.win - base.win);
  }
  const per = row[2] / 15;
  console.log(`  ${label}   ${row.map(v => (v*100 >= 0 ? '+' : '') + (v*100).toFixed(1) + '%').map(s => s.padStart(7)).join('   ')}` +
    `    ${(per*100).toFixed(2)}%/pt`);
}

/* How much does turn order matter at all? Flip every speed value on one side
   (fastest becomes slowest) while leaving the totals identical. If the win
   rate barely moves, speed is decoration. */
const flipped = winRate(t => {
  const sp = t.map(u => u.spd).sort((a,b) => a-b);
  const order = t.map((u,i) => i).sort((a,b) => t[b].spd - t[a].spd);
  order.forEach((idx, rank) => { t[idx].spd = sp[rank]; });
});
console.log(`\nreversing who is fastest on one side, totals unchanged: ` +
  `${(base.win*100).toFixed(1)}% -> ${(flipped.win*100).toFixed(1)}%`);

/* And the shape of the roster: how wide is each stat's spread? */
console.log('\nroster spread (base forms):');
for(const stat of ['hp','atk','spd']){
  const v = E.BUYABLE.map(k => E.SPECIES[k][stat]);
  const lo = Math.min(...v), hi = Math.max(...v);
  const mean = v.reduce((a,b)=>a+b,0)/v.length;
  console.log(`  ${stat.toUpperCase().padEnd(4)} ${String(lo).padStart(3)}–${String(hi).padStart(3)}` +
    `   mean ${mean.toFixed(1).padStart(5)}   spread ×${(hi/Math.max(1,lo)).toFixed(1)}`);
}
