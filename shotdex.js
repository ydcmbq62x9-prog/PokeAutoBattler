const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
 const p = await b.newPage({ viewport:{ width:1000, height:760 } });
 await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
 await p.evaluate(() => { localStorage.clear(); PREF.set('dexseen', JSON.stringify(Object.keys(SPECIES))); openDex(); });
 await p.waitForTimeout(500);
 await p.evaluate(() => document.querySelector('.dexgrid').scrollIntoView());
 await p.screenshot({ path:'../dex-no.png' });
 await b.close();
})();
