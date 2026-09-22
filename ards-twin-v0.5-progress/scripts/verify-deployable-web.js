#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'web');
const required=['index.html','styles.css','app.js','worker.js','clinical-worker.js','engine.js','clinical-cases.json'];
const failures=[];
for(const name of required){
  const p=path.join(web,name);
  if(!fs.existsSync(p)||fs.statSync(p).size===0) failures.push('missing or empty '+name);
}
function read(name){return fs.readFileSync(path.join(web,name),'utf8');}
if(failures.length===0){
  const html=read('index.html'), app=read('app.js'), css=read('styles.css'), engine=read('engine.js'), clinicalWorker=read('clinical-worker.js');
  const checks=[
    [html.includes('id="clinical-quick-start"'),'quick-start control missing'],
    [html.includes('id="clinical-ph"'),'pH monitor missing'],
    [html.includes('id="clinical-run-continuous"'),'continuous-run control missing'],
    [html.includes('id="clinical-pause-continuous"'),'continuous-pause control missing'],
    [html.includes('id="clinical-co"'),'cardiac-output monitor missing'],
    [html.includes('EDUCATIONAL SIMULATION'),'educational safety banner missing'],
    [html.includes('Not clinically validated'),'clinical-validation warning missing'],
    [html.includes('Not for patient care'),'patient-care warning missing'],
    [app.includes("clinical-quick-start"),'quick-start behavior missing'],
    [html.includes('id="clinical-run-continuous"'),'continuous-run control missing'],
    [html.includes('id="clinical-pause-continuous"'),'continuous-pause control missing'],
    [app.includes("clinicalPh.toFixed(2)"),'pH is not constrained to two decimal places'],
    [app.includes("displayClinicalInteger(snapshot.systemic?.gasExchange?.pao2MmHg)"),'PaO2 is not displayed as a whole number'],
    [app.includes("displayClinicalInteger(snapshot.systemic?.gasExchange?.paco2MmHg)"),'PaCO2 is not displayed as a whole number'],
    [app.includes("displayClinicalInteger(snapshot.systemic?.hemodynamics?.meanArterialPressureMmHg)"),'MAP is not displayed as a whole number'],
    [app.includes("clinicalContinuousNextWallMs = performance.now() + 1000"),'continuous mode is not wall-clock paced'],
    [app.includes("scheduleClinicalContinuousStep()"),'continuous real-time scheduler missing'],
    [html.includes('id="clinical-intervention-log"'),'patient-clock intervention timeline missing'],
    [app.includes("recordClinicalIntervention"),'intervention recording missing'],
    [app.includes("record.interventions = clinicalInterventions.map"),'intervention timeline missing from session export'],
    [html.includes('id="clinical-pao2-trend"') && html.includes('id="clinical-ph-trend"'),'physiologic trend panels missing'],
    [app.includes("captureClinicalPhysiologyTrend"),'physiologic trend capture missing'],
    [app.includes("class:'intervention-marker'"),'trend intervention markers missing'],
    [app.includes("record.physiologyTrend = clinicalPhysiologyTrend.map"),'physiology trends missing from session export'],
    [app.includes("if (clinicalContinuousRun && clinicalWorker)"),'continuous-run worker loop missing'],
    [app.includes("live-reduced-hummod"),'live reduced HumMod provider missing'],
    [clinicalWorker.includes("data.provider || payload.systemicMode"),'clinical worker does not read UI provider'],
    [clinicalWorker.includes("VENT.createBerlinLiveHumModSession(payload)"),'clinical worker does not route live provider to reduced HumMod session'],
    [app.includes("requestVentilationChange"),'persistent ventilator-change path missing'],
    [app.includes("clinicalPh.toFixed(2)"),'pH is not constrained to two displayed decimals'],
    [app.includes("clinicalContinuousRun"),'continuous patient advancement loop missing'],
    [app.includes("setPEEP"),'persistent PEEP path missing'],
    [app.includes("performPassiveMechanics"),'passive mechanics path missing'],
    [css.includes('.legacy-lab{display:none!important}'),'legacy mechanics lab not hidden from product shell'],
    [engine.includes('createBerlinLiveHumModSession'),'generated engine does not contain live clinical session'],
  ];
  for(const [ok,message] of checks) if(!ok) failures.push(message);
}
const report={
  schema:'vent-deployable-web-verification/v1',
  version:'0.6.0-preview.1',
  webRoot:'web/',
  requiredFiles:required,
  deployable:failures.length===0,
  failures,
  runtimeRequirements:['static HTTPS hosting','JavaScript','Web Workers','same-origin assets'],
  serverApiRequired:false,
  nativeHumModExecutableRequired:false,
  clinicalValidation:false,
};
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
