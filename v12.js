module.exports = {
 tangela: [
  {label:'hp70 atk44 wall1.4/2.3', set:(s,M)=>{ s.hp=70; s.atk=44; s.move = M.wall('Bind', 1.4, 2.3); }},
  {label:'hp72 atk46 wall1.5/2.4', set:(s,M)=>{ s.hp=72; s.atk=46; s.move = M.wall('Bind', 1.5, 2.4); }},
  {label:'hp66 atk42 spd42 wall1.4/2.3', set:(s,M)=>{ s.hp=66; s.atk=42; s.spd=42; s.move = M.wall('Bind', 1.4, 2.3); }}],
};
