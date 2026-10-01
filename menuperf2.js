const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1250,height:950} });
  await page.goto(URL); await page.waitForTimeout(800);
  await page.evaluate(() => { G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
    G.team=['charmeleon','squirtle','pikachu','pidgey'].map((id,k)=>{const u=makeUnit(id,0);u.pos=k;return u;}); G.turn=6; rollShop(G,false); render(); });
  await page.waitForTimeout(500);
  const out = await page.evaluate(() => {
    const r = {};
    let t = performance.now(); document.body.offsetHeight; r.baselineLayout = performance.now()-t;
    t = performance.now(); const d = modal('<div>x</div>'); r.modalAppend = performance.now()-t;
    t = performance.now(); document.body.offsetHeight; r.layoutAfterAppend = performance.now()-t; d.remove(); document.body.offsetHeight;
    t = performance.now(); document.body.classList.toggle('zz'); document.body.offsetHeight; r.bodyClassToggle = performance.now()-t;
    t = performance.now(); openMenu(); r.openMenu = performance.now()-t; document.querySelectorAll('.modal').forEach(x=>x.remove()); document.body.offsetHeight;
    r.domNodes = document.getElementsByTagName('*').length;
    r.htmlLen = document.documentElement.outerHTML.length;
    return r;
  });
  console.log(out);
  // CDP trace of click
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode:'ReturnAsStream' });
  await page.click('[data-act="menu"]'); await page.waitForTimeout(400);
  const done = new Promise(res => cdp.once('Tracing.tracingComplete', res));
  await cdp.send('Tracing.end'); const { stream } = await done;
  let data=''; while(true){ const c = await cdp.send('IO.read',{handle:stream}); data+=c.data; if(c.eof) break; }
  const ev = JSON.parse(data).traceEvents.filter(e => e.dur && ['UpdateLayoutTree','Layout','Paint','EventDispatch','FunctionCall','RasterTask','CompositeLayers','PrePaint','Commit','ParseHTML','Decode Image','ImageDecodeTask'].includes(e.name));
  const agg = {}; ev.forEach(e => { agg[e.name] = agg[e.name] || {n:0,ms:0,max:0}; agg[e.name].n++; agg[e.name].ms += e.dur/1000; agg[e.name].max=Math.max(agg[e.name].max,e.dur/1000); });
  for (const k in agg) console.log(k, agg[k].n, agg[k].ms.toFixed(1)+'ms', 'max', agg[k].max.toFixed(1));
  await browser.close();
})();
