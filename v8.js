const bb=(p,n)=>(s,M,on)=>{ s.move2 = on('every', M.breaker('Brick Break', p), {n}); };
module.exports = {
 machamp: [{label:'base'},{label:'BB 1.4/3',set:bb(1.4,3)},{label:'BB 1.6/3',set:bb(1.6,3)}],
 hitmonlee: [{label:'base'},{label:'BB 1.3/3',set:bb(1.3,3)},{label:'BB 1.6/3',set:bb(1.6,3)}],
 hitmonchan: [{label:'base'},{label:'BB 1.3/3',set:bb(1.3,3)},{label:'BB 1.6/3',set:bb(1.6,3)}],
 primeape: [{label:'base'},{label:'BB 1.3/3',set:bb(1.3,3)},{label:'BB 1.6/3',set:bb(1.6,3)}],
 poliwrath: [{label:'base'},{label:'BB 1.3/3',set:bb(1.3,3)}],
};
