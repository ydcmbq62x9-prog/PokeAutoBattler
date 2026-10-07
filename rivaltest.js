/* The rival (v30): three hidden ambushes, a persistent counter-team, the
   stakes, the Champion payoff, and the screens that show it. */
const { chromium } = require('playwright');
const E = require('./engine.js');
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };
const plan = E.runPlan();

/* schedule */
let fine = 0;
for(let s = 1; s < 400; s++){
  const G = E.newGame(s), st = E.rivalStages(G);
  const ok = st.length === 3 && st.every((x, i) => plan[x].kind === 'trainer' && x > 0
    && plan[x].badge >= E.TUNING.rival.windows[i][0] && plan[x].badge <= E.TUNING.rival.windows[i][1]);
  if(ok) fine++;
}
check(fine === 399, 'every run gets three ambushes, each on a trainer battle inside its window');
const G0 = E.newGame(12345);
check(JSON.stringify(E.rivalStages(G0)) === JSON.stringify(E.rivalStages(E.newGame(12345))), 'where he appears is fixed by the seed (a reload can’t move him)');
{ const G = E.newGame(12345); G.stage = E.rivalStages(G)[0]; G.team = [E.makeUnit('charmander', 0)];
  const n = E.nextUp(G);
  check(n.kind === 'trainer' && !n.boss, 'the next-up box still says "Trainer battle" — it’s a surprise'); }

/* team */
const meet = (seed, team, m, turn) => { const G = E.newGame(seed); E.rollShop(G, false);
  G.team = team.map(id => E.makeUnit(id, 0)); G.stage = E.rivalStages(G)[m]; G.turn = turn; return G; };
{ const cases = [['charmander','vulpix','abra','bulbasaur'], ['squirtle','poliwag','onix'], ['pikachu','voltorb','pidgey'], ['bulbasaur','oddish']];
  const want = ['squirtle', 'bulbasaur', 'rhyhorn', 'charmander'];
  const got = cases.map(t => { const G = meet(9, t, 0, 3); E.opponentFor(G); return G.rival.starter; });
  check(got.join() === want.join(), `his starter beats your party’s main type (Fire→Squirtle, Water→Bulbasaur, Electric→Rhyhorn, Grass→Charmander): ${got.join(', ')}`); }
{ const G = meet(77, ['charmander','vulpix'], 0, 3);
  const a = E.opponentFor(G); const core = G.rival.core.slice();
  G.team = ['squirtle','poliwag','staryu'].map(id => E.makeUnit(id, 0));        // you changed team…
  G.stage = E.rivalStages(G)[1]; G.turn = 14; const b = E.opponentFor(G);
  G.stage = E.rivalStages(G)[2]; G.turn = 26; const c = E.opponentFor(G);
  check(JSON.stringify(G.rival.core) === JSON.stringify(core), '…and he keeps that team all run, even if you change yours');
  check(a.team.length === 3 && b.team.length === 5 && c.team.length === 6, `his team grows: ${a.team.length} → ${b.team.length} → ${c.team.length}`);
  const starterNow = m => [a, b, c][m].team.map(u => u.id).find(id => E.evoLine(G.rival.starter).includes(id));
  check([0,1,2].map(starterNow).join() === E.evoLine(G.rival.starter).join(), `his starter evolves each time: ${[0,1,2].map(starterNow).join(' → ')}`);
  check(c.team.filter(u => u.held).length >= 2 && a.team.every(u => !u.held), 'he holds more items the later you meet');
  check(c.team.every(u => !u.held || E.HELD_ITEMS[u.held].kind !== 'economy'), 'and never a useless Amulet Coin or Lucky Egg');
  check([a, b, c].every(o => o.kind === 'rival' && o.name === 'Blue' && o.boss && o.boss.id === 'rival'), 'the fight is billed as your rival');
  const order = c.team.map(u => E.ROLE_ORDER[E.roleOf(u)]);
  check(order.every((x, i) => i === 0 || x >= order[i-1]), 'he lines up by role like everyone else'); }
{ // he keeps pace with YOU
  const weak = meet(5, ['charmander','pidgey','rattata'], 1, 14), strong = meet(5, ['charmander','pidgey','rattata'], 1, 14);
  weak.team.forEach(u => { u.hp += 250; u.atk += 250; u.spd += 100; });
  strong.team.forEach(u => { u.hp += 400; u.atk += 400; u.spd += 160; });
  const pw = G => E.teamPower(E.opponentFor(G).team);
  check(pw(strong) > pw(weak) * 1.3, `he is priced off your own team (${Math.round(pw(weak))} vs ${Math.round(pw(strong))})`); }

