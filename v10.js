const on0=(mv)=>(s,M,on)=>{ s.move2 = on('every', mv(M), {n:3}); };
const op=(mv)=>(s,M,on)=>{ s.move2 = on('open', mv(M), {free:true}); };
module.exports = {
 tangela: [{label:'base'},{label:'Ingrain self .45', set:op(M=>M.shield('Ingrain', 0.45, 'self'))},{label:'self .55', set:op(M=>M.shield('Ingrain', 0.55, 'self'))}],
 venusaur: [{label:'base'},{label:'LightScreen team .12', set:op(M=>M.shield('Light Screen', 0.12, 'team'))},{label:'team .14', set:op(M=>M.shield('Light Screen', 0.14, 'team'))}],
 vaporeon: [{label:'base'},{label:'Mist team .12', set:op(M=>M.shield('Mist', 0.12, 'team'))},{label:'team .10', set:op(M=>M.shield('Mist', 0.10, 'team'))}],
 alakazam: [{label:'base'},{label:'Disable 1.0', set:on0(M=>M.disable('Disable', 1.0))},{label:'Disable 1.4', set:on0(M=>M.disable('Disable', 1.4))}],
 starmie: [{label:'base'},{label:'Haze 1.0', set:on0(M=>M.haze('Haze', 1.0))},{label:'Haze 1.4', set:on0(M=>M.haze('Haze', 1.4))}],
 scyther: [{label:'base'},{label:'Knock Off 1.0', set:on0(M=>M.knock('Knock Off', 1.0))},{label:'Knock Off 1.4', set:on0(M=>M.knock('Knock Off', 1.4))}],
 electabuzz: [{label:'base'},{label:'Disable 1.0', set:on0(M=>M.disable('Disable', 1.0))},{label:'Haze 1.2', set:on0(M=>M.haze('Haze', 1.2))}],
};
