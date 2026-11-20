'use strict';
// Synthetic mechanics-only experiment. Not a clinical disease validation.
const fs=require('fs'),assert=require('assert');
const {mechanicsParams}=require('./fit_controlled_mechanics');
const {independentMechanicsParams}=require('./independent_mechanics_controls');
const {Simulation,PcAcController}=require('../../ards-twin-v1.0/src/simulation');
const {summarizeSimulationMeasurements}=require('../../ards-twin-v1.0/src/bedside_measurements');
const clone=x=>JSON.parse(JSON.stringify(x));
const base=mechanicsParams(1,1),before=JSON.stringify(base);
const variants={baseline:clone(base),resistance_only:clone(base),stiffness_only:clone(base),capacity_only:clone(base),legacy_coupled:mechanicsParams(2,1)};
variants.resistance_only.centralAirwayResistance*=2;
for(const c of variants.stiffness_only.compartments)c.elasticScale*=2;
for(const c of variants.capacity_only.compartments)c.capacity/=2;
const settings={fio2:0.4,peep:5,rr:15,pinsp:15,inspiratoryTime:1,inspiratoryPause:0};
function changedPaths(a,b,path=''){
 let r=[];for(const k of Object.keys(a)){const p=path?path+'.'+k:k;if(a[k]&&typeof a[k]==='object')r=r.concat(changedPaths(a[k],b[k],p));else if(a[k]!==b[k])r.push(p);}return r;
}
function run(params){const sim=new Simulation({params:clone(params),controller:new PcAcController(settings),dt:0.002,trackGas:false,initialPEEP:5,initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0}});sim.runFor(24);const s=summarizeSimulationMeasurements(sim),b=s.lastValidDeliveredBreath;assert(b,'completed breath absent');assert(Number.isFinite(b.VtInspired)&&b.VtInspired>0);assert(Number.isFinite(sim.state.totalVolume));return {inspiredVolumeL:b.VtInspired,totalVolumeL:sim.state.totalVolume,peakPressure:s.peakPressureCmH2O};}
assert.deepStrictEqual(independentMechanicsParams({elasticScale:2,capacityScale:0.5,resistanceScale:1}),variants.legacy_coupled);
assert.deepStrictEqual(independentMechanicsParams(),base);
const records=[];for(const [name,p]of Object.entries(variants)){const changes=changedPaths(base,p);if(name==='resistance_only')assert.deepStrictEqual(changes,['centralAirwayResistance']);if(name==='stiffness_only')assert(changes.length>0&&changes.every(x=>x.endsWith('.elasticScale')));if(name==='capacity_only')assert(changes.length>0&&changes.every(x=>x.endsWith('.capacity')));records.push({name,changes,outputs:run(p)});}
assert.strictEqual(JSON.stringify(base),before);
assert.deepStrictEqual(run(base),records[0].outputs,'fresh baseline not deterministic');
for(const r of records.slice(1))assert.notDeepStrictEqual(r.outputs,records[0].outputs,r.name+' had no detected effect');
const report={engineeringOnly:true,clinicalValidation:false,patientDataRead:false,productionEdited:false,scope:'standalone passive mechanics; no gas/circulatory coupling',settings,records,baselineReplayExact:true,pressureReadoutWarning:'summary peak pressure returned zero in all PC test runs; pressure output not accepted as validated',legacyParameterEquivalence:true};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
