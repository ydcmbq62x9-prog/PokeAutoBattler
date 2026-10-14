/* Duels end to end in the browser: two players, a full set over the live link, through the real screens.
   6.17.0: codes are no longer pasted by hand, so the set is played over the live link (PeerJS faked locally,
   as in livetest.js). Also checks that a duel goes back to where it was started: the title, or the run. */
const { chromium } = require('playwright');
let WS; try{ WS = require('ws'); }catch(e){ console.log('skipped: needs `npm i ws`'); process.exit(0); }
const URL = require('./pkbpaths').PAGE;
let bad = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) bad++; };
(async () => {
  const clients = new Map(), wss = new WS.Server({ port:9098 });
  wss.on('connection', (ws, req) => {
    const id = new URLSearchParams(req.url.split('?')[1]).get('id');
    if(clients.has(id)){ ws.send(JSON.stringify({ type:'ID-TAKEN' })); ws.close(); return; }
    clients.set(id, ws); ws.send(JSON.stringify({ type:'OPEN' }));
    ws.on('message', raw => { const m = JSON.parse(raw); if(m.type === 'HEARTBEAT') return; m.src = id;
      const dst = clients.get(m.dst); if(dst) dst.send(JSON.stringify(m)); else ws.send(JSON.stringify({ type:'EXPIRE', src:m.dst })); });
    ws.on('close', () => { if(clients.get(id) === ws) clients.delete(id); });
  });
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mkPlayer = async (name, vw = 390, vh = 844) => {
    const ctx = await br.newContext({ viewport:{ width:vw, height:vh } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.dismiss());
    await p.addInitScript(n => { try{ localStorage.setItem('pkb_dev', '1'); localStorage.setItem('pkb_name', n); localStorage.setItem('pkb_title', 'off'); }catch(e){}
      window.__peerBroker = { host:'localhost', port:9098, secure:false, path:'/peerjs', key:'peerjs' }; }, name);
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
  // Ann plays from the title screen, Bob from inside his run (a few turns in)
  await B.p.evaluate(() => { G.turn = 4; save(); });
  const bTurn = await B.p.evaluate(() => G.turn), aSeed = await A.p.evaluate(() => G.seed);
  await A.p.evaluate(() => { document.querySelectorAll('.modal').forEach(e => e.remove()); showTitle(afterTitle); openDuels(); });
  await A.p.waitForSelector('#title');
  for(const P of [A, B]) await P.p.click('[data-m="set"]');
  await A.p.click('[data-l="host"]'); await A.p.waitForSelector('.dcode', { timeout:8000 });
  const code = await A.p.textContent('.dcode');
  await B.p.click('[data-l="join"]'); await B.p.fill('#lk_in', code); await B.p.click('[data-l="go"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => liveOn(), null, { timeout:15000 });
  check(true, `both link up with code ${code}`);
  check(await A.p.$('#mycode, #theircode, [data-m="copy"]') === null, 'no copy-and-paste code boxes any more');
  let ga = 0;
  for(let game = 1; game <= 3; game++){
    for(const P of [A, B]) await P.p.waitForSelector('[data-pick], .dverdict', { timeout:5000 });
    const over = await A.p.$('.dverdict'); if(over) break;
    const na = await pickTeam(A), nb = await pickTeam(B);
    check(na >= 1 && nb >= 1, `game ${game}: both build a team within the budget (${na} and ${nb})`);
    await A.p.click('[data-m="lock"]'); await B.p.click('[data-m="lock"]');
    for(const P of [A, B]) await P.p.waitForFunction(() => !!LIVE.peer.code, null, { timeout:5000 });
    check(true, `game ${game}: both lock in and the teams swap over the link`);
    await A.p.click('[data-m="fight"]'); await B.p.click('[data-m="fight"]');
    for(const P of [A, B]){
      await P.p.waitForFunction(() => typeof battle !== 'undefined' && battle && battle.duel, null, { timeout:8000 });
      await P.p.evaluate(() => finishPlayback()); await P.p.waitForTimeout(150);
    }
    if(game === 1) check(/Back to the set/.test(await A.p.textContent('[data-act="afterbattle"]')), 'the button after a duel says Back to the set');
    const [ra, rb] = await Promise.all([A, B].map(P => P.p.evaluate(() => ({ r: battle.result, steps: battle.steps.length, last: battle.steps[battle.steps.length - 1].lines.slice(-1)[0], set: getDuelSet().games.map(g => g.result) }))));
    check(ra.steps === rb.steps, `game ${game}: both watch the same battle (${ra.steps} steps)`);
    check((ra.r === 'win' && rb.r === 'lose') || (ra.r === 'lose' && rb.r === 'win') || (ra.r === 'draw' && rb.r === 'draw'), `game ${game}: opposite results (${ra.r} / ${rb.r})`);
    for(const P of [A, B]){ await P.p.evaluate(() => afterBattle()); await P.p.waitForSelector('.modal', { timeout:4000 }); }
    if(game === 1){
      const a = await A.p.evaluate(() => ({ title: !!document.getElementById('title'), seed: G.seed })), b = await B.p.evaluate(() => ({ title: !!document.getElementById('title'), phase, turn: G.turn }));
      check(a.title && a.seed === aSeed, 'from the title: the duel goes back to the title screen, no run is opened');
      check(!b.title && b.phase === 'shop' && b.turn === bTurn, `from a run: the duel goes back to the same run (turn ${b.turn})`);
    }
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
  await br.close(); wss.close(); console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
