const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:724, height:320 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  console.log(await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); G.team=[makeUnit('ledyba',1)]; G.team[0].pos=0; inspect = { kind:'unit', u:G.team[0] }; sel={kind:'team',idx:0}; render();
    const i = document.getElementById('inspect'); const walk = (e, d) => d > 3 ? '' : [...e.children].map(c => '  '.repeat(d) + c.tagName.toLowerCase() + '.' + [...c.classList].join('.') + ' ' + getComputedStyle(c).display + (getComputedStyle(c).gridTemplateColumns !== 'none' ? ' cols=' + getComputedStyle(c).gridTemplateColumns : '') + '\n' + walk(c, d + 1)).join('');
    return walk(i, 0); }));
  await b.close();
})();
