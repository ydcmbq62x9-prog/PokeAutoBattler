/* How strong are Exp. Share and Lucky Egg, and how often do players see them?
   Env: RUNS. Compares the reference player, a snowball player (buys every
   Exp. Share / Lucky Egg first, eggs on its hitters), and a game without them. */
const E = require('./engine.js'); const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 400);
// count every purchase and every roll that offers one, rerolls included
const C = { offE:0, offG:0, buyE:0, buyG:0 };
const wrap = (name, f) => { const o = E[name]; E[name] = (...a) => { const r = o(...a); f(a, r); return r; }; };
wrap('buyItem', (a, r) => { if(r && r.ok && a[0].mart[a[1]] && a[0].mart[a[1]].id === 'expshare') C.buyE++; });
wrap('buyHeld', (a, r) => { if(r && r.ok && r.id === 'egg') C.buyG++; });
wrap('buyHeldOnto', (a, r) => { if(r && r.ok && a[0].mart[a[1]] && a[0].mart[a[1]].id === 'egg') C.buyG++; });
wrap('rollMart', (a, r) => { if(r){ for(const s of a[0].mart){ if(s.id === 'expshare') C.offE++; if(s.id === 'egg') C.offG++; } } });
function run(opts, off){
  const tE = E.ITEMS.expshare.tier, tG = E.HELD_ITEMS.egg.tier;
  if(off){ E.ITEMS.expshare.tier = 99; E.HELD_ITEMS.egg.tier = 99; }
  for(const k in C) C[k] = 0;
  let cleared = 0, seenE = 0, seenG = 0, buyE = 0, buyG = 0, turns = 0, pw = 0, pwn = 0;
  for(let r = 0; r < RUNS; r++){
    const G = E.newGame(r * 7 + 1); E.rollShop(G, false); let g = 0;
    const origRoll = E.rollMart;
    while(!G.over && g++ < 220){
      const before = { e: countBought(G, 'expshare'), g: 0 };
      B.shop(G, { reroll:true, bench:4, ...opts });
      for(const s of G.mart){ if(s.id === 'expshare'){ seenE++; if(s.bought) buyE++; } if(s.id === 'egg'){ seenG++; if(s.bought) buyG++; } }
      turns++;
      if(G.turn === 20){ pw += E.teamPower(G.team); pwn++; }
      B.fight(G); if(G.over) break; E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
  }
  E.ITEMS.expshare.tier = tE; E.HELD_ITEMS.egg.tier = tG;
  return { cleared: cleared / RUNS * 100, seenE: (seenE + C.offE) / RUNS, seenG: (seenG + C.offG) / RUNS, buyE: C.buyE / RUNS, buyG: C.buyG / RUNS, pw20: pw / Math.max(1, pwn) };
}
function countBought(){ return 0; }
for(const [label, opts, off] of [['reference', {}, false], ['snowball', { snow:true }, false], ['without either item', {}, true]]){
  const m = run(opts, off);
  console.log(`${label.padEnd(20)} cleared ${m.cleared.toFixed(0)}% · power@turn20 ${m.pw20.toFixed(0)} · offered/bought per run: Exp.Share ${m.seenE.toFixed(1)}/run (bought ${m.buyE.toFixed(1)}), Lucky Egg ${m.seenG.toFixed(1)}/run (bought ${m.buyG.toFixed(1)})`);
}
