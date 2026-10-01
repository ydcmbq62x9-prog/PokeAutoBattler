const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for(const theme of ['light', 'dark']){
  const ctx = await b.newContext({ viewport:{width:400,height:860}, deviceScaleFactor:2 });
  await ctx.addInitScript(t => { window.PKB_TIPS = true; localStorage.setItem('pkb_theme', t); localStorage.setItem('pkb_title', 'off'); }, theme);
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type()==='error') errs.push(m.text()); });
  await page.goto('file:///mnt/user-data/outputs/pokebattler.html'); await page.waitForTimeout(400);
  await page.screenshot({ path:`ps-${theme}-1tip.png` });
  // scouting report at Brock
  await page.evaluate(() => { G.stage = TUNING.battlesPerBadge; G.turn = 4; G.team = [makeUnit('squirtle',0), makeUnit('pikachu',0), makeUnit('onix',0)];
    G.team.forEach((u,i)=>u.pos=i);
    G.scouted = G.scouted || {}; G.scouted.brock = [makeUnit('geodude',0), makeUnit('onix',0)].map(u => ({ id:u.id, nm:SPECIES[u.id].name, hp:u.hp, atk:u.atk, spd:u.spd, exp:0, held:null }));
    save(); render(); });
  await page.waitForTimeout(200);
  const sm = await page.$('.smon[data-act]'); if(sm){ await sm.click(); await page.waitForTimeout(250); await page.screenshot({ path:`ps-${theme}-2scout.png` }); await page.click('.modal [data-m="close"]'); }
  else errs.push('no scout chip');
  // battle + tap a fighter
  await page.click('[data-act="endturn"]'); await page.waitForTimeout(2600);
  const f = await page.$('.ftr.e'); if(f){ await f.click({ force:true }); await page.waitForTimeout(300); await page.screenshot({ path:`ps-${theme}-3fighter.png` }); const c = await page.$('.modal [data-m="close"]'); if(c) await c.click(); } else errs.push('no fighter');
  // over screen
  await page.evaluate(() => { clearTimeout(battle && battle.timer); battle = null;
    G.runStats = { battles:14, wins:11, losses:3, mons:{} };
    G.team.forEach((u, k) => G.runStats.mons[u.uid] = { id:u.id, dealt:900 - k*200, taken:300, healed:k*40, kos:9 - k*3, fights:12 });
    G.over = 'lose'; G.badges = 5; phase = 'over'; render(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path:`ps-${theme}-4over.png`, fullPage:true });
  if(theme === 'light'){
    const url = await page.evaluate(async () => { const bl = await runImage(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(bl); }); });
    fs.writeFileSync('ps-runimage.png', Buffer.from(url.split(',')[1], 'base64'));
  }
  await ctx.close();
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
