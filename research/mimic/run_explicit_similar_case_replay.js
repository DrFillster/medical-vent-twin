'use strict';
// Development-only explicit-state replay; no retuning or clinical diagnosis assignment.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const legacy=require('./development_model_adapter');legacy.setAlternative(true);
const {optionsFor}=require('./explicit_patient_state_adapter');
const {createBerlinLiveHumModSession}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session');
const b=process.argv[2],load=n=>fs.readFileSync(path.join(b,n),'utf8');
const sel=JSON.parse(load('dev-similar-settings-v1/manifest.json')),ids=sel.groups.flatMap(g=>g.ids),p=new Map(JSON.parse(load('primary60_conservative_prefit.json')).map(e=>[e.event_id,e]));
const dec=JSON.parse(load('dev-cohort-perfusion-v1/summary.json')).decisions,parent=load('dev-batch-baseline-v1/results.jsonl').trim().split('\n').map(JSON.parse),outcomes=JSON.parse(load('dev-similar-settings-v1/raw_outcome_comparisons.json'));
const selectedIds=ids.filter(eid=>outcomes.find(r=>r.event_id===eid)?.observed);
const out=path.join(b,'dev-explicit-similar-replay-v2');fs.mkdirSync(out,{recursive:true});
const manifest={developmentOnly:true,ids:selectedIds,originalSettingsMatchedSelection:ids,selectionRestriction:'only cases with previously inspected outcome specimen; baseline failures retained',arms:['unchanged','recorded_fio2'],parametersRetuned:false,explicitState:'independent controls with legacy-equivalent parameter values',recruitmentKinetics:'legacy preserved; no opt-in correction',time:'exact clinical specimen time when available; otherwise 3600 seconds',inputProvenance:'legacy timing limitations retained, not prospective-ready',sourceCommit:require('child_process').execSync('git rev-parse HEAD',{encoding:'utf8'}).trim(),sourceHash:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),outcomesPreviouslyInspected:true};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
let complete=0;
for(const eid of selectedIds){const e=p.get(eid),d=dec.find(x=>x.event_id===eid),old=parent.find(x=>x.event_id===eid&&x.condition==='candidate_latent_sid');const pars={...old.pars,vpf:d.pass&&!d.inherited?d.result.selected.vpf:old.pars.vpf};const observed=outcomes.find(x=>x.event_id===eid)?.observed;const duration=observed?observed.elapsed_sec:3600;
 const config={schema:'research-explicit-patient-state/v1',mechanics:{elasticScale:e.prefit.stiffness_scale,capacityScale:1/e.prefit.stiffness_scale,resistanceScale:e.prefit.resistance_scale},recruitment:{normal:1,recruitable:.35,consolidated:0},effort:{profile:'awake_cooperative',drive:e.prefit.drive,muscleTransmission:e.prefit.muscle_transmission},ventilation:{mode:'PS',fio2:e.vent.fio2_percent/100,peep:e.vent.peep,rr:2,pressureSupportCmH2O:e.vent.psv},evidence:{kind:'development',source:'existing saved fit; clinical disease not assigned'}};
 for(const arm of manifest.arms){const r={event_id:eid,arm,baselineQualified:d.pass,durationSec:duration,config,gasParameters:pars,observed:observed||null};try{
 const opts={...optionsFor(config),patientDeadSpaceFractionOfTidalVolume:pars.co2,patientVentilatedPerfusionFractionOverride:pars.vpf,patientBloodSidMolPerL:pars.sid,patientArterialGasInitialization:{po2MmHg:e.targets.po2,pco2MmHg:e.targets.pco2,pH:e.targets.ph}};
 const s=createBerlinLiveHumModSession(opts);s.initialize();r.initial=s.snapshot().systemic.gasExchange;
 // Verify same initialization as legacy adapter before interventions.
 const check=legacy.sessionFor(e,pars);check.initialize();assert.deepStrictEqual(r.initial,check.snapshot().systemic.gasExchange);
 function near(a,b){if(typeof a==='number'&&typeof b==='number'){assert(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b)));return;}if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepStrictEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))near(a[k],b[k]);return;}assert.strictEqual(a,b);}
 near(s.simulation.params,check.simulation.params);r.legacyParametersEquivalentWithinRelativeTolerance=1e-12;r.initialGasesExactlyEqual=true;
 if(arm==='recorded_fio2')s.requestVentilationChange({...config.ventilation,fio2:e.transition_post_value/100});
 for(let t=0;t<duration;){const h=Math.min(30,duration-t);s.runFor(h);s.compactTraceHistory(60);t+=h;}
 r.final=s.snapshot().systemic.gasExchange;assert([r.final.paco2MmHg,r.final.pao2MmHg,r.final.pH].every(Number.isFinite));r.elapsedSimulatorTime=s.snapshot().timeSec;
 }catch(err){r.error=String(err.stack||err);}
 fs.appendFileSync(path.join(out,'runs.jsonl'),JSON.stringify(r)+'\n');console.log(JSON.stringify({completed:++complete,planned:selectedIds.length*2,error:!!r.error}));
 }}
