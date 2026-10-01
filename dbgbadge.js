const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1200,height:1000} });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  p.on('console', m => { if(m.type()==='error') console.log('CONSOLE', m.text()); });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(250);

  // stack the deck so the gym is winnable, then play it for real through the UI
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','4');
    G.stage = TUNING.battlesPerBadge; G.turn = 4; G.credits = 40;
    G.team = [makeUnit('onix',0), makeUnit('machoke',0), makeUnit('gyarados',0),
              makeUnit('alakazam',0), makeUnit('charizard',0), makeUnit('snorlax',0)];
    for(const u of G.team){ u.hp += 200; u.atk += 60; u.spd += 60; }
    save(); render();
  });
  await p.waitForTimeout(150);

  const pips = async where => p.evaluate(() => ({
    badges: G.badges,
    lit: document.querySelectorAll('.stat.badges .bdg.on').length,
    total: document.querySelectorAll('.stat.badges .bdg').length,
    phase: typeof phase !== 'undefined' ? phase : '?',
  })).then(r => console.log(`${where.padEnd(22)} G.badges=${r.badges} lit=${r.lit}/${r.total} phase=${r.phase}`));

  await pips('before the fight');
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(500);
  await pips('during the fight');
  const skip = await p.$('[data-act="skip"]');
  if(skip){ await skip.click(); await p.waitForTimeout(400); }
  await pips('victory screen');
  const banner = await p.$eval('.big', e => e.textContent.trim()).catch(()=>null);
  console.log('banner:', banner);
  await p.click('[data-act="afterbattle"]');
  await p.waitForTimeout(500);
  await pips('back in the shop');
  await p.reload();
  await p.waitForTimeout(400);
  await pips('after a reload');
  await b.close();
})();
