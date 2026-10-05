/* 4.2.0: Oak's screens, Porygon2 in play, battle pause, barrier repaint. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear());
  /* Oak screens */
  const a = await p.evaluate(() => {
    G = newGame(11, { gens: [1] }); G.redFlag = 'oak'; rollShop(G, false);
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8; phase = 'shop'; render();
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G); render();
    const t = s => (document.querySelector(s) || {}).innerText || '';
    return { dock: (document.querySelector('.dock') || {}).textContent || '', strip: t('.redstrip'), sprite: !!SPRITES.oak };
  });
  check(a.sprite, 'Oak has a sprite');
  check(/Oak is waiting at Pallet Town/.test(a.dock) && /one chance/.test(a.dock) && /Challenge Oak/i.test(a.dock), 'dock: Oak is waiting at Pallet Town');
  check(/Pallet Town/.test(a.strip) && /Oak.s Badge/.test(a.strip), 'strip names Oak and his badge');
  const w = await p.evaluate(() => {
    const opp = opponentFor0(G); applyBattleResult(G, 'win', opp, null); noteRunEnd(); phase = 'over'; render();
    return { html: document.body.innerText, rec: records().oak, red: records().red || null, badge: !!document.querySelector('.redend .rdb') };
  });
  check(/OAK DEFEATED!/.test(w.html) && /PALLET TOWN/.test(w.html) && w.badge && w.rec.count === 1 && !w.red, 'winning: Oak Defeated screen, Oak’s Badge recorded (not Red’s)');
  const card = await p.evaluate(() => { openTrainerCard(false); const t = document.querySelector('.tcard').innerText; document.querySelectorAll('.modal').forEach(m => m.remove()); return t; });
  check(/Oak.s Badge/.test(card) && /Red.s Badge/.test(card), 'Trainer Card shows both secret badges');
  check((await p.evaluate(async () => (await runImage()).size)) > 5000, 'summary image renders for Oak');
  const lose = await p.evaluate(() => {
    G = newGame(12, { gens: [1] }); G.redFlag = 'oak'; G.redOpen = true; G.stage = runPlan(G).length - 1;
    applyBattleResult(G, 'lose', opponentFor0(G), null); noteRunEnd(); phase = 'over'; render(); return document.body.innerText; });
  check(/CHAMPION!/.test(lose) && /professor smiled/.test(lose), 'losing: Champion screen with the professor’s note');
  /* Porygon2 in a Gen 2 run */
  const py = await p.evaluate(() => { G = newGame(5, { gens: [2] }); rollShop(G, false); const u = makeUnit('porygon', 0); u.exp = TUNING.expForLevel2; G.team = [u]; phase = 'shop'; render();
    const h = evoLineHtml('porygon').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); const cardOk = (() => { try{ popupHtml(makeUnit('porygon2', 0)); return true; }catch(e){ return false; } })();
    return { h, cardOk, spr: !!SPRITES.porygon2 }; });
  check(/Porygon2/.test(py.h) && py.cardOk && py.spr, 'Porygon’s card shows Porygon2 and Porygon2 has art: ' + py.h.slice(0, 60));
  /* pause */
  await p.evaluate(() => { localStorage.clear(); G = newGame(3, { gens: [1] }); G.pendingRewards = []; G.turn = 12; G.stage = 5;
    G.team = ['charizard', 'blastoise', 'butterfree', 'gengar', 'pidgeot', 'clefable'].map(i => makeUnit(i, 2)); rollShop(G, false); phase = 'shop'; render(); });
  await p.click('[data-act="endturn"]'); await p.waitForTimeout(2600);
  const i0 = await p.evaluate(() => battle.i);
  await p.click('[data-act="pause"]'); await p.waitForTimeout(150);
  const i1 = await p.evaluate(() => battle.i); await p.waitForTimeout(2500);
  const i2 = await p.evaluate(() => ({ i: battle.i, paused: battle.paused, label: document.querySelector('.pausebtn').innerText, step: !!document.querySelector('.stepbtn'), stage: document.querySelector('.bstage').classList.contains('paused') }));
  check(i2.paused && i2.i - i1 <= 1 && i2.label.includes('▶') && i2.step && i2.stage, `paused: the battle holds (step ${i1} → ${i2.i}), shows ▶, Step and PAUSED`);
  await p.click('[data-act="step"]'); await p.waitForTimeout(300);
  const i3 = await p.evaluate(() => battle.i); check(i3 === i2.i + 1, 'Step advances exactly one beat');
  await p.click('[data-act="pause"]'); await p.waitForTimeout(2600);
  const i4 = await p.evaluate(() => ({ i: battle ? battle.i : 999, paused: battle ? battle.paused : false }));
  check(!i4.paused && i4.i > i3 + 1, 'Resume carries on');
  await p.click('[data-act="skip"]').catch(() => {}); await p.waitForTimeout(500);
  const pausedSkip = await p.evaluate(() => { if(battle && !battle.exhibition){ battle.paused = true; finishPlayback(); return battle.paused; } return 'n/a'; });
  check(pausedSkip === false || pausedSkip === 'n/a', 'Skip clears a pause');
  /* barrier repaint: a barrier that breaks on a step where nothing else touches that pokémon */
  await p.evaluate(() => { localStorage.clear(); G = newGame(3, { gens: [1] }); G.pendingRewards = []; G.turn = 12; G.stage = 5;
    G.team = ['charizard', 'blastoise', 'butterfree', 'gengar', 'pidgeot', 'clefable'].map(i => makeUnit(i, 2)); rollShop(G, false); phase = 'shop'; render(); });
  await p.click('[data-act="endturn"]'); await p.waitForTimeout(2600);
  await p.evaluate(() => { battle.paused = true; clearTimeout(battle.timer); });   // keep the live playback out of the way
  await p.waitForTimeout(1200);                                                      // …and let its last step settle
  const br = await p.evaluate(() => {
    const S = battle.stage, k = [...S.f.keys()][0], F = S.f.get(k), st = battle.steps[battle.i];
    // the screen still shows a barrier (shield 9) but the next snapshot has none and nothing else changed for that pokémon
    const u0 = [...st.p, ...st.e].find(u => (k[0] + ':' + u.uid) === k); if(!u0) return 'nofighter';
    paintFighter(F, { ...u0, shield: 9 }, false);
    const onBefore = F.el.querySelector('.fbarrier').classList.contains('on') && !!F.el.querySelector('.fchip.sh');
    const next = JSON.parse(JSON.stringify(st)); next.fx = []; next.lines = [];
    battle.steps.splice(battle.i + 1, 0, next); battle.i++; animateStep(S, battle.i);
    return { onBefore };
  });
  await p.waitForTimeout(900);
  const gone = await p.evaluate(() => { const S = battle.stage, F = S.f.values().next().value; return { on: F.el.querySelector('.fbarrier').classList.contains('on'), chip: !!F.el.querySelector('.fchip.sh') }; });
  check(br !== 'nofighter' && br.onBefore && !gone.on && !gone.chip, 'a barrier that breaks on an untouched pokémon leaves nothing behind');
  check(!errs.length, 'no page errors ' + errs.slice(0, 2).join('; '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
