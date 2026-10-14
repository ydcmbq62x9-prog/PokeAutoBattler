const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:390,height:844}});
  await ctx.addInitScript(()=>{window.PKB_WIPE=true;}); const p = await ctx.newPage();
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(300);
  await p.evaluate(()=>{G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove()); G.team=['charizard','blastoise'].map((i,k)=>{const u=makeUnit(i,3);u.pos=k;return u;}); setSpeed(1); save(); render();});
  await p.click('[data-act="endturn"]');
  for(const t of [300,560,860]){ await p.waitForTimeout(t===300?300:t-(t===560?300:560)); await p.screenshot({path:`w40-${t}.png`}); }
  await b.close();
})();
