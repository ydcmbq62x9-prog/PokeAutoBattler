const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:900,height:800}});
  await ctx.addInitScript(()=>localStorage.setItem('pkb_theme','dark')); const p = await ctx.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  await p.evaluate(()=>{ G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
    G.team=['charmeleon','machop','squirtle','pikachu','jigglypuff','ivysaur'].map((id,k)=>{const u=makeUnit(id,3); u.pos=k; return u;}); G.turn=8; G.stage=5; G.badges=1; rollShop(G,false); save(); render(); });
  await p.waitForTimeout(900);
  await p.evaluate(()=>document.querySelector('.shelves').scrollIntoView());
  await p.screenshot({path:'s43b-shelves.png'});
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.click('[data-act="endturn"]'); await p.waitForTimeout(3000);
  await p.screenshot({path:'s43b-battle.png'});
  await p.click('[data-act="skip"]'); await p.waitForTimeout(1500);
  await p.screenshot({path:'s43b-end.png'});
  await b.close();
})();
