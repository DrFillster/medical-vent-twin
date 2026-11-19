'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const test=require('node:test');
const vm=require('node:vm');
const fitter=new vm.Script(fs.readFileSync(require.resolve('./fit_primary60_ps_fio2_composite_locked.js'),'utf8'));

function harness(change){
  const locked={drive:1.25,muscle_transmission:0.9,stiffness_scale:1.1,resistance_scale:0.8};
  const lock=Array.from({length:19},(_,i)=>({
    event_id:'synthetic-'+i,...locked,
    oxygenation_source_plan:'composite_effective_oxygenation',deadspace_source_plan:'latent_prior_constrained',
  }));
  const prefit=lock.map(e=>({event_id:e.event_id,prefit:{...locked},
    vent:{fio2_percent:40,peep:8,psv:10},targets:{po2:90,pco2:42,ph:7.4}}));
  change?.(lock,prefit);
  const prefitText=JSON.stringify(prefit);
  const writes=[], sessions=[];
  const snapshot={systemic:{gasExchange:{pao2MmHg:90,paco2MmHg:42}}};
  return {
    writes,sessions,prefitText,
    run:()=>fitter.runInNewContext({
      console:{log(){}},process:{env:{MAX_EVENTS:'1'}},
      require(name){
        if(name==='node:crypto') return {createHash};
        if(name==='fs') return {
          readFileSync(path){
            if(path.endsWith('/primary60_ps_fio2_prefit_index.jsonl')) return lock.map(x=>JSON.stringify(x)).join('\n');
            if(path.endsWith('/primary60_conservative_prefit.json')) return prefitText;
            throw new Error('Unexpected read: '+path);
          },
          writeFileSync(_path,output){writes.push(JSON.parse(output));},
        };
        if(name.endsWith('/fit_controlled_mechanics.js')) return {mechanicsParams:(stiffness,resistance)=>({stiffness,resistance})};
        if(name.endsWith('/clinical_twin_live_hummod_session.js')) return {
          LIVE_HUMMOD_REFERENCE_CASE_ID:'synthetic-reference',
          createBerlinLiveHumModSession(opts){
            sessions.push(opts);
            return {initialize(){},runFor:()=>snapshot,snapshot:()=>snapshot,compactTraceHistory(){}};
          },
        };
        throw new Error('Unexpected import: '+name);
      },
    }),
  };
}
test('matching input produces a fit with the locked parameters and prefit checksum',()=>{
  const h=harness();
  h.run();
  assert.ok(h.sessions.length>0);
  for(const options of h.sessions){
    assert.equal(options.patientDriveRelativeOverride,1.25);
    assert.equal(options.patientMuscleTransmissionOverride,0.9);
    assert.deepEqual(options.patientMechanicsParams,{stiffness:1.1,resistance:0.8});
  }
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].pass,true);
  assert.equal(h.writes[0].provenance.prefit_input_sha256,createHash('sha256').update(h.prefitText).digest('hex'));
});
for(const key of ['drive','muscle_transmission','stiffness_scale','resistance_scale']){
  test(key+' mismatch outside the selected shard is rejected before any run',()=>{
    const h=harness((_lock,prefit)=>{prefit[18].prefit[key]+=0.1;});
    assert.throws(h.run,new RegExp('locked prefit mismatch.*'+key));
    assert.equal(h.sessions.length,0);
    assert.equal(h.writes.length,0);
  });
}
test('duplicate prefit row is rejected before any run',()=>{
  const h=harness((_lock,prefit)=>prefit.push(prefit[0]));
  assert.throws(h.run,/duplicate conservative prefit event/);
  assert.equal(h.sessions.length+h.writes.length,0);
});
