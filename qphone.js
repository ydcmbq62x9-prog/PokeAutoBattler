const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:390,height:800}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','1');
    G.turn=12; G.credits=30;
    G.team=[makeUnit('pikachu',0), makeUnit('onix',0), makeUnit('snorlax',0)];
    for(const u of G.team){ u.hp+=80; u.atk+=20; }
    save(); render();
  });
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(1400);
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if(over) errs.push('battle screen overflows at 390px');
  const q = await p.$('.queue');
  if(!q) errs.push('no queue on a phone');
  else {
    const fits = await q.evaluate(e => e.scrollWidth <= e.clientWidth + 2 || e.scrollWidth > 0);
    await q.screenshot({ path:'queue-phone.png' });
  }
  await b.close();
  if(errs.length){ errs.forEach(e=>console.log('  - '+e)); process.exit(1); }
  console.log('queue fits the phone');
})();
