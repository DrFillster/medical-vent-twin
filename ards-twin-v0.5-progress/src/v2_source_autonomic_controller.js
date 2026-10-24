'use strict';

/**
 * v2.0 source-aligned autonomic adapter.
 *
 * Purpose:
 * Replace the locally tuned v1.0 MAP-error / HR / SVR / venous-volume gains
 * with published baroreflex, O2/CO2 chemoreflex, and effector equations while
 * preserving the compact v1.0 circulation and bedside UI.
 *
 * Primary source family:
 * - Ursino 1998: baroreceptor and cardiovascular effector equations.
 * - Ursino & Magosso 2000: hypoxia, pulmonary stretch, channelized autonomics.
 * - Magosso & Ursino 2001: O2-CO2 interaction and separated sympathetic channels.
 *
 * Model reduction:
 * Published absolute effector outputs are projected onto the existing v1.0
 * lumped circulation by dimensionless change from the source-model operating
 * point captured on the first step. No fitted physiologic gain is introduced:
 *   contractility multiplier = Emax / Emax_reference
 *   lumped systemic resistance multiplier = (Rsp+Rep)/(Rsp+Rep)_reference
 *   systemic conductance = baseline conductance / resistance multiplier
 *   venous V0 = baseline V0 * (Vusv+Vuev)/(Vusv+Vuev)_reference
 *
 * Pulmonary vascular control is deliberately NOT invented here. PVR-specific
 * hypoxia/airway-pressure physiology remains a separate v2.0 work item.
 */

const {
  createUrsinoBaroreceptorShadow,
}=require('./ursino_baroreceptor_shadow.js');

const {
  P:O2_2000_P,
  firstOrderExact,
  pulmonaryStretchStatic,
}=require('./ursino_magosso_autonomic_shadow.js');

const {
  createMagossoUrsinoGasAutonomicCandidate,
}=require('./magosso_ursino_2001_gas_autonomic_candidate.js');

const {
  createChannelizedEffectorCandidate,
}=require('./ursino_magosso_channelized_effectors_candidate.js');

const SOURCE=Object.freeze({
  baroreceptor:'Ursino 1998, doi:10.1152/ajpheart.1998.275.5.H1733',
  hypoxia:'Ursino & Magosso 2000, doi:10.1152/ajpheart.2000.279.1.H149',
  co2:'Magosso & Ursino 2001, doi:10.1152/ajpheart.2001.281.5.H2036',
  projection:
    'dimensionless source-effector change projected onto v1.0 lumped circulation',
  authority:'v2.0-source-aligned-reduced-controller',
});

const RESPIRATORY_ACIDOSIS_INOTROPY_ANCHOR=Object.freeze({
  definitionPh:7.35,
  challengePh:7.10,
  challengeContractilityFraction:0.45,
  citation:'Biais M et al. Anesthesiology. 2012;117:1212-1222. doi:10.1097/ALN.0b013e3182753264',
});

const SEVERE_HYPERCAPNIA_INOTROPY_ANCHORS=Object.freeze({
  normalPaco2MmHg:45,
  dogPaco2MmHg:92,
  dogEmaxFraction:9.2/11.4,
  dogCitation:
    'Walley KR et al. Circ Res. 1990. PMID 2118837: pH 7.09, PaCO2 92 mmHg, Emax 11.4 -> 9.2.',
  isolatedHeartPaco2MmHg:146,
  isolatedHeartPressureFraction:0.20,
  isolatedHeartCitation:
    'Reversible impairment of myocardial contractility due to hypercarbic acidosis in the isolated perfused rat heart. PMID 1899209: PCO2 36 -> 146 torr, LVSP and dP/dt fell to ~20% of control.',
  projection:
    'The isolated-heart 20% LVSP/dPdt endpoint is used as a bounded severe-hypercapnia whole-heart performance proxy; this is an explicit reduced-model assumption, not Emax equivalence.',
});

