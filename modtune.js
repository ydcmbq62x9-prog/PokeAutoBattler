// secant-tune one run-rule factor so the reference bot clears TARGET%  (node modtune.js key target N [iters])
const E = require('./engine.js'), B = require('./botlib.js');
const [key, tgtArg, nArg, itArg] = process.argv.slice(2); const TARGET = +tgtArg || 52, N = +nArg || 400, IT = itArg !== undefined ? +itArg : 4;
const isMono = key.startsWith('mono:'), t = isMono ? key.split(':')[1] : null;
const GENS = JSON.parse(process.env.GENS || '[1]'), GK = GENS.join('+');   // 4.0.0
const monoTable = () => GK === '1' ? E.TUNING.mods.monoFoes : E.TUNING.mods.monoFoesByGens[GK];
const isG = key === 'gauntlet'; const gBase = E.TUNING.gauntletRatio.slice(); let gScale = 1;
const get = () => isG ? gScale : isMono ? (monoTable()[t] || 1) : E.TUNING.mods[key];
const set = v => { if(isG){ gScale = v; gBase.forEach((x, i) => E.TUNING.gauntletRatio[i] = x * v); } else if(isMono) monoTable()[t] = v; else E.TUNING.mods[key] = v; };
const mods = isMono ? { mono: t } : key === 'richFoes' ? { rich: true } : key === 'nopcFoes' ? { nopc: true } : key === 'onelifeFoes' ? { onelife: true } : {};
const rate = () => { let c = 0; for(let r = 0; r < N; r++) if(B.playRun(r * 7 + 1, { reroll:true, bench:4, mods, gens: GENS }).cleared) c++; return c / N * 100; };
let v = get(), p = rate(), pts = [[v, p]];
console.log(key, 'start', v.toFixed(3), p.toFixed(1) + '%');
for(let i = 0; i < IT; i++){
  if(Math.abs(p - TARGET) < 2.5) break;
  let next;
  if(pts.length >= 2){ const [a, b] = pts.slice(-2); const slope = (b[1] - a[1]) / (b[0] - a[0]); next = slope < -1 ? b[0] + (TARGET - b[1]) / slope : v * (1 + (p - TARGET) / 700); }
  else next = v * (1 + (p - TARGET) / 700);
  next = Math.max(0.6, Math.min(1.6, next));
  v = next; set(v); p = rate(); pts.push([v, p]);
  console.log(key, 'iter', i + 1, v.toFixed(3), p.toFixed(1) + '%');
}
console.log('RESULT', key, +v.toFixed(3), p.toFixed(1) + '%');
