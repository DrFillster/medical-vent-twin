'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const test=require('node:test');
const vm=require('node:vm');

const runner=new vm.Script(fs.readFileSync(require.resolve('./run_controlled_forward_smoke.js'),'utf8'));
const event={
  event_id:'synthetic-1', hummod_mode:'PC_AC', intervention_type:'FIO2',
  intervention_pre_value:0.5, intervention_post_value:0.4,
  pre_fio2:0.5, pre_peep:8, pre_rr_set:20, pre_pinsp:16, pre_inspiratory_time_sec:0.8,
  pre_po2:90, pre_pco2:43, pre_ph:7.39,
  mechanics_fit:{initialRecruitmentStateRecruitable:0.5,stiffnessScale:1,resistanceScale:1},
};
const fit={
  event_id:event.event_id, fitHorizonSec:60,
  bestDeadspace:{deadspace:0.2}, bestVpf:{vpf:0.85},
  bestTissueCo2Production:{co2Production:4},
};
const snapshot=pao2=>({systemic:{gasExchange:{pao2MmHg:pao2}},pulmonary:{measurements:{}}});

function harness({rawFit=JSON.stringify(fit),horizon='60'}={}){
  const sessions=[],writes=[],reads=[];
  return {
    sessions,writes,reads,
    run:()=>runner.runInNewContext({
      process:{env:{HORIZON_SEC:horizon,EVENT_ID:event.event_id}},
      console:{log:()=>{}},
      require(name){
        if(name==='fs') return {
          readFileSync(path){
            reads.push(path);
            if(path.endsWith('/controlled_blinded_fit_ready.json')) return JSON.stringify([event]);
            if(path.endsWith('/baseline_gas_fit_smoke.json')){
              if(rawFit===null) throw new Error('file missing');
              return rawFit;
            }
            throw new Error('unexpected read: '+path);
          },
          writeFileSync(_path,data){writes.push(JSON.parse(data));},
        };
        if(name.endsWith('/fit_controlled_mechanics.js')) return {mechanicsParams:()=>({})};
        if(name.endsWith('/clinical_twin_live_hummod_session.js')) return {
          LIVE_HUMMOD_REFERENCE_CASE_ID:'synthetic-reference',
          createBerlinLiveHumModSession(options){
            const record={options,runs:[],changes:[]};
            sessions.push(record);
            return {
              initialize:()=>snapshot(90),
              runFor(sec){record.runs.push(sec);return snapshot(record.changes.length?75:86);},
              requestVentilationChange(change){record.changes.push(change);},
            };
          },
        };
        throw new Error('unexpected import: '+name);
      },
    }),
  };
}

test('same saved fit and horizon for independent control and intervention sessions',()=>{
  const h=harness();
  h.run();
  assert.equal(h.reads.length,2);
  assert.equal(h.sessions.length,2);
  const [baseline,prediction]=h.sessions;
  for(const {options,runs} of h.sessions){
    assert.deepEqual(runs,[60]);
    assert.equal(options.patientDeadSpaceFractionOfTidalVolume,0.2);
    assert.equal(options.patientVentilatedPerfusionFractionOverride,0.85);
    assert.equal(options.patientTissueCo2ProductionMmolPerMin,4);
    assert.equal(options.ventilation.fio2,0.5);
  }
  assert.equal(baseline.changes.length,0);
  assert.equal(prediction.changes.length,1);
  assert.equal(prediction.changes[0].fio2,0.4);
  const [output]=h.writes;
  assert.equal(output.no_intervention_at_horizon.horizonSec,60);
  assert.equal(output.no_intervention_at_horizon.gases.pao2,86);
  assert.equal(output.blinded_prediction.horizonSec,60);
  assert.equal(output.blinded_prediction.gases.pao2,75);
  assert.equal(output.truth_file_read,false);
});

for(const [label,options,error] of [
  ['missing fit',{rawFit:null},/read or parse/],
  ['invalid JSON',{rawFit:'{'},/read or parse/],
  ['wrong event',{rawFit:JSON.stringify({...fit,event_id:'other'})},/fit event/],
  ['wrong fit horizon',{rawFit:JSON.stringify({...fit,fitHorizonSec:120})},/fit horizon/],
  ['missing fit horizon',{rawFit:JSON.stringify({...fit,fitHorizonSec:undefined})},/fit horizon/],
  ['invalid gas parameters',{rawFit:JSON.stringify({...fit,bestVpf:{vpf:1.2}})},/invalid gas parameters/],
  ['invalid simulation horizon',{horizon:'0'},/finite and positive/],
]){
  test('fails before simulation or write on '+label,()=>{
    const h=harness(options);
    assert.throws(h.run,error);
    assert.equal(h.sessions.length,0);
    assert.equal(h.writes.length,0);
  });
}
