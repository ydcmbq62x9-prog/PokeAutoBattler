/* Does a stat keep paying? Add a block of it on top of a head start you already
   have. A stat that keeps its value is a stat worth building toward; one that
   flattens is a threshold in disguise. */
const E = require('./engine.js');
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
function team(seed, size = 6){
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for(let i = 0; i < size; i++){
    const u = E.makeUnit(ROSTER[Math.floor(rnd() * ROSTER.length)], 0);
    const bump = 8 + Math.floor(rnd() * 8);
    u.hp += bump * 3; u.atk += bump * 3; u.spd += bump * 2;
    out.push(u);
  }
  return out;
}
const clone = t => t.map(u => Object.assign({}, u));
function winRate(mut, n = 1100){
  let w = 0;
  for(let i = 0; i < n; i++){
    const a = clone(team(i * 2 + 1)), b = clone(team(i * 2 + 2));
    if(mut) mut(a);
    if(E.simulateBattle(a, b, i * 7919 + 13).result === 'win') w++;
  }
  return w / n;
}

const STEP = { hp:12, atk:12, spd:13 };   // roughly one shop purchase each
console.log('value of ONE MORE block, on top of a head start you already have');
console.log('  (a stat that keeps paying is worth building; one that flattens is a threshold)\n');
console.log('  stat   head start:      none       +1 block     +2 blocks    +3 blocks');
for(const stat of ['hp','atk','spd']){
  const step = STEP[stat];
  const cells = [];
  for(const have of [0, 1, 2, 3]){
    const before = winRate(t => t.forEach(u => { u[stat] += step * have; }));
    const after  = winRate(t => t.forEach(u => { u[stat] += step * (have + 1); }));
    cells.push(after - before);
  }
  console.log(`  ${stat.toUpperCase().padEnd(4)} +${String(step).padEnd(3)}/unit  ` +
    cells.map(v => ((v*100 >= 0 ? '+' : '') + (v*100).toFixed(1) + '%').padStart(12)).join(''));
}

/* Does a speed lead still convert into something once you have outrun
   everything? Before tempo the answer was flatly no. Count the extra actions a
   team earns at each size of lead. */
console.log('\nwhat a speed lead actually buys, in extra actions per battle:');
for(const lead of [0, 10, 20, 40, 80]){
  let extra = 0, battles = 0;
  for(let i = 0; i < 260; i++){
    const a = clone(team(i * 2 + 1)), b = clone(team(i * 2 + 2));
    a.forEach(u => { u.spd += lead; });
    const r = E.simulateBattle(a, b, i * 7919 + 13);
    extra += r.steps.flatMap(st => st.lines || []).filter(l => /fast enough to move again/.test(l)).length;
    battles++;
  }
  console.log(`  +${String(lead).padStart(2)} speed/unit   ${(extra/battles).toFixed(1)} extra actions per battle`);
}
