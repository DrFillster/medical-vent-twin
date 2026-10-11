'use strict';

const SHIMAYOSHI_REFERENCE_TOTAL_PRESSURE_MMHG=790;

const SOURCE=Object.freeze({
  hummod:Object.freeze({
    repository:'riliescu/hummod-standalone',
    revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
    myocardialPco2Structure:'Structure/LeftHeart/LeftHeart-CO2.DES',
    unitEvidence:'Display/Physiology/CO2/Blood/Artys.DES: pCO2 normal value 41.0 mmHg',
  }),
  shimayoshi:Object.freeze({
    repository:'atakeuti/TS-AT-SM-2026-IRmodel',
    revision:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
    variable:'CO2o_p',
    sourceDefinition:'extracellular CO2 percent',
    referenceTotalPressureMmHg:SHIMAYOSHI_REFERENCE_TOTAL_PRESSURE_MMHG,
  }),
  controlAuthority:false,
});

function finiteNonnegative(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0){
    throw new Error(label+' must be finite and >= 0');
  }
  return v;
}

function shimayoshiEquivalentCo2PercentFromPco2MmHg({
  myocardialPco2MmHg,
  totalPressureMmHg=SHIMAYOSHI_REFERENCE_TOTAL_PRESSURE_MMHG,
}={}){
  finiteNonnegative(myocardialPco2MmHg,'myocardialPco2MmHg');
  if(typeof totalPressureMmHg!=='number'||
     !Number.isFinite(totalPressureMmHg)||
     !(totalPressureMmHg>0)){
    throw new Error('totalPressureMmHg must be finite and > 0');
  }

  const sourceEquivalentCo2Percent=
    100*myocardialPco2MmHg/totalPressureMmHg;

  return Object.freeze({
    myocardialPco2MmHg,
    totalPressureMmHg,
    sourceEquivalentCo2Percent,
    status:'dimensional-HumMod-myocardial-PCO2-to-Shimayoshi-CO2-percent-shadow',
    fittedGain:false,
    closedLoopAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SHIMAYOSHI_REFERENCE_TOTAL_PRESSURE_MMHG,
  SOURCE,
  shimayoshiEquivalentCo2PercentFromPco2MmHg,
});
