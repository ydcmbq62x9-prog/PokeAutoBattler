/* Duels live link inside the preview page: WebRTC is blocked there, so the page's own room carries it.
   The room is faked here (two pages bridged through node); a third page tries to barge in. */
const { chromium } = require('playwright');
const URL = require('./pkbpaths').PAGE;
let bad = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) bad++; };
(async () => {
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const pages = []; // each {p, name, id}
  const mk = async name => {
    const ctx = await br.newContext({ viewport:{ width:390, height:844 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.dismiss());
    const me = { p, name, errs, idx:pages.length }; pages.push(me);
    await p.exposeBinding('__bus', (_, room, topic, data) => { // deliver to every page that joined this room, sender included (isMe)
      for(const o of pages) o.p.evaluate(([r, t, d, from]) => window.__deliver && window.__deliver(r, t, d, from), [room, topic, data, me.idx]).catch(() => {}); });
    await p.addInitScript(([n, idx]) => {
      try{ localStorage.setItem('pkb_dev', '1'); localStorage.setItem('pkb_name', n); localStorage.setItem('pkb_title', 'off'); }catch(e){}
      window.RTCPeerConnection = function(){ throw new TypeError('RTCPeerConnection is not a constructor'); };   // what the preview page does
      const subs = {}; window.__deliver = (room, topic, data, from) => { (subs[room + '|' + topic] || []).forEach(f => f({ topic, data, isMe: from === idx, sameTab: from === idx, peer:'p' + from })); };
      window.claude = { use: async name => name !== 'room' ? null : { join: async room => ({ emit: async (t, d) => window.__bus(room, t, d), on: (t, f) => { (subs[room + '|' + t] = subs[room + '|' + t] || []).push(f); return () => { subs[room + '|' + t] = (subs[room + '|' + t] || []).filter(x => x !== f); }; }, leave: async () => {} }) } };
    }, [name, me.idx]);
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelectorAll('.modal,#title').forEach(e => e.remove()); document.body.classList.remove('titled'); });
    await p.evaluate(() => openDuels()); await p.click('[data-m="devfill"]'); await p.waitForSelector('[data-m="set"]'); await p.click('[data-m="set"]');
    await p.waitForSelector('[data-pick]');
    return me;
  };
  const A = await mk('Ann'), B = await mk('Bob');
  await A.p.waitForSelector('[data-l="host"]');
  await A.p.click('[data-l="host"]'); await A.p.waitForSelector('.dcode'); const code = await A.p.textContent('.dcode');
  check(/^[A-Z2-9]{4}$/.test(code), `room code made (${code})`);
  await B.p.click('[data-l="join"]'); await B.p.fill('#lk_in', '!!'); await B.p.click('[data-l="go"]'); await B.p.waitForSelector('.dlive .dmsg'); check(true, 'bad room code refused');
  await B.p.fill('#lk_in', code); await B.p.click('[data-l="go"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => liveOn(), null, { timeout:6000 });
  check(true, 'both linked through the room');
  const C = await mk('Eve');     // a stranger who guesses the code after the pair formed
  await C.p.click('[data-l="join"]'); await C.p.fill('#lk_in', code);  await C.p.click('[data-l="go"]'); await C.p.waitForTimeout(2500);
  check(await C.p.evaluate(() => !liveOn()) && await A.p.evaluate(() => liveOn()) && await B.p.evaluate(() => liveOn()), 'a third person cannot take a seat');
  const pick = async P => { const bids = await P.p.evaluate(() => [...document.querySelectorAll('[data-pick]')].map(e => e.dataset.pick));
    for(const bid of bids){ if(await P.p.evaluate(() => duelDraft ? duelDraft.picks.length : 0) >= 6) break; await P.p.click(`[data-pick="${bid}"]`);
      if(await P.p.isDisabled('[data-m="lock"]')) await P.p.click(`[data-pick="${bid}"]`); } };
  await pick(A); await pick(B); await A.p.click('[data-m="lock"]'); await B.p.click('[data-m="lock"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => !!LIVE.peer.code, null, { timeout:5000 });
  check(true, 'teams swapped over the room');
  await A.p.click('[data-m="fight"]'); await B.p.click('[data-m="fight"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => typeof battle !== 'undefined' && battle && battle.duel, null, { timeout:9000 });
  const st = await Promise.all([A, B].map(P => P.p.evaluate(() => ({ n: battle.steps.length, r: battle.result }))));
  check(st[0].n === st[1].n && st[0].r !== undefined, `same battle on both (${st[0].n} steps, ${st[0].r}/${st[1].r})`);
  for(const P of [A, B, C]) check(P.errs.length === 0, `${P.name}: no page errors ${P.errs[0] || ''}`);
  await br.close(); console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
