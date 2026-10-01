const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport:{ width:1250, height:950 } }]]){
  const p = await (await b.newContext(dev)).newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { PREF.set('text','instant'); G.turn = 14; G.badges = 4; G.credits = 40;
    G.team = [makeUnit('eevee', 0), makeUnit('pikachu', 0)]; G.pc = [makeUnit('eevee', 0)]; G.pc[0].box = 0; fixSlots(G);
    G.mart = [{ id:'thunderstone', held:false }, { id:'waterstone', held:false }, { id:'protein', held:false }]; render();
    const rows = [...document.querySelectorAll('.martrow[data-act="mart"]')].map(r => (r.querySelector('.mprev') || {}).textContent || '');
    document.querySelector('.martrow[data-act="mart"][data-i="0"]').click();
    const ins = [...document.querySelectorAll('#inspect .sprev')].map(e => e.textContent.replace(/\s+/g,' ').trim());
    return { rows, ins, over: document.documentElement.scrollWidth > innerWidth + 1 }; });
  console.log(tag, JSON.stringify(r, null, 1), errs);
  await (await p.$('#inspect')).screenshot({ path:`prev-${tag}-insp.png` }); await (await p.$('.martlist')).screenshot({ path:`prev-${tag}-mart.png` });
  }
  await b.close(); })();
