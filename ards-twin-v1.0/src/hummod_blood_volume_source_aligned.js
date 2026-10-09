'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function createHumModBloodVolume({
  initialBloodVolumeMl=5400,
  initialHematocritFraction=0.44,
}={}){
  positive(initialBloodVolumeMl,'initialBloodVolumeMl');
  finite(initialHematocritFraction,'initialHematocritFraction');
  if(initialHematocritFraction<=0||initialHematocritFraction>=1){
    throw new Error('initialHematocritFraction must be in (0,1)');
  }

  let rbcVolumeMl=initialBloodVolumeMl*initialHematocritFraction;
  let plasmaVolumeMl=initialBloodVolumeMl*(1-initialHematocritFraction);
  let hemorrhageVolumeMl=0;
  let last=null;

  function step({
    dtSec,
    hemorrhageSwitch=false,
    hemorrhageTargetRateMlPerMin=0,
    rbcGainMlPerMin=0,
    plasmaGainMlPerMin=0,
    otherRbcLossMlPerMin=0,
    otherPlasmaLossMlPerMin=0,
  }={}){
    positive(dtSec,'dtSec');
    nonNegative(hemorrhageTargetRateMlPerMin,'hemorrhageTargetRateMlPerMin');
    finite(rbcGainMlPerMin,'rbcGainMlPerMin');
    finite(plasmaGainMlPerMin,'plasmaGainMlPerMin');
    nonNegative(otherRbcLossMlPerMin,'otherRbcLossMlPerMin');
    nonNegative(otherPlasmaLossMlPerMin,'otherPlasmaLossMlPerMin');

    const bloodVolumeMl=rbcVolumeMl+plasmaVolumeMl;
    const hct=rbcVolumeMl/bloodVolumeMl;
    const pvcrit=1-hct;
    const hemorrhageRateMlPerMin=hemorrhageSwitch
      ? hemorrhageTargetRateMlPerMin
      : 0;
    const hemorrhageRbcRateMlPerMin=hct*hemorrhageRateMlPerMin;
    const hemorrhagePlasmaRateMlPerMin=pvcrit*hemorrhageRateMlPerMin;

    const dtMin=dtSec/60;
    rbcVolumeMl += dtMin*(
      rbcGainMlPerMin-
      otherRbcLossMlPerMin-
      hemorrhageRbcRateMlPerMin
    );
    plasmaVolumeMl += dtMin*(
      plasmaGainMlPerMin-
      otherPlasmaLossMlPerMin-
      hemorrhagePlasmaRateMlPerMin
    );
    hemorrhageVolumeMl += dtMin*hemorrhageRateMlPerMin;

    if(!(rbcVolumeMl>0)&&hemorrhageSwitch){
      throw new Error('RBC volume became non-physical during hemorrhage');
    }
    if(!(plasmaVolumeMl>0)&&hemorrhageSwitch){
      throw new Error('plasma volume became non-physical during hemorrhage');
    }

    const newBloodVolumeMl=rbcVolumeMl+plasmaVolumeMl;
    last=Object.freeze({
      bloodVolumeMl:newBloodVolumeMl,
      rbcVolumeMl,
      plasmaVolumeMl,
      hematocritFraction:rbcVolumeMl/newBloodVolumeMl,
      plasmaVolumeFraction:plasmaVolumeMl/newBloodVolumeMl,
      hemorrhageSwitch:Boolean(hemorrhageSwitch),
      hemorrhageTargetRateMlPerMin,
      hemorrhageRateMlPerMin,
      hemorrhageRbcRateMlPerMin,
      hemorrhagePlasmaRateMlPerMin,
      hemorrhageVolumeMl,
      rbcGainMlPerMin,
      plasmaGainMlPerMin,
      otherRbcLossMlPerMin,
      otherPlasmaLossMlPerMin,
    });
    return snapshot();
  }

  function snapshot(){
    const bloodVolumeMl=rbcVolumeMl+plasmaVolumeMl;
    return Object.freeze({
      schema:'hummod-source-aligned-blood-volume/v1',
      ...(last||{
        bloodVolumeMl,
        rbcVolumeMl,
        plasmaVolumeMl,
        hematocritFraction:rbcVolumeMl/bloodVolumeMl,
        plasmaVolumeFraction:plasmaVolumeMl/bloodVolumeMl,
        hemorrhageSwitch:false,
        hemorrhageTargetRateMlPerMin:0,
        hemorrhageRateMlPerMin:0,
        hemorrhageRbcRateMlPerMin:0,
        hemorrhagePlasmaRateMlPerMin:0,
        hemorrhageVolumeMl,
        rbcGainMlPerMin:0,
        plasmaGainMlPerMin:0,
        otherRbcLossMlPerMin:0,
        otherPlasmaLossMlPerMin:0,
      }),
      provenance:Object.freeze({
        status:'source-aligned-acute-blood-volume-subset',
        sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
        sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
        sourceStructures:Object.freeze([
          'Hemorrhage',
          'RBCVol',
          'PlasmaVol',
          'BloodVol',
        ]),
        reduction:'non-hemorrhage RBC/plasma gains and losses remain explicit boundaries until their source dependencies are ported',
        clinicalValidation:false,
      }),
    });
  }

  return Object.freeze({
    kind:'hummod-source-aligned-blood-volume',
    step,
    snapshot,
  });
}

module.exports={createHumModBloodVolume};
