module.exports = {
 snorlax: [
  {label:'base'},
  {label:'two BodySlam 1.2', set:(s,M)=>{ s.move = M.two('Body Slam', 1.2); }},
  {label:'two BodySlam 1.5', set:(s,M)=>{ s.move = M.two('Body Slam', 1.5); }},
  {label:'all Earthquake?no: all BodySlam 1.3', set:(s,M)=>{ s.move = M.all('Body Slam', 1.3); }},
  {label:'Rest open shield .5 + keep', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Amnesia', 0.6, 'self'), {free:true}); }},
  {label:'shield team open .3', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Reflect', 0.3, 'team'), {free:true}); }},
  {label:'shield team open .4 + hyper beam', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Reflect', 0.4, 'team'), {free:true}); s.move = M.charge('Hyper Beam', 3.0, 'Body Slam', 1.6); }},
 ],
 onix: [
  {label:'base'},
  {label:'IronDef open .4', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Iron Defense', 0.4, 'self'), {free:true}); }},
  {label:'IronDef open .5', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Iron Defense', 0.5, 'self'), {free:true}); }},
  {label:'IronDef open .5 non-free', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Iron Defense', 0.5, 'self')); }},
  {label:'team shield open .25', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Harden', 0.25, 'team'), {free:true}); }},
 ],
 blastoise: [
  {label:'Surf all 1.0', set:(s,M)=>{ s.move = M.all('Surf', 1.0); }},
  {label:'Surf all 0.9', set:(s,M)=>{ s.move = M.all('Surf', 0.9); }},
  {label:'Surf 1.0 + charge? no; Surf1.0 + Bubble', set:(s,M)=>{ s.move = M.all('Surf', 1.0); }},
 ],
};
