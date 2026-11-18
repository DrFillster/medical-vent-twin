'use strict';

const assert=require('node:assert/strict');
const {
  simulate,fitEvent
}=require('./fit_controlled_mechanics.js');

function makePcEvent(){
  return {
    event_id:'SYNTH-PC',
    hummod_mode:'PC_AC',
    vent:{
      fio2_percent:50,peep:8,rr_set:20,vt_set_ml:null,
      pinsp:14,flow_lps:null,inspiratory_time_sec:0.9,inspiratory_ratio:null
    },
    targets:{
      vt_observed_ml:null,peak_pressure:null,compliance_derived:null
    },
    fit_status:{recruitability:'fit_from_preindex_peep_history'}
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
      vt_observed_ml:null,peak_pressure:null,compliance_derived:null
    },
    fit_status:{recruitability:'prior_constrained'}
  };
}

{
  const event=makePcEvent();
  const truth={stiffnessScale:1.6,resistanceScale:2.0,recruitableFraction:0.7};
  const model=simulate(event,truth);
  event.targets.vt_observed_ml=model.vtMl;
  event.targets.compliance_derived=model.dynamicComplianceMlPerCmH2O;
  const fit=fitEvent(event);
  assert(fit.best,'PC fit missing');
  assert.equal(fit.best.stiffnessScale,truth.stiffnessScale);
  assert.equal(fit.best.resistanceScale,truth.resistanceScale);
  assert.equal(fit.best.recruitableFraction,truth.recruitableFraction);
  assert(fit.best.objective<1e-10);
}

{
  const event=makeVcEvent();
  const truth={stiffnessScale:0.8,resistanceScale:3.0,recruitableFraction:0.35};
  const model=simulate(event,truth);
  event.targets.peak_pressure=model.peakPressureCmH2O;
  event.targets.compliance_derived=model.dynamicComplianceMlPerCmH2O;
  const fit=fitEvent(event);
  assert(fit.best,'VC fit missing');
  assert.equal(fit.best.stiffnessScale,truth.stiffnessScale);
  assert.equal(fit.best.resistanceScale,truth.resistanceScale);
  assert.equal(fit.best.recruitableFraction,truth.recruitableFraction);
  assert(fit.best.objective<1e-10);
}

console.log('ok - controlled mechanics fitter recovers synthetic grid parameters');
