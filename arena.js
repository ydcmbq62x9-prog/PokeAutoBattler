/* ===================================================================
   v36 · THE ARENA
   The fight is drawn as a field instead of two grids of cards: every pokémon
   stands where its slot puts it — yours on the left facing right, theirs on
   the right — with a small HP bar over its head. The field is built ONCE per
   battle and kept between renders (renderBattle leaves an empty #stageslot
   and the field is moved into it), so an attack can travel across it rather
   than the whole screen being redrawn every step.

   Each step is read as a diff against the one before: who acted, whose HP
   moved and by how much, who picked up a status or a barrier, who fainted.
   That is all the engine already records, so the animation can never show
   something the fight didn't do.
   =================================================================== */
const motionOff = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ARENA_X = { p:[38, 24, 10], e:[62, 76, 90] };   // by rank: front, middle, back (% across)
const ARENA_Y = [60, 87];                              // the two files, where the feet are (% down)
// how each card type's attacks look in flight
const FX_OF = { Fire:'fire', Water:'water', Lightning:'elec', Grass:'grass', Psychic:'psy', Fighting:'fight', Colorless:'slash' };
// a gym's floor takes the colour of its speciality (Gen 1 type names)
const GEN1_COL = { Rock:'#b8a038', Ground:'#d8b460', Water:'#5a8ff0', Electric:'#f0c830', Grass:'#62b85a',
  Poison:'#a45ab8', Psychic:'#f06090', Fire:'#f07830', Ice:'#88d0e0', Fighting:'#c04830', Ghost:'#6a5a9a', Dragon:'#7050e8' };
const ST_WORD = { brn:'Burned!', psn:'Poisoned!', par:'Paralysed!', slp:'Asleep!', cnf:'Confused!', fln:'Flinched!' };

const backdropOf = b => b.kind === 'gym' ? 'gym' : (b.kind === 'elite' || b.kind === 'champion') ? 'league'
  : b.kind === 'rival' ? 'dusk' : 'route';

function fighterHtml(u){
  const art = SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}" draggable="false">`
    : `<span class="fletters" style="--tcol:${typeColor(u.id)}">${esc(u.nm.slice(0, 2))}</span>`;
  return `<div class="fmove">
      <div class="fhead"><span class="fname">${esc(u.nm)}${u.lvl > 1 ? ` <i>L${u.lvl}</i>` : ''}</span>
        <div class="fhp"><i></i></div><div class="fchips"></div></div>
      <div class="fbody"><div class="fart">${art}</div><div class="fbarrier"></div></div>
    </div><div class="fshadow"></div>`;
}

function buildStage(){
  const b = battle, st0 = b.steps[0] || { p:[], e:[] };
  const el = document.createElement('div');
  el.className = `stage bg-${backdropOf(b)}`;
  const theme = b.boss && b.boss.theme && b.boss.theme[0];
  if(theme && GEN1_COL[theme]) el.style.setProperty('--gymc', GEN1_COL[theme]);
  el.innerHTML = `<div class="ground"></div><div class="midline"></div>
    ${['p', 'e'].map(s => RANKS.map((r, k) =>
      `<span class="rklbl" style="left:${ARENA_X[s][k]}%">${esc(r)}</span>`).join('')).join('')}
    <div class="fxl"></div>`;
  const S = { el, fx: el.querySelector('.fxl'), f: new Map(), at: 0, gen: 0 };
  for(const side of ['p', 'e']) (st0[side] || []).forEach((u, i) => addFighter(S, u, side, i));
  markActing(S, st0);
  return S;
}
function addFighter(S, u, side, i){
  const pos = Number.isInteger(u.pos) ? u.pos : i;
  const rank = Math.min(2, Math.floor(pos / RANK_W)), file = pos % RANK_W;
  const d = document.createElement('div');
  d.className = `ftr ${side}`;
  d.style.left = ARENA_X[side][rank] + '%';
  d.style.top = ARENA_Y[file] + '%';
  d.style.zIndex = String(2 + file);
  d.innerHTML = fighterHtml(u);
  S.el.insertBefore(d, S.fx);
  const F = { el: d, side, uid: u.uid, nm: u.nm, id: u.id, hp: u.hp, maxHp: u.maxHp,
              st: null, shield: 0, atk: u.atk, spd: u.spd, down: false };
  S.f.set(side + ':' + u.uid, F);
  paintFighter(F, u, false);
  return F;
}
/** Bring a fighter's bar, chips, barrier and sprite up to a snapshot. */
function paintFighter(F, u, pop){
  const frac = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
  const bar = F.el.querySelector('.fhp i');
  bar.style.width = (frac * 100).toFixed(1) + '%';
  bar.className = frac > 0.5 ? '' : frac > 0.22 ? 'mid' : 'low';
  if(u.id !== F.id){
    F.id = u.id;
    const img = F.el.querySelector('.fart img');
    if(img && SPRITES[u.id]) img.src = SPRITES[u.id];
  }
  if(u.st !== F.st || (u.shield || 0) !== F.shield){
    const S0 = u.st && TUNING.status[u.st];
    F.el.querySelector('.fchips').innerHTML =
      (S0 ? `<span class="fchip st-${u.st} ${pop && u.st !== F.st ? 'new' : ''}" title="${esc(S0.name)}">${S0.icon}<b>${S0.short}</b></span>` : '')
      + (u.shield > 0 ? `<span class="fchip sh ${pop && !F.shield ? 'new' : ''}" title="Barrier: soaks the next ${u.shield} damage">🛡️${u.shield}</span>` : '');
  }
  F.el.querySelector('.fbarrier').classList.toggle('on', u.shield > 0);
  Object.assign(F, { hp: u.hp, maxHp: u.maxHp, st: u.st, shield: u.shield || 0, atk: u.atk, spd: u.spd });
}
const snapMap = st => { const m = new Map();
  for(const s of ['p', 'e']) for(const u of (st && st[s]) || []) m.set(s + ':' + u.uid, u);
  return m; };
