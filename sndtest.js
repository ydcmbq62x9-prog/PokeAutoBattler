const { chromium } = require('playwright');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✓ ' : '✗ ') + m); if(!ok) fails++; };
(async () => { const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_SOUND = true; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  await p.mouse.click(10, 10);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 6;
    G.team = ['charmander','squirtle','bulbasaur'].map((id, i) => { const u = makeUnit(id, 1); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
  await p.waitForTimeout(2500);
  await p.click('[data-act="pause"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => SFX.held), 'pausing holds the sound');
  for(let k = 0; k < 80; k++){ const done = await p.evaluate(() => !battle || battle.i >= battle.steps.length - 1); if(done) break; await p.click('[data-act="step"]').catch(() => {}); await p.waitForTimeout(30); }
  await p.waitForTimeout(400);
  await p.evaluate(() => { const c = document.querySelector('[data-act="afterbattle"]'); if(c) c.click(); }); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const n = SFX.log.length; SFX.play('coin'); return { held: SFX.held, logged: SFX.log.length > n, phase }; });
  check(!r.held && r.logged, 'after stepping to the end while paused and continuing, sound plays again (' + JSON.stringify(r) + ')');
  check(errs.length === 0, 'no errors ' + errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all good'); process.exit(fails ? 1 : 0); })();
