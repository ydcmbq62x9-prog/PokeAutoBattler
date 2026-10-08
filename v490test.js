/* 4.9.0: run history, Pokédex second-type tag and stone users. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear());
  const h = await p.evaluate(() => {
    newRun({ gens:[1,2] }); G.over = 'won'; G.turn = 30; noteRunEnd(); noteRunEnd();      // twice: still one row
    const one = (records().history || []).length;
    newRun({ gens:[1], mods:{ onelife:true } }); G.stage = 3; G.turn = 5; noteQuit(); const two = records().history;
    for(let i = 0; i < 40; i++){ newRun({}); G.team = [makeUnit('pikachu', 2)]; fixSlots(G); G.stage = 2; G.turn = 4; noteQuit(); }
    const many = records().history.length;
    openTrainerCard(); document.querySelector('[data-m="history"]').click();
    const rows = document.querySelectorAll('.hrow').length, txt = document.querySelector('.modal.history').innerText;
    return { one, twoLen: two.length, newest: two[0].gens, mods: two[0].mods, many, rows, hasSprites: document.querySelectorAll('.hrow .hteam > *').length > 0, txt: txt.slice(0, 120) }; });
  check(h.one === 1, 'a finished run is logged once even if the end is noted twice');
  check(h.twoLen === 2 && h.newest === '1' && /One Life/.test(h.mods), 'quitting a played run logs it with its gens and rules');
  check(h.many === 30 && h.rows === 30, 'history keeps the last 30 and the page lists them');
  check(h.hasSprites, 'each row shows its team');
  await p.evaluate(() => { document.querySelector('.modal.history [data-m="close"]').click(); });
  check(await p.evaluate(() => !!document.querySelector('.modal.trainer .tcard')), 'Back returns to the Trainer Card');
  await p.evaluate(() => document.querySelectorAll('.modal').forEach(x => x.remove()));
  const d = await p.evaluate(() => { PREF.set('dexseen', JSON.stringify(['geodude'])); openDex(); const t = document.querySelector('.dextile[data-id="geodude"]'); t.click();
    const card = document.querySelector('.dcard').innerText, tags = [...document.querySelectorAll('.dcard .chead .tag')].map(x => x.textContent);
    return { tags, hasEvo: !!document.querySelector('.dcard') }; });
  check(d.tags.includes('Rock') && d.tags.includes('Ground'), 'Geodude’s card shows Rock and Ground: ' + d.tags.join());
  const e = await p.evaluate(() => stoneUsers('metalcoat').concat(stoneUsers('kingsrock')).join(' | '));
  check(/Onix → Steelix/.test(e) && /Slowpoke → Slowking/.test(e) && /Poliwhirl → Politoed/.test(e), 'stone users listed: ' + e);
  const t = await p.evaluate(() => { document.querySelectorAll('.modal').forEach(x => x.remove()); openDex(); const tabs = [...document.querySelectorAll('.dexseg .sp, [data-dextab]')]; return document.body.innerText.includes('Evolves:') || tabs.length; });
  check(!!t, 'Pokédex opens');
  // transfer merge keeps history from both
  const m = await p.evaluate(async () => { localStorage.clear(); newRun({}); G.stage = 2; G.turn = 4; noteQuit(); const code = await makeTransferCode();
    localStorage.clear(); newRun({}); G.stage = 3; G.turn = 6; noteQuit(); const before = records().history.length;
    const rd = await readTransferCode(code), ok = rd.ok && applyTransfer(rd.data); return { before, ok, after: (records().history || []).length }; });
  check(m.before === 1 && m.after === 2, 'a transfer code merges run history: ' + JSON.stringify(m));
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all good'); process.exit(fails ? 1 : 0);
})();
