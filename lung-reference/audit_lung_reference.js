'use strict';
const fs=require('fs'),M=require('./lung.js');
const {lung,vent,gas}=M.illustrativeCases()[3];
const state=M.stateAfter(lung,[30,vent.cfg.peep]);
const result={
  power_resolution:[60,120,240,480].map(n=>({intervals:n,mp:M.mechanics(lung,vent,state,n).mp_integral_J_min})),
  relay_resolution:[64,128,256,512].map(units=>{
    const model=new M.Lung({...lung.cfg,units});
    return {relays:units,ri:M.riAnalogue(model,vent.cfg.vt),max_crs_peeps:M.peepTrial(model,vent).max_crs_peeps};}),
  aop_sensitivity:[0,2,4,6,8,10,12,14,15,16].map(aop=>({aop,...M.riAnalogue(new M.Lung({...lung.cfg,aop}),vent.cfg.vt)})),
  tidal_volume_sensitivity:[.20,.28,.36,.42,.50].map(vt=>({vt_L:vt,...M.riAnalogue(lung,vt)})),
  fio2_sensitivity_fixed_state:[.21,.30,.40,.60,.80,1].map(fio2=>({fio2,...M.gasExchange(lung,new M.Vent({...vent.cfg,fio2}),state,gas)}))
};
fs.mkdirSync('results',{recursive:true});
fs.writeFileSync('results/audit.js.json',JSON.stringify(result,null,2)+'\n');
console.log('Saved results/audit.js.json');
