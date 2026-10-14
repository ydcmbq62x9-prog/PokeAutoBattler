/* Duels live link: two browsers connect with one pair of codes, lock in, and watch the same fight together. */
const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
let bad = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) bad++; };
(async () => {
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mk = async name => {
    const ctx = await br.newContext({ viewport:{ width:390, height:844 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.dismiss());
    await p.addInitScript(n => { try{ localStorage.setItem('pkb_dev', '1'); localStorage.setItem('pkb_name', n); localStorage.setItem('pkb_title', 'off'); }catch(e){} }, name);
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelectorAll('.modal,#title').forEach(e => e.remove()); document.body.classList.remove('titled'); });
    await p.evaluate(() => openDuels()); await p.click('[data-m="devfill"]'); await p.waitForSelector('[data-m="set"]'); await p.click('[data-m="set"]');
    await p.waitForSelector('[data-pick]');
    return { p, errs, name };
  };
  const A = await mk('Ann'), B = await mk('Bob');
  // connect: A hosts, B joins
  await A.p.click('[data-l="host"]'); await A.p.waitForSelector('#lk_out', { timeout:8000 });
  const offer = await A.p.inputValue('#lk_out');
  check(/^PKL1-/.test(offer) && offer.length < 2500, `host code made (${offer.length} chars)`);
  await B.p.click('[data-l="join"]'); await B.p.fill('#lk_in', 'junk'); await B.p.click('[data-l="mkreply"]');
  await B.p.waitForSelector('.dlive .dmsg'); check(true, 'junk join code is refused');
  await B.p.fill('#lk_in', offer); await B.p.click('[data-l="mkreply"]'); await B.p.waitForSelector('#lk_out', { timeout:8000 });
  const reply = await B.p.inputValue('#lk_out');
  await A.p.fill('#lk_in', reply); await A.p.click('[data-l="finish"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => liveOn(), null, { timeout:15000 });
  check(true, 'both phones are linked live');
  // build teams; the second one to lock must not reveal anything before the first has locked
  const pick = async P => { const bids = await P.p.evaluate(() => [...document.querySelectorAll('[data-pick]')].map(e => e.dataset.pick));
    for(const bid of bids){ if(await P.p.evaluate(() => duelDraft ? duelDraft.picks.length : 0) >= 6) break; await P.p.click(`[data-pick="${bid}"]`);
      if(await P.p.isDisabled('[data-m="lock"]')) await P.p.click(`[data-pick="${bid}"]`); } };
  await pick(A); await pick(B);
  await A.p.click('[data-m="lock"]'); await A.p.waitForTimeout(500);
  check(await B.p.evaluate(() => !!LIVE.peer.commit && !LIVE.peer.code), 'Bob sees only that Ann locked, not her team');
  check(await A.p.evaluate(() => !LIVE.peer.code && !LIVE.mine.sent), 'Ann has not revealed yet');
  await B.p.click('[data-m="lock"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => !!LIVE.peer.code, null, { timeout:5000 });
  check(true, 'once both are locked the teams swap by themselves');
  check(await A.p.$('#theircode') === null, 'no code pasting in live mode');
  // fight: A ready first, B second; countdown, then the same battle
  await A.p.click('[data-m="fight"]'); await A.p.waitForTimeout(300);
  check(await B.p.evaluate(() => LIVE.peer.ready === true), 'Bob sees that Ann is ready');
  const t0 = Date.now(); await B.p.click('[data-m="fight"]');
  for(const P of [A, B]) await P.p.waitForSelector('.dcount', { timeout:3000 });
  check(true, 'both screens show the countdown');
  for(const P of [A, B]) await P.p.waitForFunction(() => typeof battle !== 'undefined' && battle && battle.duel, null, { timeout:8000 });
  const dt = Date.now() - t0; check(dt > 2500, `the fight starts after the countdown (${dt} ms)`);
  const st = await Promise.all([A, B].map(P => P.p.evaluate(() => ({ steps: battle.steps.length, r: battle.result, flip: battle.flip, i: battle.i }))));
  check(st[0].steps === st[1].steps && st[0].flip !== st[1].flip, `same battle on both (${st[0].steps} steps)`);
  check((st[0].r === 'win' && st[1].r === 'lose') || (st[0].r === 'lose' && st[1].r === 'win') || (st[0].r === 'draw' && st[1].r === 'draw'), `opposite results ${st[0].r} / ${st[1].r}`);
  for(const P of [A, B]){ await P.p.evaluate(() => finishPlayback()); await P.p.evaluate(() => afterBattle()); await P.p.waitForSelector('.modal', { timeout:4000 }); }
  const sa = await A.p.evaluate(() => ({ g: getDuelSet().games.length, live: liveOn() })), sb = await B.p.evaluate(() => getDuelSet().games.length);
  check(sa.g === 1 && sb === 1, 'both record game 1'); check(sa.live, 'the link stays up for the next game');
  // game 2 over the same link
  await A.p.waitForSelector('[data-pick]'); await B.p.waitForSelector('[data-pick]');
  check(await A.p.evaluate(() => !LIVE.peer.code && !LIVE.mine.ready), 'handshake state is fresh for game 2');
  // drop the link: manual codes appear again
  await A.p.click('[data-l="cancel"]'); await B.p.waitForFunction(() => !liveOn(), null, { timeout:8000 });
  check(await B.p.evaluate(() => /dropped/.test(LIVE.err)), 'Bob is told the link dropped');
  for(const P of [A, B]) check(P.errs.length === 0, `${P.name}: no page errors ${P.errs[0] || ''}`);
  await br.close(); console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
