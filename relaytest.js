/* Duels relay (6.16.0): the same live-link checks as livetest.js, but the page is served by the real Cloudflare
   Worker running locally (relay/worker.js under `wrangler dev`), so the phones talk through our own relay.
   Start it first:  ./relay/site.sh && (cd $PKB_OUT/duels-site && npx wrangler dev --port 8787)
   Then:            RELAY=http://127.0.0.1:8787 node relaytest.js
   The PeerJS server is still faked locally: a wrong code falls through to it and must say nobody is hosting. */
const { chromium } = require('playwright');
let WS; try{ WS = require('ws'); }catch(e){ WS = require('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/ws'); }   // npm i ws
const URL = process.env.RELAY || 'http://127.0.0.1:8787';
if(!process.env.RELAY) console.log('(RELAY not set, trying ' + URL + ')');
let bad = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) bad++; };
(async () => {
  const clients = new Map(), seen = [];
  const wss = new WS.Server({ port:9099 });
  wss.on('connection', (ws, req) => {
    const q = new URLSearchParams(req.url.split('?')[1]), id = q.get('id');
    if(clients.has(id)){ ws.send(JSON.stringify({ type:'ID-TAKEN', payload:{ msg:'ID is taken' } })); ws.close(); return; }
    clients.set(id, ws); seen.push(id); ws.send(JSON.stringify({ type:'OPEN' }));
    ws.on('message', raw => { const m = JSON.parse(raw); if(m.type === 'HEARTBEAT') return; m.src = id;
      const dst = clients.get(m.dst); if(dst) dst.send(JSON.stringify(m)); else ws.send(JSON.stringify({ type:'EXPIRE', src:m.dst })); });
    ws.on('close', () => { if(clients.get(id) === ws) clients.delete(id); });
  });
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--disable-features=WebRtcHideLocalIpsWithMdns', '--no-proxy-server'] });
  const mk = async name => {
    const ctx = await br.newContext({ viewport:{ width:390, height:844 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.dismiss());
    await p.addInitScript(n => { try{ localStorage.setItem('pkb_dev', '1'); localStorage.setItem('pkb_name', n); localStorage.setItem('pkb_title', 'off'); }catch(e){}
      window.__peerBroker = { host:'localhost', port:9099, secure:false, path:'/peerjs', key:'peerjs' }; }, name);
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelectorAll('.modal,#title').forEach(e => e.remove()); document.body.classList.remove('titled'); });
    await p.evaluate(() => openDuels()); await p.click('[data-m="devfill"]'); await p.waitForSelector('[data-m="set"]'); await p.click('[data-m="set"]');
    await p.waitForSelector('[data-pick]');
    return { p, errs, name };
  };
  const A = await mk('Ann'), B = await mk('Bob'), C = await mk('Eve');
  await A.p.click('[data-l="host"]'); await A.p.waitForSelector('.dcode', { timeout:8000 });
  const code = await A.p.textContent('.dcode'); check(/^[A-Z2-9]{4}$/.test(code), `host gets a 4-character code (${code})`);
  await B.p.click('[data-l="join"]'); await B.p.fill('#lk_in', 'ZZZZ'); await B.p.click('[data-l="go"]');
  await B.p.waitForSelector('.dlive .dmsg', { timeout:8000 }); check(/Nobody is hosting/.test(await B.p.textContent('.dlive .dmsg')), 'a wrong code says nobody is hosting it');
  await B.p.click('[data-l="join"]'); await B.p.fill('#lk_in', code.toLowerCase()); await B.p.click('[data-l="go"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => liveOn(), null, { timeout:15000 });
  check(true, 'friend types the code and both phones link up');
  // a stranger with the right code after the pair formed is ignored
  await C.p.click('[data-l="join"]'); await C.p.fill('#lk_in', code); await C.p.click('[data-l="go"]'); await C.p.waitForTimeout(3000);
  check(await C.p.evaluate(() => !liveOn()) && await A.p.evaluate(() => liveOn()), 'a third phone cannot take the seat');
  const pick = async P => { const bids = await P.p.evaluate(() => [...document.querySelectorAll('[data-pick]')].map(e => e.dataset.pick));
    for(const bid of bids){ if(await P.p.evaluate(() => duelDraft ? duelDraft.picks.length : 0) >= 6) break; await P.p.click(`[data-pick="${bid}"]`);
      if(await P.p.isDisabled('[data-m="lock"]')) await P.p.click(`[data-pick="${bid}"]`); } };
  await pick(A); await pick(B);
  await A.p.click('[data-m="lock"]'); await A.p.waitForTimeout(500);
  check(await B.p.evaluate(() => !!LIVE.peer.commit && !LIVE.peer.code), 'Bob sees only that Ann locked, not her team');
  await B.p.click('[data-m="lock"]');
  for(const P of [A, B]) await P.p.waitForFunction(() => !!LIVE.peer.code, null, { timeout:5000 });
  check(true, 'once both are locked the teams swap by themselves');
  await A.p.click('[data-m="fight"]'); await A.p.waitForTimeout(300);
  check(await B.p.evaluate(() => LIVE.peer.ready === true), 'Bob sees that Ann is ready');
  const t0 = Date.now(); await B.p.click('[data-m="fight"]');
  for(const P of [A, B]) await P.p.waitForSelector('.dcount', { timeout:3000 });
  for(const P of [A, B]) await P.p.waitForFunction(() => typeof battle !== 'undefined' && battle && battle.duel, null, { timeout:8000 });
  const dt = Date.now() - t0; check(dt > 2500, `the fight starts after the countdown (${dt} ms)`);
  const st = await Promise.all([A, B].map(P => P.p.evaluate(() => ({ steps: battle.steps.length, r: battle.result, flip: battle.flip }))));
  check(st[0].steps === st[1].steps && st[0].flip !== st[1].flip, `same battle on both (${st[0].steps} steps)`);
  check((st[0].r === 'win' && st[1].r === 'lose') || (st[0].r === 'lose' && st[1].r === 'win') || (st[0].r === 'draw' && st[1].r === 'draw'), `opposite results ${st[0].r} / ${st[1].r}`);
  for(const P of [A, B]){ await P.p.evaluate(() => finishPlayback()); await P.p.evaluate(() => afterBattle()); await P.p.waitForSelector('.modal', { timeout:4000 }); }
  check(await A.p.evaluate(() => liveOn()) && await B.p.evaluate(() => getDuelSet().games.length === 1), 'game recorded and the link stays up');
  check(!seen.includes('pkarena-' + code.toLowerCase()), 'the link went through the relay, not the PeerJS server');
  const hb = await A.p.evaluate(() => new Promise(r => setTimeout(() => r(liveOn()), 11000)));
  check(hb && await B.p.evaluate(() => liveOn()), 'the link stays up while nobody does anything (heartbeat)');
  await A.p.click('[data-l="cancel"]'); await B.p.waitForFunction(() => !liveOn(), null, { timeout:8000 });
  check(await B.p.evaluate(() => /dropped/.test(LIVE.err)), 'Bob is told the link dropped');
  // the code is free again: Ann can host, Eve can join the new code
  await A.p.click('[data-l="host"]'); await A.p.waitForSelector('.dcode', { timeout:8000 }); const code2 = await A.p.textContent('.dcode');
  await C.p.click('[data-l="join"]'); await C.p.fill('#lk_in', code2); await C.p.click('[data-l="go"]');
  for(const P of [A, C]) await P.p.waitForFunction(() => liveOn(), null, { timeout:8000 });
  check(true, 'after a drop a new pair can link up');
  for(const P of [A, B, C]) check(P.errs.length === 0, `${P.name}: no page errors ${P.errs[0] || ''}`);
  await br.close(); wss.close(); console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
