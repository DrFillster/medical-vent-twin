'use strict';

const {
  createHumModBloodVolume,
}=require('./hummod_blood_volume_source_aligned.js');
const {
  hgbConcentrationFromHematocrit,
}=require('./hummod_hgb_concentration_source_aligned.js');
const {
  viscosityFromHematocrit,
}=require('./hummod_2013_coronary_flow_provider_primitives.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function createHumModBloodOxygenProviderCandidate({
  initialBloodVolumeMl,
  initialHematocritFraction,
  carboxyPercent=0,
}={}){
  positive(initialBloodVolumeMl,'initialBloodVolumeMl');
  finite(initialHematocritFraction,'initialHematocritFraction');
  finite(carboxyPercent,'carboxyPercent');

  const blood=createHumModBloodVolume({
    initialBloodVolumeMl,
    initialHematocritFraction,
  });
  let last=null;

  function derive(b){
    const hgb=hgbConcentrationFromHematocrit({
      hematocritFraction:b.hematocritFraction,
      carboxyPercent,
    });
    const viscosity=viscosityFromHematocrit({
      hematocritFraction:b.hematocritFraction,
    });
    last=Object.freeze({
      schema:'hummod-blood-oxygen-provider-candidate/v1',
      authority:'candidate-not-canonical',
      canonicalControlAuthority:false,
      bloodVolume:b,
      hematocritFraction:b.hematocritFraction,
      plasmaVolumeFraction:b.plasmaVolumeFraction,
      o2MaxMlPerMl:hgb.o2MaxMlPerMl,
      totalHgbGPerMl:hgb.totalHgbGPerMl,
      freeHgbGPerMl:hgb.freeHgbGPerMl,
      viscosityValue:viscosity.value,
      viscosityConductanceEffect:viscosity.conductanceEffect,
      carboxyPercent,
      controlAuthority:false,
      provenance:Object.freeze({
        bloodVolume:b.provenance,
        hgb:hgb.provenance,
        viscosity:'HumMod Structure/Circulation/Viscosity.DES',
        initialization:'explicit-required',
      }),
    });
    return last;
  }

  function step({
    dtSec,
    hemorrhageSwitch=false,
    hemorrhageTargetRateMlPerMin=0,
    rbcGainMlPerMin=0,
    plasmaGainMlPerMin=0,
    otherRbcLossMlPerMin=0,
    otherPlasmaLossMlPerMin=0,
  }={}){
    const b=blood.step({
      dtSec,
      hemorrhageSwitch,
      hemorrhageTargetRateMlPerMin,
      rbcGainMlPerMin,
      plasmaGainMlPerMin,
      otherRbcLossMlPerMin,
      otherPlasmaLossMlPerMin,
    });
    return derive(b);
  }

  function snapshot(){
    return last||derive(blood.snapshot());
  }

  return Object.freeze({step,snapshot});
}

module.exports=Object.freeze({
  createHumModBloodOxygenProviderCandidate,
});
