'use strict';

// Extract the myocardial acid-base inputs already carried by the reduced HumMod
// gas runtime. No arterial pCO2 substitution is performed.

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function myocardialBloodChemistryInputsFromGasSnapshot(gasSnapshot){
  if(!gasSnapshot||typeof gasSnapshot!=='object'){
    throw new Error('HumMod gas snapshot is required');
  }
  const bloodSid=gasSnapshot.boundary?.blood?.sidMolPerL;
  const arterialHco3=gasSnapshot.state?.arterialHco3MolPerL;
  finite(bloodSid,'gasSnapshot.boundary.blood.sidMolPerL');
  finite(arterialHco3,'gasSnapshot.state.arterialHco3MolPerL');

  return Object.freeze({
    bloodSid,
    arterialHco3,
    source:Object.freeze({
      bloodSid:'hummod-ards-core-gas-runtime boundary.blood.sidMolPerL',
      arterialHco3:'hummod-ards-core-gas-runtime state.arterialHco3MolPerL',
      arterialPco2Used:false,
    }),
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  myocardialBloodChemistryInputsFromGasSnapshot,
});
