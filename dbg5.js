const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(250);
  // build a state, save it, then reload — exactly what a returning player does
  await p.evaluate(() => {
    G.team = ['wartortle','onix'].map(i=>makeUnit(i,0));
    G.pc   = ['wartortle','charmeleon','machop'].map(i=>makeUnit(i,0));
    rollShop(G,false); save();
  });
  await p.reload(); await p.waitForTimeout(300);
  // ...and then the run continues: a reroll mints new units
  await p.evaluate(() => { G.credits = 99; rollDaycare(G, true); render(); });
  await p.waitForTimeout(150);
  const state = await p.evaluate(() => {
    const ids = {};
    const add = (where,u) => { (ids[u.uid] = ids[u.uid] || []).push(where+':'+u.nm); };
    G.team.forEach(u=>add('team',u)); G.pc.forEach(u=>add('pc',u));
    G.daycare.forEach(s=>s&&s.unit&&add('dc',s.unit));
    const dupes = Object.entries(ids).filter(([,v])=>v.length>1);
    // what does the popup lookup actually resolve for each PC entry?
    const lookup = G.pc.map((u,i)=>{
      const found = allUnits()[u.uid];
      return u.nm + ' (uid ' + u.uid + ') -> popup shows ' + (found ? found.nm : 'nothing');
    });
    return { dupes, lookup };
  });
  console.log('duplicate uids after reload:');
  state.dupes.forEach(([uid,who]) => console.log('   uid', uid, '=', who.join('  +  ')));
  console.log('\npopup resolution for PC entries:');
  state.lookup.forEach(l => console.log('  ', l));
  await b.close();
})();
