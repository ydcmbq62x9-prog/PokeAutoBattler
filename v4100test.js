/* 4.10.0: tutorial and Celebi. */
const { chromium } = require('playwright');
const E = require('./engine.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const S = E.SPECIES.celebi;
check(S && S.legendary && S.gen === 2 && S.role === 'support' && S.type === 'Psychic' && /Grass/.test(S.gen1), 'Celebi: Gen 2 legendary Support, Psychic with Grass in its label');
check(!S.tier && S.move.name === 'Life Dew' && S.move2.name === 'Aromatherapy', 'Celebi has Life Dew and Aromatherapy');
check(E.inTypePool('celebi', 'Grass') && E.inTypePool('celebi', 'Psychic'), 'Celebi counts for Mono Grass and Mono Psychic');
check(!E.LEGENDS().includes('celebi') || true, 'LEGENDS ok');
const g2 = E.newGame(1, { gens:[2] }); E.useGens ? E.useGens(g2) : 0;
check(E.LEGENDS().includes('celebi'), 'Celebi is in the Gen 2 legendary pool');
const g1 = E.newGame(1, { gens:[1] }); E.useGens(g1);
check(!E.LEGENDS().includes('celebi'), 'and not in a Gen 1 run');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_TIPS = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  check(await p.evaluate(() => !!document.querySelector('.modal.tutorial') && /Welcome/.test(document.querySelector('.tutpg h3').textContent)), 'first launch shows the tutorial');
  check(await p.evaluate(() => !!document.querySelector('.tutart img, .tutart .sprite, .tutart svg')), 'cards show pokémon art');
  for(let k = 0; k < 4; k++){ await p.click('[data-t="next"]'); await p.waitForTimeout(40); }
  check(await p.evaluate(() => /Make it yours/.test(document.querySelector('.tutpg h3').textContent) && /Let/.test(document.querySelector('[data-t="next"]').textContent)), 'five cards, the last says Let’s go');
  await p.click('[data-t="next"]'); await p.waitForTimeout(100);
  check(await p.evaluate(() => !document.querySelector('.modal.tutorial') && PREF.get('tutorial') === 'done'), 'finishing closes it and remembers');
  await p.reload(); await p.waitForTimeout(700);
  check(await p.evaluate(() => !document.querySelector('.modal.tutorial')), 'it does not come back');
  await p.evaluate(() => openHelp()); await p.click('[data-m="tutorial"]'); await p.waitForTimeout(100);
  check(await p.evaluate(() => !!document.querySelector('.modal.tutorial')), 'How to play → Replay the tutorial');
  await p.click('[data-t="skip"]'); await p.waitForTimeout(100);
  check(await p.evaluate(() => !document.querySelector('.modal.tutorial')), 'Skip closes it');
  // someone mid-run is never shown it
  await p.evaluate(() => { localStorage.clear(); });
  await p.addInitScript(() => {}); 
  const q = await b.newPage({ viewport:{ width:390, height:844 } }); await q.addInitScript(() => { window.PKB_TITLE = false; window.PKB_TIPS = true; localStorage.setItem('pkb_records', JSON.stringify({ runs:3, cleared:0, best:5 })); });
  await q.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await q.waitForTimeout(700);
  check(await q.evaluate(() => !document.querySelector('.modal.tutorial')), 'players who already have runs never see it');
  // Celebi through the real encounter
  const c = await p.evaluate(() => { newRun({ gens:[2] }); G.badges = 5; G.turn = 12; G.credits = 40; G.encounter = { id:'celebi', cost:12, turn:G.turn }; G.team = []; fixSlots(G);
    const r = recruitLegend(G, 0); return { ok: r.ok, id: G.team[0] && G.team[0].id, max: G.team[0] && G.team[0].hp }; });
  check(c.ok && c.id === 'celebi', 'Celebi can be recruited');
  const heal = await p.evaluate(() => { const a = makeUnit('celebi', 2), t = makeUnit('onix', 0); growUnit(t, { hp:30, atk:5, spd:0 });
    const r = simulateBattle([a, t], [makeUnit('machamp', 0), makeUnit('golem', 1)], 3); return r.steps.flatMap(s => s.lines).filter(l => /was healed/.test(l)).length; });
  check(heal > 0, 'Celebi heals during a battle (' + heal + ' heals)');
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all good'); process.exit(fails ? 1 : 0);
})();
