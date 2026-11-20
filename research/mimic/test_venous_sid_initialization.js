'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {createRequire}=require('module'),path=require('path');
const file=path.resolve(__dirname,'diagnose_venous_sid_initialization.js');
const src=fs.readFileSync(file,'utf8').split("const fs=require('fs');")[0];
const localRequire=createRequire(file);
const initPath=localRequire.resolve('../../ards-twin-v1.0/src/patient_gas_initialization.js');
const original=localRequire(initPath);
const runtime=localRequire('../../ards-twin-v1.0/src/hummod_ards_core_runtime.js');
const box={require:localRequire};vm.createContext(box);
try{
  vm.runInContext(src+';preserveSourceVenousPco2=true;',box);
  const patched=require.cache[initPath].exports;
  for(const sid of [0.02,0.04,0.05655,0.08]){
    const blood={sidMolPerL:sid,o2MaxMlPerMl:0.2,tempC:37,carboxyPercent:0};
    const args={po2MmHg:80,pco2MmHg:40,pH:7.4,blood};
    const a=original.createPatientArterialGasInitialState(args);
    const b=patched.createPatientArterialGasInitialState(args);
    const expected=runtime.deriveBloodGasOutputs({state:a.state,blood:{...blood,sidMolPerL:0.04}}).venous.pco2MmHg;
    const actual=runtime.deriveBloodGasOutputs({state:b.state,blood}).venous.pco2MmHg;
    assert(Math.abs(expected-actual)<1e-8);
  }
  console.log('ok - four synthetic SID cases and initializer invariants');
}finally{require.cache[initPath].exports=original;}
