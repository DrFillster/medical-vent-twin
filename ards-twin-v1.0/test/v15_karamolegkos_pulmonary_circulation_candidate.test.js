'use strict';

const {
  SOURCE,
  PARAMETERS,
  pulmonaryArteriolarResistance,
  pulmonaryShuntFlow,
  totalPeripheralFlow,
  pulmonaryCapillaryFlow,
  pulmonaryCapillaryVolume,
  dPulmonaryArteryTransmuralPressureDt,
  dPulmonaryArterialFlowDt,
  dPulmonaryArteriolarTransmuralPressureDt,
  dPulmonaryCapillaryTransmuralPressureDt,
  dPulmonaryVenousTransmuralPressureDt,
} = require('../src/karamolegkos_pulmonary_circulation_candidate.js');

let passed=0, failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(cond,msg){if(!cond)throw new Error(msg||'assertion failed');}
function close(a,b,tol=1e-12){return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));}

test('primary source identity and Table II parameters are pinned',()=>{
  assert(SOURCE.doi==='10.1109/OJEMB.2021.3128629');
  assert(PARAMETERS.CpaMlPerMmHg===0.76);
  assert(PARAMETERS.RpaMmHgSecPerMl===0.023);
  assert(PARAMETERS.LpaMmHgSec2PerMl===1.8e-4);
  assert(PARAMETERS.CpalMlPerMmHg===1.93);
  assert(PARAMETERS.CpcMlPerMmHg===3.87);
  assert(PARAMETERS.RppTotalMmHgSecPerMl===0.0894);
  assert(PARAMETERS.CpvMlPerMmHg===25.37);
  assert(PARAMETERS.RpvMmHgSecPerMl===0.0056);
  assert(PARAMETERS.frcNominalL===2.25);
});

test('Eq 3 reproduces its nominal-FRC algebra exactly',()=>{
  const sh=0.017;
  const r=pulmonaryArteriolarResistance({
    alveolarVolumeL:PARAMETERS.frcNominalL,
    shuntFraction:sh,
  });
  assert(close(r,PARAMETERS.RppTotalMmHgSecPerMl/(2*(1-sh))));
});

test('Eq 3 has source quadratic alveolar-volume dependence',()=>{
  const sh=0.017;
  const r1=pulmonaryArteriolarResistance({
    alveolarVolumeL:PARAMETERS.frcNominalL,
    shuntFraction:sh,
  });
  const r2=pulmonaryArteriolarResistance({
    alveolarVolumeL:2*PARAMETERS.frcNominalL,
    shuntFraction:sh,
  });
  assert(close(r2/r1,4));
});

test('A8 and A15 conserve total peripheral flow',()=>{
  const q=50, sh=0.2;
  const qs=pulmonaryShuntFlow({
    nonShuntArteriolarFlowMlPerSec:q,
    shuntFraction:sh,
  });
  const qt=totalPeripheralFlow({
    nonShuntArteriolarFlowMlPerSec:q,
    shuntFraction:sh,
  });
  assert(close(q+qs,qt));
});

test('A13 uses alveolar rather than pleural pressure as capillary external pressure',()=>{
  const v1=pulmonaryCapillaryVolume({
    pressureMmHg:12,
    alveolarPressureMmHg:5,
  });
  const v2=pulmonaryCapillaryVolume({
    pressureMmHg:12,
    alveolarPressureMmHg:10,
  });
  assert(v2<v1,'higher alveolar pressure should reduce capillary transmural volume at fixed intravascular pressure');
});

test('A12 refuses to invent an unverified capillary resistance',()=>{
  let threw=false;
  try{
    pulmonaryCapillaryFlow({
      pulmonaryCapillaryPressureMmHg:10,
      pulmonaryVenousPressureMmHg:7,
    });
  }catch(_){threw=true;}
  assert(threw,'R_pc must be explicitly supplied until primary value is verified');
});

test('continuity derivatives are zero when source flows balance',()=>{
  assert(close(dPulmonaryArteryTransmuralPressureDt({
    rvOutflowMlPerSec:80,
    pulmonaryArterialFlowMlPerSec:80,
  }),0));
  assert(close(dPulmonaryArteriolarTransmuralPressureDt({
    pulmonaryArterialFlowMlPerSec:80,
    nonShuntArteriolarFlowMlPerSec:70,
    shuntFlowMlPerSec:10,
  }),0));
  assert(close(dPulmonaryCapillaryTransmuralPressureDt({
    nonShuntArteriolarFlowMlPerSec:70,
    pulmonaryCapillaryFlowMlPerSec:70,
  }),0));
  assert(close(dPulmonaryVenousTransmuralPressureDt({
    shuntFlowMlPerSec:10,
    pulmonaryCapillaryFlowMlPerSec:70,
    pulmonaryVenousFlowMlPerSec:80,
  }),0));
});

test('A6 preserves the published pulmonary arterial momentum balance',()=>{
  const d=dPulmonaryArterialFlowDt({
    pulmonaryArteryPressureMmHg:20,
    pulmonaryArteriolarPressureMmHg:15,
    pulmonaryArterialFlowMlPerSec:5/PARAMETERS.RpaMmHgSecPerMl,
  });
  assert(close(d,0,1e-10));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
