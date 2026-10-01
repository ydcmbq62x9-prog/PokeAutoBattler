const E = require('./engine.js'); const S = E.SPECIES;
const rows = [];
for(const [id, sp] of Object.entries(S)){
  const m = sp.move, m2 = sp.move2;
  rows.push({ id, role: sp.role, tier: sp.tier, leg: !!sp.legendary, hp: sp.hp, atk: sp.atk, spd: sp.spd,
    m: m && m.name, mt: m && m.text ? m.text(1) : '', m2: m2 && m2.name, m2t: m2 && m2.text ? m2.text(1) : '', trig: m2 && m2.when ? m2.when() : '' });
}
if(process.argv[2] === 'names'){
  const by = {};
  for(const r of rows){ for(const [n, t, id] of [[r.m, r.mt, r.id], [r.m2, r.m2t, r.id]]){ if(!n) continue; (by[n] = by[n] || []).push(`${id}: ${t}`); } }
  for(const n of Object.keys(by).sort()) console.log(`## ${n}\n  ` + by[n].join('\n  '));
} else for(const r of rows) console.log(`${r.id.padEnd(11)} ${String(r.role).padEnd(8)} t${r.tier||'-'} ${r.hp}/${r.atk}/${r.spd}  | ${r.m} — ${r.mt}${r.m2 ? `\n${' '.repeat(34)}| [${r.trig}] ${r.m2} — ${r.m2t}` : ''}`);
