'use strict';

const {respiratoryRatePerMin}=require('./hennigs_neural_oscillator_candidate.js');

const SOURCE=Object.freeze({
  role:'Hennigs Eq.9 physical-clock adapter for non-dimensional Botros/Bruce oscillator',
  authority:'candidate-quantification-bridge-not-source-exact',
  controlAuthority:false,
  basis:Object.freeze([
    'Botros/Bruce oscillator omits an absolute physical time scale.',
    'Longobardo et al. describe the inherited oscillator as non-dimensional and requiring quantification.',
    'Hennigs Eq.9 supplies physical respiratory rate as a function of Drel.'
  ])
});

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}
function unit(v,label){finite(v,label);if(v<0||v>1)throw new Error(label+' must be in [0,1]');return v;}

function createHennigsPhysicalClockAdapter({
  estimateRawPeriodSec,
  minScale=0.1,
  maxScale=10,
}={}){
  if(typeof estimateRawPeriodSec!=='function') throw new Error('estimateRawPeriodSec function is required');
  positive(minScale,'minScale');positive(maxScale,'maxScale');
  if(maxScale<minScale) throw new Error('maxScale must be >= minScale');

  const cache=new Map();
  function key(dRel){return unit(dRel,'dRel').toFixed(4);}
  function mapping(dRel){
    dRel=unit(dRel,'dRel');
    const k=key(dRel);
    let rawPeriodSec=cache.get(k);
    if(rawPeriodSec==null){
      rawPeriodSec=positive(estimateRawPeriodSec(dRel),'rawPeriodSec');
      cache.set(k,rawPeriodSec);
    }
    const targetRrPerMin=respiratoryRatePerMin(dRel);
    const targetPeriodSec=60/targetRrPerMin;
    const rawTimePerPhysicalSecond=Math.max(minScale,Math.min(maxScale,rawPeriodSec/targetPeriodSec));
    return Object.freeze({
      dRel,rawPeriodSec,targetRrPerMin,targetPeriodSec,rawTimePerPhysicalSecond,
      authority:SOURCE.authority,controlAuthority:false,provenance:SOURCE,
    });
  }
  return Object.freeze({mapping,source:SOURCE});
}

module.exports=Object.freeze({SOURCE,createHennigsPhysicalClockAdapter});
