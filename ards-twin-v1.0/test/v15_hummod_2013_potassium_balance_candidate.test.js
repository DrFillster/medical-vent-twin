'use strict';
const assert=require('node:assert/strict');
const {createHumMod2013PotassiumBalanceCandidate:create,EXTERNAL_RATES}=
  require('../src/hummod_2013_potassium_balance_candidate.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('ok - '+name);}
catch(e){failed++;console.error('FAIL - '+name+': '+e.message);}}
function boundary(dtSec=1){return {
  dtSec,cellWaterVolumeMl:28000,ecfvMl:15000,aldosteronePmolPerL:300,
  giAbsorptionMeqPerMin:0,ivDripMeqPerMin:0,transfusionMeqPerMin:0,
  collectingDuctOutflowMeqPerMin:0,sweatOutflowMeqPerMin:0,
  hemorrhageMeqPerMin:0,dialyzerFluxMeqPerMin:0,
};}
function initial(){return create({initialCellMassMeq:3920,initialPoolMassMeq:60});}
function near(a,b,tol=1e-9){assert(Math.abs(a-b)<=tol,`${a} differs from ${b}`);}

test('joint exchange conserves total K while each pool changes',()=>{
  const c=initial();let s;
  for(let i=0;i<600;i++)s=c.step(boundary());
  near(s.cellMassMeq+s.poolMassMeq,3980);
  assert(s.cellMassMeq<3920);assert(s.poolMassMeq>60);
  near(s.residuals.cellResidual,0);near(s.residuals.poolResidual,0);
  assert.equal(s.controlAuthority,false);
});
test('external source gains and losses account for total K independently of exchange',()=>{
  const c=initial();let s;
  const x={...boundary(),giAbsorptionMeqPerMin:.1,ivDripMeqPerMin:.2,
    transfusionMeqPerMin:.3,collectingDuctOutflowMeqPerMin:.05,
    sweatOutflowMeqPerMin:.01,hemorrhageMeqPerMin:.02,dialyzerFluxMeqPerMin:-.04};
  for(let i=0;i<60;i++)s=c.step(x);
  near(s.cellMassMeq+s.poolMassMeq,3980+.56);
});
test('current water volumes set concentrations without resetting either K mass',()=>{
  const a=initial(),b=initial();const x=a.step(boundary());
  const y=b.step({...boundary(),cellWaterVolumeMl:14000,ecfvMl:7500});
  near(x.cellMassMeq,y.cellMassMeq);near(x.poolMassMeq,y.poolMassMeq);
  near(y.cellConcentrationMeqPerL,2*x.cellConcentrationMeqPerL);
  near(y.poolConcentrationMeqPerL,2*x.poolConcentrationMeqPerL);
});
test('aldosterone delay uses the source 120-minute constant, not 120 seconds',()=>{
  const c=initial();const s=c.step({...boundary(3600),aldosteronePmolPerL:0});
  near(s.delayedAldosteroneEffect,.9+.1*Math.exp(-.5));
});
test('exchange converges toward the independent constant-coefficient analytic solution',()=>{
  const a=.0018,b=.00008,total=3980,captive=2180,minutes=60;
  const equilibrium=(a*total+b*captive)/(a+b);
  const exact=equilibrium+(3920-equilibrium)*Math.exp(-(a+b)*minutes);
  const errors=[60,30,15].map(dt=>{
    const c=initial();for(let t=0;t<3600;t+=dt)c.step(boundary(dt));
    return Math.abs(c.snapshot().cellMassMeq-exact);
  });
  assert(errors[1]<errors[0]*.51);assert(errors[2]<errors[1]*.51);
});
test('all external providers are mandatory and invalid steps leave state intact',()=>{
  for(const key of [...EXTERNAL_RATES,'aldosteronePmolPerL','ecfvMl','cellWaterVolumeMl']){
    const c=initial(),before=c.snapshot(),x=boundary();delete x[key];
    assert.throws(()=>c.step(x),new RegExp(key));assert.deepEqual(c.snapshot(),before);
  }
  const c=initial(),before=c.snapshot();
  assert.throws(()=>c.step({...boundary(60),collectingDuctOutflowMeqPerMin:1e6}),
    /advanced K.*mass must be >= 0/);
  assert.deepEqual(c.snapshot(),before);
});
console.log(`Tests: passed=${passed} failed=${failed}`);process.exitCode=failed?1:0;
