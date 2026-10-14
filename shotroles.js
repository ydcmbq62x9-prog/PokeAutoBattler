const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,tag] of [[1250,1000,'wide'],[390,844,'phone']]){
  const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
  const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    G.pendingRewards=[]; G.turn=14; G.credits=60;
    G.team=[makeUnit('raichu',2), makeUnit('chansey',0), makeUnit('onix',0), makeUnit('machoke',0), makeUnit('rhyhorn',0), makeUnit('clefairy',0)];
    G.team[0].held='band';
    rollShop(G,false); save(); render();
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path:`roles-${tag}.png` });
  await p.click('[data-act="arrange"]'); await p.waitForTimeout(200);
  await p.screenshot({ path:`roles-${tag}-arranged.png` });
  if(tag==='wide'){ await p.hover('[data-pop="team:0"]'); await p.waitForTimeout(250); await p.screenshot({ path:'roles-pop.png' }); }
  console.log(tag, errs.length ? errs : 'no errors', await p.evaluate(() => G.team.map(u=>u.id).join(',')));
  await p.close(); }
  await b.close();
})();
