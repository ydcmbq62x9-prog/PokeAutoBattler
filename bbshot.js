const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1180, height:1700 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/bl-local.html');
  await p.waitForTimeout(9800); await p.screenshot({ path:'pc1.png', fullPage:true });
  console.log(errs); await b.close();
})();