/* stakes */
{ const G = meet(31, ['charmander','abra'], 0, 4); G.credits = 0; const lives = G.lives, stage = G.stage;
  const opp = E.opponentFor(G), prize = E.rivalPrize(G, 0);
  E.applyBattleResult(G, 'win', opp, null);
  check(G.lives === lives && G.stage === stage + 1, 'beating him moves the run on');
  check(G.bag.includes(prize.item) && G.rival.beaten === 1, `and hands over a held item (${E.HELD_ITEMS[prize.item].name})`);
  const inc = E.incomeFor(G);
  check(inc.rival === prize.credits && inc.total >= inc.base + prize.credits, `+${prize.credits}₽ lands with next turn’s pay`);
  E.nextTurn(G); check(!G.rivalPay && E.incomeFor(G).rival === 0, '…once'); }
{ const G = meet(32, ['charmander','abra'], 0, 4); G.bag = ['band','claw','coat','lefto']; const opp = E.opponentFor(G);
  E.applyBattleResult(G, 'win', opp, null);
  check(G.bag.length === 4 && G.lastRival.sold > 0 && E.incomeFor(G).rival === E.TUNING.rival.winCredits[0] + G.lastRival.sold,
    'a full Bag gets the item’s worth in credits instead'); }
{ const G = meet(33, ['charmander','abra'], 0, 4); const lives = G.lives, stage = G.stage, opp = E.opponentFor(G);
  E.applyBattleResult(G, 'lose', opp, null);
  check(G.lives === lives - 1 && G.stage === stage + 1 && !G.blackout && !G.rivalPay, 'losing costs a life like a trainer, no blackout, no prize, and the run moves on'); }

/* the payoff */
{ const G = meet(40, ['charmander','vulpix'], 0, 3); E.opponentFor(G);
  G.stage = plan.length - 1; G.turn = 33; G.badges = 8;
  const champ = E.opponentFor(G).team.map(u => u.id);
  check(champ.includes('blastoise'), `Champion Blue fields the final form of his starter (${champ.join(', ')})`);
  const H = E.newGame(40); H.stage = plan.length - 1; H.turn = 33; H.badges = 8; E.opponentFor(H);
  check(!H.rival, 'the Champion never invents a rival you haven’t met'); }

/* the difficulty claim */
{ const B = require('./botlib.js'); const met = [0,0,0], won = [0,0,0];
  for(let r = 0; r < 120; r++){ const G = E.newGame(r * 7 + 1); E.rollShop(G, false); let g = 0;
    while(!G.over && g++ < 220){ B.shop(G, {}); const { sim, opp } = B.fight(G);
      if(opp.kind === 'rival'){ met[opp.meeting]++; if(sim.result === 'win') won[opp.meeting]++; }
      if(G.over) break; E.nextTurn(G); } }
  const pct = won.map((w, i) => Math.round(w / Math.max(1, met[i]) * 100));
  check(pct.every(p => p >= 60 && p <= 98), `a focused player usually beats him, but not always (${pct.join('/')}%)`); }

/* UI */
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1200, 1000], [390, 844]]){
    const page = await (await browser.newContext({ viewport:{ width:w, height:h } })).newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await page.waitForTimeout(250);
    await page.evaluate(() => { G.pendingRewards = []; G.team = ['charizard','blastoise','venusaur','pidgeot','alakazam','snorlax'].map(i => makeUnit(i, 0));
      G.team.forEach(u => { u.hp += 200; u.atk += 200; u.spd += 80; });
      G.stage = rivalStages(G)[0]; G.turn = 3; G.bag = []; rollShop(G, false); save(); render(); });
    await page.waitForTimeout(150);
    const nu = await page.evaluate(() => (document.querySelector('.nextup') || {}).textContent || '');
    check(/Trainer battle/.test(nu), `${w}px: before the fight it looks like any trainer battle`);
    await page.click('[data-act="endturn"]'); await page.waitForTimeout(300);
    const tag = await page.$eval('.bosstag', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    check(/rival · ambush 1 of 3/i.test(tag), `${w}px: the ambush is announced: "${tag}"`);
    const art = await page.$$eval('.bosstag .bossart img', e => e.length);
    check(art === 1, `${w}px: with his portrait`);
    const log = await page.$eval('#blog', e => e.textContent);
    check(/Blue: “Hey! Wait up!/.test(log), `${w}px: he says hello in the battle log`);
    await page.click('[data-act="skip"]'); await page.waitForTimeout(200);
    const res = await page.evaluate(() => ({ big: (document.querySelector('.big') || {}).textContent, note: (document.querySelector('.rivalwin') || {}).textContent || '' }));
    check(/Rival beaten/.test(res.big) && /next turn/.test(res.note), `${w}px: the win screen shows the prize: "${res.note.replace(/\s+/g,' ').trim().slice(0, 90)}"`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(sw, `${w}px: no sideways scrolling`);
    await page.click('[data-act="afterbattle"]'); await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({ bag: G.bag.length, pay: G.income && G.income.rival, lr: G.lastRival && G.lastRival.result }));
    check(after.bag === 1 && after.pay > 0 && after.lr === 'win', `${w}px: after Continue the item is in the Bag and the pay included +${after.pay}₽`);
    await page.close();
  }
  await browser.close();
  if(errors.length){ console.log('\n' + errors.length + ' FAILURES:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
  console.log('\nrival passed');
})();
