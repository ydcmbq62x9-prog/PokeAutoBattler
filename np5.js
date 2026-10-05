const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport:{ width:1180, height:1100 } });
  await p.goto('file://' + process.cwd() + '/bl-local.html'); await p.waitForTimeout(10200);
  console.log(await p.evaluate(() => { const s = document.querySelector('#m5 .u[data-id="gyarados"] .plate .st'); const r = s.getBoundingClientRect(), cs = getComputedStyle(s); return [s.textContent, r.width, r.height, cs.opacity, cs.display, getComputedStyle(s.parentNode).opacity]; }));
  await b.close(); })();
