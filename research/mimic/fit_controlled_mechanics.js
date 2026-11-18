'use strict';

const fs = require('fs');
const { Simulation, VcAcController, PcAcController } =
  require('../../ards-twin-v1.0/src/simulation.js');
const { getBerlinCase } =
  require('../../ards-twin-v1.0/src/berlin_case_catalog.js');
const { summarizeSimulationMeasurements } =
  require('../../ards-twin-v1.0/src/bedside_measurements.js');

const DATA = '/Users/philipbernard/mimic-data/derived/controlled_fit_inputs.jsonl';
const OUT = '/Users/philipbernard/mimic-data/derived/controlled_mechanics_fit.jsonl';

function clone(x){ return JSON.parse(JSON.stringify(x)); }
function finite(x){ return typeof x === 'number' && Number.isFinite(x); }
function sq(x){ return x*x; }

function mechanicsParams(stiffnessScale,resistanceScale){
  const c=getBerlinCase('berlin-moderate-moderate-aspiration');
  const p=clone(c.phenotype.mechanicsParams);
  for(const comp of p.compartments){
    comp.elasticScale *= stiffnessScale;
    comp.capacity /= stiffnessScale;
  }
  p.centralAirwayResistance *= resistanceScale;
  return p;
}

function controllerFor(event){
  const v=event.vent;
  const fio2=v.fio2_percent/100;
  if(event.hummod_mode==='VC_AC'){
    return new VcAcController({
      fio2, peep:v.peep, rr:v.rr_set, vt:v.vt_set_ml/1000,
      inspiratoryFlow:v.flow_lps,
      // Measurement-only pause: permits the validated inspiratory-hold path
      // without changing the patient's documented flow/VT settings.
      inspiratoryPause:0.01,
    });
  }
  if(event.hummod_mode==='PC_AC'){
    return new PcAcController({
      fio2, peep:v.peep, rr:v.rr_set, pinsp:v.pinsp,
      inspiratoryTime:v.inspiratory_time_sec, inspiratoryPause:0,
    });
  }
  throw new Error('unsupported mode '+event.hummod_mode);
}

function simulate(event,candidate){
  const controller=controllerFor(event);
  const sim=new Simulation({
    params: mechanicsParams(candidate.stiffnessScale,candidate.resistanceScale),
    controller,
    dt:0.002,
    trackGas:false,
    initialRecruitmentState:{
      normal:1,recruitable:0.35,consolidated:0,
    },
  });
  const period=60/event.vent.rr_set;
  sim.runFor(period*5);

  if(event.hummod_mode==='VC_AC'){
    sim.requestInspiratoryHold(0.4);
    // Allow up to two complete cycles plus the hold itself. The hold request
    // can arrive at any controller phase and activates only at end inspiration.
    sim.runFor(period*2+1.0);
  }

  const summary=summarizeSimulationMeasurements(sim);
  const last=summary.lastValidDeliveredBreath;
  if(!last) throw new Error('no completed delivered breath');

  const peak=finite(last.Ppeak) ? last.Ppeak : summary.peakPressureCmH2O;
  if(!finite(peak)) throw new Error('no finite peak airway pressure');
  const plateau=finite(summary.plateauPressureCmH2O)
    ? summary.plateauPressureCmH2O
    : null;
  return {
    vtMl:last.VtInspired*1000,
    peakPressureCmH2O:peak,
    plateauPressureCmH2O:plateau,
  };
}

function score(event,m){
  const t=event.targets;
  let value=0, terms=0;

  if(event.hummod_mode==='PC_AC'){
    if(!finite(t.vt_observed_ml)) return Infinity;
    value += sq((m.vtMl-t.vt_observed_ml)/
      Math.max(50,0.15*t.vt_observed_ml));
    terms++;
  }

  if(event.hummod_mode==='VC_AC'){
    if(finite(t.plateau_pressure) && finite(m.plateauPressureCmH2O)){
      value += sq((m.plateauPressureCmH2O-t.plateau_pressure)/
        Math.max(2,0.08*t.plateau_pressure));
      terms++;
    }
    if(finite(t.peak_pressure)){
      value += sq((m.peakPressureCmH2O-t.peak_pressure)/
        Math.max(3,0.10*t.peak_pressure));
      terms++;
    }
  }

  return terms===0 ? Infinity : value/terms;
}

const STIFFNESS_GRID=Object.freeze([0.4,0.6,0.8,1.0,1.25,1.6,2.0,2.5]);
const RESISTANCE_GRID=Object.freeze([0.25,0.5,0.75,1.0,1.5,2.0,3.0,4.0]);

function fitEvent(event){
  const canFitResistance =
    event.hummod_mode==='VC_AC' &&
    finite(event.targets.peak_pressure) &&
    finite(event.targets.plateau_pressure) &&
    finite(event.vent.flow_lps);
  const resistanceGrid=canFitResistance ? RESISTANCE_GRID : [1.0];

  let best=null,tested=0,failed=0;
  for(const s of STIFFNESS_GRID){
    for(const r of resistanceGrid){
      try{
        const candidate={stiffnessScale:s,resistanceScale:r,initialRecruitmentStateRecruitable:0.35};
        const model=simulate(event,candidate);
        const objective=score(event,model);
        tested++;
        if(Number.isFinite(objective)&&(!best||objective<best.objective)){
          best={...candidate,objective,model};
        }
      }catch(e){ failed++; }
    }
  }
  return {tested,failed,best,canFitResistance};
}

function runFile(limit){
  const events=fs.readFileSync(DATA,'utf8').trim().split('\n').filter(Boolean)
    .map(JSON.parse).slice(0,limit);
  const out=[];
  for(const event of events){
    const fit=fitEvent(event);
    out.push({
      event_id:event.event_id,mode:event.hummod_mode,
      ...fit,
      targets:{
        vt_observed_ml:event.targets.vt_observed_ml,
        peak_pressure:event.targets.peak_pressure,
        plateau_pressure:event.targets.plateau_pressure,
      },
      fit_scope:'pre-transition-mechanics-only-v3',
    });
    console.log(JSON.stringify({
      event_id:event.event_id,mode:event.hummod_mode,
      tested:fit.tested,failed:fit.failed,
      objective:fit.best&&fit.best.objective,
      stiffnessScale:fit.best&&fit.best.stiffnessScale,
      resistanceScale:fit.best&&fit.best.resistanceScale,
      canFitResistance:fit.canFitResistance
    }));
  }
  fs.writeFileSync(OUT,out.map(x=>JSON.stringify(x)).join('\n')+'\n');
  return out;
}

if(require.main===module){
  const limit=Number(process.env.FIT_LIMIT || Number.MAX_SAFE_INTEGER);
  runFile(limit);
}

module.exports={
  mechanicsParams,controllerFor,simulate,score,fitEvent,runFile,
  STIFFNESS_GRID,RESISTANCE_GRID
};
