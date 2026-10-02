/* 4.0.0 (gen2 branch): generations — gen toggles, the shared boss pool, slot scaling, one appearance per person. */
const E = require('./engine.js'); const S = E.SPECIES; const fs = require('fs');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const ids = a => a.map(b => b.id).join();

/* Gen 1 is the classic run */
{ const G = E.newGame(5);
  check(G.gens.join() === '1' && G.bossPlan.gyms.join() === ids(E.GYMS) && G.bossPlan.elite.join() === ids(E.ELITE_FOUR) && G.bossPlan.champion === 'blue' && G.bossPlan.rival === 'rival', 'a plain run is Gen 1 in the classic order');
  const old = E.newGame(5); delete old.gens; delete old.bossPlan;
  check(E.runPlan(old).filter(p => p.boss).map(p => p.boss.id).join() === E.runPlan().filter(p => p.boss).map(p => p.boss.id).join(), 'an old save (no gens) plays the classic Gen 1 run');
  check(E.modList(G).length === 0 && E.genLabel(G) === '', 'a Gen 1 run carries no rule label, so its records stay where they were'); }

/* Gen 2 alone */
{ const G = E.newGame(7, { gens:[2] });
  check(G.bossPlan.gyms.join() === ids(E.GYMS2) && G.bossPlan.elite.join() === ids(E.ELITE_FOUR2) && G.bossPlan.champion === 'lance2' && G.bossPlan.rival === 'silver', 'Gen 2 alone: Falkner … Clair, Will … Karen, Lance, and Silver as the rival');
  check(E.BUYABLE.every(k => E.SPECIES[k].gen === 2 || E.gen2Linked(k)) && !E.BUYABLE.includes('gastly') && !E.BUYABLE.includes('dratini') && E.BUYABLE.includes('onix') && E.BUYABLE.includes('pikachu'),
    'its Daycare sells only Gen 2 pokémon and the Gen 1 lines a Gen 2 pokémon belongs to (Onix, Pikachu — not Gastly or Dratini)');
  check(E.themePool(E.bossById('morty')).includes('gengar') && E.themePool(E.bossById('clair')).includes('dragonite') && !E.themePool(['Ghost']).includes('gastly'),
    '…while its leaders can still field Johto\'s Gen 1 pokémon (Morty\'s Gengar, Clair\'s Dragonite); ordinary trainers cannot');
  check(E.rivalOf(G).name === 'Silver' && E.gymAt(G, 0).badge === 'Zephyr', 'the rival and the badge names follow the run');
  check(E.genLabel(G) === 'Gen 2' && E.modList(G)[0] === 'gens', 'a Gen 2 run is labelled and keeps its own records'); }
E.setActiveGens([1]);
check(E.BUYABLE.length === E.buyableFor([1]).length && E.MONO_TYPES.join() === E.monoTypesFor([1]).join(), 'switching back to Gen 1 restores its shop and Mono types');

/* both gens: drawn, shuffled, one appearance per person */
{ let ok = 0, bad = [], brock8 = 0, brock1 = 0, blueRival = 0, blueBoth = 0, lanceTwice = 0, kogaTwice = 0;
  const N = 400;
  for(let s = 1; s <= N; s++){
    const p = E.drawBossPlan(s, [1, 2]);
    const all = [...p.gyms, ...p.elite, p.champion, p.rival].map(E.bossById);
    const persons = all.map(E.personOf);
    if(p.gyms.length === 8 && p.elite.length === 4 && new Set(persons).size === persons.length) ok++; else bad.push(s);
    if(p.gyms[7] === 'brock') brock8++; if(p.gyms[0] === 'brock') brock1++;
    if(p.rival === 'rival'){ blueRival++; if(p.champion === 'blue') blueBoth++; }
    if(persons.filter(x => x === 'lance').length > 1) lanceTwice++;
    if(persons.filter(x => x === 'koga').length > 1) kogaTwice++;
  }
  check(ok === N, `every mixed plan has 8 gyms, 4 Elite Four, a champion and a rival, and nobody twice (${ok}/${N})`);
  check(brock8 > 5 && brock1 > 5, `Brock lands in any slot: first gym ${brock1}×, eighth gym ${brock8}×`);
  check(blueRival > 50 && blueBoth === 0 && lanceTwice === 0 && kogaTwice === 0, `Blue as rival is never also champion; Lance and Koga appear once (${blueRival} Blue rivals)`);
  check(JSON.stringify(E.drawBossPlan(9, [1, 2])) === JSON.stringify(E.drawBossPlan(9, [1, 2])), 'the draw is fixed by the seed'); }

