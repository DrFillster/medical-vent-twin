'use strict';

/**
 * HumMod 2013 source-generation-consistent left-heart pump candidate.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@51d369eb75669e150ef7c61e3ba8bcb1e068aecf
 *
 * Files:
 * - Structure/Sizing/Sizing-HeartChambers.DES
 * - Structure/Sizing/Sizing-Pressures.DES
 * - Structure/Sizing/Sizing-HeartPumping-Left-Diastole.DES
 * - Structure/Sizing/Sizing-HeartPumping-Left-Systole.DES
 * - Structure/Sizing/Sizing-SystemicArteries.DES
 * - Structure/LeftHeartPumping/LeftHeartPumping-Diastole.DES
 * - Structure/LeftHeartPumping/LeftHeartPumping-Systole.DES
 * - Structure/LeftHeartPumping/LeftHeartPumping-Pumping.DES
 * - Structure/LeftHeartPumping/LeftHeartPumping.DES
 * - Structure/BloodVessels/SystemicArtys.DES
 *
 * This is a parallel candidate with no canonical authority.
 */

const {
  hermite,
}=require('./hummod_2013_left_heart_contractility_candidate.js');

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
  authority:'candidate-not-canonical',
});

const K_MULTIPLIER=Object.freeze([
  Object.freeze({x:0,y:0,slope:0}),
  Object.freeze({x:1,y:1,slope:0.3}),
  Object.freeze({x:3,y:1.3,slope:0}),
]);

