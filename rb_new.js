function renderBattle(){
  const st = battle.steps[battle.i] || { p:[], e:[], fx:[], lines:[] };

  const done = battle.i >= battle.steps.length - 1;
  const r = battle.result;
  // a gym you have just beaten is a badge you already own, whatever G says
  const winningBadge = done && r === 'win' && battle.kind === 'gym';
  const shownBadges = G.badges + (winningBadge ? 1 : 0);
  const gn = battle.gauntlet;     // captured when the fight started
  const bossTag = battle.boss ? `<div class="bosstag ${battle.kind}">${bossArt(battle.boss, 'tag')}
      ${battle.kind === 'gym' ? `${esc(battle.boss.title)} · ${esc(battle.boss.badge)} Badge`
        : battle.kind === 'rival' ? `<span class="ambush ${battle.i < 1 ? 'pop' : ''}">!</span> Your rival · ambush ${battle.opp.meeting + 1} of ${TUNING.rival.windows.length}`
        : `${battle.kind === 'elite' ? 'Elite Four' : 'Champion'}${
          gn ? ` · fight ${gn.at + 1} of ${gn.members.length}` : ''}`}</div>` : '';
  // what winning or losing a gauntlet fight means, said on the result screen
  const next = gn && gn.members[gn.at + 1];
  const gnote = !done || !gn ? ''
    : r === 'win' && next ? `<p class="gnote">Next: <b>${esc(next.name)}</b>. The shops stay closed and nobody heals.</p>`
    : r === 'lose' ? `<p class="gnote">Back to <b>${esc(gn.members[0].name)}</b>. Everyone is healed, and the shops reopen.</p>`
    : '';
  const won = r === 'win';
  const rvl = battle.kind === 'rival' ? RIVAL_LINES[battle.opp.meeting] || RIVAL_LINES[0] : null;
  const pz = battle.prize;
  const rivalNote = !done || !rvl ? ''
    : won ? `<div class="award rivalwin">${bossArt(battle.boss, 'hero')}
        <div><b>You beat your rival!</b>
          <span>“${esc(rvl.lost)}”</span>
          <span class="prize">+${pz.credits}₽ next turn${pz.item ? ` · ${itemGlyph(pz.item, HELD_ITEMS[pz.item].icon)} ${esc(HELD_ITEMS[pz.item].name)}${
            battle.bagFull ? ` (Bag full — he pays its worth, +${heldResale(pz.item)}₽)` : ' in your Bag'}` : ''}</span></div></div>`
    : `<div class="award rivallose">${bossArt(battle.boss, 'hero')}
        <div><b>Your rival won.</b><span>“${esc(rvl.won)}”</span>
          <span class="dim">It costs a life like any trainer battle. He'll be back.</span></div></div>`;
  const award = winningBadge ? `<div class="award">
      ${bossArt(battle.boss, 'hero')}<i class="bdg on fresh big"></i>
      <div><b>${esc(battle.boss.badge)} Badge</b>
        <span>${esc(battle.boss.name)} of the ${esc(battle.boss.title)} hands it over.</span>
        <span class="dim">${shownBadges} of ${TUNING.badgesToWin}${
          shownBadges === TUNING.badgesToWin ? ' — the Elite Four are next.' : ''}</span>
        <span class="dim">Continue to choose your badge reward.</span></div>
    </div>` : '';
  /* v36: the result is a ribbon across the arena's sky, so the field stays in
     view underneath it — the winners get a little victory hop. It only slides
     in the first time; a re-render (a toast, a tap) just shows it. */
  const fresh = done && !battle.ribbonShown;
  if(done) battle.ribbonShown = true;
  const ribbon = done ? `<div class="big ribbon ${won ? 'win' : r === 'lose' ? 'lose' : 'draw'} ${fresh ? 'anim' : ''}"><span>
      ${won ? (battle.kind === 'gym' ? `${esc(battle.boss.badge).toUpperCase()} BADGE!`
              : battle.kind === 'champion' ? 'CHAMPION!'
              : battle.kind === 'elite' ? `${esc(battle.boss.name).toUpperCase()} FALLS`
              : battle.kind === 'rival' ? 'RIVAL BEATEN!' : 'VICTORY!')
        : r === 'lose' ? (battle.boss && battle.kind !== 'rival' ? 'BLACKED OUT' : 'DEFEAT') : 'DRAW'}</span></div>` : '';
  const notes = done ? `${award}${rivalNote}${gnote}` : '';

  return `
  <div class="topbar">
    <div class="stat"><span class="lbl">Turn</span>${G.turn}</div>
    <div class="stat"><span class="lbl">Lives</span>${'❤'.repeat(Math.max(0,G.lives))||'—'}</div>
    ${badgeCase(shownBadges, winningBadge ? G.badges : undefined)}
    ${streakChip()}
    <div class="spacer"></div>
    <div class="stat"><span class="lbl">VS</span>${esc(battle.oppName)}</div>
  </div>

  <div class="panel arena">
    ${bossTag}${notes}
    <div class="stagewrap"><div id="stageslot"></div>${ribbon}</div>
  </div>

  <div id="bqueue">${battleQueueHtml(st)}</div>
  <div id="blog">${battleLogHtml()}</div>

  <div class="shopbar">
    ${done
      ? `<button class="btn primary" data-act="afterbattle">${battle.exhibition ? 'Back to the Mart' : 'Continue ▶'}</button>`
      : `<div class="speed" role="group" aria-label="Playback speed">
           ${SPEEDS.map(v => `<button class="sp ${v === speed ? 'on' : ''}" data-act="speed" data-i="${v}"
             aria-pressed="${v === speed}">${v}×</button>`).join('')}
         </div>
         <span class="steps">${battle.i + 1}/${battle.steps.length}</span>
         <button class="btn" data-act="skip">Skip ⏩</button>`}
  </div>`;
}

/* The action meter is only fair if you can see it. Speed decides how often a
   pokémon acts, which is invisible in a log — so the queue is drawn: who
   moves next, and next after that, tinted by side. Three of their sprites in
   a row means three of their attacks land before you swing. */
function battleQueueHtml(st){
  const up = st.up;
  if(!up || !up.length) return '';
  const byUid = {};
  for(const u of st.p) byUid['p' + u.uid] = { u, side:'p' };
  for(const u of st.e) byUid['e' + u.uid] = { u, side:'e' };
  const cells = up.map((uid, n) => {
    const ent = byUid['p' + uid] || byUid['e' + uid];
    if(!ent) return '';
    const { u, side } = ent;
    return `<span class="qmon ${side} ${n === 0 ? 'now' : ''}" title="${esc(u.nm)}">
      ${SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}">`
                      : esc(u.nm.slice(0,2))}</span>`;
  }).filter(Boolean).join('');
  return cells ? `<div class="queue"><span class="qlbl">Next</span>${cells}</div>` : '';
}
function battleLogHtml(){
  return battle.steps.slice(0, battle.i + 1)
    .flatMap(s => s.lines || []).slice(-40)
    .map(t => `<div class="${/super effective/.test(t) ? 'eff' : /not very effective/.test(t) ? 'ineff'
      : /fainted/.test(t) ? 'ko' : /evolving/.test(t) ? 'evo'
      : ''}">${esc(t)}</div>`).join('');
}

