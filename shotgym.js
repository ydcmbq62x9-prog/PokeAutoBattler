const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1200,height:1100}, deviceScaleFactor:2 });
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    G.turn=12; G.badges=2; G.stage=2*(TUNING.battlesPerBadge+1)+TUNING.battlesPerBadge; G.credits=26;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0),
            makeUnit('machoke',0), makeUnit('butterfree',0)];
    G.team[0].held='band'; G.team[1].held='coat';
    G.bag=['sitrus'];
    rollShop(G,false);
    const opp = opponentFor(G);
    G.scouted[stageOf(G).boss.id] = opp.team.map(u=>({id:u.id,nm:u.nm,hp:u.hp,atk:u.atk,spd:u.spd,exp:u.exp||0,held:u.held||null}));
    G.attempt = 1;
    save(); render();
  });
  await p.waitForTimeout(200);
  const el = await p.$('.nextup');
  await el.screenshot({ path:'nextup-gym.png' });
  const bar = await p.$('.topbar');
  await bar.screenshot({ path:'topbar.png' });
  await b.close();
})();
