/* v34: free placement in the party and the PC. */
const { chromium } = require('playwright');
const E = require('./engine.js');
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };
const mk = (id, pos) => { const u = E.makeUnit(id, 2); E.growUnit(u, { hp:48, atk:48, spd:24 }); if(pos != null) u.pos = pos; return u; };
const lines = r => r.steps.flatMap(s => s.lines);

/* engine: where you stand is what counts */
{ const a = mk('onix', 1), b = mk('abra', 4), c = mk('pikachu', 5);           // front-right, back-left, back-right
  const r = E.simulateBattle([a, b, c], [mk('machamp'), mk('golem')], 3), L = lines(r);
  const hitsOnBack = L.filter(l => /^(Abra|Pikachu|Kadabra|Raichu) took/.test(l));
  const onixDown = L.findIndex(l => /^Onix fainted/.test(l));
  const firstBackHit = L.findIndex(l => /^(Abra|Pikachu) took/.test(l));
  const onixHits = L.filter(l => /^Onix took/.test(l)).length;
  const frontHitsOnBack = L.slice(0, onixDown < 0 ? L.length : onixDown).filter((l, i, arr) => /^(Abra|Pikachu) took/.test(l)
    && /used (Karate Chop|Seismic Toss|Submission|Rock Throw|Rock Slide|Earthquake)!/.test(arr[i - 1] || '')).length;
  check(onixHits >= 1 && frontHitsOnBack === 0, `a lone pokémon in the front rank takes every front-line hit (${onixHits}) until it falls`);
  check(r.steps[0].p.map(u => u.pos).join() === '1,4,5', 'the replay knows where everyone stands (1, 4, 5)'); }
{ // Covering Fire needs the Cannon BEHIND a Tank/Bruiser rank — by placement, gaps and all
  const dmg = team => { const t = mk('snorlax'); t.hp = 5000; t.spd = 1;
    const L = lines(E.simulateBattle(team, [t], 4)); const l = L.find(x => /^Snorlax took/.test(x)); return +l.match(/took (\d+)/)[1]; };
  const cannonFront = mk('charmander', 0); cannonFront.spd = 900;
  const cannonBack  = mk('charmander', 5); cannonBack.spd = 900;
  const tank = mk('onix', 1);
  const alone = dmg([cannonFront]), covered = dmg([tank, cannonBack]);
  check(covered > alone * 1.2, `a Cannon placed in the back behind a Tank gets Covering Fire (${alone} → ${covered})`); }
{ const G = E.newGame(5); E.rollShop(G, false); G.credits = 50;
  const r = E.buyPokemon(G, 0, G.team.length, 4);
  check(r.ok && G.team[0].pos === 4, 'buying into an empty back cell puts it there, front left empty');
  E.buyPokemon(G, 1, G.team.length);
  check(G.team.map(u => u.pos).join() === '0,4', '…and a buy with no cell picked takes the first free one (front first)');
  E.placeUnit(G, E.teamIdx(G, 4), 2);
  check(G.team.map(u => u.pos).join() === '0,2', 'moving to an empty cell just moves it');
  const a = E.teamAt(G, 0).id, b = E.teamAt(G, 2).id;
  E.placeUnit(G, E.teamIdx(G, 0), 2);
  check(E.teamAt(G, 0).id === b && E.teamAt(G, 2).id === a, 'dropping onto another pokémon swaps them');
  E.lineUpByRole(G);
  check(G.team.map(u => u.pos).join() === '0,1', 'Line up by role packs the party front-first');
  // PC boxes
  E.partyToPc(G, 0, 6);
  check(G.pc[0].box === 6, 'storing into a chosen box puts it there');
  E.buyToPc(G, 2);
  check(G.pc.map(u => u.box).join() === '0,6', '…and a buy with no box picked takes the first free one');
  E.placeInBox(G, E.pcIdx(G, 0), 6);
  check(E.pcAt(G, 6) && E.pcAt(G, 0) && G.pc.length === 2, 'two stored pokémon swap boxes');
  // team codes remember placement
  G.team[0].pos = 5; E.fixSlots(G);
  const back = E.importTeam(E.exportTeam(G.team, 'T'));
  check(back && back.team && back.team[0].pos === 5, 'a team code remembers where each pokémon stood'); }
{ // old saves / bare units get slots in list order
  const G = E.newGame(6); G.team = [E.makeUnit('abra', 0), E.makeUnit('onix', 0)]; G.pc = [E.makeUnit('pidgey', 0)];
  E.fixSlots(G);
  check(G.team.map(u => u.pos).join() === '0,1' && G.pc[0].box === 0, 'pokémon from before v34 stand where they were listed'); }

/* v35: every species is whole (a stray comment once blanked Chansey's stats) */
{ const bad = Object.keys(E.SPECIES).filter(k => { const x = E.SPECIES[k];
    return !(x.hp > 0 && x.atk > 0 && x.spd > 0) || !E.ROLES[x.role]; });
  check(!bad.length, `every species has real HP / Attack / Speed and a role${bad.length ? ': ' + bad.join(', ') : ''}`);
  check(E.roleOf('chansey') === 'tank' && /heals/.test(E.SPECIES.chansey.move.text(1)) && /barrier/.test(E.SPECIES.chansey.move2.text(1)),
    'Chansey is a Tank that still heals and shields'); }
