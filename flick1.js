const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], });
  const p = await ctx.newPage();
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    G.turn=14; G.credits=60;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0), makeUnit('machoke',0)];
    G.pc=[makeUnit('abra',0), makeUnit('gastly',0)];
    G.team[0].held='band'; G.team[1].held='coat'; G.team[2].held='coin'; G.team[3].held='evio';
    G.bag=['sitrus','lefto'];
    rollShop(G,false); save(); render();
    window.__shifts=[]; new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__shifts.push(e.value)}).observe({type:'layout-shift',buffered:false});
    window.__imgs=0; new MutationObserver(ms=>{for(const m of ms) for(const n of m.addedNodes) if(n.querySelectorAll) window.__imgs += n.querySelectorAll('img').length + (n.tagName==='IMG'?1:0)}).observe(document.body,{childList:true,subtree:true});
  });
  await p.waitForTimeout(300);
  const info = async (lbl) => { const r = await p.evaluate(()=>({sy:scrollY, h:document.documentElement.scrollHeight, shifts:__shifts.splice(0).reduce((a,b)=>a+b,0).toFixed(3), imgs:(()=>{const n=__imgs; __imgs=0; return n})()})); console.log(lbl, JSON.stringify(r)); };
  await info('start');
  await p.tap('.slot[data-act="team"][data-i="0"]'); await p.waitForTimeout(700); await info('tap team0');
  await p.screenshot({path:'fl-sel.png', fullPage:true});
  await p.tap('.slot[data-act="team"][data-i="1"]'); await p.waitForTimeout(700); await info('tap team1');
  await p.evaluate(()=>scrollTo(0,400)); await p.waitForTimeout(200); await info('scrolled');
  await p.tap('.slot[data-act="team"][data-i="1"]'); await p.waitForTimeout(700); await info('tap team1 again');
  await b.close();
})();
