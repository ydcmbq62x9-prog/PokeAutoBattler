const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1,2] }); G.turn = 20;
    const ids = ['snorlax','lapras','charizard','mew','pikachu','farfetchd']; G.team = ids.map((id, i) => { const u = makeUnit(id, 0); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const s = [...document.querySelectorAll('button')].find(b => /Skip/.test(b.textContent)); s && s.click(); });
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => [...document.querySelectorAll('.ftr.p')].map(f => f.querySelector('.fname').textContent + ' ' + f.className + ' img=' + (Object.entries(SPRITES).find(([k, v]) => v === f.querySelector('.fart img').src) || ['?'])[0] + ' anims=' + f.getAnimations({subtree:true}).length + ' tf=' + getComputedStyle(f.querySelector('.fmove')).transform)));
  await (await p.$('.bstage')).screenshot({ path:'down1.png' }); console.log(await p.evaluate(() => { const f = document.querySelector('.ftr.p.r0.f0'); return [...f.querySelectorAll('*')].map(e => e.tagName + '.' + e.className + ' ' + getComputedStyle(e).opacity + ' ' + getComputedStyle(e).backgroundImage.slice(0,40)).join('\n'); })); await b.close();
})();