/* v35: Daycare → a stored twin combines in the PC, whatever the levels */
{ const G = E.newGame(8); E.rollShop(G, false); G.credits = 50;
  const id = G.daycare[0].unit.id;
  const stored = E.makeUnit(id, E.TUNING.expForLevel2); stored.box = 3; G.pc = [stored]; E.fixSlots(G);
  const r = E.buyToPc(G, 0, 3);
  check(r.ok && r.merged && G.pc.length === 1 && G.pc[0].exp === E.TUNING.expForLevel2 + 1, `a Daycare ${id} dropped on a level-2 one in the PC combines with it`);
  const G2 = E.newGame(8); E.rollShop(G2, false); G2.credits = 50;
  const top = E.makeUnit(G2.daycare[0].unit.id, E.TUNING.expForLevel3); top.box = 0; G2.pc = [top]; E.fixSlots(G2);
  const r2 = E.buyToPc(G2, 0, 0);
  check(!r2.ok && /level 3/.test(r2.why) && G2.credits === 50, '…but not onto one already at level 3 (and nothing is charged)'); }

/* UI */
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1200, 1000], [390, 844]]){
    const page = await (await browser.newContext({ viewport:{ width:w, height:h } })).newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await page.waitForTimeout(250);
    await page.evaluate(() => { G.pendingRewards = []; G.credits = 40; G.team = []; G.pc = []; rollShop(G, false); save(); render(); });
    await page.waitForTimeout(150);
    const nums = await page.$$eval('.formation .slot.empty', els => els.map(e => getComputedStyle(e, '::after').content).filter(c => c && c !== 'none' && c !== 'normal' && c !== '""'));
    check(nums.length === 0, `${w}px: empty party cells show no 1-6 numbers`);
    // daycare → back cell (pos 5)
    await page.click('.drow[data-act="dc"][data-i="0"]'); await page.waitForTimeout(100);
    await page.click('[data-act="team"][data-i="5"]'); await page.waitForTimeout(150);
    let pos = await page.evaluate(() => G.team.map(u => u.pos).join());
    check(pos === '5', `${w}px: a Daycare buy dropped on a back cell stands there (${pos})`);
    // move it to the middle
    await page.click('[data-act="team"][data-i="5"]'); await page.waitForTimeout(100);
    await page.click('[data-act="team"][data-i="3"]'); await page.waitForTimeout(150);
    pos = await page.evaluate(() => G.team.map(u => u.pos).join());
    check(pos === '3', `${w}px: tap it, tap any empty cell — it moves (${pos})`);
    // store it in box 7, then move it to box 2
    await page.click('[data-act="team"][data-i="3"]'); await page.waitForTimeout(100);
    await page.click('[data-act="pc"][data-i="7"]'); await page.waitForTimeout(150);
    let box = await page.evaluate(() => G.pc.map(u => u.box).join());
    check(box === '7', `${w}px: a party pokémon dropped on PC box 8 goes there (${box})`);
    await page.click('[data-act="pc"][data-i="7"]'); await page.waitForTimeout(100);
    await page.click('[data-act="pc"][data-i="2"]'); await page.waitForTimeout(150);
    box = await page.evaluate(() => G.pc.map(u => u.box).join());
    check(box === '2', `${w}px: tap a stored pokémon, tap any box — it moves (${box})`);
    await page.reload(); await page.waitForTimeout(300);
    box = await page.evaluate(() => G.pc.map(u => u.box).join());
    check(box === '2', `${w}px: the PC layout survives a reload`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(sw, `${w}px: no sideways scrolling`);
    // Daycare → stored twin in the PC
    await page.evaluate(() => { G.credits = 40; rollShop(G, false); const id = G.daycare[0].unit.id; const t = makeUnit(id, 0); t.box = 5; G.pc = [t]; save(); render(); });
    await page.waitForTimeout(120);
    await page.click('.drow[data-act="dc"][data-i="0"]'); await page.waitForTimeout(100);
    const lit = await page.$('[data-act="pc"][data-i="5"].mergeable');
    await page.click('[data-act="pc"][data-i="5"]'); await page.waitForTimeout(150);
    const pcNow = await page.evaluate(() => G.pc.map(u => u.box + ':' + u.exp).join());
    check(!!lit && pcNow === '5:1', `${w}px: the stored twin lights up, and tapping it combines the Daycare copy into it (${pcNow})`);
    await page.close();
  }
  { // v43: on a phone a tap selects and the message box is the one summary — no pop-up, no ⓘ
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await page.waitForTimeout(250);
    await page.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); G.pendingRewards = []; G.team = [makeUnit('onix', 0)]; G.pc = []; save(); render(); });
    await page.waitForTimeout(150);
    await page.tap('[data-act="team"][data-i="0"]'); await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ sel: sel && sel.kind === 'team', name: (document.querySelector('#inspect .popname') || {}).textContent || '',
      popup: !!document.querySelector('.popup:not([hidden])'), info: !!document.querySelector('[data-act="info"]') }));
    check(st.sel && st.name === 'Onix', 'phone: one tap selects the pokémon and its summary is in the message box');
    check(!st.popup && !st.info, 'phone: no pop-up card and no ⓘ button');
    await page.tap('[data-act="team"][data-i="0"]'); await page.waitForTimeout(80);
    await page.tap('[data-act="team"][data-i="0"]'); await page.waitForTimeout(250);
    check(!(await page.$('.popup:not([hidden])')), 'phone: a double tap does not open a second summary');
    await ctx.close();
  }
  await browser.close();
  if(errors.length){ console.log('\n' + errors.length + ' FAILURES:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
  console.log('\nslots passed');
})();
