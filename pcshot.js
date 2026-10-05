const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1180, height:1100 }, deviceScaleFactor:2 });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/bl-local.html');
  await p.waitForTimeout(10200);
  for(const v of ['1','2','3']) await (await p.$('#m' + v)).screenshot({ path:'pc_' + v + '.png' });
  console.log(errs); await b.close();
})();
