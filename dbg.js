const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:430,height:1000},hasTouch:true,isMobile:true})).newPage();
  p.on('pageerror',e=>console.log('PAGEERROR:', e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(`G = newGame(7); G.pc = [makeUnit('pikachu',0)]; rollShop(G,false); sel=null; phase='shop'; render();`);
  await p.waitForTimeout(100);
  console.log('finePointer:', await p.evaluate(()=>finePointer()));
  console.log('wideScreen :', await p.evaluate(()=>wideScreen()));
  await p.click('.wall .cell[data-pop]');
  await p.waitForTimeout(150);
  console.log(await p.evaluate(() => ({
    sel: JSON.stringify(sel),
    held: heldUnit() ? heldUnit().nm : null,
    popupExists: !!document.querySelector('.popup'),
    popupHidden: document.querySelector('.popup') ? document.querySelector('.popup').hidden : 'n/a',
    carryHidden: document.querySelector('.carry') ? document.querySelector('.carry').hidden : 'n/a'
  })));
  await b.close();
})();
