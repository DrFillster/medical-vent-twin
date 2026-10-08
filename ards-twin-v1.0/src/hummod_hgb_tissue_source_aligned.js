'use strict';

// Exact HumMod hemoglobin property algebra used by HgbTissue.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/Hemoglobin/HgbProps.DES
// Structure/Hemoglobin/HgbTissue.DES

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

const HILL_CONSTANT=2.3;
const PO2_SATURATED=120;
const O2_SOLUBILITY=0.00003;
const TEMP_K=0.024;
const PH_K=-0.40;
const PCO2_K=0.06;
const CO_K=-0.0067;
const TEMP_NORM=37;
const PH_NORM=7.40;
const CO2_NORM=40;
const CO_NORM=0;
const P50_BASIC=26.6;

function setupHgbProps({
  tempC,
  pH,
  pCO2MmHg,
  carboxyPercent,
  tempSensitivity=1,
  pHSensitivity=1,
  pCO2Sensitivity=1,
  coSensitivity=1,
}={}){
  [tempC,pH,pCO2MmHg,carboxyPercent,tempSensitivity,pHSensitivity,pCO2Sensitivity,coSensitivity]
    .forEach((v,i)=>finite(v,['tempC','pH','pCO2MmHg','carboxyPercent','tempSensitivity','pHSensitivity','pCO2Sensitivity','coSensitivity'][i]));

  const tempEffect=10**(tempSensitivity*TEMP_K*(tempC-TEMP_NORM));
  const phEffect=10**(pHSensitivity*PH_K*(pH-PH_NORM));
  const logPco2=pCO2MmHg<1?0:Math.log10(pCO2MmHg);
  const pco2Effect=10**(pCO2Sensitivity*PCO2_K*(logPco2-Math.log10(CO2_NORM)));
  const coEffect=10**(coSensitivity*CO_K*(carboxyPercent-CO_NORM));
  const p50=P50_BASIC*tempEffect*phEffect*pco2Effect*coEffect;
  const an=(PO2_SATURATED/p50)**HILL_CONSTANT;
  const scaleForSat=(1+an)/an;

  return Object.freeze({
    tempEffect,
    phEffect,
    pco2Effect,
    coEffect,
    p50,
    scaleForSat,
  });
}

function o2ContentToPo2({
  o2ContentMlPerMl,
  o2MaxMlPerMl,
  p50,
  scaleForSat,
}={}){
  finite(o2ContentMlPerMl,'o2ContentMlPerMl');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  positive(p50,'p50');
  positive(scaleForSat,'scaleForSat');

  if(o2ContentMlPerMl<=0) return 0;
  if(o2ContentMlPerMl>o2MaxMlPerMl){
    return PO2_SATURATED+
      ((o2ContentMlPerMl-o2MaxMlPerMl)/O2_SOLUBILITY);
  }

  const sat=o2ContentMlPerMl/o2MaxMlPerMl;
  const s=sat/scaleForSat;
  const a=(s/(1-s))**(1/HILL_CONSTANT);
  return a*p50;
}

function po2ToO2Content({
  po2MmHg,
  o2MaxMlPerMl,
  p50,
  scaleForSat,
}={}){
  finite(po2MmHg,'po2MmHg');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  positive(p50,'p50');
  positive(scaleForSat,'scaleForSat');

  if(po2MmHg<=0) return 0;
  if(po2MmHg>=PO2_SATURATED){
    return o2MaxMlPerMl+((po2MmHg-PO2_SATURATED)*O2_SOLUBILITY);
  }

  const an=(po2MmHg/p50)**HILL_CONSTANT;
  const sat=scaleForSat*an/(1+an);
  return sat*o2MaxMlPerMl;
}

module.exports={
  HILL_CONSTANT,
  PO2_SATURATED,
  O2_SOLUBILITY,
  TEMP_K,
  PH_K,
  PCO2_K,
  CO_K,
  TEMP_NORM,
  PH_NORM,
  CO2_NORM,
  CO_NORM,
  P50_BASIC,
  setupHgbProps,
  o2ContentToPo2,
  po2ToO2Content,
};
