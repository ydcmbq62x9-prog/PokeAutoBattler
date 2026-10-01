module.exports = {
 snorlax: [
  {label:'base'},
  {label:'HyperBeam charge 3.0/BodySlam1.6', set:(s,M)=>{ s.move = M.charge('Hyper Beam', 3.0, 'Body Slam', 1.6); }},
  {label:'Harden/3 (drop Rest)', set:(s,M,on)=>{ s.move2 = on('every', M.guard('Amnesia', 6, 1), {n:3}); }},
  {label:'Body Slam par 30% wallish', set:(s,M)=>{ s.move = M.afflict('Body Slam', 1.6, 'par', 0.3, 'front'); }},
  {label:'Rest->every 4 heal', set:(s,M,on)=>{ s.move2 = on('every', M.recover('Rest', 0.5, true), {n:4}); }},
 ],
 onix: [
  {label:'base'},
  {label:'Screech every2 weaken .6/14', set:(s,M,on)=>{ s.move2 = on('every', M.weaken('Screech', 0.6, 14), {n:2}); }},
  {label:'Screech every3 weaken 0.8/18', set:(s,M,on)=>{ s.move2 = on('every', M.weaken('Screech', 0.8, 18), {n:3}); }},
  {label:'Bind par 30%', set:(s,M)=>{ s.move = M.afflict('Bind', 1.4, 'par', 0.4, 'front'); }},
  {label:'Rock Slide two 0.9', set:(s,M)=>{ s.move = M.two('Rock Slide', 0.9); }},
  {label:'Iron Def open 0.5 shield', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Iron Defense', 0.5, 'self'), {free:true}); }},
 ],
 blastoise: [
  {label:'base'},
  {label:'Surf all 1.2', set:(s,M)=>{ s.move = M.all('Surf', 1.2); }},
  {label:'HydroPump big 2.6 charge-ish', set:(s,M)=>{ s.move = M.charge('Hydro Pump', 3.0, 'Water Gun', 1.2); }},
  {label:'Withdraw guard every3', set:(s,M,on)=>{ s.move2 = on('every', M.guard('Withdraw', 6, 1), {n:3}); }},
  {label:'Skull Bash two 1.0', set:(s,M)=>{ s.move = M.two('Surf', 1.0); }},
 ],
};
