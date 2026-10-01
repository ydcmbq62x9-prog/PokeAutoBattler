const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  for(const [w,h] of [[390,844],[1250,900]]){
  const ctx = await b.newContext({viewport:{width:w,height:h}}); await ctx.addInitScript(()=>{window.PKB_WIPE=true;}); const p = await ctx.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  await p.evaluate(()=>{ G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
    G.team=['charizard','blastoise','pidgeot'].map((id,k)=>{const u=makeUnit(id,3); u.pos=k; return u;}); setSpeed(1); save(); render(); });
  await p.evaluate(()=>{window.__cont=setInterval(()=>{const c=document.querySelector('[data-act="afterbattle"]'); if(c){ c.click(); clearInterval(window.__cont);} },300);});
  const log = await p.evaluate(()=>new Promise(r=>{ const out=[]; let last=''; const t0=performance.now();
    document.querySelector('[data-act="endturn"]').click();
    const iv=setInterval(()=>{ const bars=[...document.querySelectorAll('.shopbar')].map(x=>{const rr=x.getBoundingClientRect(); return `${x.className.replace('shopbar','').trim()||'bar'}@${Math.round(rr.top)}h${Math.round(rr.height)}`;}).join(',');
      const q=document.querySelector('#bqueue'); const qh=q?Math.round(q.getBoundingClientRect().height):-1;
      const s = `${phase} i=${battle?battle.i:'-'} bars=[${bars}] q=${qh} ${document.querySelector('.bstage')?'':'NOSTAGE'}`;
      if(s!==last){ out.push(Math.round(performance.now()-t0)+'ms '+s); last=s; }
      if(performance.now()-t0>30000){ clearInterval(iv); r(out); } }, 20); }));
  console.log(w, '\n'+log.slice(0,60).join('\n'));
  await ctx.close(); }
  await b.close();
})();
