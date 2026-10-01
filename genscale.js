// 4.0.0: find TUNING.gensFoes[key] so the reference bot clears TARGET%   node genscale.js '[1,2]' 75 400
const E = require('./engine.js'), B = require('./botlib.js');
const gens = JSON.parse(process.argv[2] || '[1,2]'), T = +process.argv[3] || 75, N = +process.argv[4] || 400, key = gens.join('+');
const rate = v => { E.TUNING.gensFoes[key] = v; let c = 0; for(let r = 0; r < N; r++) if(B.playRun(r * 7 + 1, { reroll:true, bench:4, gens }).cleared) c++; return c / N * 100; };
let v = +(process.argv[5] || 0.88), p = rate(v); const pts = [[v, p]]; console.log(key, v, p.toFixed(1));
for(let i = 0; i < 4 && Math.abs(p - T) > 2; i++){
  if(pts.length >= 2){ const [a, b] = pts.slice(-2); const sl = (b[1] - a[1]) / (b[0] - a[0]); v = sl < -1 ? b[0] + (T - b[1]) / sl : v * (1 + (p - T) / 400); }
  else v = v * (1 + (p - T) / 400);
  v = +Math.max(0.6, Math.min(1.1, v)).toFixed(3); p = rate(v); pts.push([v, p]); console.log(key, v, p.toFixed(1));
}
console.log('RESULT', key, v, p.toFixed(1));
