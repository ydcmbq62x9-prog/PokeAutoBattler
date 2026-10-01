const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1100,height:1100}, deviceScaleFactor:2 });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','1');
    G.turn=12; G.badges=2; G.credits=30;
    G.team=[makeUnit('pikachu',0), makeUnit('alakazam',0), makeUnit('onix',0), makeUnit('snorlax',0)];
    for(const u of G.team){ u.hp += 80; u.atk += 20; }
    save(); render();
  });
  await p.waitForTimeout(150);
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(3000);
  const q = await p.$('.queue');
  if(q) await q.screenshot({ path:'queue.png' }); else console.log('NO QUEUE');
  await p.screenshot({ path:'battle-atb.png' });
  await b.close();
})();
