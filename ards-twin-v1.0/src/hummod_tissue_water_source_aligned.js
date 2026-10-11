'use strict';

// Source-complete HumMod tissue-water algebra that can be represented without
// inventing missing regional water dynamics.
// Sources:
// Structure/TissueH2O/CellH2O/CellH2O.DES
// Structure/TissueH2O/InterstitialWater/InterstitialWater.DES
// Structure/TissueH2O/TissueH2O.DES
// pinned to riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1

const TISSUE_SIZE_FRACTIONS=Object.freeze({
  upper:0.20,
  middle:0.50,
  lower:0.30,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function cellWaterVolume({
  icfvMl,
  rbcWaterMl,
}={}){
  nonNegative(icfvMl,'icfvMl');
  nonNegative(rbcWaterMl,'rbcWaterMl');
  const volumeMl=icfvMl-rbcWaterMl;
  if(volumeMl<0) throw new Error('cell water volume cannot be negative');
  return Object.freeze({
    volumeMl,
    volumeL:volumeMl/1000,
    controlAuthority:false,
  });
}

function initialCellWaterVolume({
  initialIcfvMl,
  initialRbcWaterMl,
}={}){
  return cellWaterVolume({
    icfvMl:initialIcfvMl,
    rbcWaterMl:initialRbcWaterMl,
  });
}

function initialInterstitialWaterVolume({
  initialEcfvMl,
  initialPlasmaVolumeMl,
  initialExternalWaterCoreMl,
}={}){
  nonNegative(initialEcfvMl,'initialEcfvMl');
  nonNegative(initialPlasmaVolumeMl,'initialPlasmaVolumeMl');
  nonNegative(initialExternalWaterCoreMl,'initialExternalWaterCoreMl');
  const volumeMl=
    initialEcfvMl-initialPlasmaVolumeMl-initialExternalWaterCoreMl;
  if(volumeMl<0) throw new Error('initial interstitial water volume cannot be negative');
  return Object.freeze({
    volumeMl,
    volumeL:volumeMl/1000,
    controlAuthority:false,
  });
}

function tissueWaterVolume({
  upperVolumeMl,
  middleVolumeMl,
  lowerVolumeMl,
}={}){
  [upperVolumeMl,middleVolumeMl,lowerVolumeMl].forEach((v,i)=>
    nonNegative(v,['upperVolumeMl','middleVolumeMl','lowerVolumeMl'][i])
  );
  const volumeMl=upperVolumeMl+middleVolumeMl+lowerVolumeMl;
  return Object.freeze({
    volumeMl,
    volumeL:volumeMl/1000,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  TISSUE_SIZE_FRACTIONS,
  cellWaterVolume,
  initialCellWaterVolume,
  initialInterstitialWaterVolume,
  tissueWaterVolume,
});
