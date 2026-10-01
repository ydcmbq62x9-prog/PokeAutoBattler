/* v28 roles: (1) do roles still look different late, (2) is any role/team shape dominant.
   Teams are built from the real growth rules, then scaled to EQUAL power, so a
   result is about shape, not about who has more stats. */
const E = require(process.env.ENG || './engine.js');
if(process.env.TUNE) Object.assign(E.TUNING, JSON.parse(process.env.TUNE));
if(process.env.ROLES){ const o = JSON.parse(process.env.ROLES); for(const r in o) Object.assign(E.TUNING.roles[r], o[r]); }
const N = Number(process.env.N || 400), TURN = Number(process.env.TURN || 24);
const byRole = r => E.BUYABLE.filter(k => E.roleOf(k) === r);
const finalOf = k => { const l = E.evoLine(k); return l[l.length - 1]; };
function build(ids, rnd){
  const bank = { hp: TURN * 2, atk: TURN * 2, spd: TURN * 1 };        // ~turn-24 trainer bank
  return ids.map(id => { const u = E.makeUnit(id, E.TUNING.expForLevel2); E.growUnit(u, bank);
    E.growUnit(u, E.TUNING.levelUpBonusMax); return u; });
}
function scaleTo(team, P){ const k = P / E.teamPower(team);
  for(const u of team){ u.hp = Math.round(u.hp * k); u.atk = Math.round(u.atk * k); u.spd = Math.round(u.spd * k); } return team; }
function mkRnd(s){ let x = s >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function pickTeam(shape, rnd){
  // shape: array of roles; species drawn at random from that role (final forms)
  return shape.map(r => { const pool = byRole(r).map(finalOf); return pool[Math.floor(rnd() * pool.length)]; });
}
const SHAPES = {
  'mixed 2T 2B 1S 1C': ['tank','tank','bruiser','bruiser','support','cannon'],
  'mixed 1T 2B 1S 2C': ['tank','bruiser','bruiser','support','cannon','cannon'],
  'all tank':    Array(6).fill('tank'),
  'all bruiser': Array(6).fill('bruiser'),
  'all cannon':  Array(6).fill('cannon'),
  'all support': Array(6).fill('support'),
  '3T 3C':       ['tank','tank','tank','cannon','cannon','cannon'],
  '2T 3B 1C (no S)': ['tank','tank','bruiser','bruiser','bruiser','cannon'],
  '2T 2S 2C':    ['tank','tank','support','support','cannon','cannon'],
  '2B 2S 2C (no T)': ['bruiser','bruiser','support','support','cannon','cannon'],
};
function duel(a, b){ let w = 0;
  for(let i = 0; i < N; i++){ const rnd = mkRnd(i * 97 + 13);
    const A = E.formationSort(build(pickTeam(SHAPES[a], rnd), rnd)), Bt = E.formationSort(build(pickTeam(SHAPES[b], rnd), rnd));
    if(process.env.NORM !== "0"){ const P = (E.teamPower(A) + E.teamPower(Bt)) / 2; scaleTo(A, P); scaleTo(Bt, P); }
    const r = E.simulateBattle(A, Bt, i + 1).result; if(r === 'win') w++; else if(r === 'draw') w += 0.5;
    const r2 = E.simulateBattle(Bt, A, i + 1001).result; if(r2 === 'lose') w++; else if(r2 === 'draw') w += 0.5; }
  return w / (2 * N); }
if(process.argv[2] !== 'noduel'){
  const names = Object.keys(SHAPES);
  console.log('win rate of ROW vs COLUMN, equal power, turn', TURN);
  console.log(''.padEnd(20) + names.map(n => n.slice(0, 11).padStart(12)).join(''));
  const W = {}; for(const a of names) W[a] = {};
  for(let i = 0; i < names.length; i++) for(let j = i + 1; j < names.length; j++){
    const x = duel(names[i], names[j]); W[names[i]][names[j]] = x; W[names[j]][names[i]] = 1 - x; }
  for(const a of names){ let line = a.padEnd(20), avg = 0;
    for(const b of names){ line += (a === b ? '—' : (W[a][b] * 100).toFixed(0) + '%').padStart(12); if(a !== b) avg += W[a][b]; }
    console.log(line + ('  avg ' + (avg / (names.length - 1) * 100).toFixed(0) + '%')); }
}
// identity: stat shares by role at TURN
const share = {};
for(const k of E.BUYABLE){ const f = finalOf(k); const [u] = build([f]); const t = u.hp + u.atk + u.spd;
  const r = E.roleOf(f); (share[r] = share[r] || []).push([u.hp / t, u.atk / t, u.spd / t]); }
console.log('\nlate stat shares (HP / Atk / Spd) by role:');
for(const r in share){ const a = share[r]; const m = i => (a.reduce((n, x) => n + x[i], 0) / a.length * 100).toFixed(0) + '%';
  console.log('  ' + r.padEnd(8), m(0), m(1), m(2)); }
