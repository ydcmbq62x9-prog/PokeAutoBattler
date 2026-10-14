/* v37: Game Boy style — the dock, the START menu, the Trainer Card and records, Options, the typing message box. */
const { chromium } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1250, 950], [390, 844]]){
    const tag = w + 'px';
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
    await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await page.waitForTimeout(250);
    await page.evaluate(() => { localStorage.removeItem('pkb_records'); localStorage.removeItem('pkb_name'); localStorage.removeItem('pkb_motion'); localStorage.removeItem('pkb_theme');
      G.pendingRewards = []; G.credits = 20; const m = (id, pos) => { const u = makeUnit(id, 4); u.pos = pos; return u; };
      G.team = [m('charizard', 0), m('blastoise', 1), m('pidgeot', 4)]; G.stage = 1; G.turn = 2; rollShop(G, false); save(); render();
      document.querySelectorAll('.modal').forEach(x => x.remove()); });

    /* ---- the dock ---- */
    const dock = await page.evaluate(() => { const d = document.querySelector('.dock'); const r = d.getBoundingClientRect();
      return { text: d.textContent.replace(/\s+/g, ' '), dots: d.querySelectorAll('.road i:not(.bdg)').length, done: d.querySelectorAll('.road i.done').length,
        now: d.querySelectorAll('.road i.now').length, gem: d.querySelectorAll('.road .bdg').length, btn: !!d.querySelector('[data-act="endturn"]'),
        pinned: d.closest('.bcR') && getComputedStyle(d.closest('.bcR')).display === 'flex' ? (document.body.classList.contains('inworld') && getComputedStyle(document.body).overflow === 'hidden' ? 'sticky' : getComputedStyle(d.closest('.bcR')).position) :   /* 5.0.0: the wide shop doesn't scroll at all */ getComputedStyle(d).position,   // 5.0.0: on a computer the dock is the foot of the pinned shop column
        bottom: Math.round(r.bottom), vh: innerHeight, name: trainerName(G.turn) }; });
    check(dock.text.includes(dock.name + ' wants to battle!'), `${tag}: dock says "${dock.name} wants to battle!"`);
    check(/Trainer battle/.test(dock.text) && /to the gym/.test(dock.text), `${tag}: and that it's a trainer battle before the gym`);
    check(dock.dots === 3 && dock.done === 1 && dock.now === 1 && dock.gem === 1, `${tag}: road shows 3 trainers (1 done, this one lit) then the badge (${dock.dots}/${dock.done}/${dock.now}/${dock.gem})`);
    check(dock.btn && /sticky|fixed/.test(dock.pinned) && dock.bottom <= dock.vh + 1, `${tag}: Battle button sits in the pinned dock, on screen (bottom ${dock.bottom}/${dock.vh})`);
    await page.evaluate(() => { G.stage = 3; save(); render(); });
    const gym = await page.evaluate(() => ({ t: document.querySelector('.dock').textContent.replace(/\s+/g, ' '), art: !!document.querySelector('.dock .bossart img'),
      lit: !!document.querySelector('.dock .road .bdg.on'), cta: document.querySelector('[data-act="endturn"]').textContent.trim(), panel: !!document.querySelector('.nextup.boss') }));
    check(/Brock wants to battle!/.test(gym.t) && gym.art && gym.lit, `${tag}: at the gym the dock shows Brock, his portrait and the lit badge`);
    check(/Challenge Brock/.test(gym.cta) && gym.panel, `${tag}: button names him and the boss details stay above`);
    await page.evaluate(() => { G.stage = 1; save(); render(); });

    /* ---- the typing message box keeps its whole text ---- */
    await page.click('.slot[data-act="team"][data-i="0"]').catch(() => page.click('.slot[data-act="team"]:not(.empty)'));
    await page.waitForTimeout(30);
    const tw = await page.evaluate(() => ({ roll: !!document.querySelector('#inspect .isum.reveal'), txt: document.querySelector('#inspect').textContent }));
    check(/Charizard|Blastoise|Pidgeot/.test(tw.txt), `${tag}: 5.4.0: message box shows the summary straight away`);
    await page.keyboard.press('Escape');

    /* ---- START menu ---- */
    await page.click('[data-act="menu"]'); await page.waitForTimeout(250);
    const sm = await page.evaluate(() => ({ items: [...document.querySelectorAll('.startmenu .smi')].map(b => b.dataset.m).join(','),
      cur: (document.querySelector('.smi.cur') || {}).dataset.m, desc: document.querySelector('.sdesc').textContent,
      ver: document.querySelector('.sver').textContent, v: GAME_VERSION.v }));
    check(sm.items === 'trainer,dex,export,versus,duels,transfer,news,help,options,title,restart,close', `${tag}: START menu entries: ${sm.items}`);
    check(sm.cur === 'trainer' && /badges/.test(sm.desc) && sm.ver.includes(sm.v), `${tag}: cursor starts on TRAINER, with its line and the version`);
    await page.hover('.smi[data-m="dex"]');
    check(await page.evaluate(() => document.querySelector('.smi.cur').dataset.m === 'dex' && /pokémon/.test(document.querySelector('.sdesc').textContent)), `${tag}: the cursor follows`);
    const turn0 = await page.evaluate(() => G.turn);
    await page.click('.smi[data-m="restart"]'); await page.waitForTimeout(80);
    check(await page.evaluate(() => !document.querySelector('.yesno').hidden && !!document.querySelector('.startmenu')), `${tag}: RESTART asks YES / NO first`);
    await page.click('[data-m="restart-no"]');
    check(await page.evaluate(t => G.turn === t && document.querySelector('.yesno').hidden, turn0), `${tag}: NO keeps the run`);
    await page.click('.smi[data-m="close"]');
    check(await page.evaluate(() => !document.querySelector('.modal')), `${tag}: EXIT closes it`);

    /* ---- a real battle feeds the records ---- */
    await page.evaluate(() => document.querySelector('[data-act="endturn"]').click());
    await page.waitForTimeout(300);
    await page.click('[data-act="skip"]').catch(() => {});
    await page.waitForTimeout(1600);
    await page.click('[data-act="afterbattle"]'); await page.waitForTimeout(300);
    const rec = await page.evaluate(() => ({ fought: Object.values((G.rec || {}).fought || {}), hit: (G.rec || {}).hit, R: JSON.parse(localStorage.getItem('pkb_records') || '{}') }));
    check(rec.fought.length === 3 && rec.fought.every(n => n === 1), `${tag}: each of the 3 fighters has 1 battle on record`);
    check(!rec.hit || (rec.hit.dmg > 0 && rec.hit.id), `${tag}: biggest hit recorded: ${rec.hit ? rec.hit.id + ' ' + rec.hit.dmg : 'none'}`);
    check(rec.R.best >= 2, `${tag}: best run moved on (stage ${rec.R.best})`);
    await page.evaluate(() => document.querySelectorAll('.modal').forEach(x => x.remove()));

    /* ---- Options: name, then the Trainer Card ---- */
    await page.click('[data-act="menu"]'); await page.click('.smi[data-m="options"]'); await page.waitForTimeout(150);
    await page.fill('#optname', 'Sean');
    await page.click('.modal [data-o="motion"][data-v="reduced"]');
    check(await page.evaluate(() => document.body.classList.contains('calm') && motionOff()), `${tag}: Reduced motion applies at once`);
    await page.click('.modal [data-o="motion"][data-v="device"]');
    await page.click('.modal [data-o="theme"][data-v="dark"]');
    const dk = await page.evaluate(() => ({ on: document.documentElement.classList.contains('dark'), bg: getComputedStyle(document.body).backgroundColor, saved: localStorage.getItem('pkb_theme') }));
    check(dk.on && dk.saved === 'dark' && dk.bg !== 'rgb(233, 227, 204)', `${tag}: Dark theme switches at once (${dk.bg})`);
    await page.click('.modal [data-o="theme"][data-v="system"]');
    check(await page.evaluate(() => localStorage.getItem('pkb_theme') === 'system' && document.documentElement.classList.contains('dark') === matchMedia('(prefers-color-scheme: dark)').matches), `${tag}: System follows the device`);
    await page.click('.modal [data-o="theme"][data-v="light"]');
    check(await page.evaluate(() => !document.documentElement.classList.contains('dark')), `${tag}: Light switches back`);
    await page.click('.modal [data-o="speed"][data-v="2"]');
    check(await page.evaluate(() => speed === 2 && localStorage.getItem('pkb_speed') === '2'), `${tag}: battle speed set from Options`);
    await page.click('.modal [data-o="speed"][data-v="1"]');
    await page.click('.modal [data-m="close"]');
    await page.click('[data-act="menu"]'); await page.click('.smi[data-m="trainer"]'); await page.waitForTimeout(150);
    const card = await page.evaluate(() => ({ t: document.querySelector('.tcard').textContent.replace(/\s+/g, ' '), cells: document.querySelectorAll('.bcase .bcell2').length,
      won: document.querySelectorAll('.bcase .bcell2.on').length, badges: G.badges, face: !!document.querySelector('.tface img') }));
    check(/Name\s*Sean/.test(card.t), `${tag}: the card shows the name`);
    check(card.cells === 8 && card.won === card.badges, `${tag}: badge case has 8 slots, ${card.won} won`);
    check(/Partner\s*\w+ · 1 battle/.test(card.t) && card.face, `${tag}: partner and its picture: ${(card.t.match(/Partner [^B]*/) || [''])[0]}`);
    check(/Best run\s*(On the way to|Reached) Brock/.test(card.t), `${tag}: best run label`);
    await page.click('.modal [data-m="close"]');
    const code = await page.evaluate(() => { openExport(); const v = document.querySelector('.modal textarea').value; document.querySelectorAll('.modal').forEach(x => x.remove()); return importTeam(v); });
    check(code && /Sean/.test(code.name || ''), `${tag}: the team code carries the name (${code && code.name})`);

    /* ---- restart counts the run ---- */
    await page.click('[data-act="menu"]'); await page.click('.smi[data-m="restart"]'); await page.click('[data-m="restart-yes"]'); await page.waitForTimeout(150);
    await page.click('.modal.newrun [data-n="go"]'); await page.waitForTimeout(150);   // 2.0.0: YES opens the New Run rules picker
    const after = await page.evaluate(() => ({ turn: G.turn, stage: G.stage, R: JSON.parse(localStorage.getItem('pkb_records') || '{}') }));
    check(after.turn === 1 && !after.stage && after.R.runs === 1 && after.R.cleared === 0, `${tag}: YES starts over and counts 1 run played`);

    const over = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    check(over, `${tag}: no sideways scrolling`);
    check(!errs.length, `${tag}: no console errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'game boy style passed');
  process.exit(fails ? 1 : 0);
})();
