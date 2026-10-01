const { chromium } = require('playwright');
(async()=>{ const b = await chromium.launch();
  for(const [w,h] of [[390,844],[1250,900]]){
  const p = await b.newPage({viewport:{width:w,height:h}});
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  await p.evaluate(()=>{ G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
    G.team=['jigglypuff','rattata','charizard','onix','gyarados','pidgeot'].map((id,k)=>{const u=makeUnit(id,0); u.pos=k; return u;}); G.pc=[makeUnit('snorlax',0),makeUnit('dragonite',0)]; G.pc.forEach((u,k)=>u.pos=k); G.team[0].held='lefto'; G.bag=['claw']; save(); render(); });
  await p.waitForTimeout(900);
  const audit = () => p.evaluate(()=>{ const out=[];
    for(const img of document.querySelectorAll('img')){ const r=img.getBoundingClientRect(); if(!r.width) continue;
      // nearest framed ancestor
      let a=img.parentElement; while(a && a!==document.body){ const c=getComputedStyle(a); if(parseFloat(c.borderTopWidth)>0 || c.overflow!=='visible' || c.boxShadow!=='none') break; a=a.parentElement; }
      if(!a||a===document.body) continue; const q=a.getBoundingClientRect(); const c=getComputedStyle(a);
      const bl=parseFloat(c.borderLeftWidth)||0, bt=parseFloat(c.borderTopWidth)||0;
      const over = Math.max(q.left+bl - r.left, r.right-(q.right-bl), q.top+bt - r.top, r.bottom-(q.bottom-bt));
      // also the rendered sprite within object-fit contain — fine; report overflow > 1px
      if(over > 1) out.push(`${a.className.toString().slice(0,40)} ← img ${Math.round(r.width)}x${Math.round(r.height)} in ${Math.round(q.width)}x${Math.round(q.height)} over ${Math.round(over)}px ${c.overflow}`); }
    return [...new Set(out)]; });
  console.log(w,'shop', await audit());
  await p.click('[data-act="endturn"]'); await p.waitForTimeout(2500);
  console.log(w,'battle', await audit());
  await p.click('[data-act="skip"]'); await p.waitForTimeout(800);
  console.log(w,'end', await audit());
  await p.close(); }
  await b.close(); })();
