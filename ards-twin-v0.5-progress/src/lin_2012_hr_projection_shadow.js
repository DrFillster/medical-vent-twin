'use strict';

/**
 * Experimental v2.4 Lin-2012 HR projection.
 *
 * This is intentionally SHADOW ONLY.
 *
 * Physiology comes from the published Lin/Ngwompo/Tilley steady-state
 * baro-chemoreflex + HR equations (Eqs. 12-31), implemented in
 * lin_2012_steady_state_hr_candidate.js.
 *
 * The only reduction here is an operating-point translation:
 *
 *   HR_projected =
 *     HR_patient_reference
 *     + [ HR_Lin(current MAP, PaO2, PaCO2)
 *         - HR_Lin(reference MAP, reference PaO2, reference PaCO2) ]
 *
 * This preserves the PUBLISHED Lin model's predicted change in HR while
 * allowing the bedside virtual patient's authored resting HR to differ from
 * Lin's published intrinsic/operating point.
 *
 * It is not a PaCO2->HR fit, floor, gain, or interpolation.
 * It has no control authority until physician/source validation accepts the
 * reduction and the missing dynamic central-compartment parameter is resolved.
 */

const {
  evaluateLin2012SteadyState,
}=require('./lin_2012_steady_state_hr_candidate.js');

const SOURCE=Object.freeze({
  primary:
    'Lin J, Ngwompo RF, Tilley DG. Proc Inst Mech Eng H. 2012;226(10):787-803. doi:10.1177/0954411912451823',
  sourceEquations:'Lin 2012 Eqs. 12-31 steady-state algebra',
  reduction:
    'patient operating-point translation preserves the Lin model delta-HR; no fitted gain',
  authority:'shadow-only',
  dynamicAuthority:false,
  clinicalValidation:false,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function createLin2012HrProjectionShadow({
  patientReferenceHeartRatePerMin,
  referenceMeanArterialPressureMmHg=82,
  referenceArterialPo2MmHg=90,
  referenceArterialPco2MmHg=40,
}={}){
  positive(patientReferenceHeartRatePerMin,'patientReferenceHeartRatePerMin');
  finite(referenceMeanArterialPressureMmHg,'referenceMeanArterialPressureMmHg');
  positive(referenceArterialPo2MmHg,'referenceArterialPo2MmHg');
  positive(referenceArterialPco2MmHg,'referenceArterialPco2MmHg');

  const reference=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:referenceMeanArterialPressureMmHg,
    arterialPo2MmHg:referenceArterialPo2MmHg,
    arterialPco2MmHg:referenceArterialPco2MmHg,
  });

  let last=null;

  function evaluate({
    meanArterialPressureMmHg,
    arterialPo2MmHg,
    arterialPco2MmHg,
  }={}){
    const current=evaluateLin2012SteadyState({
      meanArterialPressureMmHg,
      arterialPo2MmHg,
      arterialPco2MmHg,
    });
    const sourceDeltaHeartRatePerMin=
      current.heartRatePerMin-reference.heartRatePerMin;
    const projectedHeartRatePerMin=
      patientReferenceHeartRatePerMin+sourceDeltaHeartRatePerMin;

    last=Object.freeze({
      patientReferenceHeartRatePerMin,
      sourceReferenceHeartRatePerMin:reference.heartRatePerMin,
      sourceCurrentHeartRatePerMin:current.heartRatePerMin,
      sourceDeltaHeartRatePerMin,
      projectedHeartRatePerMin,
      reference,
      current,
      controlAuthority:false,
      dynamicAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  return Object.freeze({
    kind:'lin-2012-hr-operating-point-shadow',
    evaluate,
    snapshot:()=>last,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createLin2012HrProjectionShadow,
});
