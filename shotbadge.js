const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1100,height:1000}, deviceScaleFactor:2 });
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','4');
    G.stage = 3*(TUNING.battlesPerBadge+1)+TUNING.battlesPerBadge; G.badges = 3;
    G.turn = 16; G.credits = 40;
    G.team = [makeUnit('onix',0), makeUnit('machoke',0), makeUnit('gyarados',0),
              makeUnit('alakazam',0), makeUnit('charizard',0), makeUnit('snorlax',0)];
    for(const u of G.team){ u.hp += 300; u.atk += 90; u.spd += 80; }
    save(); render();
  });
  await p.waitForTimeout(150);
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(400);
  const skip = await p.$('[data-act="skip"]');
  if(skip){ await skip.click(); await p.waitForTimeout(500); }
  await p.screenshot({ path:'badge-win.png' });
  const arena = await p.$('.panel.arena');
  await arena.screenshot({ path:'badge-award.png' });
  const bar = await p.$('.topbar');
  await bar.screenshot({ path:'badge-bar.png' });
  await b.close();
})();
