const { chromium } = require('playwright');
const theme = process.argv[2] || 'dark';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(t => { window.PKB_TITLE = true; try{ localStorage.setItem('pkb_pref_theme', t); }catch(e){} }, theme);
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(1500);
  await p.evaluate(t => { PREF.set('theme', t); applyTheme(); }, theme);
  await p.waitForTimeout(300);
  await p.screenshot({ path:`sc_${theme}_title.png` });
  await p.evaluate(() => { document.querySelectorAll('.modal,.title,.titlescreen').forEach(m => m.remove()); document.body.classList.remove('titled'); newRun({ gens:[1] }); render(); });
  const shots = ['openMenu','openDex','openTrainerCard','openOptions','openNewRun','openChangelog','openHelp','openBadgeInfo'];
  for(const f of shots){
    await p.evaluate(f => { document.querySelectorAll('.modal').forEach(m => m.remove()); try{ window[f](); }catch(e){ console.log(e); } }, f);
    await p.waitForTimeout(500); await p.screenshot({ path:`sc_${theme}_${f}.png` });
  }
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); G.over = true; phase = 'over'; render(); });
  await p.waitForTimeout(500); await p.screenshot({ path:`sc_${theme}_over.png` });
  console.log(errs); await b.close();
})();
