'use strict';
const assert=require('assert'),fs=require('fs');
const {Simulation,PcAcController}=require('../../ards-twin-v1.0/src/simulation');
const {independentMechanicsParams}=require('./independent_mechanics_controls');
const {completedBreathReadout}=require('./research_completed_breath_readout');
const records=[];
for(const resistanceScale of [1,10,30])for(const rr of [10,20,30]){
 const sim=new Simulation({params:independentMechanicsParams({resistanceScale}),controller:new PcAcController({peep:5,rr,fio2:.4,pinsp:15,inspiratoryTime:1}),dt:.002,trackGas:false,initialPEEP:5,initialRecruitmentState:{normal:1,recruitable:.35,consolidated:0}});
 sim.runFor(36);
 const readout=completedBreathReadout(sim);assert.strictEqual(readout.peakPressureCmH2O,20);assert(readout.inspiredVolumeL>0);
 sim.requestExpiratoryHold(.5);sim.runFor(8);
 const holds=sim.measurements.filter(x=>x.kind==='EXPIRATORY_HOLD');assert.strictEqual(holds.length,1);assert(Number.isFinite(holds[0].totalPeepCmH2O));
 records.push({resistanceScale,rr,readout,hold:holds[0]});
}
// No-breath and incomplete-only histories must not manufacture zero peak.
for(const metrics of [[],[{Ppeak:0,VtInspired:0}]])assert.strictEqual(completedBreathReadout({metrics:()=>metrics}).peakPressureCmH2O,null);
for(const resistanceScale of [1,10,30]){
 const series=records.filter(x=>x.resistanceScale===resistanceScale);
 assert(series[0].hold.totalPeepCmH2O<series[1].hold.totalPeepCmH2O&&series[1].hold.totalPeepCmH2O<series[2].hold.totalPeepCmH2O,'total PEEP must rise with rate in this fixture');
}
for(const rr of [10,20,30]){
 const series=records.filter(x=>x.rr===rr);
 assert(series[0].hold.totalPeepCmH2O<series[1].hold.totalPeepCmH2O&&series[1].hold.totalPeepCmH2O<series[2].hold.totalPeepCmH2O,'total PEEP must rise with resistance in this fixture');
}
const result={engineeringOnly:true,clinicalValidation:false,patientDataRead:false,productionEdited:false,scope:'passive standalone PC mechanics; central resistance only; no validated COPD assignment',records};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
