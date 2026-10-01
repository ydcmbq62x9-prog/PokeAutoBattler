const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:390,height:800}, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    G.turn=14; G.badges=3; G.credits=30;
    G.team=[makeUnit('wartortle',2)]; G.bag=['sitrus','lefto']; rollShop(G,false); save(); render();
  });
  await p.waitForTimeout(150);
  const state = async label => console.log(label,
    JSON.stringify(await p.evaluate(() => ({
      sel, body: document.body.className,
      carryHidden: (document.querySelector('.carry')||{}).hidden,
      carryText: ((document.querySelector('.carry')||{}).textContent||'').trim().slice(0,30),
    }))));
  await state('start        ');
  await p.click('[data-act="team"][data-i="0"]'); await p.waitForTimeout(200);
  await state('picked pokemon');
  await p.click('.wall.bag .bcell:not(.empty)'); await p.waitForTimeout(250);
  await state('picked bag item');
  await b.close();
})();