function actorKey(st){
  if(st.actor == null) return null;
  const a = (st.fx || []).find(x => x.kind === 'act' && x.uid === st.actor);
  if(a && a.side) return a.side + ':' + st.actor;
  for(const s of ['p', 'e']) if((st[s] || []).some(u => u.uid === st.actor)) return s + ':' + st.actor;
  return null;
}
function markActing(S, st){
  const k = actorKey(st);
  for(const [key, F] of S.f) F.el.classList.toggle('acting', key === k && !F.down);
}

/** Jump straight to step i — after a skip, or when a render lands mid-fight. */
function syncStage(S, i){
  const st = battle.steps[i];
  if(!st) return;
  S.gen++;                                   // anything still scheduled belongs to a stale step
  S.el.getAnimations({ subtree: true }).forEach(a => a.cancel());
  S.fx.innerHTML = '';
  S.el.querySelectorAll('.introban').forEach(e => e.remove());
  const live = snapMap(st);
  for(const [k, F] of S.f){
    const u = live.get(k);
    if(u){ F.down = false; F.el.classList.remove('down'); paintFighter(F, u, false); }
    else { F.down = true; F.el.classList.add('down'); }
  }
  markActing(S, st);
  S.at = i;
}

/* Put the kept field into the page the render just drew, and bring it up to
   date: animated if it is exactly one step behind, snapped otherwise. */
function mountStage(){
  const slot = document.getElementById('stageslot');
  if(!slot || !battle) return;
  if(!battle.stage) battle.stage = buildStage();
  const S = battle.stage;
  if(S.el.parentNode !== slot) slot.appendChild(S.el);
  if(S.at === battle.i - 1) animateStep(S, battle.i);
  else if(S.at !== battle.i) syncStage(S, battle.i);
  if(battle.i >= battle.steps.length - 1 && !battle.outroPlayed){
    battle.outroPlayed = true;
    setTimeout(() => stageOutro(S), motionOff() ? 0 : 450);
  }
}

