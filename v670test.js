/* 6.7.0: Hoenn bosses may field Gen 1 and Gen 2 pokémon that the run doesn't sell. */
const E = require('./engine.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const b3 = E.GEN_BOSSES[3], bosses = [...b3.gyms, ...b3.elite, b3.champion], by = id => bosses.find(b => b.id === id);
E.setActiveGens([3]);
check(bosses.every(b => (b.guards || []).every(k => E.inBossPool(k, null, b))), 'in a Gen 3-only run every Hoenn boss can field all of its hand-picked bodyguards');
{ const pool = k => E.themePool(by(k)); 
  check(['geodude', 'graveler', 'golem'].every(k => pool('roxanne').includes(k)), 'Roxanne can field the Geodude line (not sold in a Gen 3-only run)');
  check(['machamp', 'machoke'].every(k => pool('brawly').includes(k)), 'Brawly can field Machamp');
  check(pool('glacia').includes('lapras') && pool('drake').includes('dragonite'), 'Glacia can field Lapras and Drake Dragonite');
  check(!pool('flannery').includes('charizard') && !pool('winona').includes('dragonite'), 'a leader only gets other leaders’ guards if they are Hoenn-living (no Charizard for Flannery, no Dragonite for Winona)'); }
check(!E.buyableFor([3]).includes('geodude') && !E.buyableFor([3]).includes('machamp'), 'none of them is sold in the Daycare of a Gen 3-only run');
/* only Gen 3 bosses get it; Kanto and Johto benches are unchanged */
{ E.setActiveGens([1, 3]); const brock = E.GYMS[0]; check(E.themePool(brock).every(k => E.inGens(k) || E.inBossPool(k)), 'Kanto bosses are not widened');
  check(!E.inBossPool('crobat', null, brock) || E.inGens('crobat'), 'a Kanto boss cannot borrow a Gen 2 pokémon the run lacks'); }
E.setActiveGens([2, 3]);
check(E.inBossPool('charizard', null, by('drake')) && !E.inBossPool('charizard', null, E.GYMS2[0]), 'Drake may field Charizard in a Gen 2+3 run; Johto gym leaders still cannot');
E.setActiveGens([3]);
check(['lapras', 'dewgong'].every(k => !E.SPECIES[k].legendary) && !E.inBossPool('articuno', null, by('glacia')), 'legendaries still stay out of trainer teams');
/* real teams */
{ let seen = new Set(), n = 0;
  for(let s = 1; s <= 60; s++){ const G = E.newGame(s * 5, { gens:[3] }); E.useGens(G); const boss = by('glacia'); G.stage = 0;
    const t = E.generateAiTeam({ turn: 24, seed: s * 31, badges: 6, kind:'elite', boss }); for(const u of t.team || t) seen.add(u.id); n++; }
  check(['lapras', 'dewgong', 'jynx', 'sneasel', 'seel'].some(k => seen.has(k)), 'Glacia’s generated teams include Gen 1/2 pokémon in a Gen 3-only run (' + [...seen].filter(k => E.SPECIES[k].gen !== 3).join(', ') + ')'); }
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
