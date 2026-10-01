module.exports = {
 snorlax: [
  {label:'Reflect team .35', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Reflect', 0.35, 'team'), {free:true}); }},
  {label:'Reflect team .35 atk50', set:(s,M,on)=>{ s.atk=50; s.move2 = on('open', M.shield('Reflect', 0.35, 'team'), {free:true}); }},
  {label:'Reflect .35 + HyperBeam3.4/BS1.6 atk48', set:(s,M,on)=>{ s.atk=48; s.move = M.charge('Hyper Beam', 3.4, 'Body Slam', 1.6); s.move2 = on('open', M.shield('Reflect', 0.35, 'team'), {free:true}); }},
  {label:'Reflect .45', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Reflect', 0.45, 'team'), {free:true}); }},
  {label:'Reflect .3 + weaken BodySlam', set:(s,M,on)=>{ s.move = M.weaken('Body Slam', 1.6, 12); s.move2 = on('open', M.shield('Reflect', 0.3, 'team'), {free:true}); }},
  {label:'Reflect .3 + spd 30', set:(s,M,on)=>{ s.spd=30; s.move2 = on('open', M.shield('Reflect', 0.3, 'team'), {free:true}); }},
 ],
 onix: [
  {label:'team shield .3', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Harden', 0.3, 'team'), {free:true}); }},
  {label:'team .2', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Harden', 0.2, 'team'), {free:true}); }},
  {label:'team .25 + hp+4', set:(s,M,on)=>{ s.move2 = on('open', M.shield('Harden', 0.25, 'team'), {free:true}); }},
 ],
};
