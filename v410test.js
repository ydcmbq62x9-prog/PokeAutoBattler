/* 4.1.0 (gen2 branch): Run Focus, the Evolution Pool, Gen 2 role pass, Pokédex grid. */
const E = require('./engine.js'); const S = E.SPECIES; const fs = require('fs');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };

/* roles (Sean: too many early supports) */
check(['hoothoot','noctowl'].every(k => S[k].role === 'tank') && ['natu','xatu'].every(k => S[k].role === 'cannon') && S.girafarig.role === 'bruiser', 'Hoothoot line is tank, Natu line cannon, Girafarig bruiser');
check(['wooper','quagsire'].every(k => S[k].tier === 1 && S[k].role === 'tank'), 'Wooper line is a tier 1 tank');
const t1 = Object.keys(S).filter(k => S[k].gen === 2 && !S[k].legendary && S[k].tier === 1 && !S[k].token || ['hoothoot','wooper'].includes(k));
const t1s = Object.keys(S).filter(k => S[k].gen === 2 && S[k].tier === 1 && S[k].role === 'support' && !S[k].token).length;
const t1t = Object.keys(S).filter(k => S[k].gen === 2 && S[k].tier === 1 && S[k].role === 'tank' && !S[k].token).length;
check(t1s <= 3 && t1t >= 2, `tier 1 Gen 2 has ≤3 supports and ≥2 tank lines (${t1s} support, ${t1t} tank)`);

/* mixed only */
for(const gens of [[1], [2]]){
  const G = E.newGame(77, { gens });
  check(G.evoPool === null && G.focus === null, `Gen ${gens} runs draw no focus and no evolution pool`);
}
const A = E.newGame(2024, { gens: [1, 2] }), A2 = E.newGame(2024, { gens: [1, 2] }), B = E.newGame(2025, { gens: [1, 2] });
check(A.focus.length === 3 && new Set(A.focus).size === 3 && A.evoPool.length === 4 && new Set(A.evoPool).size === 4, 'a mixed run draws 3 distinct focus lines and 4 open evolutions');
check(JSON.stringify([A.focus, A.evoPool]) === JSON.stringify([A2.focus, A2.evoPool]), 'the same seed draws the same focus and pool');
let differ = 0; for(let s = 1; s <= 30; s++){ const g = E.newGame(s * 13, { gens: [1, 2] }); if(JSON.stringify(g.evoPool) !== JSON.stringify(A.evoPool)) differ++; }
check(differ >= 20, `different seeds draw different pools (${differ}/30)`);
check(A.focus.some(k => E.genOf(k) === 1) && A.focus.some(k => E.genOf(k) === 2) && A.focus.every(k => E.BUYABLE.includes(k) && S[k].tier <= 3), 'focus has a Gen 1 and a Gen 2 line, all sold early');
check(A.evoPool.every(k => E.CROSS_EVOS.includes(k)), 'the pool only holds cross-gen evolutions');

/* the pool gates evolutions */
E.useGens(A);
const open = id => E.evoNext(id).some(n => n.gen2);
check(E.CROSS_EVOS.every(k => open(k) === A.evoPool.includes(k)), 'in a mixed run, only pooled cross-gen evolutions exist');
check(E.evoNext('ivysaur').length === E.evoNext('ivysaur').length && S.gloom.evo && E.evoNext('gloom').some(n => n.into === 'vileplume'), 'regular evolutions are unaffected (Gloom still levels into Vileplume)');
E.useGens(E.newGame(5, { gens: [2] }));
check(E.CROSS_EVOS.every(open), 'a Gen 2-only run keeps every cross-gen evolution open');
E.setActiveGens([1, 2]);
check(E.CROSS_EVOS.every(open), 'the Pokédex view (all gens, no run) shows them all');

/* focus lines show up more */
E.useGens(A);
const seen = {}; const G = E.newGame(2024, { gens: [1, 2] });
for(let b = 0; b <= 8; b++){ G.badges = b; for(let r = 0; r < 6; r++){ E.rollDaycare(G, false); G.daycare.forEach(c => { seen[c.unit.id] = (seen[c.unit.id] || 0) + 1; }); } }
const foc = G.focus.map(k => seen[k] || 0), others = Object.keys(seen).filter(k => !G.focus.includes(k) && S[k].tier <= 3).map(k => seen[k]);
const avgO = others.reduce((a, b) => a + b, 0) / others.length;
check(foc.every(n => n > avgO * 1.5), `focus lines appear >1.5× as often as other early pokémon (${foc.join('/')} vs ${avgO.toFixed(1)})`);

/* single-gen shops are untouched by the focus code */
const s1 = E.newGame(9, { gens: [1] }); E.rollDaycare(s1, false); const ids1 = s1.daycare.map(c => c.unit.id).join();
const s1b = E.newGame(9, { gens: [1] }); E.rollDaycare(s1b, false);
check(ids1 === s1b.daycare.map(c => c.unit.id).join(), 'a Gen 1 shop is deterministic and unchanged');

/* sprites and UI */
const sprites = fs.readFileSync('sprites.js', 'utf8');
check(/dragonscale/.test(sprites), 'the Dragon Scale has its art');
const ui = fs.readFileSync('ui.js', 'utf8');
check(/class="dextile/.test(ui) && /showCard/.test(ui) && /dexsearch/.test(ui) && /data-t="dex"/.test(ui), 'the Pokédex is a tile grid with cards, search, and a title-menu entry');
check(/runNoteHtml/.test(ui) && /class="dfocus"/.test(ui), 'the Daycare marks focus lines and shows the open evolutions');
/* daily */
let cnt = { '1': 0, '1,2': 0, '2': 0 };
for(let d = 1; d <= 120; d++){ const date = '2026-' + String(1 + (d % 12)).padStart(2, '0') + '-' + String(1 + (d % 28)).padStart(2, '0') + '-' + d; cnt[E.dailyGens(date).join()]++; }
check(cnt['1'] > 30 && cnt['1,2'] > 20 && cnt['2'] > 8, `the daily rotates Gen 1 / Gen 1+2 / Gen 2 (${JSON.stringify(cnt)})`);
check(E.dailyGens('2026-10-03').join() === E.dailyGens('2026-10-03').join(), 'a day always plays the same gens');
let okMono = true; for(let d = 1; d <= 200; d++){ const date = 'x' + d, m = E.dailyMods(date); if(m.mono && !E.monoTypesFor(E.dailyGens(date)).includes(m.mono)) okMono = false; }
check(okMono, 'a daily Mono type always exists in that day\u2019s gens');
const dg = E.newGame(E.dailySeed('x7'), { mods: E.dailyMods('x7'), daily: 'x7', gens: E.dailyGens('x7') });
check(JSON.stringify(dg.gens) === JSON.stringify(E.dailyGens('x7')), 'a daily run plays the day\u2019s gens');
check(/\$\{runNoteHtml\(G\)\}\s*\n\s*\$\{top\.length/.test(ui) && /Open evolutions: ' \+ pl/.test(ui) && /Pool of the day/.test(ui), 'the summary, the summary image and the daily show Focus and evolutions');
check(/class="dexfam"/.test(ui) && /farrow/.test(ui), 'the Pokédex groups tiles by evolution line');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
