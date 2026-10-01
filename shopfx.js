/* ===================================================================
   v36 · SHOP POLISH
   The shop is redrawn on every tap, so it can't animate by itself. After each
   draw this compares what is on screen now with the last draw and gives the
   differences a moment: a new pokémon lands with a pokéball flash, a level-up
   or evolution glows and says so, money ticks, and a fresh Daycare or Mart
   deals its cards in. A tap that changes nothing animates nothing.
   =================================================================== */
let shopMem = null;
function shopFloat(el, text, cls){
  if(!el) return;
  const r = el.getBoundingClientRect();
  const e = document.createElement('div');
  e.className = 'sfloat ' + (cls || '');
  e.textContent = text;
  e.style.left = (r.left + r.width / 2 + window.scrollX) + 'px';
  e.style.top = (r.top + window.scrollY + Math.min(18, r.height * 0.25)) + 'px';
  document.body.appendChild(e);
  const still = motionOff();
  anim(e, still ? [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { opacity: 0 }]
    : [{ opacity: 0, transform: 'translate(-50%,0) scale(.7)' }, { opacity: 1, transform: 'translate(-50%,-14px) scale(1.1)', offset: .2 },
       { opacity: 1, transform: 'translate(-50%,-26px) scale(1)', offset: .7 }, { opacity: 0, transform: 'translate(-50%,-40px)' }],
    { duration: 1300, easing: 'ease-out', remove: true });
}
function shopFx(){
  if(!G || phase !== 'shop') return;
  const rec = u => ({ id: u.id, lvl: unitLevel(u), exp: u.exp || 0 });
  const now = {
    seed: G.seed, credits: G.credits,
    mon: new Map([...G.team, ...G.pc].map(u => [u.uid, rec(u)])),
    dc: G.daycare.map(s => s && s.unit ? s.unit.uid : '-').join(','),
    mart: G.mart.map(m => m.id).join(','),
  };
  const was = shopMem;
  shopMem = now;
  if(!was || was.seed !== now.seed) return;          // first draw of a run: nothing to celebrate
  const cardOf = u => Number.isInteger(u.box) && G.pc.includes(u)
    ? document.querySelector(`.cell[data-act="pc"][data-i="${u.box}"]`)
    : document.querySelector(`.slot[data-act="team"][data-i="${u.pos}"] .unit`);
  for(const u of [...G.team, ...G.pc]){
    const w = was.mon.get(u.uid), el = cardOf(u);
    if(!el) continue;
    const n = rec(u);
    if(!w){ el.classList.add('fx-land'); continue; }
    if(n.id !== w.id){ el.classList.add('fx-evo'); shopFloat(el, `${SPECIES[u.id].name}!`, 'evo'); }
    else if(n.lvl > w.lvl){ el.classList.add('fx-lvl'); shopFloat(el, `Level ${n.lvl}!`, 'lvl'); }
    else if(n.exp > w.exp){ el.classList.add('fx-exp'); shopFloat(el, '+EXP', 'exp'); }
  }
  const dc = now.credits - was.credits;
  if(dc){
    const c = document.querySelector('.stat.credits');
    if(c){ c.classList.add(dc > 0 ? 'fx-gain' : 'fx-spend'); shopFloat(c, `${dc > 0 ? '+' : '−'}${Math.abs(dc)}₽`, dc > 0 ? 'gain' : 'spend'); }
  }
  // a new Daycare / Mart stock deals itself in, card by card
  if(now.dc !== was.dc) document.querySelectorAll('.dclist .drow').forEach((e, k) => {
    e.classList.add('fx-deal'); e.style.animationDelay = (k * 55) + 'ms'; });
  if(now.mart !== was.mart) document.querySelectorAll('.martlist .martrow:not(.fixed)').forEach((e, k) => {
    e.classList.add('fx-deal'); e.style.animationDelay = (k * 55) + 'ms'; });
}

