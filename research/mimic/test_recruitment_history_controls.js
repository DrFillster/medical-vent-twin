'use strict';
const assert=require('assert');
const {independentMechanicsParams}=require('./independent_mechanics_controls');
const {deriveRecruitmentFromHistory}=require('../../ards-twin-v1.0/src/recruitment_history');
const {stepRecruitmentWithFloor}=require('../../ards-twin-v1.0/src/recruitment');
const p=independentMechanicsParams(),cp=p.compartments.find(x=>x.id==='recruitable'),aop=p.airwayOpeningPressure;
function run(pressures){return deriveRecruitmentFromHistory({history:{schema:'vent-recruitment-history/v1',startingRecruitableFraction:.35,startingStateSource:'synthetic engineering fixture, not observed patient state',segments:pressures.map(pressureCmH2O=>({pressureCmH2O,durationSec:10}))},recruitableCompartmentParams:cp,airwayOpeningPressureCmH2O:aop});}
const low=run([aop]),high=run([aop+cp.recruitment.P_open+10]),lowThenHigh=run([aop,aop+cp.recruitment.P_open+10]),highThenLow=run([aop+cp.recruitment.P_open+10,aop]);
const fraction=x=>x.initialRecruitmentState.recruitable;
for(const x of [low,high,lowThenHigh,highThenLow])assert(fraction(x)>=0&&fraction(x)<=1);
assert(fraction(high)>fraction(low));assert.notStrictEqual(fraction(lowThenHigh),fraction(highThenLow));assert.deepStrictEqual(run([aop]),low);
// Numerical preservation of available volume on attempted closure.
const volume=.4*cp.capacity;
const closed=stepRecruitmentWithFloor(.6,aop,.02,volume,cp,aop);
assert(closed*cp.capacity>=volume);
assert.throws(()=>deriveRecruitmentFromHistory({history:{schema:'vent-recruitment-history/v1',segments:[]},recruitableCompartmentParams:cp,airwayOpeningPressureCmH2O:aop}));
console.log(JSON.stringify({engineeringOnly:true,historyIsSustainedZeroFlowNotClinicalVentReplay:true,low:fraction(low),high:fraction(high),lowThenHigh:fraction(lowThenHigh),highThenLow:fraction(highThenLow),floorPreserved:true,deterministic:true}));
