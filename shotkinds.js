const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const plan = [['route',1,390],['gymphone',3,390]];
  for(const [name, stage, w] of plan){
    const p = await b.newPage({ viewport:{width:w,height:900} });
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(200);
    await p.evaluate((stage) => { G.pendingRewards=[]; const m=(id,pos,e)=>{const u=makeUnit(id,e||0);u.pos=pos;return u;};
      G.team=[m('charizard',0,40), m('blastoise',1,40), m('pidgeot',4,40), m('clefable',2,40), m('pikachu',5,40), m('venusaur',3,40)];
      const plan=runPlan(); G.stage = stage < 0 ? plan.length-5 : plan.findIndex(s=>s.kind==='gym')+ (stage-1)*0;
      G.badges = stage<0 ? 8 : 0; save(); render(); document.querySelectorAll('.modal').forEach(m=>m.remove()); }, stage);
    await p.evaluate(() => document.querySelector('[data-act="endturn"]').click());
    await p.waitForTimeout(900); await p.screenshot({path:`k-${name}-intro.png`});
    for(let k=0;k<6;k++){ await p.waitForTimeout(k?230:1400); await p.screenshot({path:`k-${name}-${k}.png`}); }
    console.log(name, errs);
    await p.close();
  }
  await b.close();
})();
