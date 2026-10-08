'use strict';

// Exact HumMod acid-base primitives required by myocardial pH.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/AcidBase/PhGeneral.DES
// Structure/AcidBase/PhCells.DES
// Structure/CO2/Blood-GasToBase.DES
// Structure/CO2/Tissue-BaseToGas.DES

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

const PH_CELLS_PK=7.15;
const BLOOD_GAS_TO_BASE_A=0.2325;
const BLOOD_GAS_TO_BASE_B=0.00036;
const TISSUE_BASE_TO_GAS_C=-1411.4;
const TISSUE_BASE_TO_GAS_D=5988.0;

function phGeneral({pK,pCO2,SID}={}){
  finite(pK,'pK'); finite(pCO2,'pCO2'); finite(SID,'SID');
  let pH;
  if(pCO2<=0){
    pH=pK+3;
  } else if((SID/pCO2)<1e-3){
    pH=pK-3;
  } else {
    pH=pK+Math.log10(SID/pCO2);
  }
  const hydrogen=10**(9-pH);
  return Object.freeze({pH,hydrogen});
}

function phCells({pCO2,SID}={}){
  return phGeneral({pK:PH_CELLS_PK,pCO2,SID});
}

function bloodGasToBase({pCO2,SID}={}){
  finite(pCO2,'pCO2'); finite(SID,'SID');
  const hco3=(pCO2>0&&SID>0)
    ? (BLOOD_GAS_TO_BASE_A*SID)+(BLOOD_GAS_TO_BASE_B*pCO2)
    : 0.0001;
  return Object.freeze({hco3});
}

function tissueBaseToGas({hco3,SID}={}){
  finite(hco3,'hco3'); finite(SID,'SID');
  const pCO2=(hco3>0&&SID>0)
    ? Math.max((TISSUE_BASE_TO_GAS_C*SID)+(TISSUE_BASE_TO_GAS_D*hco3),0.0001)
    : 0.0001;
  return Object.freeze({pCO2});
}

module.exports={
  PH_CELLS_PK,
  BLOOD_GAS_TO_BASE_A,
  BLOOD_GAS_TO_BASE_B,
  TISSUE_BASE_TO_GAS_C,
  TISSUE_BASE_TO_GAS_D,
  phGeneral,
  phCells,
  bloodGasToBase,
  tissueBaseToGas,
};
