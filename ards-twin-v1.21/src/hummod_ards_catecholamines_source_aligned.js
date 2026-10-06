'use strict';

const { HUMMOD_SOURCE_IDENTITY } = require('./hummod_source_identity.js');

function finite(v,l){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(l+' must be finite');return v;}
function positive(v,l){finite(v,l);if(!(v>0))throw new Error(l+' must be > 0');return v;}

function hermite(points,x){
  finite(x,'curve input');
  if(x<=points[0].x)return points[0].y+points[0].slope*(x-points[0].x);
  const z=points[points.length-1];
  if(x>=z.x)return z.y+z.slope*(x-z.x);
  let i=0; while(i+1<points.length&&x>points[i+1].x)i++;
  const a=points[i],b=points[i+1],h=b.x-a.x,t=(x-a.x)/h;
  return (2*t*t*t-3*t*t+1)*a.y+(t*t*t-2*t*t+t)*h*a.slope+
    (-2*t*t*t+3*t*t)*b.y+(t*t*t-t*t)*h*b.slope;
}

const ADRENAL_EFFECT=Object.freeze([
  Object.freeze({x:2,y:1,slope:0}),
  Object.freeze({x:8,y:20,slope:0}),
]);

const SOURCE_CONSTANTS=Object.freeze({
  neTargetNgPerMl:0.240,
  epiTargetNgPerMl:0.040,
  neSecretionBase:220,
  epiSecretionBase:375,
  neSpilloverK:570,
  neClearanceK:4.5,
  epiClearanceK:9.4,
  alphaNeScale:0.021,
  alphaEpiScale:0.125,
  betaNeScale:0.021,
  betaEpiScale:0.125,
});

function poolEffects({nePgPerMl,epiPgPerMl}={}){
  finite(nePgPerMl,'nePgPerMl'); finite(epiPgPerMl,'epiPgPerMl');
  const alphaTotal=
    nePgPerMl*SOURCE_CONSTANTS.alphaNeScale+
    epiPgPerMl*SOURCE_CONSTANTS.alphaEpiScale;
  const betaTotal=
    nePgPerMl*SOURCE_CONSTANTS.betaNeScale+
    epiPgPerMl*SOURCE_CONSTANTS.betaEpiScale;
  return Object.freeze({
    alphaTotal,
    betaTotal,
    alphaEffect:alphaTotal>1?Math.log10(alphaTotal):0,
    betaEffect:betaTotal>1?Math.log10(betaTotal):0,
  });
}

function createHumModSourceAlignedCatecholamines({
  ecfvMl,
  initialNeNgPerMl=SOURCE_CONSTANTS.neTargetNgPerMl,
  initialEpiNgPerMl=SOURCE_CONSTANTS.epiTargetNgPerMl,
}={}){
  positive(ecfvMl,'ecfvMl');
  positive(initialNeNgPerMl,'initialNeNgPerMl');
  positive(initialEpiNgPerMl,'initialEpiNgPerMl');

  let neMass=initialNeNgPerMl*ecfvMl;
  let epiMass=initialEpiNgPerMl*ecfvMl;
  let last=null;

  function step({
    dtSec,
    adrenalNerveHz,
    generalGangliaHz,
    otherTissueFunctionEffect=1,
  }={}){
    positive(dtSec,'dtSec');
    finite(adrenalNerveHz,'adrenalNerveHz');
    finite(generalGangliaHz,'generalGangliaHz');
    finite(otherTissueFunctionEffect,'otherTissueFunctionEffect');

    const adrenalEffect=hermite(ADRENAL_EFFECT,adrenalNerveHz);
    const neSecretion=
      SOURCE_CONSTANTS.neSecretionBase*adrenalEffect*otherTissueFunctionEffect;
    const neSpillover=
      SOURCE_CONSTANTS.neSpilloverK*generalGangliaHz;
    const epiSecretion=
      SOURCE_CONSTANTS.epiSecretionBase*adrenalEffect*otherTissueFunctionEffect;

    // Native DES uses backward Euler. With ECFV fixed over this acute reduced
    // step, each linear pool has an analytic backward-Euler update.
    const dtMin=dtSec/60;
    const neF2=1000*SOURCE_CONSTANTS.neClearanceK/ecfvMl;
    const epiF2=1000*SOURCE_CONSTANTS.epiClearanceK/ecfvMl;
    neMass=(neMass+dtMin*(neSecretion+neSpillover))/(1+dtMin*neF2);
    epiMass=(epiMass+dtMin*epiSecretion)/(1+dtMin*epiF2);

    const nePgPerMl=1000*(neMass/ecfvMl);
    const epiPgPerMl=1000*(epiMass/ecfvMl);
    const effects=poolEffects({nePgPerMl,epiPgPerMl});
    last=Object.freeze({
      ecfvMl,
      adrenalNerveHz,
      generalGangliaHz,
      adrenalEffect,
      neMass,
      epiMass,
      nePgPerMl,
      epiPgPerMl,
      neSecretion,
      neSpillover,
      epiSecretion,
      neClearance:SOURCE_CONSTANTS.neClearanceK*nePgPerMl,
      epiClearance:SOURCE_CONSTANTS.epiClearanceK*epiPgPerMl,
      ...effects,
    });
    return snapshot();
  }

  function snapshot(){
    const nePgPerMl=1000*(neMass/ecfvMl);
    const epiPgPerMl=1000*(epiMass/ecfvMl);
    return Object.freeze({
      schema:'hummod-source-aligned-catecholamines/v1.2',
      ...(last||{
        ecfvMl,neMass,epiMass,nePgPerMl,epiPgPerMl,
        ...poolEffects({nePgPerMl,epiPgPerMl}),
      }),
      provenance:Object.freeze({
        status:'source-aligned-acute-subset',
        sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
        sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
        reproducibilityMirrorRepository:
          HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRepository,
        reproducibilityMirrorRevision:
          HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRevision,
        ecfvBoundary:'explicit-required',
        solverAdaptation:
          'linear backward-Euler pool update with fixed ECFV over coupled step',
        clinicalValidation:false,
      }),
    });
  }

  return Object.freeze({
    kind:'hummod-source-aligned-catecholamines',
    step,
    snapshot,
  });
}

module.exports={
  ADRENAL_EFFECT,
  SOURCE_CONSTANTS,
  poolEffects,
  createHumModSourceAlignedCatecholamines,
};
