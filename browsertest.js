const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx0 = null;
  const ctx = await browser.newContext({ viewport:{width:430,height:900}, deviceScaleFactor:2 });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));

  await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await page.waitForTimeout(300);

  const shot = async n => page.screenshot({ path:`shot-${n}.png` });

  // --- play 4 full turns automatically ---
  for(let turn=1; turn<=4; turn++){
    // buy everything affordable (re-query each time: the UI re-renders innerHTML)
    for(let i=0; i<5; i++){
      const card = await page.$(`[data-act="dc"][data-i="${i}"]:not(.locked):not(.out)`);
      if(!card) continue;
      await page.click(`[data-act="dc"][data-i="${i}"]`).catch(()=>{});
      await page.waitForTimeout(50);
      const tgt = await page.$('[data-act="team"].valid, [data-act="team"].mergeable');
      if(tgt){ const idx = await tgt.getAttribute('data-i'); await page.click(`[data-act="team"][data-i="${idx}"]`).catch(()=>{}); }
      else { await page.click('[data-act="cancel"]').catch(()=>{}); }
      await page.waitForTimeout(50);
    }
    // try an item
    const itemCard = await page.$('[data-act="mart"][data-i="0"]');
    if(itemCard){
      await page.click('[data-act="mart"][data-i="0"]').catch(()=>{});
      await page.waitForTimeout(50);
      const t = await page.$('[data-act="team"].valid');
      if(t){ const idx = await t.getAttribute('data-i'); await page.click(`[data-act="team"][data-i="${idx}"]`).catch(()=>{}); }
      else await page.click('[data-act="cancel"]').catch(()=>{});
    }
    await page.waitForTimeout(60);
    if(turn===1) await shot('1-shop');

    const teamCount = await page.$$eval('[data-act="team"] .unit', els => els.length);
    if(teamCount === 0) errors.push(`turn ${turn}: bought nothing`);

    await page.click('[data-act="cancel"]').catch(()=>{});
    await page.click('[data-act="endturn"]');
    await page.waitForTimeout(400);
    if(turn===1) await shot('2-battle');
    await page.click('[data-act="skip"]').catch(()=>{});
    await page.waitForTimeout(250);
    if(turn===1) await shot('3-result');
    const cont = await page.$('[data-act="afterbattle"]');
    if(!cont){ errors.push(`turn ${turn}: no continue button after battle`); break; }
    await cont.click();
    await page.waitForTimeout(250);
    // a won gym asks for a badge reward before anything else can be tapped
    const card = await page.$('.modal.reward .rcard');
    if(card){ await card.click(); await page.waitForTimeout(200); }
    const over = await page.$('[data-act="restart"]');
    if(over){ console.log('run ended at turn', turn); await shot('4-over'); break; }
  }

  // --- reorder + sell ---
  if(await page.$('[data-act="team"][data-i="1"] .unit')){
    await page.click('[data-act="team"][data-i="0"]').catch(()=>{}); await page.waitForTimeout(80);
    await page.click('[data-act="team"][data-i="1"]').catch(()=>{}); await page.waitForTimeout(80);
  }
  await shot('5-later-shop');

  console.log('… reached: battle items section');
  // --- battle items: party-wide, used from the action bar, mark the cards ---
  // (there is no target to tap any more: an X item boosts the whole party)
  if(await page.$('[data-act="team"][data-i="0"] .unit')){
    await page.evaluate(() => { G.credits = Math.max(G.credits, 10); save(); render(); });
    await page.click('[data-act="bitem"][data-i="0"]').catch(()=>{});
    await page.waitForTimeout(60);
    const before = await page.evaluate(()=>G.credits);
    await page.click('[data-act="usex"]').catch(()=>{});
    await page.waitForTimeout(60);
    await page.click('[data-act="usex"]').catch(()=>{});   // again: up to the per-battle cap
    await page.waitForTimeout(60);
    const after = await page.evaluate(()=>({c:G.credits, all:G.team.every(u => u.tmpAtk > 0)}));
    if(!after.all) errors.push('battle item did not boost the whole party');
    if(!(after.c < before)) errors.push('battle item was free');
    if(!(await page.$('.boosted'))) errors.push('boosted pokemon shows no marker');
    await page.click('[data-act="cancel"]').catch(()=>{});
  }
  await shot('9-bitem');

  // --- the formation grid: six slots, three ranks, two abreast ---
  const slots = await page.$$eval('[data-act="team"]', els => els.length);
  if(slots !== 6) errors.push('expected 6 party slots, got ' + slots);
  const grid = await page.evaluate(() => {
    const f = document.querySelector('.formation');
    if(!f) return null;
    const cols = getComputedStyle(f).gridTemplateColumns.split(' ').length;
    const idx = [...f.children].map(c => c.dataset.i);
    const heads = [...document.querySelectorAll('.rankhead span')].map(e => e.textContent);
    return { cols, idx, heads };
  });
  if(!grid) errors.push('no formation grid rendered');
  else {
    if(grid.cols !== 2) errors.push('formation should be 2 columns on a phone (5.0.0: ranks run top to bottom), got ' + grid.cols);
    if(grid.idx.join(',') !== '4,2,0,5,3,1')
      errors.push('formation slot order should be back/mid/front per row, got ' + grid.idx.join(','));
    if(grid.heads.join('/') !== 'Back/Middle/Front')
      errors.push('rank headers wrong: ' + grid.heads.join('/'));
  }
  // the three shelves from the sketch
  for(const sel of ['.wall', '.dclist', '.martlist'])
    if(!(await page.$(sel))) errors.push('missing shelf: ' + sel);
  const dcRows = await page.$$eval('.dclist .drow', e => e.length);
  if(dcRows !== 6) errors.push('daycare list should show 6 rows, got ' + dcRows);
  const scrolls = await page.evaluate(() => {
    const l = document.querySelector('.dclist');
    return getComputedStyle(l).overflowY;
  });
  if(!/auto|scroll/.test(scrolls)) errors.push('the daycare list should be scrollable, got ' + scrolls);

  console.log('… reached: PC section');
  // --- the PC: store, withdraw, and combine a banked copy ---
  const pcCells = await page.$$eval('.wall .cell', e => e.length);
  const pcWant = await page.evaluate(() => Math.max(pcCap(G), G.pc.length));   // grows with the Storage Box reward
  if(pcCells !== pcWant) errors.push(`PC should show ${pcWant} box cells, got ` + pcCells);
  // the box shows sprites only — no names, no stat text
  const boxText = await page.$$eval('.wall .cell', els =>
    els.map(e => e.textContent.replace(/[＋L\d\s]/g,'')).join(''));
  if(boxText.length) errors.push('the box should show sprites only, found text: ' + boxText);

  const pcFlow = await page.evaluate(() => {
    G.team = [makeUnit('charmander', 0)];
    G.pc = [];
    G.credits = 99;
    G.daycare[0] = { unit: makeUnit('charmander', 0), bought:false };
    render();
    return { start: G.pc.length };
  });
  if(pcFlow.start !== 0) errors.push('PC should start empty for this check');

  // tap the daycare pokemon, then an empty PC cell -> it should be stored
  await page.click('[data-act="dc"][data-i="0"]').catch(()=>{});
  await page.waitForTimeout(60);
  const pcValid = await page.$('.wall .cell.valid');
  if(!pcValid) errors.push('an empty PC slot should highlight when buying');
  await page.click('[data-act="pc"][data-i="0"]').catch(()=>{});
  await page.waitForTimeout(60);
  let stored = await page.evaluate(() => G.pc.length);
  if(stored !== 1) errors.push('buying into the PC did not store the pokemon, pc=' + stored);

  // the stored copy should flag that a party member can take it
  if(!(await page.$('.wall .cready'))) errors.push('no merge flag on a stored copy with a party twin');
  // picking one up should show the carry cursor and lift the source cell
  await page.click('[data-act="pc"][data-i="0"]').catch(()=>{});
  await page.waitForTimeout(80);
  const carrying = await page.evaluate(() => ({
    body: document.body.classList.contains('carrying'),
    chip: !!document.querySelector('.carry:not([hidden])'),
    lifted: !!document.querySelector('.wall .cell.lifted'),
    popup: !!document.querySelector('#inspect .isum')
  }));
  if(!carrying.body || !carrying.chip) errors.push('picking up should show the carry cursor: ' + JSON.stringify(carrying));
  if(!carrying.lifted) errors.push('the source cell should look lifted');
  if(!carrying.popup) errors.push('tapping should also show its summary in the message box');
  await page.click('[data-act="pc"][data-i="0"]').catch(()=>{});
  await page.waitForTimeout(80);
  if(await page.evaluate(() => document.body.classList.contains('carrying')))
    errors.push('tapping the held pokemon again should put it back down');

  // tap the stored copy, then the party member -> combine
  await page.click('[data-act="pc"][data-i="0"]').catch(()=>{});
  await page.waitForTimeout(60);
  if(!(await page.$('[data-act="team"].mergeable'))) errors.push('party twin should highlight as mergeable');
  await page.click('[data-act="team"][data-i="0"]').catch(()=>{});
  await page.waitForTimeout(60);
  const merged = await page.evaluate(() => ({ pc: G.pc.length, exp: G.team[0].exp, n: G.team.length }));
  if(merged.pc !== 0) errors.push('the combined copy should leave the PC');
  if(merged.exp !== 1) errors.push('combining from the PC should add exp, got ' + merged.exp);
  if(merged.n !== 1) errors.push('combining must not add a party slot');

  // store a party member from the contextual bar
  await page.click('[data-act="team"][data-i="0"]').catch(()=>{});
  await page.waitForTimeout(60);
  await page.click('[data-act="topc"]').catch(()=>{});
  await page.waitForTimeout(60);
  const dep = await page.evaluate(() => ({ pc: G.pc.length, team: G.team.length }));
  if(dep.pc !== 1 || dep.team !== 0) errors.push('Store in PC did not move the pokemon: ' + JSON.stringify(dep));
  await page.click('[data-act="cancel"]').catch(()=>{});
  await shot('10-pc');

  console.log('… reached: freeze/reserve section');
  // --- freezing is gone; the Mart reserves ---
  const labels = await page.evaluate(() => {
    const out = { dc:'', mart:'' };
    const dc = document.querySelector('[data-act="dc"]');
    if(dc){ dc.click(); out.dc = document.body.innerText; }
    const m = document.querySelector('[data-act="mart"]');
    if(m){ m.click(); out.mart = document.body.innerText; }
    return out;
  });
  if(/Freeze|Unfreeze/i.test(labels.dc)) errors.push('the Daycare still offers freezing');
  if(/Freeze|Unfreeze/i.test(labels.mart)) errors.push('the Mart still says Freeze');
  if(!/Reserve/i.test(labels.mart)) errors.push('the Mart should offer Reserve');
  await page.evaluate(() => { sel = null; render(); });

  console.log('… reached: evolution section');
  // --- evolution actually happens through the UI ---
  const evolved = await page.evaluate(() => {
    G.team = [makeUnit('charmander', 0)];
    G.credits = 99;
    G.daycare[0] = { unit: makeUnit('charmander',0), frozen:false, bought:false };
    buyPokemon(G, 0, 0);
    G.daycare[1] = { unit: makeUnit('charmander',0), frozen:false, bought:false };
    buyPokemon(G, 1, 0);
    render();
    return G.team[0].id;
  });
  if(evolved !== 'charmeleon') errors.push('three charmanders should make a charmeleon, got ' + evolved);

  console.log('… reached: team code section');
  // --- team code round trip in the real page ---
  const codeOk = await page.evaluate(() => {
    const code = exportTeam(G.team, 'BrowserTest');
    const back = importTeam(code);
    return !!(back && back.team.length === G.team.length && back.name === 'BrowserTest');
  });
  if(!codeOk) errors.push('team code round trip failed in browser');

  // --- exhibition battle vs own code ---
  await page.evaluate(() => {
    const parsed = importTeam(exportTeam(G.team,'Mirror'));
    const sim = simulateBattle(G.team, parsed.team, 99);
    battle = { steps:sim.steps, i:0, result:sim.result, oppName:parsed.name, timer:null, exhibition:true };
    phase='battle'; render(); finishPlayback();
  });
  await page.waitForTimeout(200);
  await shot('6-exhibition');
  const exhibBtn = await page.$('[data-act="afterbattle"]');
  if(!exhibBtn) errors.push('exhibition battle did not finish');
  else { await exhibBtn.click(); await page.waitForTimeout(150); }

  // --- menu + help modal render ---
  await page.click('[data-act="menu"]').catch(()=>{});
  await page.waitForTimeout(120);
  const helpBtn = await page.$('[data-m="help"]');
  if(helpBtn){ await helpBtn.click(); await page.waitForTimeout(200); await shot('7-help'); }
  else errors.push('menu did not open');

  // --- horizontal overflow check at phone width ---
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('.modal').forEach(m=>m.remove()));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if(overflow > 2) errors.push('horizontal overflow of ' + overflow + 'px at 430px wide');

  // --- desktop width ---
  await page.setViewportSize({width:900,height:820});
  await page.waitForTimeout(150);
  await shot('8-desktop');

  await browser.close();
  if(errors.length){ console.log('\nISSUES:'); [...new Set(errors)].forEach(e=>console.log(' - '+e)); process.exit(1); }
  console.log('\nbrowser test passed, no console errors');
})();
