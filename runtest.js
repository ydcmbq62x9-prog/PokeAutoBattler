/* The new win condition, in the browser. */
const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
const errors = [];
const mark = m => console.log('… ' + m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1200,height:1100}, deviceScaleFactor:2 });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  await page.goto(URL);
  await page.waitForTimeout(250);

  // the badge case is in the top bar, empty at the start
  const pips = await page.$$eval('.stat.badges .bdg', els => els.length);
  if(pips !== 8) errors.push(`badge case shows ${pips} slots, not 8`);
  const lit = await page.$$eval('.stat.badges .bdg.on', els => els.length);
  if(lit !== 0) errors.push('badges are lit before any are won');

  // a trainer battle announces itself as one, and counts down to the gym
  let next = await page.$eval('.nextup', e => e.textContent.replace(/\s+/g,' ').trim());
  if(!/Trainer battle/.test(next)) errors.push('first stage is not announced as a trainer battle');
  if(!/to the gym/.test(next)) errors.push('no countdown to the gym');
  mark('trainer stage: ' + next.slice(0, 60));

  // walk to the first gym
  await page.evaluate(() => {
    G.stage = TUNING.battlesPerBadge; G.turn = 4; G.credits = 40;
    G.team = [makeUnit('squirtle',0), makeUnit('onix',0), makeUnit('pikachu',0)];
    save(); render();
  });
  await page.waitForTimeout(150);
  const gym = await page.$eval('.nextup.boss', e => e.textContent.replace(/\s+/g,' ').trim());
  if(!/Brock/.test(gym)) errors.push('the first gym is not Brock: ' + gym);
  if(!/Rock/.test(gym)) errors.push('the gym does not say its type');
  if(!/Boulder/.test(gym)) errors.push('the gym does not name its badge');
  const cta = await page.$eval('[data-act="endturn"]', e => e.textContent.trim());
  if(!/Challenge Brock/.test(cta)) errors.push('the button does not name the leader: ' + cta);
  mark('gym stage: ' + gym.slice(0, 70));

  // lose it on purpose: blackout, scouting report, same gym again
  await page.evaluate(() => {
    G.credits = 40;
    const opp = opponentFor(G);
    applyBattleResult(G, 'lose', opp);
    save(); render();
  });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    credits: G.credits, stage: G.stage, badges: G.badges,
    attempt: G.attempt, scouted: Object.keys(G.scouted).length, lives: G.lives,
  }));
  if(after.credits !== 20) errors.push(`blackout left ${after.credits}₽, expected 20`);
  if(after.stage !== 3) errors.push('losing a gym advanced the run');
  if(after.lives !== 5) errors.push('the first attempt cost a life');
  if(!after.scouted) errors.push('no scouting report after a defeat');
  const scout = await page.$('.scout');
  if(!scout) errors.push('the scouting report is not shown');
  const scoutMons = await page.$$eval('.scout .smon', els => els.length);
  if(!scoutMons) errors.push('the scouting report is empty');
  const warn = await page.$eval('.nwarn', e => e.textContent.trim()).catch(()=>null);
  if(!warn || !/Attempt 2/.test(warn)) errors.push('no attempt warning: ' + warn);
  mark(`blackout: ${after.credits}₽ left, ${scoutMons} pokémon scouted, "${warn}"`);

  // win it: badge lights up, run moves on
  await page.evaluate(() => { applyBattleResult(G, 'win'); save(); render(); });
  await page.waitForTimeout(150);
  const litNow = await page.$$eval('.stat.badges .bdg.on', els => els.length);
  if(litNow !== 1) errors.push(`won a gym but ${litNow} badges are lit`);
  const stageNow = await page.evaluate(() => G.stage);
  if(stageNow !== 4) errors.push('winning a gym did not move the run on');
  mark('badge won and lit');

  /* The badge has to appear at the MOMENT you win it. It used to light only
     after Continue, so the screen shouted "BOULDER BADGE!" over an empty case
     and the badge never appeared when you actually earned it. */
  await page.evaluate(() => {
    localStorage.setItem('pkb_speed','4');
    G.seed = 2024;     // every real fight in this file is seeded — see below
    G.stage = 3 * (TUNING.battlesPerBadge + 1) + TUNING.battlesPerBadge;
    G.badges = 3; G.turn = 16; G.credits = 40; G.lives = 5;
    G.pendingRewards = [];   // skip the earlier badges' rewards; this block tests the 4th
    G.team = [makeUnit('onix',0), makeUnit('machoke',0), makeUnit('gyarados',0),
              makeUnit('alakazam',0), makeUnit('charizard',0), makeUnit('snorlax',0)];
    for(const u of G.team){ u.hp += 300; u.atk += 90; u.spd += 80; }
    save(); render();
  });
  await page.waitForTimeout(150);
  await page.click('[data-act="endturn"]');
  await page.waitForTimeout(300);
  const mid = await page.$$eval('.stat.badges .bdg.on', els => els.length);
  if(mid !== 3) errors.push(`mid-fight the case shows ${mid} badges, should still be 3`);
  const sk = await page.$('[data-act="skip"]');
  if(sk){ await sk.click(); await page.waitForTimeout(400); }
  const onWin = await page.evaluate(() => ({
    lit: document.querySelectorAll('.stat.badges .bdg.on').length,
    stored: G.badges,
    award: (document.querySelector('[data-act="afterbattle"]') || {}).textContent || null,   // 5.2.1: the badge is handed over on the field; Continue goes to the reward
    box: !!document.querySelector('.arenanotes .award'),
    fresh: document.querySelectorAll('.bdg.fresh').length,
  }));
  if(onWin.lit !== 4)
    errors.push(`won a badge but the case still shows ${onWin.lit} — it must light before Continue`);
  if(onWin.stored !== 3) errors.push('the badge was banked before Continue');
  if(!onWin.award || !/reward/i.test(onWin.award) || onWin.box) errors.push('a won gym should go straight to the reward: ' + onWin.award);
  if(!onWin.fresh) errors.push('the new pip is not marked fresh');
  mark(`badge shows the moment it is won: "${onWin.award}", ${onWin.lit}/8 lit`);

  await page.click('[data-act="afterbattle"]');
  await page.waitForTimeout(400);
  const after2 = await page.evaluate(() => ({
    lit: document.querySelectorAll('.stat.badges .bdg.on').length, stored: G.badges }));
  if(after2.stored !== 4 || after2.lit !== 4)
    errors.push(`after Continue: ${after2.stored} stored, ${after2.lit} lit`);

  /* Badge rewards (v25): the picker opens on Continue, offers three, can't be
     dismissed by tapping outside, and comes back — with the same three — after
     a reload if you close the tab instead of choosing. */
  const pick1 = await page.evaluate(() => {
    const m = document.querySelector('.modal.reward');
    return m ? { cards: [...m.querySelectorAll('.rcard')].map(c => c.dataset.r),
                 title: m.querySelector('h3').textContent } : null;
  });
  if(!pick1) errors.push('no badge reward picker after winning a gym');
  else {
    if(pick1.cards.length !== 3 || new Set(pick1.cards).size !== 3) errors.push('the picker should offer three different rewards: ' + pick1.cards);
    if(!/Rainbow Badge/.test(pick1.title)) errors.push('the picker names the wrong badge: ' + pick1.title);
    await page.mouse.click(5, 5);          // tapping outside must not close it
    await page.waitForTimeout(150);
    if(!await page.$('.modal.reward')) errors.push('tapping outside closed the reward picker');
  }
  await page.reload();
  await page.waitForTimeout(300);
  const survived2 = await page.$$eval('.stat.badges .bdg.on', els => els.length);
  if(survived2 !== 4) errors.push('badges did not survive a reload: ' + survived2);
  const pick2 = await page.$$eval('.modal.reward .rcard', els => els.map(c => c.dataset.r));
  if(pick1 && JSON.stringify(pick2) !== JSON.stringify(pick1.cards))
    errors.push(`after a reload the picker offered ${pick2}, not the same ${pick1 && pick1.cards}`);
  mark('and it stays won through Continue and a reload; the reward offer survives too: ' + pick2.join(', '));
  await page.screenshot({ path:'shot-reward.png' });
  // choose the first, and it lands
  const chosen = pick2[0];
  await page.click(`.modal.reward .rcard[data-r="${chosen}"]`);
  await page.waitForTimeout(200);
  const got = await page.evaluate(() => ({ modal: !!document.querySelector('.modal.reward'),
    pending: G.pendingRewards.length, log: G.rewardLog.map(x => x.id) }));
  if(got.modal) errors.push('the picker stayed open after choosing');
  if(got.pending) errors.push('a reward is still pending after choosing');
  if(got.log[got.log.length - 1] !== chosen) errors.push('the chosen reward was not recorded: ' + got.log);
  // the badge case lists it
  await page.click('.stat.badges');
  await page.waitForTimeout(150);
  const info = await page.$eval('.modal .blist', e => e.textContent.replace(/\s+/g, ' '));
  const nm = await page.evaluate(id => rewardById(id).name, chosen);
  if(!info.includes(nm)) errors.push('the badge screen does not show the chosen reward ' + nm);
  await page.click('.modal [data-m="close"]');
  mark(`chose ${nm}; the badge screen lists it`);

  // the Elite Four and the Champion are the last five stages
  const tail = await page.evaluate(() => {
    const plan = runPlan();
    return plan.slice(-5).map(p => p.kind + ':' + (p.boss ? p.boss.name : ''));
  });
  if(tail.filter(t => t.startsWith('elite')).length !== 4) errors.push('the Elite Four are not four: ' + tail);
  if(!tail[4].startsWith('champion')) errors.push('the Champion is not last: ' + tail);
  mark('endgame: ' + tail.join(', '));

  // a full boss fight plays through with the boss framing
  // (seeded, like the queue check below: an unseeded page runs a different
  //  fight every time, and a draw is neither a badge nor a blackout)
  await page.evaluate(() => {
    G.seed = 777;
    // the earlier blackout scouted Brock from an UNSEEDED game, and a rematch is
    // rebuilt from the scouting report — clear it, or this fight inherits that luck
    G.scouted = {}; G.attempt = 0;
    G.stage = TUNING.battlesPerBadge; G.turn = 4; G.credits = 40;
    G.team = [makeUnit('squirtle',0), makeUnit('onix',0), makeUnit('pikachu',0)];
    save(); render();
  });
  await page.click('[data-act="endturn"]');
  await page.waitForTimeout(400);
  const tag = await page.$eval('.bosstag', e => e.textContent.trim()).catch(()=>null);
  if(!tag || !/Pewter/.test(tag)) errors.push('no gym tag during the fight: ' + tag);
  await page.click('[data-act="skip"]');
  await page.waitForTimeout(300);
  const bannerText = await page.$eval('.big', e => e.textContent.trim()).catch(()=>null);
  if(!bannerText || !/BADGE|BLACKED OUT/.test(bannerText))
    errors.push('the result banner is not badge-aware: ' + bannerText);
  mark('fight banner: ' + bannerText);
  await page.screenshot({ path:'shot-gym.png', fullPage:true });

  /* The action meter is invisible without the queue — if this strip ever stops
     rendering, speed silently becomes unreadable again. */
  // the previous block left us on a victory screen; get back to the shop first
  const cont = await page.$('[data-act="afterbattle"]');
  if(cont){ await cont.click(); await page.waitForTimeout(400); }
  /* Pin the seed. `newGame()` falls back to Math.random() when there is no save,
     so this file used to run a DIFFERENT fight every time — and the check below
     read the queue 1400ms in, by which point one side might already be wiped
     out. It passed for months on luck and failed the first time a balance
     change moved fight lengths. Seed it, and look at the opening step, where
     both teams are guaranteed to still be standing. */
  await page.evaluate(() => {
    G.seed = 4242;
    G.stage = 1; G.turn = 10; G.credits = 30;
    G.team = [makeUnit('pikachu',0), makeUnit('onix',0), makeUnit('snorlax',0)];
    for(const u of G.team){ u.hp += 80; u.atk += 20; }
    save(); render();
  });
  await page.waitForTimeout(150);
  await page.click('[data-act="endturn"]');
  // step 0 is the "Battle start!" snapshot and carries no queue; wait for the
  // first real action rather than guessing at a delay
  await page.waitForFunction(() => battle && battle.i >= 1 && battle.steps[battle.i].up, null, { timeout: 8000 });   // v43: step 0 now previews the order too
  const opening = await page.evaluate(() => ({
    i: battle.i, p: battle.steps[battle.i].p.length, e: battle.steps[battle.i].e.length }));
  if(!(opening.p && opening.e))
    errors.push('the queue check started after a side was already wiped out: ' + JSON.stringify(opening));
  const queue = await page.$$eval('.queue .qmon', els => els.map(e => ({
    side: e.className.includes(' p') ? 'you' : 'them', now: e.className.includes('now'),
  }))).catch(() => []);
  if(!queue.length) errors.push('no action queue during a fight');
  if(queue.length > 6) errors.push('the queue shows more than it should: ' + queue.length);
  if(queue.filter(q => q.now).length !== 1) errors.push('the queue does not mark exactly one as next');
  if(!queue.some(q => q.side === 'you') || !queue.some(q => q.side === 'them'))
    errors.push(`the queue does not distinguish sides (${opening.p} of yours and ` +
      `${opening.e} of theirs are standing): ` + JSON.stringify(queue));
  mark(`action queue: ${queue.length} slots, ${queue.filter(q=>q.side==='you').length} yours`);

  /* The queue has to be telling the truth about the fight, not decoration.
     (How OFTEN a pokémon acts is asserted in the engine suite, where survival
     can be controlled for — in a real fight a fast pokémon that faints early
     acts less than a slow one that lives, which is correct and makes the
     naive "fastest acts most" check meaningless here.) */
  const truthful = await page.evaluate(() => {
    const st = battle.steps[battle.i];
    if(!st || !st.up) return 'no queue on the current step';
    const shown = [...document.querySelectorAll('.queue .qmon')].length;
    if(shown !== st.up.length) return `queue shows ${shown}, step says ${st.up.length}`;
    const alive = new Set([...st.p, ...st.e].map(u => u.uid));
    if(!st.up.every(uid => alive.has(uid))) return 'the queue lists a fainted pokémon';
    return null;
  });
  if(truthful) errors.push('queue: ' + truthful);
  mark('the queue matches the battle state');

  await page.click('[data-act="afterbattle"]').catch(()=>{});
  await page.waitForTimeout(300);

  // phone width
  await page.setViewportSize({ width:390, height:860 });
  await page.waitForTimeout(250);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if(over) errors.push('horizontal overflow at 390px');

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].slice(0,20).forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nrun structure passed');
})();
