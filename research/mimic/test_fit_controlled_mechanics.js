'use strict';

const assert=require('node:assert/strict');
const { simulate,fitEvent }=require('./fit_controlled_mechanics.js');

function makePcEvent(){
  return {
    event_id:'SYNTH-PC',
    hummod_mode:'PC_AC',
    vent:{
      fio2_percent:50,peep:8,rr_set:20,vt_set_ml:null,
      pinsp:14,flow_lps:null,inspiratory_time_sec:0.9,inspiratory_ratio:null
    },
    targets:{
      vt_observed_ml:null,peak_pressure:null,plateau_pressure:null
    },
    fit_status:{}
  };
}

function makeVcEvent(){
  return {
    event_id:'SYNTH-VC',
    hummod_mode:'VC_AC',
    vent:{
      fio2_percent:50,peep:8,rr_set:18,vt_set_ml:420,
      pinsp:null,flow_lps:0.55,inspiratory_time_sec:null,inspiratory_ratio:null
    },
    targets:{
      vt_observed_ml:null,peak_pressure:null,plateau_pressure:null
    },
    fit_status:{}
  };
}

{
  const event=makePcEvent();
  const truth={stiffnessScale:1.6,resistanceScale:1.0,initialRecruitmentStateRecruitable:0.35};
  const model=simulate(event,truth);
  event.targets.vt_observed_ml=model.vtMl;
  const fit=fitEvent(event);
  assert(fit.best,'PC fit missing');
  assert.equal(fit.best.stiffnessScale,truth.stiffnessScale);
  assert.equal(fit.best.resistanceScale,1.0);
  assert.equal(fit.best.initialRecruitmentStateRecruitable,0.35);
  assert(fit.best.objective<1e-10);
  assert.equal(fit.canFitResistance,false);
}

{
  const event=makeVcEvent();
  const truth={stiffnessScale:0.8,resistanceScale:3.0,initialRecruitmentStateRecruitable:0.35};
  const model=simulate(event,truth);
  event.targets.peak_pressure=model.peakPressureCmH2O;
  event.targets.plateau_pressure=model.plateauPressureCmH2O;
  const fit=fitEvent(event);
  assert(fit.best,'VC fit missing');
  assert.equal(fit.best.stiffnessScale,truth.stiffnessScale);
  assert.equal(fit.best.resistanceScale,truth.resistanceScale);
  assert.equal(fit.best.initialRecruitmentStateRecruitable,0.35);
  assert(fit.best.objective<1e-10);
  assert.equal(fit.canFitResistance,true);
}

console.log('ok - v3 controlled mechanics fitter recovers identifiable synthetic parameters');
