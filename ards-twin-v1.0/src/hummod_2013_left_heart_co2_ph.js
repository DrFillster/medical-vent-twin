'use strict';

/**
 * HumMod 2012/2013 LeftHeart CO2/SID/pHi runtime.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/LeftHeart/LeftHeart-CO2.DES
 * - Structure/LeftHeart/LeftHeart-Ph.DES
 * - Structure/CellSID/CellSID.DES
 * - Structure/AcidBase/PhCells.DES
 * - Structure/AcidBase/PhGeneral.DES
 * - Structure/CO2/CO2Blood.DES
 * - Structure/CO2/CO2_[HCO3]_To_pCO2.DES
 * - Structure/CO2/CO2_pCO2_To_[HCO3].DES
 * - Structure/CO2/CO2Tools.DES
 *
 * The source LeftHeart-CO2 state is declared as <diffeq>. This implementation
 * uses an explicit fixed-step update of that source derivative and therefore
 * discloses non-identity with the DES adaptive integrator. Timestep
 * convergence must be demonstrated before integration.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  authority:'candidate-not-canonical',
});

const CELL_OTHER_CATIONS=0.012;
const CELL_STRONG_ANIONS=0.117;
const CELL_WEAK_ANIONS=0.036;

const CELL_PH_PK=7.15;

const TISSUE_CO2_P50_MMHG=32.0;
const TISSUE_CO2_K_MULTIPLIER=0.760;
const INITIAL_PCO2_MMHG=60.0;
const INITIAL_SID=0.036;

const BLOOD_CO2_P50_MMHG=32.0;
const BLOOD_CO2_K_MULTIPLIER=1.09;

const LITERS_TO_MOLS=0.0446;
const DEFAULT_RQ=0.8;

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function pco2ToHco3({pCO2MmHg,k,p50MmHg=32}={}){
  finite(pCO2MmHg,'pCO2MmHg');
  finite(k,'k');
  positive(p50MmHg,'p50MmHg');
  if(pCO2MmHg<=0) return 0;
  return k*(pCO2MmHg/(p50MmHg+pCO2MmHg));
}

function hco3ToPco2({hco3,k,p50MmHg=32}={}){
  finite(hco3,'hco3');
  finite(k,'k');
  positive(p50MmHg,'p50MmHg');
  if(hco3<=0) return 0;
  if(hco3>=k) return 1000;
  return (p50MmHg*hco3)/(k-hco3);
}

function myocardialSid2013({
  intracellularPotassium,
  myocardialLactateMeqPerMl,
}={}){
  finite(intracellularPotassium,'intracellularPotassium');
  finite(myocardialLactateMeqPerMl,'myocardialLactateMeqPerMl');
  const sid=
    intracellularPotassium+
    CELL_OTHER_CATIONS-
    CELL_STRONG_ANIONS-
    myocardialLactateMeqPerMl;
  return Object.freeze({
    sid,
    sidMeqPerL:1000*sid,
    intracellularPotassium,
    myocardialLactateMeqPerMl,
    otherCations:CELL_OTHER_CATIONS,
    strongAnions:CELL_STRONG_ANIONS,
    weakAnions:CELL_WEAK_ANIONS,
  });
}

function cellPh2013({pCO2MmHg,sidMeqPerL}={}){
  finite(pCO2MmHg,'pCO2MmHg');
  finite(sidMeqPerL,'sidMeqPerL');
  let pH;
  if(pCO2MmHg<=0){
    pH=CELL_PH_PK+3;
  }else if((sidMeqPerL/pCO2MmHg)<1e-3){
    pH=CELL_PH_PK-3;
  }else{
    pH=CELL_PH_PK+Math.log10(sidMeqPerL/pCO2MmHg);
  }
  return Object.freeze({
    pH,
    hydrogenNanoEqPerL:10**(9-pH),
  });
}

function initialLeftHeartCo2Mass2013({initialLiquidVolumeMl}={}){
  positive(initialLiquidVolumeMl,'initialLiquidVolumeMl');
  const k=TISSUE_CO2_K_MULTIPLIER*INITIAL_SID;
  const initialHco3=pco2ToHco3({
    pCO2MmHg:INITIAL_PCO2_MMHG,
    k,
    p50MmHg:TISSUE_CO2_P50_MMHG,
  });
  const initialMass=initialHco3*initialLiquidVolumeMl;
  return Object.freeze({
    k,
    initialPco2MmHg:INITIAL_PCO2_MMHG,
    initialSid:INITIAL_SID,
    initialHco3,
    initialLiquidVolumeMl,
    initialMass,
  });
}

function createHumMod2013LeftHeartCo2Ph({
  initialLiquidVolumeMl,
}={}){
  const initial=initialLeftHeartCo2Mass2013({initialLiquidVolumeMl});
  let mass=initial.initialMass;
  let timeSec=0;
  let last=null;

  function derive({
    liquidVolumeMl,
    intracellularPotassium,
    myocardialLactateMeqPerMl,
  }={}){
    positive(liquidVolumeMl,'liquidVolumeMl');
    const sid=myocardialSid2013({
      intracellularPotassium,
      myocardialLactateMeqPerMl,
    });
    const hco3=mass/liquidVolumeMl;
    const tissueK=TISSUE_CO2_K_MULTIPLIER*sid.sid;
    const pCO2MmHg=hco3ToPco2({
      hco3,
      k:tissueK,
      p50MmHg:TISSUE_CO2_P50_MMHG,
    });
    const ph=cellPh2013({
      pCO2MmHg,
      sidMeqPerL:sid.sidMeqPerL,
    });
    return Object.freeze({
      mass,
      hco3,
      hco3MeqPerL:1000*hco3,
      tissueK,
      pCO2MmHg,
      sid,
      intracellularPh:ph.pH,
      hydrogenNanoEqPerL:ph.hydrogenNanoEqPerL,
    });
  }

  function step({
    dtSec,
    liquidVolumeMl,
    intracellularPotassium,
    myocardialLactateMeqPerMl,
    bloodFlowMlPerMin,
    o2UseMlPerMin,
    bloodSid,
    arterialHco3,
    respiratoryQuotient=DEFAULT_RQ,
  }={}){
    positive(dtSec,'dtSec');
    positive(liquidVolumeMl,'liquidVolumeMl');
    nonNegative(bloodFlowMlPerMin,'bloodFlowMlPerMin');
    nonNegative(o2UseMlPerMin,'o2UseMlPerMin');
    finite(bloodSid,'bloodSid');
    finite(arterialHco3,'arterialHco3');
    finite(respiratoryQuotient,'respiratoryQuotient');

    const before=derive({
      liquidVolumeMl,
      intracellularPotassium,
      myocardialLactateMeqPerMl,
    });

    const kFlow=bloodFlowMlPerMin/liquidVolumeMl;
    const dtMin=dtSec/60;
    const alpha=(kFlow*dtMin)>=100
      ?4e-44
      :Math.exp(-kFlow*dtMin);

    const inflowGasMlPerMin=
      respiratoryQuotient*o2UseMlPerMin;
    const inflowBase=
      LITERS_TO_MOLS*inflowGasMlPerMin;

    const bloodK=BLOOD_CO2_K_MULTIPLIER*bloodSid;
    const bloodHco3=pco2ToHco3({
      pCO2MmHg:before.pCO2MmHg,
      k:bloodK,
      p50MmHg:BLOOD_CO2_P50_MMHG,
    });
    const outflow0=
      bloodFlowMlPerMin*(bloodHco3-arterialHco3);
    const outflowBase=
      (alpha*outflow0)+((1-alpha)*inflowBase);
    const change=inflowBase-outflowBase;

    mass+=change*dtMin;
    if(mass<0 && mass>-1e-12) mass=0;
    if(mass<0) throw new Error('LeftHeart-CO2 mass became negative');

    timeSec+=dtSec;
    const after=derive({
      liquidVolumeMl,
      intracellularPotassium,
      myocardialLactateMeqPerMl,
    });

    last=Object.freeze({
      schema:'hummod-2013-left-heart-co2-ph/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      initial,
      before,
      ...after,
      bloodFlowMlPerMin,
      o2UseMlPerMin,
      bloodSid,
      arterialHco3,
      respiratoryQuotient,
      kFlow,
      alpha,
      inflowGasMlPerMin,
      inflowBase,
      bloodK,
      bloodHco3,
      outflow0,
      outflowBase,
      change,
      numericalImplementation:Object.freeze({
        co2MassIntegrator:'explicit fixed-step update of source <diffeq> derivative',
        exactDesIntegratorIdentity:false,
      }),
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  return Object.freeze({
    step,
    derive,
    snapshot:()=>last||Object.freeze({
      schema:'hummod-2013-left-heart-co2-ph/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      mass,
      initial,
      controlAuthority:false,
      provenance:SOURCE,
    }),
  });
}

module.exports=Object.freeze({
  SOURCE,
  CELL_OTHER_CATIONS,
  CELL_STRONG_ANIONS,
  CELL_WEAK_ANIONS,
  CELL_PH_PK,
  TISSUE_CO2_P50_MMHG,
  TISSUE_CO2_K_MULTIPLIER,
  INITIAL_PCO2_MMHG,
  INITIAL_SID,
  BLOOD_CO2_P50_MMHG,
  BLOOD_CO2_K_MULTIPLIER,
  LITERS_TO_MOLS,
  DEFAULT_RQ,
  pco2ToHco3,
  hco3ToPco2,
  myocardialSid2013,
  cellPh2013,
  initialLeftHeartCo2Mass2013,
  createHumMod2013LeftHeartCo2Ph,
});
