/* v370: the polish update — tips, tap-to-inspect everywhere, auto-skip, haptics, run summary, app icon. */
const { chromium } = require('playwright');
const fs = require('fs');
const errors = []; const ok = m => console.log('✓ ' + m); const bad = m => { console.log('✗ ' + m); errors.push(m); };
const check = (c, m) => c ? ok(m) : bad(m);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{ width:400, height:860 } });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///mnt/user-data/outputs/pokebattler.html'); await page.waitForTimeout(300);
  check(!(await page.$('.tipcard')), 'tips stay hidden in test runs unless asked for');
  await page.evaluate(() => { window.PKB_TIPS = true; render(); }); await page.waitForTimeout(100);
  check(/Welcome/.test(await page.$eval('.tipcard', e => e.textContent)), 'the first tip is the welcome card');
  await page.click('[data-act="tipok"]'); await page.waitForTimeout(100);
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('pkb_tipsSeen') || '[]'));
  check(seen.includes('shop'), '“Got it” remembers the tip');
  check(!(await page.$('.tipcard')) || !/Welcome/.test(await page.$eval('.tipcard', e => e.textContent)), 'the welcome card doesn’t come back');
  await page.evaluate(() => { localStorage.setItem('pkb_tips', 'off'); render(); });
  check(!(await page.$('.tipcard')), 'Options → Tips → Hide hides them');
  await page.evaluate(() => { TIPS.reset(); localStorage.setItem('pkb_tips', 'on'); render(); });
  check(/Welcome/.test(await page.$eval('.tipcard', e => e.textContent)), 'Show again brings them back');
  await page.evaluate(() => { window.PKB_TIPS = false; render(); });
  /* scouting report chips open a card */
  await page.evaluate(() => { G.stage = TUNING.battlesPerBadge; G.turn = 4; G.team = [makeUnit('squirtle',0), makeUnit('pikachu',0)]; G.team.forEach((u,i)=>u.pos=i);
    G.scouted = G.scouted || {}; G.scouted.brock = [{ id:'onix', nm:'Onix', hp:60, atk:20, spd:40, exp:0, held:null }]; save(); render(); });
  await page.click('.smon[data-act="scoutcard"]'); await page.waitForTimeout(150);
  check(/Onix/.test(await page.$eval('.modal.unitcard', e => e.textContent)) , 'a scouting-report pokémon opens its summary card');
  await page.click('.modal.unitcard [data-m="close"]');
  /* battle fighters open a card */
  await page.click('[data-act="endturn"]'); await page.waitForTimeout(2600);
  await page.click('.ftr.e .fbody', { force:true }); await page.waitForTimeout(150);
  check(!!(await page.$('.modal.unitcard')), 'tapping an enemy in battle opens its summary card');
  const c = await page.$('.modal.unitcard [data-m="close"]'); if(c) await c.click();
  await page.evaluate(() => finishPlayback()); await page.waitForTimeout(200);
  /* auto-skip trainer battles */
  await page.evaluate(() => { clearTimeout(battle && battle.timer); battle = null; phase = 'shop'; G.stage = 0; G.over = null; G.lives = 5; localStorage.setItem('pkb_autoskip', 'on'); save(); render(); });
  await page.click('[data-act="endturn"]'); await page.waitForTimeout(1800);
  const at = await page.evaluate(() => battle && battle.kind === 'trainer' ? battle.i === battle.steps.length - 1 : null);
  check(at === true, 'Skip to result jumps a trainer battle straight to its result');
  await page.evaluate(() => { clearTimeout(battle && battle.timer); battle = null; phase = 'shop'; localStorage.setItem('pkb_autoskip', 'off'); render(); });
  /* haptics */
  await page.evaluate(() => { localStorage.setItem('pkb_sound', 'off'); SFX.play('levelup'); });
  check((await page.evaluate(() => HAPTIC.log.slice(-1)[0])) === 'levelup', 'haptics fire even with the sound off');
  await page.evaluate(() => { localStorage.setItem('pkb_haptics', 'off'); HAPTIC.log.length = 0; SFX.play('win'); });
  check((await page.evaluate(() => HAPTIC.log.length)) === 0, 'Options → Haptics → Off silences them');
  /* options rows */
  await page.evaluate(() => openOptions()); await page.waitForTimeout(100);
  const opts = await page.$eval('.modal.options', e => e.textContent);
  check(/Haptics/.test(opts) && /Trainer battles/.test(opts) && /Tips/.test(opts), 'Options has Haptics, Trainer battles and Tips');
  await page.click('.modal.options [data-m="close"]');
  /* run summary */
  await page.evaluate(() => { G.runStats = { battles:3, wins:2, losses:1, mons:{} };
    G.team.forEach((u, k) => G.runStats.mons[u.uid] = { id:u.id, dealt:300 - k*100, taken:50, healed:0, kos:3 - k, fights:3 });
    G.over = 'lose'; phase = 'over'; render(); });
  await page.waitForTimeout(150);
  const sum = await page.$eval('.runsum', e => e.textContent);
  check(/RUN MVP/.test(sum) && /Squirtle/.test(sum) && /2W · 1L/.test(sum), 'the run-over screen shows the summary and the MVP');
  check(!!(await page.$('[data-act="runimage"]')), 'there is a Save summary image button');
  const size = await page.evaluate(async () => { const bl = await runImage(); return bl ? bl.size : 0; });
  check(size > 2000, `the summary image is drawn (${size} bytes)`);
  await page.click('.overteam .slot[data-act="overcard"]'); await page.waitForTimeout(120);
  check(!!(await page.$('.modal.unitcard')), 'the final team is tappable');
  /* runs are counted in real battles */
  const counted = await page.evaluate(() => { const g = G; const before = JSON.stringify(g.runStats); noteRunStats({ result:'win', sim:{ stats:[{ side:'p', uid:g.team[0].uid, id:g.team[0].id, dealt:10, taken:0, healed:0, kos:1 }] } }); return g.runStats.wins === 3 && g.runStats.battles === 4; });
  check(counted, 'every battle adds to the run stats');
  await b.close();
  /* the app icon */
  const png = f => { const d = fs.readFileSync('app/icons/' + f); return [d.readUInt32BE(16), d.readUInt32BE(20)]; };
  check(png('icon-512.png').join() === '512,512' && png('icon-192.png').join() === '192,192' && png('apple-touch-icon.png').join() === '180,180' && png('maskable-512.png').join() === '512,512', 'the new app icons are the right sizes');
  console.log(errors.length ? `${errors.length} FAILED\n` + errors.join('\n') : 'v370 passed'); process.exit(errors.length ? 1 : 0);
})();
