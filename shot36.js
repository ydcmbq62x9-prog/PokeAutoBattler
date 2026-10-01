const { chromium } = require('playwright');
const tag = process.argv[2] || 'pre';
(async () => {
  const b = await chromium.launch();
  for(const [w,h,sz] of [[1250,1000,'wide'],[390,844,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
    const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(200);
    await p.evaluate(() => { G.pendingRewards=[]; G.turn=6; G.credits=12;
      const m=(id,pos)=>{const u=makeUnit(id,0);u.pos=pos;return u;};
      G.team=[m('onix',0), m('machop',1), m('abra',4), m('pikachu',5), m('charmander',2), m('clefairy',3)];
      rollShop(G,false); save(); render(); document.querySelectorAll('.modal').forEach(m=>m.remove()); });
    await p.waitForTimeout(200);
    await p.screenshot({ path:`s36-${tag}-shop-${sz}.png`, fullPage: true });
    await p.click('[data-act="endturn"]',{timeout:3000}).catch(e=>errs.push('nobattle '+e.message));
    await p.waitForTimeout(700);  await p.screenshot({ path:`s36-${tag}-intro-${sz}.png` });
    for(let k=0;k<4;k++){ await p.waitForTimeout(k?520:1500); await p.screenshot({ path:`s36-${tag}-b${k}-${sz}.png` }); }
    await p.click('[data-act="skip"]').catch(()=>{}); await p.waitForTimeout(900);
    await p.screenshot({ path:`s36-${tag}-end-${sz}.png`, fullPage: true });
    console.log(sz, errs);
    await p.close();
  }
  await b.close();
})();