const SOURCE_SIZING=Object.freeze({
  heartRatePerMin:77,
  leftSystolicMassFraction:0.175,
  leftAtriumPressureMmHg:5.5,
  pericardialPressureMmHg:-4,
  systemicMeanPressureMmHg:87,
  systemicSbpMmHg:110,
  systemicDbpMmHg:76,
  arterialV0Fraction:0.85,
  arterialSequesteredVolumeMl:50,
  diastolicBreakVolumeMultiplier:1.2,
  diastolicKBasic:0.01,
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

function sourceSizingFromReference({
  sourceCardiacOutputMlPerMin,
  leftHeartMassG,
  systemicArteryTotalVolumeMl,
}={}){
  positive(sourceCardiacOutputMlPerMin,'sourceCardiacOutputMlPerMin');
  positive(leftHeartMassG,'leftHeartMassG');
  positive(systemicArteryTotalVolumeMl,'systemicArteryTotalVolumeMl');

  const strokeVolumeMl=
    sourceCardiacOutputMlPerMin/SOURCE_SIZING.heartRatePerMin;
  const leftHeartEsvMl=
    SOURCE_SIZING.leftSystolicMassFraction*leftHeartMassG;
  const leftHeartEdvMl=leftHeartEsvMl+strokeVolumeMl;

  const edpTmpMmHg=
    SOURCE_SIZING.leftAtriumPressureMmHg-
    SOURCE_SIZING.pericardialPressureMmHg;
  const diastolicSlope=edpTmpMmHg/leftHeartEdvMl;
  const breakVolumeMl=
    SOURCE_SIZING.diastolicBreakVolumeMultiplier*leftHeartEdvMl;
  const breakPressureBasicMmHg=diastolicSlope*breakVolumeMl;

  const espTmpMmHg=
    SOURCE_SIZING.systemicSbpMmHg-
    SOURCE_SIZING.pericardialPressureMmHg;
  const passiveTmpAtEsvMmHg=diastolicSlope*leftHeartEsvMl;
  const activeTmpAtEsvMmHg=espTmpMmHg-passiveTmpAtEsvMmHg;
  const systolicKBasic=
    activeTmpAtEsvMmHg/Math.sqrt(leftHeartEsvMl);

  const systemicArteriesVolumeMl=
    systemicArteryTotalVolumeMl-SOURCE_SIZING.arterialSequesteredVolumeMl;
  positive(systemicArteriesVolumeMl,'systemicArteriesVolumeMl');
  const arterialV0Ml=
    SOURCE_SIZING.arterialV0Fraction*systemicArteriesVolumeMl;
  const arterialComplianceMlPerMmHg=
    (systemicArteriesVolumeMl-arterialV0Ml)/
    SOURCE_SIZING.systemicMeanPressureMmHg;
  const arterialKs=
    (SOURCE_SIZING.systemicSbpMmHg-
      SOURCE_SIZING.systemicMeanPressureMmHg)*
    (arterialComplianceMlPerMmHg/strokeVolumeMl);

  return Object.freeze({
    strokeVolumeMl,
    leftHeartEsvMl,
    leftHeartEdvMl,
    edpTmpMmHg,
    diastolicSlope,
    breakVolumeMl,
    breakPressureBasicMmHg,
    diastolicKBasic:SOURCE_SIZING.diastolicKBasic,
    systolicKBasic,
    systemicArteriesVolumeMl,
    arterialV0Ml,
    arterialComplianceMlPerMmHg,
    arterialKs,
    source:SOURCE,
  });
}

function passiveTmpFromVolume({
  volumeMl,
  breakVolumeMl,
  breakPressureMmHg,
  diastolicK,
  slope,
}={}){
  nonNegative(volumeMl,'volumeMl');
  positive(breakVolumeMl,'breakVolumeMl');
  nonNegative(breakPressureMmHg,'breakPressureMmHg');
  positive(diastolicK,'diastolicK');
  positive(slope,'slope');
  if(volumeMl>breakVolumeMl){
    const del=volumeMl-breakVolumeMl;
    return breakPressureMmHg+diastolicK*del*del;
  }
  return slope*volumeMl;
}

function passiveVolumeFromTmp({
  tmpMmHg,
  breakVolumeMl,
  breakPressureMmHg,
  diastolicK,
  slope,
}={}){
  nonNegative(tmpMmHg,'tmpMmHg');
  positive(breakVolumeMl,'breakVolumeMl');
  nonNegative(breakPressureMmHg,'breakPressureMmHg');
  positive(diastolicK,'diastolicK');
  positive(slope,'slope');
  if(tmpMmHg>breakPressureMmHg){
    return breakVolumeMl+Math.sqrt((tmpMmHg-breakPressureMmHg)/diastolicK);
  }
  return tmpMmHg/slope;
}

function solveEsv({
  systolicTmpMmHg,
  systolicK,
  breakVolumeMl,
  breakPressureMmHg,
  diastolicK,
  slope,
}={}){
  nonNegative(systolicTmpMmHg,'systolicTmpMmHg');
  nonNegative(systolicK,'systolicK');

  function totalTmp(v){
    return systolicK*Math.sqrt(Math.max(v,0))+
      passiveTmpFromVolume({
        volumeMl:v,
        breakVolumeMl,
        breakPressureMmHg,
        diastolicK,
        slope,
      });
  }

  let lo=0;
  let hi=Math.max(breakVolumeMl,1);
  while(totalTmp(hi)<systolicTmpMmHg && hi<1e7) hi*=2;
  if(totalTmp(hi)<systolicTmpMmHg){
    throw new Error('unable to bracket HumMod 2013 ESV solution');
  }
  for(let i=0;i<100;i++){
    const mid=0.5*(lo+hi);
    if(totalTmp(mid)<systolicTmpMmHg) lo=mid;
    else hi=mid;
  }
  const esvMl=0.5*(lo+hi);
  return Object.freeze({
    esvMl,
    residualMmHg:totalTmp(esvMl)-systolicTmpMmHg,
    exactDesSolverIdentity:false,
  });
}

function solveLeftHeartPump2013({
  meanArterialPressureMmHg,
  leftAtrialPressureMmHg,
  pericardialPressureMmHg,
  heartRatePerMin,
  contractility,
  sourceSizing,
  stiffness=1,
  systolicX=1,
  mitralStenosisEffect=1,
  aorticStenosisEffect=1,
  mitralRegurgitationEffect=1,
  aorticRegurgitationEffect=1,
}={}){
  finite(meanArterialPressureMmHg,'meanArterialPressureMmHg');
  finite(leftAtrialPressureMmHg,'leftAtrialPressureMmHg');
  finite(pericardialPressureMmHg,'pericardialPressureMmHg');
  positive(heartRatePerMin,'heartRatePerMin');
  finite(contractility,'contractility');
  positive(stiffness,'stiffness');
  positive(systolicX,'systolicX');
  [
    ['mitralStenosisEffect',mitralStenosisEffect],
    ['aorticStenosisEffect',aorticStenosisEffect],
    ['mitralRegurgitationEffect',mitralRegurgitationEffect],
    ['aorticRegurgitationEffect',aorticRegurgitationEffect],
  ].forEach(([k,v])=>nonNegative(v,k));
  if(!sourceSizing||typeof sourceSizing!=='object'){
    throw new Error('sourceSizing is required');
  }

  const breakPressureMmHg=
    stiffness*positive(sourceSizing.breakPressureBasicMmHg,'sourceSizing.breakPressureBasicMmHg');
  const breakVolumeMl=positive(sourceSizing.breakVolumeMl,'sourceSizing.breakVolumeMl');
  const slope=breakPressureMmHg/breakVolumeMl;
  const diastolicK=
    stiffness*positive(sourceSizing.diastolicKBasic,'sourceSizing.diastolicKBasic');
  const kMultiplier=hermite(K_MULTIPLIER,contractility);
  const systolicK=
    systolicX*
    positive(sourceSizing.systolicKBasic,'sourceSizing.systolicKBasic')*
    Math.max(kMultiplier,0);
  const compliance=
    positive(sourceSizing.arterialComplianceMlPerMmHg,
      'sourceSizing.arterialComplianceMlPerMmHg');
  const ks=positive(sourceSizing.arterialKs,'sourceSizing.arterialKs');

  const edpMmHg=
    mitralStenosisEffect*leftAtrialPressureMmHg+
    (1-mitralStenosisEffect)*pericardialPressureMmHg;
  const diastolicTmpMmHg=Math.max(edpMmHg-pericardialPressureMmHg,0);
  const edvMl=passiveVolumeFromTmp({
    tmpMmHg:diastolicTmpMmHg,
    breakVolumeMl,
    breakPressureMmHg,
    diastolicK,
    slope,
  });

  function evaluateSbp(sbpMmHg){
    const systolicTmpMmHg=Math.max(sbpMmHg-pericardialPressureMmHg,0);
    const esv=solveEsv({
      systolicTmpMmHg,
      systolicK,
      breakVolumeMl,
      breakPressureMmHg,
      diastolicK,
      slope,
    });
    const basicStrokeMl=Math.max(edvMl-esv.esvMl,0);
    const forwardStrokeMl=
      basicStrokeMl*aorticStenosisEffect*mitralRegurgitationEffect;
    const netStrokeMl=forwardStrokeMl*aorticRegurgitationEffect;
    const predictedSbpMmHg=
      meanArterialPressureMmHg+
      ks*(forwardStrokeMl/compliance);
    return {
      sbpMmHg,
      predictedSbpMmHg,
      residualMmHg:predictedSbpMmHg-sbpMmHg,
      systolicTmpMmHg,
      esv,
      basicStrokeMl,
      forwardStrokeMl,
      netStrokeMl,
    };
  }

  let lo=-4;
  let hi=Math.max(220,meanArterialPressureMmHg+150);
  let flo=evaluateSbp(lo).residualMmHg;
  let fhi=evaluateSbp(hi).residualMmHg;
  let expand=0;
  while(flo*fhi>0 && expand<20){
    hi*=1.5;
    fhi=evaluateSbp(hi).residualMmHg;
    expand++;
  }
  if(flo*fhi>0){
    throw new Error('unable to bracket HumMod 2013 SBP implicit solution');
  }
  let sol=null;
  for(let i=0;i<100;i++){
    const mid=0.5*(lo+hi);
    const e=evaluateSbp(mid);
    sol=e;
    if(Math.abs(e.residualMmHg)<=1e-9) break;
    if(flo*e.residualMmHg<=0){
      hi=mid;
      fhi=e.residualMmHg;
    }else{
      lo=mid;
      flo=e.residualMmHg;
    }
  }

  const strokeVolumeMl=sol.netStrokeMl;
  const bloodFlowMlPerMin=heartRatePerMin*strokeVolumeMl;
  const ejectionFraction=edvMl>0?sol.forwardStrokeMl/edvMl:0;

  return Object.freeze({
    schema:'hummod-2013-left-heart-pump-candidate/v1',
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    meanArterialPressureMmHg,
    sbpMmHg:sol.sbpMmHg,
    leftAtrialPressureMmHg,
    pericardialPressureMmHg,
    heartRatePerMin,
    contractility,
    kMultiplier,
    systolicK,
    edpMmHg,
    edvMl,
    esvMl:sol.esv.esvMl,
    strokeVolumeMl,
    forwardStrokeMl:sol.forwardStrokeMl,
    bloodFlowMlPerMin,
    ejectionFraction,
    solver:Object.freeze({
      sbpResidualMmHg:sol.residualMmHg,
      esvResidualMmHg:sol.esv.residualMmHg,
      exactDesSolverIdentity:false,
    }),
    sourceSizing,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  K_MULTIPLIER,
  SOURCE_SIZING,
  sourceSizingFromReference,
  passiveTmpFromVolume,
  passiveVolumeFromTmp,
  solveEsv,
  solveLeftHeartPump2013,
});
