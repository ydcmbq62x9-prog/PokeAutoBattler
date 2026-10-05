const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:400, height:860 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/bl-local.html');
  await p.waitForTimeout(5200); await p.screenshot({ path:'bl1.png' });
  await p.waitForTimeout(4300); await (await p.$('#mC')).screenshot({ path:'bl2.png' });
  console.log(errs);
  await b.close();
})();
