/* 4.3.0: Secret Boss Tickets, Pokédex secret bosses, sound hold. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear());
  /* engine forcing */
  const f = await p.evaluate(() => ({
    red: newGame(1, { gens: [2], secret: 'red' }).redFlag, oak: newGame(1, { gens: [1], secret: 'oak' }).redFlag,
    badOak: newGame(1, { gens: [2], secret: 'oak' }).redFlag, badRed: newGame(1, { gens: [1], secret: 'red' }).redFlag,
    both: newGame(1, { gens: [1, 2], secret: 'oak' }).redFlag, none: newGame(1, { gens: [1], secret: 'bogus' }).redFlag,
    used: newGame(1, { gens: [2], secret: 'red' }).ticketUsed }));
  check(f.red === 'red' && f.oak === 'oak' && f.both === 'oak' && f.used === 'red', 'a ticket forces Red / Oak (also in a mixed run)');
  check(f.badOak === 'red' || f.badOak === null || f.badOak === true, 'Oak ticket in a Gen 2-only run falls back to the normal draw: ' + f.badOak);
  check(f.badRed !== 'red', 'Red ticket in a Gen 1-only run falls back: ' + f.badRed);
  /* award */
  const aw = await p.evaluate(() => {
    G = newGame(11, { gens: [2] }); G.redFlag = 'red'; rollShop(G, false);
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8; phase = 'shop';
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G);
    applyBattleResult(G, 'win', opponentFor0(G), null); noteRunEnd(); awardRed();
    return { t: records().tickets, met: records().met }; });
  check(aw.t && aw.t.red === 1 && aw.met && aw.met.red, 'beating Red earns a ticket and marks him met');
  /* daily doesn't earn */
  const dl = await p.evaluate(() => { const r = records(); r.tickets = { red: 0 }; saveRecords(r);
    G = newGame(12, { gens: [2] }); G.daily = '2026-10-04'; G.redFlag = 'red'; G.redResult = 'won'; G.over = 'won'; awardRed(); return records().tickets.red; });
  check(dl === 0, 'a daily win earns no ticket');
  /* cap + New Run modal */
  const nr = await p.evaluate(() => {
    const r = records(); r.tickets = { red: 5, oak: 1 }; saveRecords(r);
    G = newGame(3, { gens: [1] }); rollShop(G, false); phase = 'shop'; render();
    PREF.set('gens', [1]); openNewRun();
    const btns = [...document.querySelectorAll('[data-tkt]')].map(x => x.dataset.tkt);
    return { btns, txt: document.querySelector('.newrun').innerText }; });
  check(nr.btns.join() === 'red,oak' && /Secret Boss Ticket/i.test(nr.txt), 'New Run lists both tickets');
  const sel = await p.evaluate(async () => {
    document.querySelector('[data-tkt="red"]').click(); const redOn = document.querySelector('[data-tkt="red"]').classList.contains('on');   // Gen 1 only: refused
    document.querySelector('[data-tkt="oak"]').click(); const oakOn = document.querySelector('[data-tkt="oak"]').classList.contains('on');
    document.querySelector('[data-n="go"]').click(); await new Promise(r => setTimeout(r, 200));
    return { redOn, oakOn, flag: G.redFlag, tk: records().tickets, used: G.ticketUsed, mods: JSON.stringify(G.mods || {}) }; });
  check(!sel.redOn && sel.oakOn && sel.flag === 'oak' && sel.tk.oak === 0 && sel.tk.red === 5 || (sel.tk.red === 3), 'Oak ticket used on start; Red ticket refused in Gen 1: ' + JSON.stringify(sel));
  /* transfer merge of tickets/met via records code path */
  const mg = await p.evaluate(() => { const r = records(); return typeof r.tickets === 'object'; });
  check(mg, 'tickets are stored in records');
  /* Dex */
  const dx = await p.evaluate(() => { localStorage.removeItem('pkb_records'); PREF.set('gens', [1, 2]); openDex(); const t = document.querySelector('.dex').innerText; document.querySelectorAll('.modal').forEach(m => m.remove());
    const r = records(); r.met = { oak: true }; saveRecords(r); openDex(); const t2 = document.querySelector('.dex').innerText; document.querySelectorAll('.modal').forEach(m => m.remove()); return { t, t2 }; });
  check(/Secret bosses/.test(dx.t) && /\?\?\?/.test(dx.t) && !/Pallet Town/.test(dx.t.split('Secret bosses')[1] || ''), 'Dex: unmet bosses are ???');
  check(/Oak/.test(dx.t2.split('Secret bosses')[1] || '') && /Pallet Town/.test(dx.t2) && /\?\?\?/.test(dx.t2), 'Dex: Oak shown once met, Red still ???');
  /* sound hold */
  const sh = await p.evaluate(() => { SFX.ensure(); SFX.hold(true); const a = SFX.held; SFX.play('tap'); SFX.hold(false); return { a, b: SFX.held }; });
  check(sh.a === true && sh.b === false, 'SFX hold toggles');
  const pz = await p.evaluate(async () => { localStorage.clear(); G = newGame(3, { gens: [1] }); G.pendingRewards = []; G.turn = 12; G.stage = 5;
    G.team = ['charizard', 'blastoise', 'butterfree', 'gengar', 'pidgeot', 'clefable'].map(i => makeUnit(i, 2)); rollShop(G, false); phase = 'shop'; render();
    await startBattle(); await new Promise(r => setTimeout(r, 600));
    handle('pause'); const held = SFX.held; handle('pause'); const after = SFX.held; return { held, after }; });
  check(pz.held === true && pz.after === false, 'pause holds the sound, resume releases it: ' + JSON.stringify(pz));
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
