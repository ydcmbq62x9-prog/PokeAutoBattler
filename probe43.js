const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:390,height:844}});
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  await p.evaluate(()=>{ G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
    G.team=['charmander','squirtle'].map((id,k)=>{const u=makeUnit(id,0); u.pos=k; return u;}); G.team[0].copies=2; save(); render(); });
  await p.waitForTimeout(1500);
  await p.screenshot({path:'probe43.png'});
  const r2 = await p.evaluate(()=>{ const e=[...document.querySelectorAll('.pfield .exp')]; 
    return { n:e.length, pips: expPipsToNext(G.team[0]), html: document.querySelector('.pfield .unit').outerHTML.slice(0,900),
      pip: (()=>{const i=document.querySelector(".pfield .exp i"); const c=getComputedStyle(i); return [c.width,c.height,c.display,c.flex,c.minWidth,c.position,c.background.slice(0,40)];})(), box: e.map(x=>{const r=x.getBoundingClientRect(); const c=getComputedStyle(x); return [r.width,r.height,c.display,c.visibility];}) }; });
  console.log(JSON.stringify(r2,null,1)); await b.close();
})();
