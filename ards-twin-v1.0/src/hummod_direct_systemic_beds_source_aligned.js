'use strict';

const {humModSource}=require('./hummod_source_identity.js');

const HEPATIC_ARTERY_BASIC_CONDUCTANCE=2.8;
const AV_FISTULA_BASIC_CONDUCTANCE=0.0;

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}

function hepaticArteryFlow({
  systemicArterialPressureMmHg,
  splanchnicVenousPressureMmHg,
  basicConductance=HEPATIC_ARTERY_BASIC_CONDUCTANCE,
}={}){
  finite(systemicArterialPressureMmHg,'systemicArterialPressureMmHg');
  finite(splanchnicVenousPressureMmHg,'splanchnicVenousPressureMmHg');
  nonNegative(basicConductance,'basicConductance');
  const pressureGradientMmHg=systemicArterialPressureMmHg-splanchnicVenousPressureMmHg;
  const conductance=basicConductance;
  const bloodFlowMlPerMin=pressureGradientMmHg*conductance;
  return Object.freeze({
    pressureGradientMmHg,
    conductance,
    bloodFlowMlPerMin,
    provenance:Object.freeze({
      status:'source-aligned-equation',
      source:humModSource('Structure/Circulation/HepaticArty.DES','HepaticArty.CalcFlow'),
      clinicalValidation:false,
    }),
  });
}

function avFistulaFlow({
  systemicArterialPressureMmHg,
  systemicVenousPressureMmHg,
  basicConductance=AV_FISTULA_BASIC_CONDUCTANCE,
  viscosityConductanceEffect=1,
  plasmaVolumeFraction,
}={}){
  finite(systemicArterialPressureMmHg,'systemicArterialPressureMmHg');
  finite(systemicVenousPressureMmHg,'systemicVenousPressureMmHg');
  nonNegative(basicConductance,'basicConductance');
  nonNegative(viscosityConductanceEffect,'viscosityConductanceEffect');
  nonNegative(plasmaVolumeFraction,'plasmaVolumeFraction');
  if(plasmaVolumeFraction>1)throw new Error('plasmaVolumeFraction must be <= 1');
  const pressureGradientMmHg=Math.max(systemicArterialPressureMmHg-systemicVenousPressureMmHg,0);
  const conductance=basicConductance*viscosityConductanceEffect;
  const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
  return Object.freeze({
    pressureGradientMmHg,
    conductance,
    bloodFlowMlPerMin,
    plasmaFlowMlPerMin:bloodFlowMlPerMin*plasmaVolumeFraction,
    provenance:Object.freeze({
      status:'source-aligned-equation',
      pressureSource:humModSource('Structure/A-VFistula/A-VFistula-Pressure.DES','A-VFistula-Pressure.Calc'),
      flowSource:humModSource('Structure/A-VFistula/A-VFistula-Flow.DES','A-VFistula-Flow.Calc'),
      clinicalValidation:false,
    }),
  });
}

module.exports={
  HEPATIC_ARTERY_BASIC_CONDUCTANCE,
  AV_FISTULA_BASIC_CONDUCTANCE,
  hepaticArteryFlow,
  avFistulaFlow,
};
