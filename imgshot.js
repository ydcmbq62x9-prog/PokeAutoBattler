const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  const data = await p.evaluate(async () => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.badges = 8;
    G.team = ['mewtwo','mew','dragonite','snorlax','gyarados','alakazam'].map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); G.over = 'won'; phase = 'over'; render();
    const blob = await runImage(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); });
  require('fs').writeFileSync('runimg.png', Buffer.from(data.split(',')[1], 'base64'));
  await p.waitForTimeout(800); await p.screenshot({ path:'overwon.png', fullPage:true });
  console.log(errs); await b.close();
})();
