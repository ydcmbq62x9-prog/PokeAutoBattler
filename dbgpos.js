const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1200,height:1000} });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    G.turn=12; G.credits=60; G.team=[makeUnit('squirtle',0)]; G.pc=[makeUnit('abra',0)];
    G.team[0].held='band'; G.pc[0].held='claw'; save(); render();
  });
  await p.waitForTimeout(150);
  for(const sel of ['[data-act="pc"][data-i="0"]','[data-act="pc"][data-i="0"] .held','[data-act="team"][data-i="0"] .artwrap','[data-act="team"][data-i="0"] .held']){
    const r = await p.$eval(sel, e => { const b=e.getBoundingClientRect(); const s=getComputedStyle(e);
      return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),pos:s.position,top:s.top,bottom:s.bottom,right:s.right}; }).catch(e=>'MISSING');
    console.log(sel, JSON.stringify(r));
  }
  await b.close();
})();
