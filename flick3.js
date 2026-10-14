const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], });
  const p = await ctx.newPage();
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    G.turn=14; G.credits=60;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0), makeUnit('machoke',0)];
    G.pc=[makeUnit('abra',0), makeUnit('gastly',0)];
    G.team[0].held='band';
    G.bag=['sitrus','lefto']; PREF.set('text','instant');
    rollShop(G,false); save(); render();
  });
  const pos = async l => console.log(l, await p.evaluate(()=>({sy:scrollY, pc:Math.round(document.querySelector('.cell[data-act="pc"]').getBoundingClientRect().top), insp:Math.round(document.querySelector('#inspect').getBoundingClientRect().top), dc: Math.round(document.querySelector('.drow').getBoundingClientRect().top)})));
  await p.evaluate(()=>document.querySelector('.cell[data-act="pc"]').scrollIntoView({block:'center'}));
  await p.waitForTimeout(200); await pos('before'); await p.screenshot({path:'fl-a.png'});
  await p.tap('.cell[data-act="pc"][data-i="0"]'); await p.waitForTimeout(700); await pos('after pc tap'); await p.screenshot({path:'fl-b.png'});
  await p.evaluate(()=>document.querySelector('.drow').scrollIntoView({block:'center'})); await p.waitForTimeout(200); await pos('dc view');
  await p.tap('.drow'); await p.waitForTimeout(700); await pos('after dc tap'); await p.screenshot({path:'fl-c.png'});
  await b.close();
})();
