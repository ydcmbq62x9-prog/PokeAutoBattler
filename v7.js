module.exports = {
 gyarados: [
  {label:'base'},
  {label:'Hydro 2.8', set:(s,M)=>{ s.move = M.charge('Hydro Pump', 2.8, 'Bite', 1.1); }},
  {label:'hp50 atk56 spd58', set:(s)=>{ s.hp=50; s.atk=56; s.spd=58; }},
  {label:'Hydro 2.6 hp46 atk54', set:(s,M)=>{ s.hp=46; s.atk=54; s.move = M.charge('Hydro Pump', 2.6, 'Bite', 1.1); }},
 ],
 golbat: [
  {label:'base'},
  {label:'drain 1.6/.5', set:(s,M)=>{ s.move = M.drain('Leech Life', 1.6, 0.5); }},
  {label:'drain 1.5/.6 hp50', set:(s,M)=>{ s.hp=50; s.move = M.drain('Leech Life', 1.5, 0.6); }},
  {label:'atk48 hp48', set:(s)=>{ s.hp=48; s.atk=48; }},
 ],
};
