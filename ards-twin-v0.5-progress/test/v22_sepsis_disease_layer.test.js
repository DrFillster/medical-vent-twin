'use strict';

const {
  evaluateV22SepsisDiseaseLayer,
}=require('../src/v22_sepsis_disease_layer.js');
const {
  arterialCapillaryFiltration,
  venousCapillaryReabsorption,
  bloodVolumeRateFromCapillaryExchange,
  systemicResistanceRatioFromYamanakaVasodilation,
}=require('../src/v22_yamanaka_sepsis_equations.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed+=1;}
  catch(e){console.error('FAIL -',name,':',e.message);failed+=1;}
}
function assert(cond,msg){if(!cond) throw new Error(msg||'assertion failed');}

test('zero inflammation returns normal Yamanaka disease-layer state',()=>{
  const s=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:0,
    antiInflammatoryMediatorCA:0,
  });
  assert(Math.abs(s.capillaryPermeabilityMlPerMmHgSec-0.01)<1e-12);
  assert(Math.abs(s.capillaryPermeabilityRatio-1)<1e-12);
  assert(Math.abs(s.sourceStrokeVolumeMl-73.8)<1e-9);
  assert(Math.abs(s.leftMyocardialPerformanceMultiplier-1)<1e-12);
  assert(s.vasodilationDecrement===0);
});

test('inflammation increases permeability and vasodilation signal',()=>{
  const low=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:0.1,
    antiInflammatoryMediatorCA:0,
  });
  const high=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:1.0,
    antiInflammatoryMediatorCA:0,
  });
  assert(high.capillaryPermeabilityMlPerMmHgSec>
    low.capillaryPermeabilityMlPerMmHgSec);
  assert(high.vasodilationDecrement>low.vasodilationDecrement);
  assert(high.leftMyocardialPerformanceMultiplier<
    low.leftMyocardialPerformanceMultiplier);
});

test('sepsis layer refuses implied live authority for unresolved bridges',()=>{
  const s=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:1,
    antiInflammatoryMediatorCA:0.1,
  });
  assert(s.liveAuthority.leftMyocardialPerformanceMultiplier===true);
  assert(s.liveAuthority.systemicVasodilation===false);
  assert(s.liveAuthority.capillaryLeakVolume===false);
  assert(/source-family A_r state/.test(s.unresolved.systemicVasodilation));
  assert(/source capillary\/interstitial\/oncotic pressures/.test(s.unresolved.capillaryLeak));
});

test('Yamanaka Eqs.4-6 preserve explicit blood-volume bookkeeping',()=>{
  const fa=arterialCapillaryFiltration({
    permeabilityLa:0.01,
    arterialCapillaryPressureMmHg:28,
    interstitialPressureMmHg:0,
    plasmaOncoticPressureMmHg:25,
    interstitialOncoticPressureMmHg:5,
  });
  const rv=venousCapillaryReabsorption({
    permeabilityLv:0.062,
    venousCapillaryPressureMmHg:10,
    interstitialPressureMmHg:0,
    plasmaOncoticPressureMmHg:25,
    interstitialOncoticPressureMmHg:5,
  });
  assert(Number.isFinite(fa)&&Number.isFinite(rv));
  const dv=bloodVolumeRateFromCapillaryExchange({
    arterialFiltrationMlPerSec:fa,
    venousReabsorptionMlPerSec:rv,
    infusionMlPerSec:0,
  });
  assert(Math.abs(dv-(-fa+rv))<1e-12,
    'Eq.4 must be exactly -Fa+Rv+Qinf');
});

test('Yamanaka Eq.30 disease-only radius change lowers resistance in valid source domain',()=>{
  const ratio=systemicResistanceRatioFromYamanakaVasodilation({
    sourceAr:2,
    vasodilationDecrement:0.2,
  });
  assert(ratio>0&&ratio<1,
    'source vasodilation should reduce disease-only resistance ratio');
  let threw=false;
  try{
    systemicResistanceRatioFromYamanakaVasodilation({
      sourceAr:1,
      vasodilationDecrement:1,
    });
  }catch(e){threw=/non-positive A_r/.test(e.message);}
  assert(threw,'invalid source A_r domain must fail closed');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
