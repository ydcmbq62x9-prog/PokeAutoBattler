const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:430,height:900}, deviceScaleFactor:2 });
  ctx.setDefaultTimeout(4000);
  const p = await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERROR:', e.message));
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    G.team = [makeUnit('charmander',0)]; G.pc = []; G.credits = 99;
    G.daycare[0] = { unit: makeUnit('charmander',0), bought:false };
    sel = null; render();
  });
  await p.click('[data-act="dc"][data-i="0"]'); await p.waitForTimeout(60);
  await p.click('[data-act="pc"][data-i="0"]'); await p.waitForTimeout(60);
  console.log('after buy  :', await p.evaluate(()=>({pc:G.pc.length, sel:JSON.stringify(sel)})));
  console.log('cell now   :', await p.evaluate(()=>{const e=document.querySelector('[data-act="pc"][data-i="0"]');return e?e.tagName+'|'+e.className:'none';}));
  try { await p.click('[data-act="pc"][data-i="0"]'); console.log('2nd click ok'); }
  catch(e){ console.log('2nd click FAILED:', e.message.split('\n').slice(0,6).join(' | ')); }
  await p.waitForTimeout(100);
  console.log('after pick :', await p.evaluate(()=>({sel:JSON.stringify(sel),
    carrying:document.body.classList.contains('carrying'),
    carryHidden: document.querySelector('.carry') ? document.querySelector('.carry').hidden : 'none'})));
  await b.close();
})();
