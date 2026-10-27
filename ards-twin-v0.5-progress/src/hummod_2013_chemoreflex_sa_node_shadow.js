'use strict';

/**
 * HumMod 2012/2013 chemoreflex -> sympathoadrenal -> SA-node shadow candidate for v2.4.
 *
 * Source generation:
 * nysuloem/HumMod-UTSC-CPG@51d369eb75669e150ef7c61e3ba8bcb1e068aecf
 *
 * Source files:
 * - Structure/Nerves/Chemoreceptors.DES
 * - Structure/Nerves/ChemoreceptorsCNS.DES
 * - Structure/Nerves/Sympathetics-Adrenal.DES
 * - Structure/Nerves/Sympathetics-Cardiac.DES
 * - Structure/Nerves/Sympathetics-General.DES
 * - Structure/Nerves/Ganglia-Adrenal.DES
 * - Structure/Nerves/Ganglia-Cardiac.DES
 * - Structure/Nerves/Ganglia-General.DES
 * - Structure/Nerves/AdrenalNerve.DES
 * - Structure/Nerves/VagusNerve.DES
 * - Structure/Catechols/NESecretion.DES
 * - Structure/Catechols/EpiSecretion.DES
 * - Structure/Catechols/NEPool.DES
 * - Structure/Catechols/EpiPool.DES
 * - Structure/Catechols/Alpha1Pool.DES
 * - Structure/Catechols/Beta1Pool.DES
 * - Structure/Heart/SANode-BetaReceptors.DES
 * - Structure/Heart/SANode-Rate.DES
 *
 * Reduction:
 * - isolates the chemoreflex branch;
 * - baroreflex, low-pressure, mechanoreceptor, apnea, A2, pain, trophic,
 *   exercise, Cushing, fuel, essential, and renal-mechanoreflex terms are held
 *   at their source-neutral values;
 * - no blockade, clamps, exogenous agonists/antagonists, pumps, boluses, or
 *   pheochromocytoma sources;
 * - OtherTissue-Function.Effect = 1.
 *
 * No physiologic gain is introduced by this reduction.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
  generation:'HumMod-2012/2013',
  authority:'candidate-not-canonical',
});

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
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

function hermite(points,x){
  finite(x,'curve input');
  if(x<=points[0].x) return points[0].y+points[0].slope*(x-points[0].x);
  const z=points[points.length-1];
  if(x>=z.x) return z.y+z.slope*(x-z.x);
  let i=0;
  while(i+1<points.length&&x>points[i+1].x)i++;
  const a=points[i],b=points[i+1],h=b.x-a.x,t=(x-a.x)/h;
  return (2*t*t*t-3*t*t+1)*a.y+
    (t*t*t-2*t*t+t)*h*a.slope+
    (-2*t*t*t+3*t*t)*b.y+
    (t*t*t-t*t)*h*b.slope;
}

const CURVES=Object.freeze({
  chemoPo2:Object.freeze([
    Object.freeze({x:30,y:10,slope:0}),
    Object.freeze({x:60,y:2,slope:-0.05}),
    Object.freeze({x:94,y:0.5,slope:-0.005}),
    Object.freeze({x:400,y:0.2,slope:0}),
  ]),
  chemoDeltaPh:Object.freeze([
    Object.freeze({x:-0.34,y:2,slope:0}),
    Object.freeze({x:0,y:0.4,slope:-3}),
    Object.freeze({x:0.26,y:0,slope:0}),
  ]),
  chemoSymps:Object.freeze([
    Object.freeze({x:0,y:0,slope:0}),
    Object.freeze({x:1,y:0.1,slope:0.2}),
    Object.freeze({x:4,y:0.6,slope:0}),
  ]),
  chemoCnsEffect:Object.freeze([
    Object.freeze({x:-10,y:0.6,slope:0}),
    Object.freeze({x:0,y:1,slope:0.10}),
    Object.freeze({x:10,y:3,slope:0}),
  ]),
  vagusHz:Object.freeze([
    Object.freeze({x:0,y:8,slope:0}),
    Object.freeze({x:1.5,y:2,slope:-1}),
    Object.freeze({x:4.5,y:0.5,slope:0}),
  ]),
  saParasympathetic:Object.freeze([
    Object.freeze({x:0,y:0,slope:0}),
    Object.freeze({x:2,y:-20,slope:-12}),
    Object.freeze({x:8,y:-40,slope:0}),
  ]),
  saSympathetic:Object.freeze([
    Object.freeze({x:0,y:0,slope:0}),
    Object.freeze({x:1,y:15,slope:10}),
    Object.freeze({x:1.75,y:45,slope:40}),
    Object.freeze({x:2.5,y:100,slope:30}),
    Object.freeze({x:3.5,y:120,slope:0}),
  ]),
});

const P=Object.freeze({
  chemoSsPhKPerMin:0.0001,
  chemoCnsOnsetTauMin:5,
  chemoCnsAdaptationTauDays:15,
  sympatheticHzScale:1.5,
  gangliaNaScale:0.667,
  neTargetNgPerMl:0.240,
  epiTargetNgPerMl:0.040,
  neBase:220,
  epiBase:375,
  neSpilloverK:570,
  neClearanceK:4.5,
  epiClearanceK:9.4,
  adrenalA:23,
  adrenalM:4.6,
  adrenalS:5.35,
  adrenalB:0.8,
  beta1Total:1.45,
  beta1KdEpi:1.120,
  beta1KdNe:0.973,
  saNeuralK:0.5,
  saHumoralK:0.25,
  saBasicRatePerMin:77,
  alpha1Total:4,
  alpha1KdEpi:5,
  alpha1KdNe:5,
});

function hillActivity({x,A,m,S,B}){
  nonNegative(x,'hill x');
  return A*((x**m)/((x**m)+(S**m)))+B;
}

function beta1Effect({nePgPerMl,epiPgPerMl}){
  nonNegative(nePgPerMl,'nePgPerMl');
  nonNegative(epiPgPerMl,'epiPgPerMl');
  const ne=0.00592*nePgPerMl;
  const epi=0.00546*epiPgPerMl;
  // Source competitive binding with isoproterenol=0 and propranolol=0.
  const denominator=
    ne*P.beta1KdEpi+
    epi*P.beta1KdNe+
    P.beta1KdEpi*P.beta1KdNe;
  const epiBound=denominator>0 ? epi*P.beta1KdNe/denominator : 0;
  const neBound=denominator>0 ? ne*P.beta1KdEpi/denominator : 0;
  return P.beta1Total*(2*epiBound+neBound);
}

function alpha1Effect({nePgPerMl,epiPgPerMl}){
  nonNegative(nePgPerMl,'nePgPerMl');
  nonNegative(epiPgPerMl,'epiPgPerMl');
  const ne=0.00592*nePgPerMl;
  const epi=0.00546*epiPgPerMl;
  // Source competitive binding with midodrine/phenylephrine terms = 0.
  const denominator=
    ne*P.alpha1KdEpi+
    epi*P.alpha1KdNe+
    P.alpha1KdEpi*P.alpha1KdNe;
  const epiBound=denominator>0 ? epi*P.alpha1KdNe/denominator : 0;
  const neBound=denominator>0 ? ne*P.alpha1KdEpi/denominator : 0;
  return P.alpha1Total*(epiBound+neBound);
}

function createHumMod2013ChemoreflexSaNodeCandidate({
  ecfvMl,
  initialArterialPh=7.44,
}={}){
  positive(ecfvMl,'ecfvMl');
  finite(initialArterialPh,'initialArterialPh');

  let ssPh=initialArterialPh;
  let onsetDelay=1;
  let adaptationDelay=1;
  let neMass=P.neTargetNgPerMl*ecfvMl;
  let epiMass=P.epiTargetNgPerMl*ecfvMl;
  let generalGangliaNa=0.667*1.5;
  let last=null;
  let timeSec=0;

  function concentrations(){
    return {
      nePgPerMl:1000*(neMass/ecfvMl),
      epiPgPerMl:1000*(epiMass/ecfvMl),
    };
  }

  function step({dtSec,arterialPo2MmHg,arterialPh}={}){
    positive(dtSec,'dtSec');
    nonNegative(arterialPo2MmHg,'arterialPo2MmHg');
    finite(arterialPh,'arterialPh');

    const dtMin=dtSec/60;

    // Chemoreceptors.DES: slow pH reference.
    ssPh += (arterialPh-ssPh)*
      (1-Math.exp(-P.chemoSsPhKPerMin*dtMin));
    const deltaPh=arterialPh-ssPh;

    const poolsBefore=concentrations();
    const alpha1=alpha1Effect(poolsBefore);
    const alphaAgonism=
      0.5*generalGangliaNa+
      0.5*alpha1;

    const po2Effect=hermite(CURVES.chemoPo2,arterialPo2MmHg);
    const phEffect=hermite(CURVES.chemoDeltaPh,deltaPh);
    const sympsEffect=hermite(CURVES.chemoSymps,alphaAgonism);
    const firingRate=po2Effect+phEffect+sympsEffect;

    // ChemoreceptorsCNS.DES delay dynamics. HumMod timebase is minutes.
    onsetDelay += (firingRate-onsetDelay)*
      (1-Math.exp(-dtMin/P.chemoCnsOnsetTauMin));
    const adaptTauMin=1440*P.chemoCnsAdaptationTauDays;
    adaptationDelay += (firingRate-adaptationDelay)*
      (1-Math.exp(-dtMin/adaptTauMin));

    const change=onsetDelay-adaptationDelay;
    const chemoCnsEffect=hermite(CURVES.chemoCnsEffect,change);

    // Source-neutral isolation: all multiplicative reflex terms other than
    // ChemoreceptorsCNS.Effect = 1; all additive stress terms = 0.
    const adrenalSympatheticNa=chemoCnsEffect;
    const cardiacSympatheticNa=chemoCnsEffect;
    const generalSympatheticNa=chemoCnsEffect;

    const adrenalHz=P.sympatheticHzScale*adrenalSympatheticNa;
    const cardiacHz=P.sympatheticHzScale*cardiacSympatheticNa;
    const generalHz=P.sympatheticHzScale*generalSympatheticNa;

    const adrenalNerveHz=adrenalHz;
    const generalGangliaHz=generalHz;
    const cardiacGangliaHz=cardiacHz;
    generalGangliaNa=P.gangliaNaScale*generalGangliaHz;

    // Later HumMod adrenal secretion uses the source Hill relation.
    const epiAdrenalEffect=hillActivity({
      x:adrenalNerveHz,
      A:P.adrenalA,m:P.adrenalM,S:P.adrenalS,B:P.adrenalB,
    });
    const neAdrenalEffect=epiAdrenalEffect;

    const neSecretion=P.neBase*neAdrenalEffect;
    const epiSecretion=P.epiBase*epiAdrenalEffect;
    const neSpillover=P.neSpilloverK*generalGangliaHz;

    // Source backward-Euler pool form with fixed ECFV over this acute step.
    const neF2=1000*P.neClearanceK/ecfvMl;
    const epiF2=1000*P.epiClearanceK/ecfvMl;
    neMass=(neMass+dtMin*(neSecretion+neSpillover))/(1+dtMin*neF2);
    epiMass=(epiMass+dtMin*epiSecretion)/(1+dtMin*epiF2);

    const pools=concentrations();
    const beta1=beta1Effect(pools);

    const saBetaActivity=
      P.saNeuralK*cardiacGangliaHz+
      P.saHumoralK*beta1;
    const vagusHz=clamp(hermite(CURVES.vagusHz,cardiacHz),0,8);
    const parasympatheticEffectPerMin=
      hermite(CURVES.saParasympathetic,vagusHz);
    const sympatheticEffectPerMin=
      hermite(CURVES.saSympathetic,saBetaActivity);
    const heartRatePerMin=
      P.saBasicRatePerMin+
      parasympatheticEffectPerMin+
      sympatheticEffectPerMin;

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-chemoreflex-sa-node-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      arterialPo2MmHg,
      arterialPh,
      ssPh,
      deltaPh,
      chemoreceptor:Object.freeze({
        po2Effect,phEffect,sympsEffect,alphaAgonism,firingRate,
      }),
      chemoreceptorsCns:Object.freeze({
        onsetDelay,adaptationDelay,change,effect:chemoCnsEffect,
      }),
      sympathetic:Object.freeze({
        adrenalNa:adrenalSympatheticNa,
        cardiacNa:cardiacSympatheticNa,
        generalNa:generalSympatheticNa,
        adrenalHz,cardiacHz,generalHz,
      }),
      ganglia:Object.freeze({
        adrenalHz,
        cardiacHz:cardiacGangliaHz,
        generalHz:generalGangliaHz,
        generalNa:generalGangliaNa,
      }),
      catecholamines:Object.freeze({
        nePgPerMl:pools.nePgPerMl,
        epiPgPerMl:pools.epiPgPerMl,
        neSecretion,
        epiSecretion,
        neSpillover,
        beta1Effect:beta1,
        alpha1Effect:alpha1Effect(pools),
      }),
      saNode:Object.freeze({
        vagusHz,
        betaActivity:saBetaActivity,
        parasympatheticEffectPerMin,
        sympatheticEffectPerMin,
        heartRatePerMin,
      }),
      heartRatePerMin,
      provenance:SOURCE,
      reduction:Object.freeze({
        isolatedMechanism:'chemoreflex',
        neutralMultipliers:Object.freeze([
          'apnea','baroreflex','low-pressure','mechanoreceptor',
          'A2','pain','CNS trophic','renal mechanoreflex',
        ]),
        zeroAdditiveTerms:Object.freeze([
          'exercise','Cushing','Brain-Fuel','EssentialEffect',
          'constitutive sympathetic additions',
        ]),
        drugsAndClamps:'neutral/off',
        numericalCoupling:
          'exact-ZOH first-order delay updates; backward-Euler catecholamine pools',
      }),
    });
    return last;
  }

  function runFor(seconds,inputs){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    const dtSec=positive(inputs.dtSec,'inputs.dtSec');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step(inputs);
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-2013-chemoreflex-sa-node-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      heartRatePerMin:null,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,runFor,snapshot,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,P,CURVES,hermite,hillActivity,beta1Effect,alpha1Effect,
  createHumMod2013ChemoreflexSaNodeCandidate,
});
