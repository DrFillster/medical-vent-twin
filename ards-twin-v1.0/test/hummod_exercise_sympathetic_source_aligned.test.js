'use strict';

const {
  MOTOR_RADIATION_CURVE,
  METABOREFLEX_PH_CURVE,
  motorRadiationTotalEffect,
  skeletalMuscleMetaboreflexNerveActivity,
  exerciseSympsTotalEffect,
}=require('../src/hummod_exercise_sympathetic_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,t=1e-12){if(Math.abs(a-b)>t)throw new Error(a+' != '+b);}

test('preserves MotorRadiation source knots',()=>{
  near(motorRadiationTotalEffect(0),0);
  near(motorRadiationTotalEffect(500),2.2);
  near(motorRadiationTotalEffect(1000),2.6);
  near(MOTOR_RADIATION_CURVE[0].slope,0.004);
});

test('preserves skeletal-muscle metaboreflex pH knots and failure branch',()=>{
  near(skeletalMuscleMetaboreflexNerveActivity({skeletalMusclePh:6.5}),5);
  near(skeletalMuscleMetaboreflexNerveActivity({skeletalMusclePh:6.9}),0);
  near(skeletalMuscleMetaboreflexNerveActivity({skeletalMusclePh:6.5,skeletalMuscleFunctionFailed:true}),0);
  near(METABOREFLEX_PH_CURVE[1].y,0);
});

test('ExerciseSymps combines motor radiation with 0.32 times metaboreflex activity',()=>{
  const out=exerciseSympsTotalEffect({totalWatts:500,skeletalMusclePh:6.5});
  near(out.radiationEffect,2.2);
  near(out.metaboreflexEffect,1.6);
  near(out.totalEffect,3.8);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
