/* 6.20.0 — what each held item is worth in a duel, as "% more power" (a report: no assertions, so the suite skips it).
   Random duel teams (fully evolved, random vitamins). The item goes on a team member that can use it; the same
   member instead gets +x% to HP, Attack and Speed (= x% more power). The x that wins as often as the item is
   what the item is worth. Same teams and seeds for every variant, so the comparison is fair.
     node duelitemreport.js [trials per item] [item ids, comma separated]   (HOLDER=support to pick the holder's role) */
const E = require('./engine.js');
const { SPECIES, HELD_ITEMS, TUNING, makeUnit, simulateBattle, roleOf, canStillEvolve, unitPower } = E;
E.setActiveGens(E.GENS_READY);
const N = +process.argv[2] || 1500;
const IDS = (process.argv[3] || Object.keys(HELD_ITEMS).filter(k => HELD_ITEMS[k].kind !== 'economy' && k !== 'evio').join(',')).split(',');
const FIN = Object.keys(SPECIES).filter(k => !SPECIES[k].legendary && SPECIES[k].role && !canStillEvolve(k));
const ORDER = { tank:0, bruiser:1, support:2, cannon:3 };
let rs = 12345; const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];
const mkUnit = id => { const u = makeUnit(id, TUNING.expForLevel3 + 1), c = TUNING.vitaminCap;
  u.hp += 8 * Math.floor(rnd() * (c + 1)); u.atk += 9 * Math.floor(rnd() * (c + 1)); u.spd += 10 * Math.floor(rnd() * (c + 1)); return u; };
const mkTeam = () => { const t = Array.from({ length:6 }, () => mkUnit(pick(FIN))); t.sort((a, b) => ORDER[roleOf(a)] - ORDER[roleOf(b)]); t.forEach((u, i) => u.pos = i); return t; };
const clone = t => t.map(u => Object.assign(makeUnit(u.id, u.exp), u));
const score = (A, B, seed) => { const r = simulateBattle(A, B, seed).result; return r === 'win' ? 1 : r === 'draw' ? 0.5 : 0; };
const XS = [0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.45, 0.65];
for(const id of IDS){
  const h = HELD_ITEMS[id], trials = [];
  for(let n = 0; n < N; n++){
    const A = mkTeam(), B = mkTeam(), seed = Math.floor(rnd() * 1e9);
    const role = h.role || process.env.HOLDER;             // HOLDER=support measures an item on the role it suits
    const ok = A.map((u, i) => i).filter(i => !role || roleOf(A[i]) === role); if(!ok.length){ n--; continue; }
    trials.push({ A, B, seed, i: pick(ok) });
  }
  let withItem = 0, counted = 0; const boost = XS.map(() => 0);
  for(const t of trials){
    const Ai = clone(t.A); Ai[t.i].held = id; withItem += score(Ai, clone(t.B), t.seed);
    const bare = unitPower(t.A[t.i]); counted += (unitPower(Ai[t.i]) - bare) / bare;
    XS.forEach((x, k) => { const Ax = clone(t.A), u = Ax[t.i];
      u.hp = Math.round(u.hp * (1 + x)); u.atk = Math.round(u.atk * (1 + x)); u.spd = Math.round(u.spd * (1 + x)); boost[k] += score(Ax, clone(t.B), t.seed); });
  }
  const w = withItem / N, b = boost.map(v => v / N);
  let eq = XS[XS.length - 1];                                         // the x where +x% wins as often as the item
  if(w <= b[0]) eq = 0; else for(let k = 1; k < XS.length; k++) if(b[k] >= w){ eq = XS[k - 1] + (XS[k] - XS[k - 1]) * (w - b[k - 1]) / Math.max(1e-9, b[k] - b[k - 1]); break; }
  console.log(JSON.stringify({ id, name:h.name, gain:+((w - b[0]) * 100).toFixed(1), worth:+(eq * 100).toFixed(1), counted:+(counted / N * 100).toFixed(1), extra:+(Math.max(0, eq - counted / N) * 100).toFixed(1) }));
}
