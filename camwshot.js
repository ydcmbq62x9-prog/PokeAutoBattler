const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1100, height:1400 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/bl-local.html'); await p.waitForTimeout(900);
  await (await p.$('#s-pc')).screenshot({ path:'cw0.png' }); await (await p.$('#s-land')).screenshot({ path:'cl0.png' });
  await p.click('[data-play="pc"]'); await p.click('[data-play="land"]'); await p.waitForTimeout(800);
  await (await p.$('#s-pc')).screenshot({ path:'cw1.png' });
  await p.waitForTimeout(3600); await (await p.$('#s-pc')).screenshot({ path:'cw2.png' }); await (await p.$('#s-land')).screenshot({ path:'cl2.png' });
  console.log(errs); await b.close();
})();
