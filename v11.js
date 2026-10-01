module.exports = {
 venusaur: [{label:'base'},
  {label:'drain 1.6/.9', set:(s,M)=>{ s.move = M.drain('Giga Drain', 1.6, 0.9); }},
  {label:'drain 1.5/.8 hp56', set:(s,M)=>{ s.hp=56; s.move = M.drain('Giga Drain', 1.5, 0.8); }},
  {label:'drain 1.8/1.0 hp56', set:(s,M)=>{ s.hp=56; s.move = M.drain('Giga Drain', 1.8, 1.0); }},
  {label:'Psn every2 .8 + hp56 drain1.6/.9', set:(s,M,on)=>{ s.hp=56; s.move = M.drain('Giga Drain', 1.6, 0.9); s.move2 = on('every', M.afflict('Poison Powder', 0.8, 'psn', 1, 'front'), {n:2}); }}],
 tangela: [{label:'base'},
  {label:'wall 1.4/2.4', set:(s,M)=>{ s.move = M.wall('Bind', 1.4, 2.4); }},
  {label:'hp66 atk42 wall1.3/2.2', set:(s,M)=>{ s.hp=66; s.atk=42; s.move = M.wall('Bind', 1.3, 2.2); }}],
};
