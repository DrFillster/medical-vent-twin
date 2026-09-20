#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const { createBerlinLiveHumModSession, LIVE_HUMMOD_REFERENCE_CASE_ID }=require('../src/clinical_twin_live_hummod_session.js');

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}

function main(){
  const outPath=process.argv[2]||path.resolve(__dirname,'../benchmark-results/reduced-native-alignment.json');
  const targetPath=process.argv[3]||null;
  const nativeCalibrationTarget=targetPath ? JSON.parse(fs.readFileSync(targetPath,'utf8')) : null;
  const session=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{mode:'VC_AC',fio2:0.50,peep:0,rr:16,vtL:0.45,inspiratoryFlowLps:0.75,inspiratoryPauseSec:0},
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    dt:0.002,
    mechanicalWarmupSec:30,
    nativeCalibrationTarget,
  });
  session.initialize();
  const snapshot=session.runFor(300);
  const gas=snapshot.systemic.gasExchange;
  const hemo=snapshot.systemic.hemodynamics;
  const report={
    schema:'vent-reduced-hummod-native-alignment-probe/v1',
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    runDurationSec:300,
    ventilator:{fio2:0.50,peepCmH2O:0,rrPerMin:16,vtMl:450},
    endpoints:{
      pao2MmHg:finite(gas.pao2MmHg,'PaO2'),
      paco2MmHg:finite(gas.paco2MmHg,'PaCO2'),
      pH:finite(gas.pH,'pH'),
      heartRatePerMin:finite(hemo.heartRatePerMin,'heart rate'),
      meanArterialPressureMmHg:finite(hemo.meanArterialPressureMmHg,'MAP'),
      cardiacOutputLPerMin:finite(hemo.cardiacOutputMlPerMin,'cardiac output')/1000,
    },
    calibration:{
      targetPath:targetPath ? path.resolve(targetPath) : null,
      targetId:nativeCalibrationTarget ? nativeCalibrationTarget.targetId : null,
      nativeGasStateAvailable:Boolean(nativeCalibrationTarget && nativeCalibrationTarget.nativeReducedState && nativeCalibrationTarget.nativeReducedState.available),
      nativeGasStateApplied:Boolean(snapshot.coupling.nativeGasStateApplied),
      nativeHeartRateApplied:nativeCalibrationTarget ? nativeCalibrationTarget.endpoints.heartRatePerMin : null,
    },
    coupling:snapshot.coupling,
    engineeringBoundaries:snapshot.engineeringBoundaries,
    applicability:{
      status:'cross-model-engineering-alignment-probe',
      matchedNativeControls:['FiO2','respiratory-rate','tidal-volume','heart-rate-when-native-target-provided','gas-state-initialization-when-native-state-symbols-available'],
      unmatchedNativeMechanics:['native HumMod has no PEEP control; Vent reference-case mechanics remain synthetic ARDS mechanics'],
      fullHumModEquivalent:false,
      berlinArdsCalibration:false,
      clinicalValidation:false,
    },
  };
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}

if(require.main===module)main();
