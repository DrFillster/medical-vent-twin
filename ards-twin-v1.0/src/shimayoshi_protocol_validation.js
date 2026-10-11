'use strict';

const ALLOWED_PHASES=Object.freeze({
  control:Object.freeze(['control']),
  ischemia:Object.freeze(['control','ischemia','reperfusion']),
  acidosis:Object.freeze(['control','acidosis']),
});

function assertRows(rows){
  if(!Array.isArray(rows)||rows.length===0){
    throw new Error('source rows are required');
  }
  for(const row of rows){
    if(!row||typeof row.protocol!=='string'||!row.protocol){
      throw new Error('every source row must include protocol phase');
    }
    if(typeof row.time_s!=='number'||!Number.isFinite(row.time_s)){
      throw new Error('every source row must include finite time_s');
    }
  }
}

function phaseSegments(rows){
  assertRows(rows);
  const segments=[];
  let current=null;
  for(const row of rows){
    if(!current||current.phase!==row.protocol){
      current={
        phase:row.protocol,
        startTimeS:row.time_s,
        endTimeS:row.time_s,
        rowCount:1,
      };
      segments.push(current);
    }else{
      current.endTimeS=row.time_s;
      current.rowCount+=1;
    }
  }
  return Object.freeze(segments.map(x=>Object.freeze({...x})));
}

function validateProtocolTrajectory(rows,protocol){
  assertRows(rows);
  if(!Object.prototype.hasOwnProperty.call(ALLOWED_PHASES,protocol)){
    throw new Error('protocol must be control, ischemia, or acidosis');
  }

  const allowed=ALLOWED_PHASES[protocol];
  for(const row of rows){
    if(!allowed.includes(row.protocol)){
      throw new Error(
        'unexpected source phase '+row.protocol+' for '+protocol+' trajectory'
      );
    }
  }

  const segments=phaseSegments(rows);
  const observed=segments.map(s=>s.phase);

  if(protocol==='control'){
    if(observed.length!==1||observed[0]!=='control'){
      throw new Error('control trajectory must contain only control phase');
    }
  }

  if(protocol==='ischemia'){
    const ischemiaIndex=observed.indexOf('ischemia');
    if(ischemiaIndex<0){
      throw new Error('ischemia trajectory is missing ischemia phase');
    }
    if(observed[0]!=='control'){
      throw new Error('ischemia trajectory must begin in control phase');
    }
    if(observed.slice(ischemiaIndex+1).includes('control')){
      throw new Error('ischemia trajectory cannot return directly to control phase');
    }
    const repIndex=observed.indexOf('reperfusion');
    if(repIndex>=0&&repIndex<ischemiaIndex){
      throw new Error('reperfusion cannot precede ischemia');
    }
  }

  if(protocol==='acidosis'){
    const acidIndex=observed.indexOf('acidosis');
    if(acidIndex<0){
      throw new Error('acidosis trajectory is missing acidosis phase');
    }
    if(observed[0]!=='control'){
      throw new Error('acidosis trajectory must begin in control phase');
    }
    if(observed.slice(acidIndex+1).some(p=>p!=='control')){
      throw new Error('post-acidosis trajectory may only recover to control');
    }
  }

  return Object.freeze({
    protocol,
    status:'source-protocol-trajectory-valid',
    observedPhases:Object.freeze([...observed]),
    segments,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  ALLOWED_PHASES,
  phaseSegments,
  validateProtocolTrajectory,
});
