const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const dev of [devices['iPhone 13'], {viewport:{width:1250,height:900}}]){
  const p = await (await b.newContext(dev)).newPage();
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    G.turn=14; G.credits=60;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0), makeUnit('machoke',0)];
    G.pc=[makeUnit('abra',0), makeUnit('gastly',0)];
    G.team[0].held='band'; G.team[1].held='coat'; G.pc[0].held='claw';
    G.bag=['sitrus','lefto']; rollShop(G,false); save(); render();
    sel={kind:'team',idx:0}; inspect={kind:'unit',u:G.team[0]}; render();
  });
  await p.waitForTimeout(200);
  const r = await p.evaluate(()=>[...document.querySelectorAll('.held, .sheld')].map(h=>{const i=h.querySelector('img'); const a=h.getBoundingClientRect(), c=i&&i.getBoundingClientRect(); return h.className+' '+Math.round(a.width)+' img '+(c?Math.round(c.width):'-')+(c&&c.width>a.width?' OVER':'')}));
  console.log(r.join('\n'));
  }
  await b.close();
})();
