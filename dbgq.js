const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1200,height:1100} });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','1');
    G.stage = 1; G.turn = 10; G.credits = 30;
    G.team = [makeUnit('pikachu',0), makeUnit('onix',0), makeUnit('snorlax',0)];
    for(const u of G.team){ u.hp += 80; u.atk += 20; }
    save(); render();
  });
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(1400);
  const snap = async label => console.log(label, JSON.stringify(await p.evaluate(() => {
    const counts = {};
    for(const st of battle.steps) if(st.actor) counts[st.actor] = (counts[st.actor]||0)+1;
    return { steps: battle.steps.length, i: battle.i,
             team: G.team.map(u => `${u.nm}:${u.spd}:${counts[u.uid]||0}`),
             allActors: Object.keys(counts).length };
  })));
  await snap('mid   ');
  await p.evaluate(() => finishPlayback());
  await p.waitForTimeout(200);
  await snap('after ');
  await b.close();
})();
