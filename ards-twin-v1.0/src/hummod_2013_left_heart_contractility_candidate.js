'use strict';

/**
 * HumMod 2012/2013 left-heart contractility candidate.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@51d369eb75669e150ef7c61e3ba8bcb1e068aecf
 *
 * Files:
 * - Structure/LeftHeart/LeftHeart-BetaReceptors.DES
 * - Structure/LeftHeartPumping/LeftHeartPumping-Contractility.DES
 *
 * Acute candidate assumptions are explicit source-neutral states:
 * - no clamp;
 * - FailureSwitch = 0;
 * - DigoxinPool concentration may be supplied, default source-neutral 0;
 * - anesthesia HeartContractility may be supplied, default source-neutral 1;
 * - contractile-protein functional ratio may be supplied, default 1;
 * - Basic starts at the source initial/target value 1.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

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

const PH_EFFECT=Object.freeze([
  Object.freeze({x:6.6,y:0,slope:0}),
  Object.freeze({x:6.75,y:1,slope:0}),
]);

const DIGOXIN_EFFECT=Object.freeze([
  Object.freeze({x:0,y:1,slope:1}),
  Object.freeze({x:2.5,y:2,slope:0}),
]);

function leftHeartBetaReceptorActivity({
  cardiacGangliaHz,
  beta1PoolEffect,
}={}){
  nonNegative(cardiacGangliaHz,'cardiacGangliaHz');
  nonNegative(beta1PoolEffect,'beta1PoolEffect');
  return (0.333*cardiacGangliaHz)+(0.5*beta1PoolEffect);
}

function leftHeartContractility({
  cardiacGangliaHz,
  beta1PoolEffect,
  myocardialIntracellularPh,
  contractileProteinFunctionalRatio=1,
  digoxinPoolConcentration=0,
  anesthesiaHeartContractility=1,
  basic=1,
}={}){
  finite(myocardialIntracellularPh,'myocardialIntracellularPh');
  nonNegative(contractileProteinFunctionalRatio,'contractileProteinFunctionalRatio');
  nonNegative(digoxinPoolConcentration,'digoxinPoolConcentration');
  nonNegative(anesthesiaHeartContractility,'anesthesiaHeartContractility');
  nonNegative(basic,'basic');

  const betaActivity=leftHeartBetaReceptorActivity({
    cardiacGangliaHz,
    beta1PoolEffect,
  });
  const betaSymps=(2.5*(betaActivity-1))+1;
  const phEffect=hermite(PH_EFFECT,myocardialIntracellularPh);
  const digoxinEffect=hermite(DIGOXIN_EFFECT,digoxinPoolConcentration);
  const contractility=
    betaSymps*
    phEffect*
    contractileProteinFunctionalRatio*
    digoxinEffect*
    anesthesiaHeartContractility*
    basic;

  return Object.freeze({
    betaActivity,
    betaSymps,
    phEffect,
    contractileProteinFunctionalRatio,
    digoxinEffect,
    anesthesiaHeartContractility,
    basic,
    contractility,
    source:SOURCE,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  SOURCE,
  PH_EFFECT,
  DIGOXIN_EFFECT,
  hermite,
  leftHeartBetaReceptorActivity,
  leftHeartContractility,
});
