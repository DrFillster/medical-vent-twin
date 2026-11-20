'use strict';
// Research-only. Explicit controls; reference-template dependence retained.
const {independentMechanicsParams}=require('./independent_mechanics_controls');
const {createBerlinLiveHumModSession,LIVE_HUMMOD_REFERENCE_CASE_ID}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session');
const copy=x=>JSON.parse(JSON.stringify(x));
function optionsFor(config){
 if(!config||config.schema!=='research-explicit-patient-state/v1')throw Error('explicit schema required');
 for(const k of ['mechanics','recruitment','effort','ventilation','evidence'])if(!config[k])throw Error(k+' required');
 for(const k of ['elasticScale','capacityScale','resistanceScale'])if(config.mechanics[k]===undefined)throw Error('explicit '+k+' required');
 if(!['synthetic','development'].includes(config.evidence.kind)||typeof config.evidence.source!=='string'||!config.evidence.source)throw Error('source provenance required');
 const {drive,muscleTransmission}=config.effort;
 for(const v of [drive,muscleTransmission])if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('finite nonnegative effort required');
 const r=config.recruitment;
 if(r.normal!==1||r.consolidated!==0||!Number.isFinite(r.recruitable)||r.recruitable<0||r.recruitable>1)throw Error('current compartment constraints not satisfied');
 if(!config.effort.profile)throw Error('explicit effort profile required');
 const mechanics=independentMechanicsParams(config.mechanics);
 if(config.recruitmentKinetics){
  const k=config.recruitmentKinetics;
  for(const key of ['P_open','P_close','k_open','k_close'])if(typeof k[key]!=='number'||!Number.isFinite(k[key])||k[key]<0)throw Error('explicit nonnegative recruitment kinetics required');
  if(!(k.P_close<k.P_open))throw Error('closing threshold must be below opening threshold');
  const c=mechanics.compartments.find(x=>x.id==='recruitable');
  Object.assign(c,k);c.recruitment={...c.recruitment,...k};
 }
 return {caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,ventilation:copy(config.ventilation),initialRecruitmentState:copy(r),patientStateProfile:config.effort.profile,patientDriveRelativeOverride:drive,patientMuscleTransmissionOverride:muscleTransmission,patientMechanicsParams:mechanics,dt:.01,mechanicalWarmupSec:8,coupledEquilibrationSec:0,physicianValidationCandidate:false};
}
function createExplicitPatientStateSession(config){
 optionsFor(config);
 const immutableConfig=copy(config),options=optionsFor(immutableConfig),session=createBerlinLiveHumModSession(options);
 const provenance=Object.freeze({schema:'research-explicit-state-provenance/v1',configuration:immutableConfig,referenceTemplate:LIVE_HUMMOD_REFERENCE_CASE_ID,referenceTemplateIsPatientDiagnosis:false,clinicalValidation:false,gasAndCirculation:'existing reference boundaries; not patient fitted in this adapter'});
 return Object.freeze({session,provenance,options:copy(options)});
}
module.exports={optionsFor,createExplicitPatientStateSession};
