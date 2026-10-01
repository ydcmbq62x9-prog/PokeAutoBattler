const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    G.team = ['wartortle','onix'].map(i=>makeUnit(i,0));
    G.pc   = ['wartortle','charmeleon','machop'].map(i=>makeUnit(i,0));
    rollShop(G,false); save();
  });
  const before = await p.evaluate(() => ({
    team: G.team.map(u=>u.uid+':'+u.nm), pc: G.pc.map(u=>u.uid+':'+u.nm),
    dc: G.daycare.map(s=>s.unit.uid+':'+s.unit.nm) }));
  console.log('BEFORE reload'); console.log(' ', JSON.stringify(before));
  await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(() => { G.credits = 99; rollDaycare(G, true); render(); });
  await p.waitForTimeout(120);
  const after = await p.evaluate(() => {
    const ids = {};
    const add = (w,u) => { (ids[u.uid]=ids[u.uid]||[]).push(w+':'+u.nm); };
    G.team.forEach(u=>add('team',u)); G.pc.forEach(u=>add('pc',u));
    G.daycare.forEach(s=>s&&s.unit&&add('dc',s.unit));
    return { all: ids,
      dupes: Object.entries(ids).filter(([,v])=>v.length>1).map(([k,v])=>k+' = '+v.join(' + ')),
      lookup: G.pc.map(u => u.nm+' (uid '+u.uid+') -> '+(allUnits()[u.uid]||{}).nm) };
  });
  console.log('AFTER reload + reroll');
  console.log('  all uids:', JSON.stringify(after.all));
  console.log('  DUPES   :', after.dupes.length ? after.dupes : 'none');
  console.log('  popups  :', after.lookup);
  await b.close();
})();
