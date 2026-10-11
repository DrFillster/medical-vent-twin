'use strict';

const {
  myocardialSid,
}=require('./hummod_myocardial_sid_source_aligned.js');
const {
  calculateMyocardialCo2Derivatives,
}=require('./hummod_myocardial_co2_source_aligned.js');
const {
  phCells,
}=require('./hummod_acid_base_source_aligned.js');

const SOURCE=Object.freeze({
  repository:'riliescu/hummod-standalone',
  revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  structures:Object.freeze([
    'Structure/Electrolytes/CellSID.DES',
    'Structure/LeftHeart/LeftHeart-Ph.DES',
    'Structure/RightHeart/RightHeart-Ph.DES',
    'Structure/LeftHeart/LeftHeart-CO2.DES',
    'Structure/RightHeart/RightHeart-CO2.DES',
    'Structure/AcidBase/PhCells.DES',
    'Structure/CO2/Tissue-BaseToGas.DES',
  ]),
  controlAuthority:false,
});

function myocardialAcidBaseState({
  side,
  intracellularPotassium,
  myocardialLactate,
  co2Mass,
  liquidVolumeMl,
  bloodFlowMlPerMin,
  o2UseMlPerMin,
  bloodSid,
  arterialHco3,
  dxMin,
  dxUndefined=false,
  respiratoryQuotient,
}={}){
  const sidState=myocardialSid({
    intracellularPotassium,
    myocardialLactate,
  });

  const co2State=calculateMyocardialCo2Derivatives({
    side,
    mass:co2Mass,
    liquidVolumeMl,
    tissueSid:sidState.sid,
    bloodFlowMlPerMin,
    o2UseMlPerMin,
    bloodSid,
    arterialHco3,
    dxMin,
    dxUndefined,
    ...(respiratoryQuotient==null?{}:{respiratoryQuotient}),
  });

  const phState=phCells({
    pCO2:co2State.pCO2,
    SID:sidState.sid,
  });

  return Object.freeze({
    side,
    intracellularPh:phState.pH,
    intracellularHydrogen:phState.hydrogen,
    myocardialPco2:co2State.pCO2,
    myocardialSid:sidState.sid,
    myocardialSidMeqPerL:sidState.sidMeqPerL,
    myocardialHco3:co2State.hco3,
    myocardialHco3MeqPerL:co2State.hco3MeqPerL,
    sidState,
    co2State,
    status:'HumMod-source-aligned-myocardial-acid-base-state',
    controlAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  myocardialAcidBaseState,
});
