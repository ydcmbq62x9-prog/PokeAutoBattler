const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:430,height:900} });
  ctx.setDefaultTimeout(4000);
  const p = await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERROR:', e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(250);
  const steps = [
    ['select daycare 0', async()=>p.click('[data-act="dc"][data-i="0"]')],
    ['place in party',   async()=>p.click('[data-act="team"][data-i="0"]')],
    ['cancel',           async()=>p.click('[data-act="cancel"]').catch(()=>{})],
    ['endturn',          async()=>p.click('[data-act="endturn"]')],
    ['skip',             async()=>p.click('[data-act="skip"]').catch(()=>{})],
    ['afterbattle',      async()=>p.click('[data-act="afterbattle"]')],
  ];
  for(const [label, fn] of steps){
    try{ await fn(); console.log('ok  ', label); }
    catch(e){ console.log('FAIL', label, '->', e.message.split('\n')[0]); break; }
    await p.waitForTimeout(120);
  }
  await b.close();
})();
