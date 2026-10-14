// @slow: statistical balance check, skipped by quick.sh (runs in the full suite)
/* v31: Exp. Share and Lucky Egg can't carry a run on their own any more. */
const E = require('./engine.js');
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };
const T = E.TUNING;

/* rarity */
check(E.rarityOf(E.ITEMS.expshare) === 'rare' && E.rarityOf(E.HELD_ITEMS.egg) === 'rare', 'Exp. Share and Lucky Egg are marked rare');
{ let n = 0, hits = { expshare:0, egg:0 }, other = { protein:0, band:0 };
  for(let s = 1; s < 400; s++){ const G = E.newGame(s); G.turn = 30; G.badges = 8; G.team = [E.makeUnit('abra',0)];
    for(let r = 0; r < 5; r++){ E.rollMart(G, false); for(const m of G.mart) if(m.id in hits) hits[m.id]++; else if(m.id in other) other[m.id]++; n++; } }
  const rE = hits.expshare / other.protein, rG = hits.egg / other.band;
  /* 6.5.0: the medicine shelf has more items now, so Protein is rarer per slot; Exp. Share's own rate is unchanged (~0.07 a slot), hence the wider bands (Lucky Egg too: Muscle Band shares the held shelf with the new role items). */
  check(rE > 0.15 && rE < 0.5 && rG > 0.15 && rG < 0.45, `they turn up about a quarter as often (Exp. Share ${rE.toFixed(2)}× Protein, Lucky Egg ${rG.toFixed(2)}× Muscle Band)`); }

/* Exp. Share: party only */
{ const G = E.newGame(3); E.rollShop(G, false);
  G.team = [E.makeUnit('machop', 0)]; G.pc = [E.makeUnit('geodude', 0)]; G.team[0].held = 'egg';
  const bank = JSON.stringify(G.trainerExp), pc = G.pc[0].hp, a0 = G.team[0].atk;
  E.shareExp(G);
  check(G.team[0].atk === a0 + T.expGainWin.atk, 'Exp. Share gives the party one round');
  check(JSON.stringify(G.trainerExp) === bank, '…but not the trainer bank, so new buys don’t inherit it');
  check(G.pc[0].hp === pc, '…nor the PC');
  check(!G.team[0].eggTicks, '…and it doesn’t trigger a Lucky Egg'); }

/* Lucky Egg cap */
{ const G = E.newGame(4); E.rollShop(G, false); G.team = [E.makeUnit('machop', 0)]; G.team[0].held = 'egg';
  for(let i = 0; i < 30; i++) E.grantBattleExp(G, 'win', true);
  const u = G.team[0], plain = E.makeUnit('machop', 0);
  for(let i = 0; i < 30 + T.eggCap; i++) E.growUnit(plain, T.expGainWin);
  check(u.eggTicks === T.eggCap && u.atk === plain.atk, `a Lucky Egg stops after ${T.eggCap} bonus rounds (30 fights → ${u.eggTicks})`);
  check(!E.heldActive(u), '…and then shows as used up');
  const v = E.makeUnit('machop', 0); v.eggTicks = 4; E.mergeInto(G, u, v);
  check(u.eggTicks === T.eggCap, 'merging keeps the higher count, like vitamins'); }

/* the measured claim */
{ const B = require('./botlib.js'); const RUNS = 150;
  const clear = opts => { let c = 0; for(let r = 0; r < RUNS; r++) if(B.playRun(r * 7 + 1, { reroll:true, bench:4, ...opts }).cleared) c++; return c / RUNS * 100; };
  const ref = clear({}), snow = clear({ snow:true });
  check(snow - ref < 8, `snowballing (every Exp. Share and Lucky Egg first) isn’t a strategy: ${ref.toFixed(0)}% → ${snow.toFixed(0)}% (was 77% → 90%)`); }

if(errors.length){ console.log('\n' + errors.length + ' FAILURES:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
console.log('\nsnowball items passed');
