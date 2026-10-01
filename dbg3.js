const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:900,height:900} });
  ctx.setDefaultTimeout(4000);
  const p = await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERROR:', e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(`G = newGame(3); G.team=[makeUnit('charmander',0)]; G.pc=[makeUnit('charmander',0)];
                    rollShop(G,false); sel=null; phase='shop'; render();`);
  await p.waitForTimeout(120);
  console.log('cell exists:', !!(await p.$('[data-act="pc"][data-i="0"]')));
  console.log('cell tag/cls:', await p.evaluate(()=>{const e=document.querySelector('[data-act="pc"][data-i="0"]');return e?e.tagName+'.'+e.className:'none';}));
  try { await p.click('[data-act="pc"][data-i="0"]'); console.log('click ok'); }
  catch(e){ console.log('click FAILED:', e.message.split('\n').slice(0,4).join(' | ')); }
  await p.waitForTimeout(150);
  console.log(await p.evaluate(()=>({sel:JSON.stringify(sel), carrying:document.body.classList.contains('carrying'),
    lifted:!!document.querySelector('.wall .cell.lifted')})));
  await b.close();
})();
