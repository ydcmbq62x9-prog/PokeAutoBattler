/* 5.3.0: the gym reward is held out on the field; a winning boss gloats; the Champion's team photo. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [tag, vp] of [['phone', { width:390, height:844 }], ['desktop', { width:1250, height:900 }]]){
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(500);
    const setup = (kind, strong) => p.evaluate(([kind, strong]) => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.pendingRewards = []; setSpeed(4); sessionBattles = 9;
      if(kind === 'champion') G.badges = 8;
      G.stage = runPlan().findIndex(s => s.kind === kind);
      const ids = strong ? ['mewtwo','mew','dragonite','snorlax','gyarados','alakazam'] : ['magikarp'];
      G.team = ids.map((id, i) => { const u = makeUnit(id, strong ? 3 : 0); u.pos = i; return u; }); fixSlots(G); render(); }, [kind, strong]);
    const fight = async force => { await p.evaluate(() => document.querySelector('[data-act=endturn]').click()); await p.waitForFunction(() => !wiping && battle && battle.stage, null, { timeout: 6000 });
      await p.waitForTimeout(400); await p.evaluate(f => { if(f) battle.result = f; finishPlayback(); }, force); };
    /* a gym win: the reward on the field */
    await setup('gym', true); await fight('win');
    await p.waitForTimeout(3500);
    check(await p.evaluate(() => document.querySelector('[data-act=afterbattle]').textContent.includes('Choose your reward')), `${tag}: a gym win offers Choose your reward`);
    await p.evaluate(() => document.querySelector('[data-act=afterbattle]').click()); await p.waitForTimeout(900);
    const c = await p.evaluate(() => ({ cards: document.querySelectorAll('.wcam .fieldcards .fcard').length, modal: !!document.querySelector('.modal.reward'), phase, shop: !!document.querySelector('#app .pfield'), badges: G.badges }));
    check(c.cards === 3 && !c.modal && !c.shop, `${tag}: the three reward cards are held out on the field, no pop-up (${c.cards})`);
    check(c.badges === 1, `${tag}: the badge is already banked while you choose`);
    const pick = await p.evaluate(() => document.querySelector('.wcam .fieldcards .fcard').dataset.r);
    await p.evaluate(() => document.querySelector('.wcam .fieldcards .fcard').click());
    await p.waitForFunction(() => phase === 'shop' && !fieldPicking && !wiping && !!document.querySelector('#app .pfield'), null, { timeout: 8000 });
    const after = await p.evaluate(() => ({ log: (G.rewardLog || []).map(e => e.id), pend: (G.pendingRewards || []).length, cards: !!document.querySelector('.fieldcards'), cls: document.body.classList.contains('fieldpick') }));
    check(after.log[0] === pick && !after.pend && !after.cards && !after.cls, `${tag}: picking one keeps it and the camera goes back to the shop (${after.log})`);
    /* a loss to a leader: the gloat */
    await setup('gym', false); await fight('lose');
    await p.waitForTimeout(2600);
    const g = await p.evaluate(() => ({ say: (document.querySelector('.wcam .walkout .wsay') || {}).textContent || '', want: GLOAT_LINES[battle.boss.id] }));
    check(g.say === g.want, `${tag}: a leader who beats you walks out and gloats ("${g.say}")`);
    await p.evaluate(() => { handle('afterbattle'); }); await p.waitForFunction(() => !wiping, null, { timeout: 8000 });
    /* the Champion: the team photo */
    await setup('champion', true); await fight('win');
    await p.waitForTimeout(6500);
    const ph = await p.evaluate(() => ({ taken: battle.photoTaken, frame: !!document.querySelector('.wcam .photoframe'), mons: document.querySelectorAll('.wcam .phmon').length, team: G.team.length }));
    check(ph.taken && ph.frame && ph.mons === ph.team, `${tag}: after the Champion the whole team gathers for a photo (${ph.mons}/${ph.team})`);
    check(!errs.length, `${tag}: no errors ${errs.join('; ')}`);
    await p.close(); }
  /* the won run's summary image is the photo */
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(500);
  const ok = await p.evaluate(async () => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.badges = 8;
    G.team = ['mewtwo','snorlax'].map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); G.over = 'won'; phase = 'over'; render();
    await new Promise(r => setTimeout(r, 1200)); const im = document.querySelector('.runphoto'); return !!(im && im.complete && im.naturalWidth === 720); });
  check(ok, 'a won run shows the team photo on its last screen, and it is the summary image');
  await b.close(); console.log(fails ? `${fails} FAILED` : 'fieldtest passed'); process.exit(fails ? 1 : 0); })();
