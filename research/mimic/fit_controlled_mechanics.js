'use strict';

const fs = require('fs');
const { Simulation, VcAcController, PcAcController } =
  require('../../ards-twin-v1.0/src/simulation.js');
const { getBerlinCase } =
  require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

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
      inspiratoryFlow:v.flow_lps, inspiratoryPause:0,
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
      normal:1,recruitable:candidate.recruitableFraction,consolidated:0,
    },
  });
  const period=60/event.vent.rr_set;
  sim.runFor(period*5);
  const breaths=sim.metrics().filter(m=>finite(m.VtInspired)&&m.VtInspired>0);
  const last=breaths[breaths.length-1];
  if(!last) throw new Error('no completed breath');
  const cutoff=Math.max(0,sim.state.t-period*1.2);
  const rows=sim.trace.filter(r=>r.t>=cutoff);
  const peak=Math.max(...rows.map(r=>r.output.airwayPressure).filter(finite));
  const vtMl=last.VtInspired*1000;
  const deltaP=peak-event.vent.peep;
  const compliance=deltaP>0?vtMl/deltaP:null;
  return {
    vtMl,
    peakPressureCmH2O:peak,
    dynamicComplianceMlPerCmH2O:compliance
  };
}

function score(event,m){
  const t=event.targets;
  let value=0, terms=0;
  if(event.hummod_mode==='PC_AC' && finite(t.vt_observed_ml)){
    value += sq((m.vtMl-t.vt_observed_ml)/Math.max(50,0.15*t.vt_observed_ml));
    terms++;
  }
  if(event.hummod_mode==='VC_AC' && finite(t.peak_pressure)){
    value += sq((m.peakPressureCmH2O-t.peak_pressure)/Math.max(3,0.10*t.peak_pressure));
    terms++;
  }
  if(finite(t.compliance_derived) && finite(m.dynamicComplianceMlPerCmH2O)){
    value += sq((m.dynamicComplianceMlPerCmH2O-t.compliance_derived)/
      Math.max(10,0.20*t.compliance_derived));
    terms++;
  }
  return terms===0 ? Infinity : value/terms;
}

const STIFFNESS_GRID=Object.freeze([0.4,0.6,0.8,1.0,1.25,1.6,2.0,2.5]);
const RESISTANCE_GRID=Object.freeze([0.25,0.5,0.75,1.0,1.5,2.0,3.0,4.0]);
const RECRUITMENT_GRID=Object.freeze([0.05,0.2,0.35,0.5,0.7,0.9]);

function fitEvent(event,{forceRecruitmentGrid=null}={}){
  const recruitable=forceRecruitmentGrid ||
    (event.fit_status && event.fit_status.recruitability==='fit_from_preindex_peep_history'
      ? RECRUITMENT_GRID : [0.35]);
  let best=null,tested=0,failed=0;
  for(const s of STIFFNESS_GRID){
    for(const r of RESISTANCE_GRID){
      for(const rec of recruitable){
        try{
          const candidate={stiffnessScale:s,resistanceScale:r,recruitableFraction:rec};
          const model=simulate(event,candidate);
          const objective=score(event,model);
          tested++;
          if(Number.isFinite(objective)&&(!best||objective<best.objective)){
            best={...candidate,objective,model};
          }
        }catch(e){ failed++; }
      }
    }
  }
  return {tested,failed,best};
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
        compliance_derived:event.targets.compliance_derived,
      },
      fit_scope:'pre-transition-mechanics-only',
    });
    console.log(JSON.stringify({
      event_id:event.event_id,mode:event.hummod_mode,
      tested:fit.tested,failed:fit.failed,
      objective:fit.best&&fit.best.objective,
      stiffnessScale:fit.best&&fit.best.stiffnessScale,
      resistanceScale:fit.best&&fit.best.resistanceScale,
      recruitableFraction:fit.best&&fit.best.recruitableFraction
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
  STIFFNESS_GRID,RESISTANCE_GRID,RECRUITMENT_GRID
};
