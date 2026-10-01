const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,theme] of [[390,844,'light'],[1250,900,'light'],[390,844,'dark'],[390,600,'light']]){
    const ctx = await b.newContext({ viewport:{width:w,height:h} });
    await ctx.addInitScript(t => { window.PKB_TITLE = true; localStorage.setItem('pkb_theme', t); localStorage.setItem('pkb_name','Sean');
      localStorage.setItem('pkb_records', JSON.stringify({runs:3,cleared:1,best:14})); localStorage.setItem('pkb_partner','charizard'); }, theme);
    const p = await ctx.newPage();
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(1600);
    await p.screenshot({ path:`t38-${w}x${h}-${theme}.png` });
    // make a run in progress and reload to see the menu
    await p.evaluate(() => { G.turn = 9; G.stage = 6; G.badges = 2; save(); });
    await p.reload(); await p.waitForTimeout(1400);
    await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    await p.screenshot({ path:`t38-${w}x${h}-${theme}-menu.png` });
    await ctx.close();
  }
  await b.close();
})();
