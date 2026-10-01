const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(400);
  await p.evaluate(() => { G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0)]; G.team[0].held='band'; rollShop(G,false); render(); });
  const r = await p.evaluate(async () => { const t = [];
    for(const mode of ['patch','replace']) { let s=0; for(let k=0;k<20;k++){ sel = k%2 ? {kind:'team',idx:0} : null; inspect = k%2 ? {kind:'unit',u:G.team[0]} : null; if(mode==='replace') drawnPhase=null; const a=performance.now(); render(); document.body.offsetHeight; s+=performance.now()-a; await new Promise(r=>requestAnimationFrame(r)); } t.push(mode+' '+(s/20).toFixed(1)+'ms'); }
    return t; });
  console.log(r.join(' | ')); await b.close(); })();
