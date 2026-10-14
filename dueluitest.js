/* Duels end to end in the browser: two players, a full set, through the real screens. */
const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
let bad = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) bad++; };
(async () => {
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const mkPlayer = async (name, vw = 390, vh = 844) => {
    const ctx = await br.newContext({ viewport:{ width:vw, height:vh } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.dismiss());
    await p.addInitScript(n => { try{ localStorage.setItem('pkb_dev', '1'); localStorage.setItem('pkb_name', n); localStorage.setItem('pkb_title', 'off'); }catch(e){} }, name);
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelectorAll('.modal,#title').forEach(e => e.remove()); document.body.classList.remove('titled'); });
    return { p, ctx, errs, name };
  };
  const A = await mkPlayer('Ann'), B = await mkPlayer('Bob', 1250, 1000);
  for(const P of [A, B]){
    await P.p.evaluate(() => openDuels());
    await P.p.click('[data-m="devfill"]'); await P.p.waitForSelector('[data-m="set"]');
    const n = await P.p.evaluate(() => duelBox().length);
    check(n === 30, `${P.name}: the dev tool fills the box (${n})`);
    check(await P.p.isDisabled('[data-m="set"]') === false, `${P.name}: Start a set is enabled with a box`);
  }
  const pickTeam = async P => {
    const bids = await P.p.evaluate(() => [...document.querySelectorAll('[data-pick]')].map(e => e.dataset.pick));
    for(const bid of bids){
      const before = await P.p.evaluate(() => (duelDraft ? duelDraft.picks.length : 0));
      if(before >= 6) break;
      await P.p.click(`[data-pick="${bid}"]`);
      const disabled = await P.p.isDisabled('[data-m="lock"]');
      const msg = await P.p.evaluate(() => (document.querySelector('.dmsg') || {}).textContent || '');
      if(disabled && /over the power budget/.test(msg)) await P.p.click(`[data-pick="${bid}"]`);   // too much: take it back off
    }
    return P.p.evaluate(() => duelDraft.picks.length);
  };
  const lockAndCode = async P => { await P.p.click('[data-m="lock"]'); await P.p.waitForSelector('#mycode'); return P.p.inputValue('#mycode'); };
  let ga = 0;
  for(let game = 1; game <= 3; game++){
    for(const P of [A, B]){
      if(game === 1) await P.p.click('[data-m="set"]');
      await P.p.waitForSelector('[data-pick], #mycode, .dverdict', { timeout:5000 });
    }
    const over = await A.p.$('.dverdict'); if(over) break;
    const na = await pickTeam(A), nb = await pickTeam(B);
    check(na >= 1 && nb >= 1, `game ${game}: both build a team within the budget (${na} and ${nb})`);
    const ca = await lockAndCode(A), cb = await lockAndCode(B);
    check(/^PKD1-/.test(ca) && ca !== cb, `game ${game}: both lock in and get a code`);
    // hidden picks: the paste box exists only once locked
    // a wrong code is refused, the right one fights
    await A.p.fill('#theircode', 'hello'); await A.p.click('[data-m="fight"]');
    check(/not a duel code/.test(await A.p.evaluate(() => (document.querySelector('.dmsg') || {}).textContent || '')), `game ${game}: junk is refused`);
    await A.p.fill('#theircode', ca); await A.p.click('[data-m="fight"]');
    check(/your own code/.test(await A.p.evaluate(() => (document.querySelector('.dmsg') || {}).textContent || '')), `game ${game}: pasting your own code is refused`);
    await A.p.fill('#theircode', cb); await B.p.fill('#theircode', ca);
    await Promise.all([A.p.click('[data-m="fight"]'), B.p.click('[data-m="fight"]')]);
    for(const P of [A, B]){
      await P.p.waitForFunction(() => typeof battle !== 'undefined' && battle && battle.duel, null, { timeout:8000 });
      await P.p.evaluate(() => finishPlayback()); await P.p.waitForTimeout(150);
    }
    const [ra, rb] = await Promise.all([A, B].map(P => P.p.evaluate(() => ({ r: battle.result, steps: battle.steps.length, last: battle.steps[battle.steps.length - 1].lines.slice(-1)[0], set: getDuelSet().games.map(g => g.result) }))));
    check(ra.steps === rb.steps, `game ${game}: both watch the same battle (${ra.steps} steps)`);
    check((ra.r === 'win' && rb.r === 'lose') || (ra.r === 'lose' && rb.r === 'win') || (ra.r === 'draw' && rb.r === 'draw'), `game ${game}: opposite results (${ra.r} / ${rb.r})`);
    for(const P of [A, B]){ await P.p.evaluate(() => afterBattle()); await P.p.waitForSelector('.modal', { timeout:4000 }); }
    const sa = await A.p.evaluate(() => getDuelSet()), sb = await B.p.evaluate(() => getDuelSet());
    check(sa.id === sb.id && sa.games.length === game, `game ${game}: both record it (set ${sa.id})`);
    if(sa.over){ check(!!sb.over, `the set ends for both (${sa.over} / ${sb.over})`); break; }
  }
  const fa = await A.p.evaluate(() => getDuelSet()), fb = await B.p.evaluate(() => getDuelSet());
  check(fa.over && fb.over && ((fa.over === 'win') === (fb.over === 'lose')) || (fa.over === 'draw' && fb.over === 'draw'), `final verdict agrees: ${fa.over} / ${fb.over}`);
  check(await A.p.$('.dverdict') !== null, 'the verdict screen shows');
  await A.p.click('[data-m="finish"]');
  check(await A.p.evaluate(() => getDuelSet()) === null, 'finishing clears the set');
  check(await A.p.evaluate(() => duelBox().length) === 30, 'the box is unchanged after the set');
  for(const P of [A, B]) check(P.errs.length === 0, `${P.name}: no page errors ${P.errs[0] || ''}`);
  await A.p.screenshot({ path:'_scratch/duel-ph.png' }); await B.p.screenshot({ path:'_scratch/duel-pc.png' });
  await br.close(); console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
