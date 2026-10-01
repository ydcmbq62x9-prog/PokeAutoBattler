// 4.0.0: tune each boss's `mix` (its price when it lands outside its home slot) so a
// mixed-gen run's first-try win rate in every slot follows the same curve as a single-gen run.
// node mixtune.js N iters '[1,2]'
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 400, IT = +process.argv[3] || 4, GENS = JSON.parse(process.argv[4] || '[1,2]');
const GYM_T = [98, 98, 97, 96, 95, 93, 91, 89], E4_T = [96, 93, 91, 88], CH_T = 80;
const GS = E.TUNING.badgesToWin * (E.TUNING.battlesPerBadge + 1);
function measure(){
  const by = {}; let cleared = 0;
  for(let r = 0; r < N; r++){
    const G = E.newGame(r * 13 + 5, { gens: GENS }); E.rollShop(G, false);
    const seen = new Set(); let guard = 0;
    while(!G.over && guard++ < 220){
      B.shop(G, { reroll:true, bench:4 });
      const st = E.stageOf(G), stage0 = G.stage || 0;
      const isBoss = st.boss && ['gym','elite','champion'].includes(st.kind);
      const { sim } = B.fight(G);
      if(isBoss && !seen.has(st.boss.id)){ seen.add(st.boss.id);
        const home = E.homeOf(st.boss), slot = st.kind === 'gym' ? st.badge : st.kind === 'elite' ? stage0 - GS : 0;
        const tgt = st.kind === 'gym' ? GYM_T[slot] : st.kind === 'elite' ? E4_T[slot] : CH_T;
        const atHome = home && home.kind === st.kind && home.slot === slot;
        const f = by[st.boss.id] = by[st.boss.id] || { n:0, diff:0, w:0, away:0 };
        f.n++; if(sim.result === 'win') f.w++;
        if(!atHome){ f.away++; f.diff += (sim.result === 'win' ? 100 : 0) - tgt; } }
      if(G.over) break; E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
  }
  return { by, clear: cleared / N * 100 };
}
for(let it = 0; it < IT; it++){
  const m = measure(); const line = [];
  for(const b of E.EVERY_BOSS){ const f = m.by[b.id]; if(!f || f.away < 15) continue;
    const d = f.diff / f.away;   // average points above target when away from home
    b.mix = +Math.max(0.5, Math.min(1.8, (b.mix || 1) * (1 + d / 100 * 0.5))).toFixed(3);
    line.push(`${b.id} ${d >= 0 ? '+' : ''}${d.toFixed(0)}→${b.mix}`); }
  console.log('iter', it, 'clear', m.clear.toFixed(1) + '%', line.join('  '));
}
console.log('MIX', JSON.stringify(Object.fromEntries(E.EVERY_BOSS.filter(b => b.mix && b.mix !== 1).map(b => [b.id, b.mix]))));
