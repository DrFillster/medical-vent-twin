'use strict';
// Candidate integration, not a locked evaluation protocol. Import before live session.
const assert=require('assert');
const livePath=require.resolve('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session');
if(require.cache[livePath])throw Error('candidate pilot must load before live session; isolated worker required');
const adapter=require('./development_model_adapter');adapter.setAlternative(true);
const {declaredRecruitmentOptions}=require('./declared_recruitment_options');
const {createBerlinLiveHumModSession}=require(livePath);
function createCandidatePilotSession({stateConfig,gasParameters,sid,arterialGas}){
 assert(stateConfig&&gasParameters&&arterialGas,'explicit inputs required');
 assert(Number.isFinite(sid)&&sid>0,'SID required');
 assert(Number.isFinite(gasParameters.deadSpace)&&gasParameters.deadSpace>=.2&&gasParameters.deadSpace<=.8,'dead-space outside candidate bounds');
 assert(Number.isFinite(gasParameters.vpf)&&gasParameters.vpf>=.4&&gasParameters.vpf<=1,'perfusion outside candidate bounds');
 for(const k of ['po2MmHg','pco2MmHg','pH'])assert(Number.isFinite(arterialGas[k])&&arterialGas[k]>0,'missing gas '+k);
 adapter.setAlternative(true);
 return createBerlinLiveHumModSession({...declaredRecruitmentOptions(stateConfig),patientDeadSpaceFractionOfTidalVolume:gasParameters.deadSpace,patientVentilatedPerfusionFractionOverride:gasParameters.vpf,patientBloodSidMolPerL:sid,patientArterialGasInitialization:{...arterialGas}});
}
function requireEvaluationLock(lock){
 const required=['sourceHashesVerified','inputRulesLocked','fittingRulesLocked','baselineAcceptanceLocked','comparatorLocked','patientSeparationVerified','scoringLocked','predictionsCommittedBeforeOutcomes'];
 assert(lock&&lock.schema==='candidate-pilot-review/v1','missing reviewed lock');
 for(const k of required)assert.strictEqual(lock[k],true,'evaluation blocked: '+k);
 // This assertion validates contract shape only; caller must verify actual hashes,
 // identity ledger and committed predictions. A boolean is not evidence of review.
 return true;
}
module.exports={createCandidatePilotSession,requireEvaluationLock};
