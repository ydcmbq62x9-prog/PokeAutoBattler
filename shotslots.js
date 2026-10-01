const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,tag] of [[1250,1000,'wide'],[390,844,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(200);
    await p.evaluate(() => { G.pendingRewards=[]; G.turn=10;
      const m=(id,pos)=>{const u=makeUnit(id,0);u.pos=pos;return u;};
      G.team=[m('onix',1), m('abra',4), m('pikachu',5)];
      const pb=(id,box)=>{const u=makeUnit(id,0);u.box=box;return u;};
      G.pc=[pb('pidgey',0), pb('rattata',3), pb('geodude',7)];
      rollShop(G,false); save(); render(); });
    await p.waitForTimeout(200);
    await p.screenshot({ path:`slots-${tag}.png`, fullPage: tag==='phone' });
    await p.close();
  }
  await b.close();
})();
