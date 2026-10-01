const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const errs=[];
  for (const [w,h,tag] of [[390,844,'phone'],[1250,900,'wide']]) for(const theme of ['light','dark']){
    const ctx = await b.newContext({viewport:{width:w,height:h}});
    await ctx.addInitScript(t=>{ localStorage.setItem('pkb_theme',t); }, theme);
    const p = await ctx.newPage(); const T = `${tag}-${theme}`;
    p.on('pageerror',e=>errs.push(T+' '+e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
    await p.evaluate(()=>{ G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
      G.team=['wartortle','geodude','pidgeotto','clefairy','charmeleon','pikachu'].map(i=>makeUnit(i,0));
      G.team.forEach((u,k)=>u.pos=[2,5,1,4,0,3][k]); G.team[0].held='lefto'; G.bag=['claw','band'];
      G.pc=[makeUnit('abra',0),makeUnit('magikarp',0)]; G.pc.forEach((u,k)=>u.pos=k);
      G.badges=3; G.stage=13; G.turn=14; G.credits=18; G.lives=4; G.streak=5; rollShop(G,false); save(); render(); });
    await p.waitForTimeout(900);
    await p.screenshot({path:`io/${T}-shop.png`, fullPage:true});
    await p.click('.pfield .slot[data-i="0"]').catch(()=>{}); await p.waitForTimeout(700);
    await p.screenshot({path:`io/${T}-shopsel.png`});
    await p.keyboard.press('Escape');
    // summary popup
    await p.dblclick('.pfield .slot[data-i="4"]').catch(()=>{}); await p.hover('.pfield .slot[data-i="4"]').catch(()=>{}); await p.waitForTimeout(400);
    await p.screenshot({path:`io/${T}-popup.png`});
    await p.keyboard.press('Escape'); await p.mouse.click(5,5);
    for(const m of ['trainer','options','dex','news']){
      await p.click('[data-act="menu"]'); await p.waitForTimeout(300);
      if(m==='trainer') await p.screenshot({path:`io/${T}-menu.png`});
      await p.click(`[data-m="${m}"]`); await p.waitForTimeout(350);
      await p.screenshot({path:`io/${T}-${m}.png`});
      await p.evaluate(()=>document.querySelectorAll('.modal').forEach(x=>x.remove()));
    }
    // battle
    await p.evaluate(()=>{G.stage=12; save(); render(); setSpeed(1);});
    await p.click('[data-act="endturn"]'); await p.waitForTimeout(2600);
    await p.screenshot({path:`io/${T}-battle1.png`});
    await p.waitForTimeout(1500); await p.screenshot({path:`io/${T}-battle2.png`});
    await p.click('[data-act="skip"]'); await p.waitForTimeout(1500);
    await p.screenshot({path:`io/${T}-result.png`, fullPage:true});
    // reward picker
    await p.evaluate(()=>{ battle=null; phase='shop'; G.pendingRewards=[3]; save(); render(); openRewardPicker(); }); await p.waitForTimeout(400);
    await p.screenshot({path:`io/${T}-reward.png`});
    await p.evaluate(()=>{ document.querySelectorAll('.modal').forEach(x=>x.remove()); G.pendingRewards=[]; G.over='lost'; G.lives=0; phase='over'; render(); }); await p.waitForTimeout(300);
    await p.screenshot({path:`io/${T}-over.png`, fullPage:true});
    await ctx.close();
  }
  console.log(errs); await b.close();
})();