/* ---------------- the little effects ---------------- */
function artCentre(S, F){
  const a = F.el.querySelector('.fart').getBoundingClientRect(), r = S.el.getBoundingClientRect();
  return { x: a.left - r.left + a.width / 2, y: a.top - r.top + a.height / 2, w: a.width };
}
function fxEl(S, cls, x, y, html){
  const e = document.createElement('div');
  e.className = 'fx ' + cls;
  e.style.left = x + 'px'; e.style.top = y + 'px';
  if(html) e.innerHTML = html;
  S.fx.appendChild(e);
  return e;
}
const anim = (el, frames, opts) => {
  const a = el.animate(frames, opts);
  if(opts && opts.remove) a.finished.then(() => el.remove(), () => el.remove());
  return a;
};
/** A number or word that rises off a pokémon and fades. */
function floatText(S, F, text, cls, lift){
  const c = artCentre(S, F);
  const e = fxEl(S, 'num ' + (cls || ''), c.x, c.y - c.w * 0.35 - (lift || 0), esc(text));
  const still = motionOff();
  anim(e, still ? [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { opacity: 0 }]
    : [{ opacity: 0, transform: 'translate(-50%,-30%) scale(.6)' },
       { opacity: 1, transform: 'translate(-50%,-85%) scale(1.15)', offset: .18 },
       { opacity: 1, transform: 'translate(-50%,-125%) scale(1)', offset: .7 },
       { opacity: 0, transform: 'translate(-50%,-175%) scale(1)' }],
    { duration: still ? 900 : 1050, easing: 'ease-out', remove: true });
}
/** A few of a status icon drifting up — flames, bubbles, Zs. */
function puff(S, F, glyph, n){
  if(motionOff()) return;
  const c = artCentre(S, F);
  for(let k = 0; k < (n || 3); k++){
    const e = fxEl(S, 'puff', c.x + (k - 1) * c.w * 0.28, c.y, esc(glyph));
    anim(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' },
             { opacity: 1, offset: .3 },
             { opacity: 0, transform: `translate(calc(-50% + ${(k - 1) * 6}px), calc(-50% - ${26 + k * 8}px)) scale(1.2)` }],
      { duration: 760, delay: k * 110, easing: 'ease-out', fill: 'backwards', remove: true });
  }
}
function flash(F, big, colour){
  if(motionOff()) return;
  const art = F.el.querySelector('.fart');
  anim(art, [{ filter: 'none' }, { filter: `brightness(2.6) ${colour ? `drop-shadow(0 0 6px ${colour})` : ''}` },
             { filter: 'none' }, { filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 340 });
  const dx = (F.side === 'p' ? -1 : 1) * (big ? 7 : 4);
  anim(art, [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` },
             { transform: `translateX(${-dx / 2}px)` }, { transform: 'translateX(0)' }], { duration: 280, composite: 'add' });
}
function glow(F, colour){
  if(motionOff()) return;
  anim(F.el.querySelector('.fart'), [{ filter: 'none' }, { filter: `drop-shadow(0 0 8px ${colour}) brightness(1.3)` }, { filter: 'none' }],
    { duration: 520 });
}
function lunge(F, towardsFoe, dur){
  if(motionOff()) return;
  const dir = F.side === 'p' ? 1 : -1;
  const mv = F.el.querySelector('.fmove');
  anim(mv, towardsFoe
    ? [{ transform: 'translate(0,0)' }, { transform: `translate(${dir * 18}px,-6px)`, offset: .45 }, { transform: 'translate(0,0)' }]
    : [{ transform: 'translate(0,0)' }, { transform: 'translate(0,-10px)', offset: .4 }, { transform: 'translate(0,0)' }],
    { duration: dur, easing: 'ease-out' });
}
/** What an attack looks like on its way over. Resolves when it lands. */
function projectile(S, A, T, kind, dur){
  const a = artCentre(S, A), b = artCentre(S, T), col = typeColor(A.id);
  const dx = b.x - a.x, dy = b.y - a.y;
  if(kind === 'slash' || kind === 'fight'){
    const e = fxEl(S, kind === 'slash' ? 'slash' : 'punch', b.x, b.y);
    return anim(e, kind === 'slash'
      ? [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-70deg) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(30deg) scale(1.05)', offset: .6 },
         { opacity: 0, transform: 'translate(-50%,-50%) rotate(70deg) scale(1.15)' }]
      : [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.15)', offset: .55 },
         { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4)' }],
      { duration: dur, delay: dur * 0.2, easing: 'ease-out', fill: 'backwards', remove: true }).finished.catch(() => {});
  }
  if(kind === 'psy'){
    const rings = [0, 1, 2].map(k => {
      const e = fxEl(S, 'ring', b.x, b.y); e.style.setProperty('--c', col);
      return anim(e, [{ opacity: .95, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' }],
        { duration: dur * 0.8, delay: k * dur * 0.13, fill: 'backwards', remove: true }).finished.catch(() => {});
    });
    return Promise.all(rings);
  }
  const n = kind === 'elec' ? 1 : kind === 'grass' ? 3 : kind === 'water' ? 4 : 3;
  const shots = [];
  for(let k = 0; k < n; k++){
    const e = fxEl(S, 'shot ' + kind, a.x, a.y); e.style.setProperty('--c', col);
    const jig = kind === 'water' ? (k % 2 ? 7 : -7) : kind === 'grass' ? (k - 1) * 10 : 0;
    const frames = kind === 'elec'
      ? [0, .2, .4, .6, .8, 1].map((f, j) => ({ transform: `translate(calc(-50% + ${dx * f}px), calc(-50% + ${dy * f + (f > 0 && f < 1 ? (j % 2 ? -12 : 12) : 0)}px))` }))
      : [{ transform: 'translate(-50%,-50%) scale(.6) rotate(0deg)' },
         { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 + jig - 12}px)) scale(1) rotate(180deg)`, offset: .5 },
         { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1) rotate(360deg)` }];
    shots.push(anim(e, frames, { duration: dur, delay: k * dur * 0.14, easing: kind === 'elec' ? 'steps(5, end)' : 'ease-in',
      fill: 'both', remove: true }).finished.catch(() => {}));
  }
  return Promise.all(shots).then(() => {
    if(!T.el.isConnected) return;
    const e = fxEl(S, 'burst', b.x, b.y); e.style.setProperty('--c', col);
    anim(e, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4)' }],
      { duration: 300, remove: true });
  });
}
/** Support moves travel too: a soft sparkle from the user to whoever it helps. */
function boon(S, A, T, dur){
  const a = artCentre(S, A), b = artCentre(S, T);
  const e = fxEl(S, 'shot boon', a.x, a.y);
  return anim(e, [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: .4 },
                  { transform: `translate(calc(-50% + ${(b.x - a.x) / 2}px), calc(-50% + ${(b.y - a.y) / 2 - 22}px)) scale(1)`, opacity: 1, offset: .5 },
                  { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.8)`, opacity: .9 }],
    { duration: dur, easing: 'ease-in-out', fill: 'both', remove: true }).finished.catch(() => {});
}
function faintFx(S, F){
  const mv = F.el.querySelector('.fmove');
  F.down = true;
  F.el.classList.remove('acting');
  if(motionOff()){ F.el.classList.add('down'); return; }
  anim(mv, [{ transform: 'translate(0,0)', opacity: 1, filter: 'none' },
            { transform: 'translate(0,6px) scaleY(.92)', opacity: .9, filter: 'grayscale(1) brightness(1.6)', offset: .25 },
            { transform: 'translate(0,26px) scaleY(.15)', opacity: 0, filter: 'grayscale(1)' }],
    { duration: 620, easing: 'ease-in' }).finished.then(() => F.el.classList.add('down'), () => {});
}

