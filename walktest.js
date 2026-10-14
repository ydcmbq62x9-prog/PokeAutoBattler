/* 5.0.0: a leader walks out, throws out the team, then the banner — trainers don't. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [tag, vp] of [['phone', { width:390, height:844 }], ['desktop', { width:1250, height:900 }]]){
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.PKB_TITLE = false; });
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(500);
    const setup = kind => p.evaluate(kind => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.pendingRewards = []; setSpeed(1);
      if(kind) G.stage = runPlan().findIndex(s => s.kind === kind);
      G.team = ['charmeleon','wartortle','pikachu'].map((id, i) => { const u = makeUnit(id, 1); u.pos = i; return u; }); fixSlots(G); render(); }, kind);
    await setup('gym');
    check(await p.evaluate(() => /fl-/.test(document.querySelector('.wcam .bstage.shopstage').className) && document.querySelector('.wcam .bstage.shopstage').className.includes(floorOf(nextBout()))),
      `${tag}: the shop's field is already the gym's floor`);
    await p.evaluate(() => startBattle()); await p.waitForTimeout(300);
    const a = await p.evaluate(() => { const w = document.querySelector('.wcam .walkout'); const foes = [...battle.stage.el.querySelectorAll('.ftr.e .fmove')].map(e => +getComputedStyle(e).opacity);
      return { w: !!w, img: !!(w && w.querySelector('img')), name: w && w.textContent.trim(), foesHidden: foes.every(o => o < .1), ban: [...document.querySelectorAll('.introban')].map(e => +getComputedStyle(e).opacity) }; });
    check(a.w && a.img && a.name === (await p.evaluate(() => battle.boss.name)), `${tag}: the leader walks out onto the field (${a.name})`);
    check(a.foesHidden, `${tag}: the leader's pokémon aren't out yet`);
    check(a.ban.every(o => o < .1), `${tag}: the banner waits for the walk-out`);
    check(await p.evaluate(() => [...document.querySelectorAll('.wcam .ftr.e')].every(f => getComputedStyle(f, '::before').opacity === '0')), `${tag}: no shadows waiting on the empty spots`);
    await p.waitForTimeout(1100);
    check(await p.evaluate(() => { const b = document.querySelector('.wcam .walkout .wsay'); return !!b && b.textContent === BOSS_LINES[battle.boss.id]; }), `${tag}: the leader says their line`);
    await p.waitForTimeout(1250);
    check(await p.evaluate(() => document.querySelectorAll('.wcam .wball2').length > 0), `${tag}: pokéballs fly to each spot`);
    await p.waitForTimeout(900);
    const c = await p.evaluate(() => ({ foes: [...battle.stage.el.querySelectorAll('.ftr.e .fmove')].map(e => +getComputedStyle(e).opacity), ban: [...document.querySelectorAll('.introban')].map(e => +getComputedStyle(e).opacity) }));
    check(c.foes.every(o => o > .9) && c.ban.some(o => o > .5), `${tag}: the team is out and the banner plays`);
    await p.waitForFunction(() => battle && battle.i > 0, null, { timeout: 8000 });
    check(!(await p.evaluate(() => document.querySelector('.wcam .walkout'))), `${tag}: the leader has left the field when the fight starts`);
    /* a won gym: the leader walks back out and hands over the badge; fainted pokémon have no name plate */
    await p.evaluate(() => { battle.result = 'win'; battle.outroPlayed = false; finishPlayback(); });
    await p.waitForTimeout(3500);
    const [said, want] = await p.evaluate(() => [(document.querySelector('.wcam .walkout .wsay') || {}).textContent || '', DEFEAT_LINES[battle.boss.id]]);
    check(said === want, `${tag}: beaten, the leader says so first ("${said}")`);
    await p.waitForTimeout(1900);
    const cer = await p.evaluate(() => ({ walk: !!document.querySelector('.wcam .walkout'), say: (document.querySelector('.wcam .walkout .wsay') || {}).textContent || '', badge: !!document.querySelector('.wcam .wbadge'),
      downPlates: [...document.querySelectorAll('.wcam .ftr.down .fhead')].map(e => getComputedStyle(e).display) }));
    check(cer.walk && cer.badge && /Badge/.test(cer.say), `${tag}: after the win the leader hands over the badge ("${cer.say}")`);
    check(cer.downPlates.every(d => d === 'none'), `${tag}: fainted pokémon have no name plate (${cer.downPlates.length})`);
    await p.evaluate(() => { handle('afterbattle'); }); await p.waitForTimeout(400);
    await setup(null);
    await p.evaluate(() => startBattle()); await p.waitForTimeout(300);
    check(!(await p.evaluate(() => document.querySelector('.wcam .walkout'))), `${tag}: a plain trainer just sends out the team`);
    check(!errs.length, `${tag}: no errors ${errs.join('; ')}`);
    await p.close(); }
  await b.close(); console.log(fails ? `${fails} FAILED` : 'walktest passed'); process.exit(fails ? 1 : 0); })();
