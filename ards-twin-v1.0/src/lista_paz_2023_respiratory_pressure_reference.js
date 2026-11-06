'use strict';

/**
 * Lista-Paz et al. 2023 maximal respiratory pressure reference equations.
 *
 * Primary source:
 * Lista-Paz A et al. Arch Bronconeumol. 2023;59(12):813-820.
 * DOI: 10.1016/j.arbres.2023.08.016.
 *
 * Source units:
 * - age: years
 * - BMI: kg/m^2
 * - output PImax/PEmax: cmH2O
 *
 * These are population reference equations used by the Hennigs respiratory
 * muscle-strength chain. They are not patient measurements and are not a
 * substitute for measured respiratory muscle strength.
 */

const SOURCE=Object.freeze({
  citation:'Lista-Paz A et al. Maximal Respiratory Pressure Reference Equations in Healthy Adults and Cut-off Points for Defining Respiratory Muscle Weakness. Arch Bronconeumol. 2023;59(12):813-820.',
  doi:'10.1016/j.arbres.2023.08.016',
  population:'healthy Spanish adults age 18-80 years',
  authority:'source-reference-not-patient-measurement',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function validateInputs({ageYears,bmiKgM2,sex}={}){
  finite(ageYears,'ageYears');
  finite(bmiKgM2,'bmiKgM2');
  if(ageYears<18||ageYears>80){
    throw new Error('ageYears is outside the source population 18-80 years');
  }
  if(!(bmiKgM2>0)) throw new Error('bmiKgM2 must be > 0');
  if(sex!=='female'&&sex!=='male'){
    throw new Error("sex must be 'female' or 'male'");
  }
}

function predictPiMaxCmH2O(inputs={}){
  validateInputs(inputs);
  const {ageYears:a,bmiKgM2:b,sex}=inputs;
  if(sex==='female'){
    return 61.48+0.66*a+1.55*b-0.01*a*a;
  }
  return 98.60+1.18*a+0.76*b-0.02*a*a;
}

function predictPeMaxCmH2O(inputs={}){
  validateInputs(inputs);
  const {ageYears:a,bmiKgM2:b,sex}=inputs;
  if(sex==='female'){
    return 74.75+1.67*a+1.75*b-0.02*a*a;
  }
  return 58.11+3.71*a+2.64*b-0.04*a*a;
}

function predictMaxRespiratoryPressures(inputs={}){
  validateInputs(inputs);
  return Object.freeze({
    piMaxCmH2O:predictPiMaxCmH2O(inputs),
    peMaxCmH2O:predictPeMaxCmH2O(inputs),
    source:SOURCE,
    interpretation:'population-reference-prediction',
  });
}

module.exports=Object.freeze({
  SOURCE,
  predictPiMaxCmH2O,
  predictPeMaxCmH2O,
  predictMaxRespiratoryPressures,
});