/* ---------------- one step, animated ---------------- */
function animateStep(S, i){
  const st = battle.steps[i], prev = battle.steps[i - 1];
  if(!st || !prev){ syncStage(S, i); return; }
  S.at = i;
  const gen = S.gen;
  const beat = stepDelay();                       // how long this step is on screen
  const quick = beat < 300 || motionOff();        // at 4× there is only time for the numbers
  const was = snapMap(prev), now = snapMap(st);
  const fxBy = new Map();
  for(const x of st.fx || []){
    const k = (x.side || (now.has('p:' + x.uid) || was.has('p:' + x.uid) ? 'p' : 'e')) + ':' + x.uid;
    if(!fxBy.has(k)) fxBy.set(k, new Set());
    fxBy.get(k).add(x.kind);
  }
  const lines = st.lines || [];
  const ak = actorKey(st), A = ak ? S.f.get(ak) : null;
  markActing(S, st);

  // what happened to each pokémon on this step
  const ev = [];
  for(const [k, F] of S.f){
    if(F.down) continue;
    const w = was.get(k), n = now.get(k), kinds = fxBy.get(k) || new Set();
    if(!w && !n) continue;
    const fainted = !n || kinds.has('faint');
    const dhp = (n ? n.hp : 0) - (w ? w.hp : F.hp);
    const stNew = n && n.st && n.st !== (w && w.st) ? n.st : null;
    const shUp = n && (n.shield || 0) > ((w && w.shield) || 0);
    const dAtk = n && w ? n.atk - w.atk : 0, dSpd = n && w ? n.spd - w.spd : 0;
    const touched = fainted || dhp || stNew || shUp || dAtk || dSpd || kinds.has('hit') || kinds.has('crit') || kinds.has('buff');
    if(touched) ev.push({ k, F, n, w, kinds, fainted, dhp, stNew, shUp, dAtk, dSpd });
  }
  const foes = A ? ev.filter(e => e.F.side !== A.side && (e.dhp < 0 || e.fainted || e.stNew || e.kinds.has('hit') || e.kinds.has('crit'))) : [];
  const pals = A ? ev.filter(e => e.F !== A && e.F.side === A.side && (e.dhp > 0 || e.shUp || e.dAtk > 0 || e.dSpd > 0 || e.kinds.has('buff'))) : [];
  const selfBuff = A && ev.some(e => e.F === A && (e.dhp > 0 || e.shUp || e.dAtk > 0 || e.dSpd > 0));

  const lungeMs = Math.min(320, beat * 0.42);
  const flyMs = Math.min(300, beat * 0.4);
  const impactAt = quick ? 0 : Math.min(beat * 0.6, lungeMs * 0.45 + flyMs);

  if(A && !quick){
    if(foes.length) lunge(A, true, lungeMs);
    else if(pals.length || selfBuff) lunge(A, false, lungeMs);
    const kind = FX_OF[SPECIES[A.id] ? SPECIES[A.id].type : ''] || 'slash';
    setTimeout(() => {
      if(S.gen !== gen) return;
      foes.slice(0, 6).forEach(e => projectile(S, A, e.F, kind, flyMs));
      pals.slice(0, 6).forEach(e => boon(S, A, e.F, flyMs));
    }, lungeMs * 0.45);
  }
  // a pokémon that lost its turn says so
  if(A && lines.some(l => /is fast asleep/.test(l))) puff(S, A, 'z', 3);
  if(A && lines.some(l => /flinched and couldn't move/.test(l))) floatText(S, A, 'Flinched!', 'st-fln note');

  const land = () => {
    if(S.gen !== gen) return;
    let told = false;
    for(const e of ev){
      const F = e.F, nm = F.nm;
      if(e.n) paintFighter(F, e.n, true);
      else { const bar = F.el.querySelector('.fhp i'); bar.style.width = '0%'; bar.className = 'low'; }
      let lift = 0;
      const soak = lines.find(l => l.startsWith(nm + "'s barrier soaked"));
      if(e.dhp < 0){
        const se = e.kinds.has('crit'), weak = lines.some(l => l.startsWith(nm + ' took') && /not very effective/.test(l));
        const dot = !A && e.w && e.w.st && TUNING.status[e.w.st] && TUNING.status[e.w.st].dotPct;
        floatText(S, F, '−' + (-e.dhp), se ? 'se' : weak ? 'weak' : dot ? 'st-' + e.w.st : '');
        if(dot) puff(S, F, TUNING.status[e.w.st].icon, 2);
        else flash(F, se || e.fainted, se ? '#ffd166' : null);
        if(se && !told){ told = true; floatText(S, F, 'Super effective!', 'se note', 26); }
        lift = 22;
      } else if(e.dhp > 0){
        floatText(S, F, '+' + e.dhp, 'heal'); glow(F, '#5ad17a'); lift = 22;
      } else if(soak){
        flash(F, false, '#8ecbff');
      } else if(e.kinds.has('hit') && !e.stNew && !e.dAtk && !e.dSpd && F !== A){
        flash(F, false);
      }
      if(soak){ const m = soak.match(/soaked (\d+)/); if(m) floatText(S, F, '🛡️ ' + m[1], 'shield note', lift); lift += 20; }
      if(e.stNew){
        const S0 = TUNING.status[e.stNew];
        floatText(S, F, ST_WORD[e.stNew] || S0.name, 'st-' + e.stNew + ' note', lift); lift += 20;
        puff(S, F, e.stNew === 'slp' ? 'z' : S0.icon, 3);
        glow(F, { brn:'#ff7a2e', psn:'#b05ad0', par:'#ffd93a', slp:'#9fb1d6', cnf:'#ff9bd0', fln:'#ffffff' }[e.stNew] || '#fff');
      }
      if(e.shUp){ floatText(S, F, 'Barrier', 'shield note', lift); lift += 20; }
      if(e.dAtk) { floatText(S, F, e.dAtk > 0 ? 'ATK ▲' : 'ATK ▼', (e.dAtk > 0 ? 'up' : 'down') + ' note', lift); lift += 20; }
      if(e.dSpd) { floatText(S, F, e.dSpd > 0 ? 'SPD ▲' : 'SPD ▼', (e.dSpd > 0 ? 'up' : 'down') + ' note', lift); }
      if(e.fainted) setTimeout(() => { if(S.gen === gen) faintFx(S, F); }, quick ? 60 : 170);
    }
  };
  if(impactAt) setTimeout(land, impactAt); else land();
}

/* ---------------- intro and outro ---------------- */
/** "X wants to battle!" slides across, then both teams run in. Returns how long it takes. */
function playIntro(S){
  const b = battle, still = motionOff();
  const introMs = still ? 700 : Math.round(1500 / Math.max(1, speed * 0.75));
  const who = b.kind === 'gym' ? `${b.boss.name} wants to battle!`
    : b.kind === 'elite' ? `Elite Four ${b.boss.name} wants to battle!`
    : b.kind === 'champion' ? `Champion ${b.boss.name} wants to battle!`
    : b.kind === 'rival' ? `Your rival ${RIVAL.name} blocks the way!`
    : `${b.oppName} wants to battle!`;
  const sub = b.kind === 'gym' ? `${b.boss.title} · ${b.boss.badge} Badge`
    : b.kind === 'rival' ? 'An ambush!' : b.exhibition ? 'Exhibition match' : b.kind === 'trainer' ? 'Trainer battle' : b.boss ? b.boss.title : '';
  const n = (b.steps[0] && b.steps[0].e.length) || 0;
  const balls = Array.from({ length: TUNING.maxTeam }, (_, k) => `<i class="${k < n ? '' : 'out'}"></i>`).join('');
  const ban = document.createElement('div');
  ban.className = 'introban' + (b.kind !== 'trainer' && b.boss ? ' boss ' + b.kind : '');
  ban.innerHTML = `${bossArt(b.boss, 'intro')}<div><b>${esc(who)}</b><span>${esc(sub)}</span><div class="iballs">${balls}</div></div>`;
  S.el.appendChild(ban);
  if(still){ setTimeout(() => ban.remove(), introMs); return introMs; }
  const hold = introMs * 0.62;
  anim(ban, [{ transform: 'translate(-110%,-50%)', opacity: 0 }, { transform: 'translate(0,-50%)', opacity: 1, offset: .22 },
             { transform: 'translate(0,-50%)', opacity: 1, offset: .8 }, { transform: 'translate(110%,-50%)', opacity: 0 }],
    { duration: hold, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards', remove: true });
  let k = 0;
  for(const F of S.f.values()){
    const from = F.side === 'p' ? '-60vw' : '60vw';
    anim(F.el.querySelector('.fmove'), [{ transform: `translateX(${from})`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: introMs * 0.3, delay: hold * 0.55 + (k++ % 6) * introMs * 0.035, easing: 'cubic-bezier(.2,.9,.3,1.1)', fill: 'backwards' });
    anim(F.el.querySelector('.fshadow'), [{ opacity: 0 }, { opacity: 1 }], { duration: introMs * 0.3, delay: hold * 0.55, fill: 'backwards' });
  }
  return introMs;
}
function stageOutro(S){
  if(!battle || battle.stage !== S || motionOff()) return;
  const r = battle.result;
  if(r !== 'win' && r !== 'lose') return;
  const side = r === 'win' ? 'p' : 'e';
  let k = 0;
  for(const F of S.f.values()){
    if(F.down || F.side !== side) continue;
    anim(F.el.querySelector('.fmove'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: .25 },
      { transform: 'translateY(0)', offset: .5 }, { transform: 'translateY(-9px)', offset: .72 }, { transform: 'translateY(0)' }],
      { duration: 900, delay: k++ * 90, easing: 'ease-out' });
  }
}

/* ---------------- the chrome around the field, patched per step ---------- */
function patchBattleChrome(){
  const st = battle.steps[battle.i] || {};
  const q = document.getElementById('bqueue'); if(q) q.innerHTML = battleQueueHtml(st);
  const lg = $('#blog'); if(lg){ lg.innerHTML = battleLogHtml(); lg.scrollTop = lg.scrollHeight; }
  const n = document.querySelector('.shopbar .steps'); if(n) n.textContent = `${battle.i + 1}/${battle.steps.length}`;
  const am = document.querySelector('.ambush.pop'); if(am && battle.i >= 1) am.classList.remove('pop');
}

