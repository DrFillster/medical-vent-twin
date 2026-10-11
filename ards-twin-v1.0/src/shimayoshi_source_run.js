'use strict';

const {validateProtocolTrajectory}=require('./shimayoshi_protocol_validation.js');

const PINNED_UPSTREAM_SHA='6478d2ab0acbfc88d3da461d2594658bcb2798ca';

const REQUIRED_COLUMNS=Object.freeze([
  'time_s',
  'protocol',
  'peak_Fb_mN_per_mm2',
  'end_cycle_pHi',
  'end_cycle_ExtCell_O2o_mM',
  'end_cycle_O2i_mM',
  'end_cycle_ATPTotal_mM',
  'end_cycle_PCr_mM',
  'end_cycle_Pi_mM',
  'peak_Cyt_Cai_mM',
]);

function finiteNumber(value,label){
  const n=Number(value);
  if(!Number.isFinite(n)){
    throw new Error(label+' must be finite');
  }
  return n;
}

function parseSimpleCsv(text){
  if(typeof text!=='string'||!text.trim()){
    throw new Error('CSV text is required');
  }
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2){
    throw new Error('CSV must contain a header and at least one data row');
  }
  const header=lines[0].split(',').map(s=>s.trim());
  if(header.length!==REQUIRED_COLUMNS.length||
     header.some((name,i)=>name!==REQUIRED_COLUMNS[i])){
    throw new Error(
      'Shimayoshi CSV header must exactly match required source-run schema'
    );
  }

  return lines.slice(1).map((line,rowIndex)=>{
    const values=line.split(',').map(s=>s.trim());
    if(values.length!==header.length){
      throw new Error('CSV row '+(rowIndex+2)+' has incorrect column count');
    }
    const row={};
    for(let i=0;i<header.length;i++) row[header[i]]=values[i];
    row.time_s=finiteNumber(row.time_s,'time_s');
    row.peak_Fb_mN_per_mm2=finiteNumber(
      row.peak_Fb_mN_per_mm2,'peak_Fb_mN_per_mm2'
    );
    row.end_cycle_pHi=finiteNumber(row.end_cycle_pHi,'end_cycle_pHi');
    row.end_cycle_ExtCell_O2o_mM=finiteNumber(
      row.end_cycle_ExtCell_O2o_mM,'end_cycle_ExtCell_O2o_mM'
    );
    row.end_cycle_O2i_mM=finiteNumber(row.end_cycle_O2i_mM,'end_cycle_O2i_mM');
    row.end_cycle_ATPTotal_mM=finiteNumber(
      row.end_cycle_ATPTotal_mM,'end_cycle_ATPTotal_mM'
    );
    row.end_cycle_PCr_mM=finiteNumber(row.end_cycle_PCr_mM,'end_cycle_PCr_mM');
    row.end_cycle_Pi_mM=finiteNumber(row.end_cycle_Pi_mM,'end_cycle_Pi_mM');
    row.peak_Cyt_Cai_mM=finiteNumber(
      row.peak_Cyt_Cai_mM,'peak_Cyt_Cai_mM'
    );

    if(!(row.time_s>=0)) throw new Error('time_s must be >= 0');
    if(!(row.peak_Fb_mN_per_mm2>=0)){
      throw new Error('peak_Fb_mN_per_mm2 must be >= 0 for imported paced cycles');
    }
    if(!row.protocol){
      throw new Error('protocol is required for every row');
    }
    return Object.freeze(row);
  });
}

function validateManifest(manifest){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)){
    throw new Error('SHIMAYOSHI_SOURCE_RUN manifest object is required');
  }
  const required=[
    'upstreamGitSha',
    'compilerBuildEnvironment',
    'exactCodeDiff',
    'simulationDuration',
    'protocolEnabled',
    'outputCadence',
    'protocolName',
    'physiologyChanged',
  ];
  for(const key of required){
    if(!(key in manifest)){
      throw new Error('source-run manifest missing '+key);
    }
  }
  if(manifest.upstreamGitSha!==PINNED_UPSTREAM_SHA){
    throw new Error(
      'upstreamGitSha must equal pinned Shimayoshi source '+PINNED_UPSTREAM_SHA
    );
  }
  for(const key of [
    'compilerBuildEnvironment',
    'exactCodeDiff',
    'simulationDuration',
    'protocolEnabled',
    'outputCadence',
  ]){
    if(typeof manifest[key]!=='string'||!manifest[key].trim()){
      throw new Error(key+' must be a non-empty string');
    }
  }
  if(!['control','ischemia','acidosis'].includes(manifest.protocolName)){
    throw new Error('protocolName must be control, ischemia, or acidosis');
  }
  if(manifest.physiologyChanged!==false){
    throw new Error('source run rejected: physiologyChanged must be false');
  }
  return Object.freeze({...manifest});
}

function meanPeakStress(rows){
  if(!Array.isArray(rows)||rows.length===0){
    throw new Error('control rows are required');
  }
  let sum=0;
  for(const row of rows) sum+=row.peak_Fb_mN_per_mm2;
  const mean=sum/rows.length;
  if(!Number.isFinite(mean)||!(mean>0)){
    throw new Error('control mean peak stress must be finite and > 0');
  }
  return mean;
}

function assertMonotonicTime(rows,label){
  for(let i=1;i<rows.length;i++){
    if(rows[i].time_s<=rows[i-1].time_s){
      throw new Error(label+' time_s must increase strictly');
    }
  }
}

function normalizeStressRows(rows,referencePeakStress){
  if(!Number.isFinite(referencePeakStress)||!(referencePeakStress>0)){
    throw new Error('referencePeakStress must be finite and > 0');
  }
  return Object.freeze(rows.map(row=>Object.freeze({
    ...row,
    stress_ratio:row.peak_Fb_mN_per_mm2/referencePeakStress,
  })));
}

function buildSourceStressTrajectory({
  controlCsvText,
  challengeCsvText,
  controlManifest,
  challengeManifest,
}={}){
  const controlProvenance=validateManifest(controlManifest);
  const provenance=validateManifest(challengeManifest);

  if(controlProvenance.protocolName!=='control'){
    throw new Error('controlManifest protocolName must be control');
  }
  if(controlProvenance.upstreamGitSha!==provenance.upstreamGitSha){
    throw new Error('control and challenge manifests must use the same upstream SHA');
  }

  const controlRows=parseSimpleCsv(controlCsvText);
  const challengeRows=parseSimpleCsv(challengeCsvText);
  assertMonotonicTime(controlRows,'control');
  assertMonotonicTime(challengeRows,'challenge');

  const controlProtocolValidation=validateProtocolTrajectory(controlRows,'control');
  const referencePeakStress=meanPeakStress(controlRows);
  const protocolValidation=validateProtocolTrajectory(
    challengeRows,
    provenance.protocolName
  );
  const trajectory=normalizeStressRows(challengeRows,referencePeakStress);

  return Object.freeze({
    status:'shimayoshi-source-stress-trajectory-validated',
    controlAuthority:false,
    referencePeakStressMnPerMm2:referencePeakStress,
    trajectory,
    controlProtocolValidation,
    protocolValidation,
    controlProvenance,
    provenance,
  });
}

module.exports=Object.freeze({
  PINNED_UPSTREAM_SHA,
  REQUIRED_COLUMNS,
  parseSimpleCsv,
  validateManifest,
  meanPeakStress,
  normalizeStressRows,
  buildSourceStressTrajectory,
});
