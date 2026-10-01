/* One step of the v28 roster pass: measure every final form's value in a team
   (species-value.js method) and scale the move power of any line that falls
   outside the band toward it. Writes engine.js. Run a few times. */
const fs = require('fs'); const { execSync } = require('child_process');
const LO = Number(process.env.LO || 0.45), HI = Number(process.env.HI || 0.55), K = Number(process.env.K || 1.2);
const out = execSync('node species-value.js', { env:{ ...process.env, N: process.env.N || '300' } }).toString();
const E = require('./engine.js');
const vals = {}; for(const l of out.split('\n')){ const m = l.match(/^(\w+)\s+\w+\s+T\d (\d+)%/); if(m) vals[m[1]] = +m[2] / 100; }
const IDX = { hit:[0], all:[0], two:[0], multi:[0], fast:[0], big:[0], pierce:[0], trueHit:[0], drain:[0], slow:[0,1], weaken:[0,1],
  recoil:[0], ramp:[0], heal:[0,1], mend:[0,1], rally:[0,1], hush:[0,1], charge:[0,1], wall:[0,1], guard:[0,1] };
let src = fs.readFileSync('engine.js', 'utf8'); const log = [];
for(const [X, v] of Object.entries(vals)){
  if(v >= LO && v <= HI) continue;
  const f = Math.max(0.8, Math.min(1.25, 1 + K * ((v < LO ? LO : HI) - v)));
  for(const id of E.evoLine(X)){
    const i = src.indexOf('\n  ' + id + ':'); const j = src.indexOf('move:M.', i) + 7; const e = src.indexOf(')', j);
    const call = src.slice(j, e + 1); const m = call.match(/^(\w+)\((.*)\)$/); if(!m || !IDX[m[1]]) continue;
    const parts = m[2].match(/'[^']*'|[^,]+/g).map(x => x.trim());
    const nums = parts.filter(x => !x.startsWith("'"));
    const newNums = nums.map((n, k) => { if(!IDX[m[1]].includes(k)) return n; const x = parseFloat(n) * f;
      return (m[1] === 'guard' || !n.includes('.')) ? String(Math.max(1, Math.round(x))) : String(Math.round(x * 100) / 100); });
    let k = 0; const rebuilt = parts.map(x => x.startsWith("'") ? x : newNums[k++]).join(', ');
    src = src.slice(0, j) + m[1] + '(' + rebuilt + ')' + src.slice(e + 1);
    log.push(`${id} ${(v*100).toFixed(0)}% ×${f.toFixed(2)}: ${call} → ${m[1]}(${rebuilt})`);
  }
}
fs.writeFileSync('engine.js', src); console.log(log.join('\n') || 'all in band');
