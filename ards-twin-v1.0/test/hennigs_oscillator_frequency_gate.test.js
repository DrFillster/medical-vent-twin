'use strict';

const {createHennigsNeuralOscillatorRuntime}=require('../src/hennigs_neural_oscillator_runtime.js');

function empiricalRr(dRel,{dtSec=0.002,settleSec=30,observeSec=60}={}){
  const r=createHennigsNeuralOscillatorRuntime({dtSec,dRel});
  let previous=r.snapshot().state.I;
  let crossings=0;
  const totalSteps=Math.round((settleSec+observeSec)/dtSec);
  for(let i=0;i<totalSteps;i++){
    const s=r.step();
    if(s.timeSec>settleSec && previous<=0 && s.state.I>0) crossings++;
    previous=s.state.I;
  }
  return {empiricalRrPerMin:crossings*60/observeSec, formulaRrPerMin:r.snapshot().prescribedRespiratoryRatePerMin};
}

const probes=[0.25,0.5,0.75].map(dRel=>({dRel,...empiricalRr(dRel)}));
for(const p of probes){
  if(!(p.empiricalRrPerMin>0)) throw new Error('oscillator must retain a limit cycle at dRel='+p.dRel);
  if(!(Math.abs(p.empiricalRrPerMin-p.formulaRrPerMin)>5)){
    throw new Error('frequency mismatch gate expected to remain unresolved at dRel='+p.dRel);
  }
}
console.log('ok - Hennigs oscillator frequency mismatch remains explicitly gated');
console.log(JSON.stringify(probes,null,2));