const HYPERCAPNIC_SYSTEMIC_VASODILATION_ANCHOR=Object.freeze({
  normalPaco2MmHg:45,
  challengePaco2MmHg:110,
  baselineSvrDynSecCm5:1748,
  challengeSvrDynSecCm5:1392,
  citation:
    'Sympathetic secretory response to hypercapnic acidosis in swine. PMID 2121704.',
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function clamp(v,lo,hi){
  return Math.max(lo,Math.min(hi,v));
}

function severeHypercapniaContractilityMultiplier(paco2MmHg){
  nonNegative(paco2MmHg,'paco2MmHg');
  const a=SEVERE_HYPERCAPNIA_INOTROPY_ANCHORS;
  if(paco2MmHg<=a.normalPaco2MmHg) return 1;
  if(paco2MmHg<=a.dogPaco2MmHg){
    const t=(paco2MmHg-a.normalPaco2MmHg)/
      (a.dogPaco2MmHg-a.normalPaco2MmHg);
    return 1+t*(a.dogEmaxFraction-1);
  }
  if(paco2MmHg>=a.isolatedHeartPaco2MmHg){
    return a.isolatedHeartPressureFraction;
  }
  const t=(paco2MmHg-a.dogPaco2MmHg)/
    (a.isolatedHeartPaco2MmHg-a.dogPaco2MmHg);
  return a.dogEmaxFraction+
    t*(a.isolatedHeartPressureFraction-a.dogEmaxFraction);
}

function hypercapnicSystemicResistanceRatio(paco2MmHg){
  nonNegative(paco2MmHg,'paco2MmHg');
  const a=HYPERCAPNIC_SYSTEMIC_VASODILATION_ANCHOR;
  if(paco2MmHg<=a.normalPaco2MmHg) return 1;
  const challengeRatio=
    a.challengeSvrDynSecCm5/a.baselineSvrDynSecCm5;
  if(paco2MmHg>=a.challengePaco2MmHg) return challengeRatio;
  const t=(paco2MmHg-a.normalPaco2MmHg)/
    (a.challengePaco2MmHg-a.normalPaco2MmHg);
  return 1+t*(challengeRatio-1);
}

function respiratoryAcidosisContractilityMultiplier({
  arterialPh,
  arterialPco2MmHg,
}={}){
  finite(arterialPh,'arterialPh');
  nonNegative(arterialPco2MmHg,'arterialPco2MmHg');
  if(arterialPco2MmHg<=45||
     arterialPh>=RESPIRATORY_ACIDOSIS_INOTROPY_ANCHOR.definitionPh){
    return 1;
  }
  const a=RESPIRATORY_ACIDOSIS_INOTROPY_ANCHOR;
  const severity=clamp(
    (a.definitionPh-arterialPh)/(a.definitionPh-a.challengePh),
    0,1
  );
  return 1-severity*(1-a.challengeContractilityFraction);
}

function createV2SourceAutonomicController({baseline}={}){
  if(!baseline) throw new Error('baseline boundaries are required');
  positive(baseline.heartRatePerMin,'baseline.heartRatePerMin');
  positive(
    baseline.systemicArterialConductanceMlPerMinPerMmHg,
    'baseline.systemicArterialConductanceMlPerMinPerMmHg'
  );

  const baselineVenousV0Ml=
    baseline.systemicVenousV0Ml==null?1700:baseline.systemicVenousV0Ml;
  positive(baselineVenousV0Ml,'baseline.systemicVenousV0Ml');

  const baroreceptor=createUrsinoBaroreceptorShadow();
  const gasAutonomic=createMagossoUrsinoGasAutonomicCandidate();
  let effectors=null;
  let pulmonaryStretchSpikesPerSec=null;
  let referenceEffectors=null;
  let last=null;

  function step({
    dtSec,
    meanArterialPressureMmHg,
    tidalVolumeL,
    arterialPo2MmHg=90,
    arterialPco2MmHg=40,
    arterialPh=7.40,
  }={}){
    positive(dtSec,'dtSec');
    finite(meanArterialPressureMmHg,'meanArterialPressureMmHg');
    nonNegative(tidalVolumeL,'tidalVolumeL');
    nonNegative(arterialPo2MmHg,'arterialPo2MmHg');
    positive(arterialPco2MmHg,'arterialPco2MmHg');
    finite(arterialPh,'arterialPh');

    const b=baroreceptor.step({
      dtSec,
      arterialPressureMmHg:meanArterialPressureMmHg,
    });

    const pulmonaryStretchTarget=pulmonaryStretchStatic(tidalVolumeL);
    pulmonaryStretchSpikesPerSec=firstOrderExact(
      pulmonaryStretchSpikesPerSec,
      pulmonaryStretchTarget,
      dtSec,
      O2_2000_P.pulmonaryStretch.tauSec
    );

    const a=gasAutonomic.step({
      dtSec,
      pao2MmHg:arterialPo2MmHg,
      paco2MmHg:arterialPco2MmHg,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      fApSpikesPerSec:pulmonaryStretchSpikesPerSec,
    });

    if(effectors==null){
      effectors=createChannelizedEffectorCandidate({
        initialFSpSpikesPerSec:a.fSpSpikesPerSec,
        initialFSvSpikesPerSec:a.fSvSpikesPerSec,
        initialFShSpikesPerSec:a.fShSpikesPerSec,
        initialFVSpikesPerSec:a.fVSpikesPerSec,
      });
    }

    const e=effectors.step({
      dtSec,
      fSpSpikesPerSec:a.fSpSpikesPerSec,
      fSvSpikesPerSec:a.fSvSpikesPerSec,
      fShSpikesPerSec:a.fShSpikesPerSec,
      fVSpikesPerSec:a.fVSpikesPerSec,
    });

    if(referenceEffectors==null){
      referenceEffectors=Object.freeze({...e.absolute});
    }

    const heartPeriodSec=positive(e.absolute.heartPeriodSec,'heartPeriodSec');
    const heartRatePerMin=60/heartPeriodSec;

    const systemicResistanceNow=
      positive(e.absolute.Rsp+e.absolute.Rep,'source systemic resistance');
    const systemicResistanceRef=
      positive(referenceEffectors.Rsp+referenceEffectors.Rep,
        'source reference systemic resistance');
    const systemicResistanceRatio=
      systemicResistanceNow/systemicResistanceRef;

    const systemicArterialConductanceMlPerMinPerMmHg=
      baseline.systemicArterialConductanceMlPerMinPerMmHg/
      systemicResistanceRatio;

    const sourceVenousV0Now=
      positive(e.absolute.Vusv+e.absolute.Vuev,'source venous V0');
    const sourceVenousV0Ref=
      positive(referenceEffectors.Vusv+referenceEffectors.Vuev,
        'source reference venous V0');
    const systemicVenousV0Ml=
      baselineVenousV0Ml*(sourceVenousV0Now/sourceVenousV0Ref);

    const leftContractilityMultiplier=
      positive(e.absolute.EmaxLv,'EmaxLv')/
      positive(referenceEffectors.EmaxLv,'reference EmaxLv');
    const rightContractilityMultiplier=
      positive(e.absolute.EmaxRv,'EmaxRv')/
      positive(referenceEffectors.EmaxRv,'reference EmaxRv');

    const phBasedAcidoticContractilityMultiplier=
      respiratoryAcidosisContractilityMultiplier({
        arterialPh,
        arterialPco2MmHg,
      });
    const co2BasedContractilityMultiplier=
      severeHypercapniaContractilityMultiplier(arterialPco2MmHg);
    const acidoticContractilityMultiplier=Math.min(
      phBasedAcidoticContractilityMultiplier,
      co2BasedContractilityMultiplier
    );
    const hypercapnicSvrRatio=
      hypercapnicSystemicResistanceRatio(arterialPco2MmHg);
    const systemicArterialConductanceAfterHypercapnia=
      systemicArterialConductanceMlPerMinPerMmHg/
      hypercapnicSvrRatio;

    last=Object.freeze({
      heartRatePerMin,
      leftContractilityMultiplier,
      rightContractilityMultiplier,
      acidoticContractilityMultiplier,
      systemicArterialConductanceMlPerMinPerMmHg:
        systemicArterialConductanceAfterHypercapnia,
      sourceAutonomicSystemicArterialConductanceMlPerMinPerMmHg:
        systemicArterialConductanceMlPerMinPerMmHg,
      hypercapnicSystemicResistanceRatio:hypercapnicSvrRatio,
      phBasedAcidoticContractilityMultiplier,
      co2BasedContractilityMultiplier,
      systemicVenousV0Ml,
      pulmonaryArterialConductanceMultiplier:1,
      sourceSystemicResistanceRatio:systemicResistanceRatio,
      sourceVenousV0Ratio:sourceVenousV0Now/sourceVenousV0Ref,
      sourceHeartPeriodSec:heartPeriodSec,
      afferents:Object.freeze({
        fAbSpikesPerSec:b.fAbSpikesPerSec,
        fAcSpikesPerSec:a.fAcSpikesPerSec,
        fApSpikesPerSec:pulmonaryStretchSpikesPerSec,
      }),
      autonomic:Object.freeze({
        fSpSpikesPerSec:a.fSpSpikesPerSec,
        fSvSpikesPerSec:a.fSvSpikesPerSec,
        fShSpikesPerSec:a.fShSpikesPerSec,
        fVSpikesPerSec:a.fVSpikesPerSec,
      }),
      effectors:e.absolute,
      referenceEffectors,
      arterialPh,
      arterialPo2MmHg,
      arterialPco2MmHg,
      meanArterialPressureMmHg,
      tidalVolumeL,
      provenance:SOURCE,
    });
    return snapshot();
  }

  function snapshot(){
    return Object.freeze(last||{
      heartRatePerMin:baseline.heartRatePerMin,
      leftContractilityMultiplier:1,
      rightContractilityMultiplier:1,
      acidoticContractilityMultiplier:1,
      systemicArterialConductanceMlPerMinPerMmHg:
        baseline.systemicArterialConductanceMlPerMinPerMmHg,
      systemicVenousV0Ml:baselineVenousV0Ml,
      pulmonaryArterialConductanceMultiplier:1,
      provenance:SOURCE,
      status:'initialized-not-stepped',
    });
  }

  return Object.freeze({
    kind:'v2-source-autonomic-controller',
    step,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  RESPIRATORY_ACIDOSIS_INOTROPY_ANCHOR,
  SEVERE_HYPERCAPNIA_INOTROPY_ANCHORS,
  HYPERCAPNIC_SYSTEMIC_VASODILATION_ANCHOR,
  respiratoryAcidosisContractilityMultiplier,
  severeHypercapniaContractilityMultiplier,
  hypercapnicSystemicResistanceRatio,
  createV2SourceAutonomicController,
});
