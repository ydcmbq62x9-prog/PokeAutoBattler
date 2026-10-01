const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], });
  const p = await ctx.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    G.turn=14; G.credits=60;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0), makeUnit('machoke',0)];
    G.pc=[makeUnit('abra',0), makeUnit('gastly',0)];
    G.team[0].held='band'; G.team[1].held='coat'; G.team[2].held='coin'; G.team[3].held='evio';
    G.bag=['sitrus','lefto']; PREF.set('text','instant');
    rollShop(G,false); save(); render();
  });
  await p.tap('.slot[data-act="team"][data-i="0"]'); await p.waitForTimeout(900);
  const el = await p.$('#inspect'); console.log(await el.evaluate(e=>e.outerHTML.slice(0,300)));
  await el.screenshot({path:'fl-insp.png'});
  const r = await p.evaluate(()=>{const s=document.querySelector('#inspect .popart'); const h=s.querySelector('.held'); const i=s.querySelector('img'); return {art:s.getBoundingClientRect().width, img:i.getBoundingClientRect().width, held:h.getBoundingClientRect().width}});
  console.log(JSON.stringify(r));
  await b.close();
})();
