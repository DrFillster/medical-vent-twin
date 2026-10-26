'use strict';

/**
 * v2.4 HR source qualification.
 *
 * Purpose:
 * Compare the two published-equation candidates for the physician-observed
 * high-MAP + severe-gas HR defect without fitting an HR target.
 *
 * This is a qualification report only. It does not change live authority.
 */

const {
  createV2SourceAutonomicController,
}=require('../src/v2_source_autonomic_controller.js');
const {
  evaluateLin2012SteadyState,
}=require('../src/lin_2012_steady_state_hr_candidate.js');
const {
  createLin2012HrProjectionShadow,
}=require('../src/lin_2012_hr_projection_shadow.js');

function runAlbanese(controller,seconds,input){
  let s;
  const dtSec=0.1;
  for(let i=0;i<Math.round(seconds/dtSec);i++){
    s=controller.step({dtSec,...input});
  }
  return s;
}
function makeAlbanese(){
  return createV2SourceAutonomicController({
    baseline:{
      heartRatePerMin:75,
      systemicArterialConductanceMlPerMinPerMmHg:60,
      systemicVenousV0Ml:1700,
    },
  });
}
function albaneseScenario(map,pao2,paco2,pH,vt){
  const c=makeAlbanese();
  runAlbanese(c,60,{
    meanArterialPressureMmHg:82,
    tidalVolumeL:0.42,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
    arterialPh:7.40,
  });
  return runAlbanese(c,120,{
    meanArterialPressureMmHg:map,
    tidalVolumeL:vt,
    arterialPo2MmHg:pao2,
    arterialPco2MmHg:paco2,
    arterialPh:pH,
  });
}

const reference={
  map:82,pao2:90,paco2:40,pH:7.40,vt:0.42,
};
const severe={
  map:104,pao2:35,paco2:110,pH:6.90,vt:0.10,
};

const aRef=albaneseScenario(
  reference.map,reference.pao2,reference.paco2,reference.pH,reference.vt
);
const aSevere=albaneseScenario(
  severe.map,severe.pao2,severe.paco2,severe.pH,severe.vt
);

const linRef=evaluateLin2012SteadyState({
  meanArterialPressureMmHg:reference.map,
  arterialPo2MmHg:reference.pao2,
  arterialPco2MmHg:reference.paco2,
});
const linSevere=evaluateLin2012SteadyState({
  meanArterialPressureMmHg:severe.map,
  arterialPo2MmHg:severe.pao2,
  arterialPco2MmHg:severe.paco2,
});
const linProjection=createLin2012HrProjectionShadow({
  patientReferenceHeartRatePerMin:75,
  referenceMeanArterialPressureMmHg:reference.map,
  referenceArterialPo2MmHg:reference.pao2,
  referenceArterialPco2MmHg:reference.paco2,
});
const linProjectedSevere=linProjection.evaluate({
  meanArterialPressureMmHg:severe.map,
  arterialPo2MmHg:severe.pao2,
  arterialPco2MmHg:severe.paco2,
});

const maps=[60,70,80,90,100,104,110];
const mapSweep=maps.map(map=>{
  const normal=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:map,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  const gas=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:map,
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  return {
    map,
    linNormalHr:normal.heartRatePerMin,
    linSevereGasHr:gas.heartRatePerMin,
    linSevereMinusNormalHr:gas.heartRatePerMin-normal.heartRatePerMin,
    linNormalDemandPressure:normal.demandPressureMmHg,
    linSevereDemandPressure:gas.demandPressureMmHg,
    linNormalSna:normal.sympatheticHz,
    linSevereSna:gas.sympatheticHz,
    linNormalPna:normal.parasympatheticHz,
    linSeverePna:gas.parasympatheticHz,
  };
});

const qualification={
  schema:'v2.4-hr-source-qualification/v1',
  physicianDefect:
    'High MAP during severe hypoxemia/hypercapnia produces inappropriately low HR.',
  empiricalPaCO2HrFloorAccepted:false,
  liveAuthorityChanged:false,
  reference,
  severe,
  albanese2016:{
    role:'negative/source-fidelity comparator in reduced v2 chassis',
    referenceHr:aRef.heartRatePerMin,
    severeHr:aSevere.heartRatePerMin,
    severeFAb:aSevere.afferents.fAbSpikesPerSec,
    severeFAc:aSevere.afferents.fAcSpikesPerSec,
    severeFSh:aSevere.autonomic.fShSpikesPerSec,
    severeFV:aSevere.autonomic.fVSpikesPerSec,
    finding:
      aSevere.heartRatePerMin<aRef.heartRatePerMin
        ?'fails-high-MAP-severe-gas-direction'
        :'passes-direction',
  },
  lin2012:{
    role:'leading published baro-chemoreflex HR candidate',
    referenceAbsoluteHr:linRef.heartRatePerMin,
    severeAbsoluteHr:linSevere.heartRatePerMin,
    severeMinusReferenceHr:linSevere.heartRatePerMin-linRef.heartRatePerMin,
    patientReferenceHr:75,
    severeProjectedHr:linProjectedSevere.projectedHeartRatePerMin,
    severeDemandPressure:linSevere.demandPressureMmHg,
    severeSympatheticHz:linSevere.sympatheticHz,
    severeParasympatheticHz:linSevere.parasympatheticHz,
    dynamicAuthority:false,
    missingDynamicParameter:'tau_c in Lin Eq.13 central-compartment filter',
    finding:
      linSevere.heartRatePerMin>linRef.heartRatePerMin
        ?'passes-high-MAP-severe-gas-direction'
        :'fails-direction',
  },
  mapSweep,
  promotionDecision:
    'BLOCKED: Lin source equations pass steady-state direction, but live dynamic cutover is prohibited until tau_c is source-verified or physician explicitly approves a quasi-steady reduced controller.',
};

console.log(JSON.stringify(qualification,null,2));

if(qualification.albanese2016.finding!=='fails-high-MAP-severe-gas-direction'){
  throw new Error('Albanese negative comparator unexpectedly changed direction');
}
if(qualification.lin2012.finding!=='passes-high-MAP-severe-gas-direction'){
  throw new Error('Lin steady-state source candidate failed severe-gas direction');
}
if(qualification.liveAuthorityChanged!==false){
  throw new Error('qualification must not change live authority');
}