/* slot scaling */
{ const brock = E.bossById('brock'), G = E.newGame(3, { gens:[1, 2] });
  const at = (b, badge) => ({ kind:'gym', badge, boss:b });
  check(E.bossCalib(G, at(brock, 0)) === brock.calib, 'at home, a boss keeps its own calib (Gen 1 is untouched)');
  const exp = (E.GYMS[7].calib + E.GYMS2[7].calib) / 2 * (brock.mix || 1);
  check(Math.abs(E.bossCalib(G, at(brock, 7)) - exp) < 1e-9, 'moved to slot 8, it is priced like the eighth gyms of the run\'s gens');
  const team = badge => E.generateAiTeam({ turn: 6 + badge * 4, seed: 11, badges: badge, kind:'gym', boss: brock, tier: Math.min(6, 1 + badge),
    ratio: E.bossCalib(G, at(brock, badge)) * E.TUNING.gymRatio[badge] }).team;
  const early = team(0), late = team(7);
  const depth = t => t.reduce((s, u) => s + E.evoDepth(u.id), 0) / t.length;
  check(depth(late) > depth(early) && E.teamPower(late) > E.teamPower(early) * 2, `Brock as the eighth gym is evolved and far stronger (${early.map(u => u.id)} → ${late.map(u => u.id)})`); }

/* the opponent for a mixed run comes from its plan */
{ const G = E.newGame(12, { gens:[1, 2] }); E.rollShop(G, false);
  G.stage = E.TUNING.battlesPerBadge; const st = E.stageOf(G);
  check(st.kind === 'gym' && st.boss.id === G.bossPlan.gyms[0], `the first gym is the plan's (${st.boss.name})`);
  const plan = E.runPlan(G); const champ = plan[plan.length - 1];
  check(champ.boss.id === G.bossPlan.champion, 'and so is the champion'); }

/* Gen 2-only evolutions (evo2) and stat-picked evolutions (byStat), on stand-in species */
{ S.tstbat = { name:'Testbat', type:'Poison', gen1:'Poison', gen:2, tier:2, role:'support', hp:60, atk:50, spd:70, token:true, move:E.M.hit('Tackle', 1) };
  S.golbat.evo2 = { into:'tstbat', by:'level' };
  E.setActiveGens([1]);
  check(E.evoNext('golbat').length === 0 && E.evoParent('tstbat') === null, 'with Gen 1 only, Golbat stays a final form');
  E.setActiveGens([1, 2]);
  check(E.evoNext('golbat').some(n => n.into === 'tstbat'), 'with Gen 2 on, it can evolve again');
  const G = E.newGame(4, { gens:[1, 2] }); const u = E.makeUnit('golbat', 0);
  const r = E.applyLevelUp(G, u);
  check(r.evolved && u.id === 'tstbat', 'and does so on its next level up');
  delete S.golbat.evo2; delete S.tstbat;
  S.tstbaby = { name:'Testbaby', type:'Fighting', gen1:'Fighting', gen:2, tier:3, role:'bruiser', hp:20, atk:20, spd:20,
    evo:{ by:'level', byStat:{ atk:'hitmonlee', hp:'hitmonchan', spd:'tauros' } }, move:E.M.hit('Tackle', 1) };
  const a = E.makeUnit('tstbaby', 0); a.atk = 90; E.applyLevelUp(G, a);
  const b = E.makeUnit('tstbaby', 0); b.hp = 90; E.applyLevelUp(G, b);
  const c = E.makeUnit('tstbaby', 0); c.spd = 90; E.applyLevelUp(G, c);
  check(a.id === 'hitmonlee' && b.id === 'hitmonchan' && c.id === 'tauros', 'a stat-picked evolution follows the highest stat (Tyrogue)');
  delete S.tstbaby; E.setActiveGens([1]); }

/* the New Run screen */
const ui = fs.readFileSync('ui.js', 'utf8');
check(/class="gent" data-gen=/.test(ui) && /newRun\(\{ mods, gens, secret \}\)/.test(ui) && /monoTypesFor\(gens\)/.test(ui), 'New Run has a toggle per gen, passes them on, and shows only the Mono types those gens can field');
check(E.modsLabel({ gens:[1, 2], mods:{ nopc:true } }) === 'Gen 1+2 · No PC', 'a mixed run is labelled "Gen 1+2" beside its other rules');
console.log(fails ? fails + ' FAILED' : 'v400 passed'); process.exit(fails ? 1 : 0);
