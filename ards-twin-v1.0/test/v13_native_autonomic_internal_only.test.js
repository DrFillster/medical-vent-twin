'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function assert(x,m){if(!x)throw new Error(m||'assertion failed');}
const enginePath=path.resolve(__dirname,'../web/engine.js');
const source=fs.readFileSync(enginePath,'utf8');
const context={console,setTimeout,clearTimeout,Math,JSON,Object,Array,Number,String,Boolean,Date,Error,TypeError,RangeError};
vm.createContext(context);
vm.runInContext(source,context,{filename:enginePath});
const VENT=context.VENT;
assert(VENT,'VENT bundle missing');

const nativeCalibrationTarget={
  schema:'vent-native-reduced-hummod-calibration-target/v1',
  targetId:'test-native-autonomic-internal-only',
  endpoints:null,
  nativeReducedState:{available:false},
  nativeCirculationState:{available:false},
  nativeReducedBoundary:{available:false,values:{}},
  nativeAutonomicTrajectory:{
    available:true,
    rows:[
      {timestampSec:0,brainFuelFractUseDelay:1,a2PoolLog10Conc:1.7,brainFunctionEffect:1,exerciseMode:3,exerciseBikePowerW:100,exerciseBikeRpm:50,skeletalMusclePh:7.1},
      {timestampSec:600,brainFuelFractUseDelay:1,a2PoolLog10Conc:1.7,brainFunctionEffect:1,exerciseMode:3,exerciseBikePowerW:100,exerciseBikeRpm:50,skeletalMusclePh:7.0},
    ],
    policy:'internal model-state input only; never exposed as a human-entered control',
  },
};

const s=VENT.createBerlinLiveHumModSession({
  caseId:'berlin-moderate-moderate-aspiration',
  ventilation:{mode:'VC_AC',fio2:0.60,peep:8,rr:20,vtL:0.42,inspiratoryFlowLps:0.70,inspiratoryPauseSec:0.20},
  initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  dt:0.002,
  mechanicalWarmupSec:3,
  nativeCalibrationTarget,
});
s.initialize();
s.requestVentilationChange({mode:'VC_AC',fio2:0.20,peep:8,rr:4,vtL:0.10,inspiratoryFlowLps:0.20,inspiratoryPauseSec:0});
const x=s.runFor(180);
const h=x.systemic.hemodynamics;
assert(x.coupling.nativeAutonomicTrajectoryApplied===true,'native autonomic trace was not applied internally');
assert(h.empiricalChronotropicBoostPerMin===0,'empirical bridge must be disabled when native autonomic state is active');
assert(h.exerciseMetabolism && h.exerciseMetabolism.totalWatts>0,'native exercise metabolism state was not generated internally');
assert(h.sourceAlignedAutonomic.exerciseSympsTotalEffect>0,'generated native ExerciseSymps drive did not reach source-aligned controller');
assert(x.ventilator && !Object.prototype.hasOwnProperty.call(x.ventilator,'exerciseSympsTotalEffect'),'autonomic state leaked into human-facing ventilator controls');
console.log('ok - native autonomic state is internal and disables empirical bridge');
