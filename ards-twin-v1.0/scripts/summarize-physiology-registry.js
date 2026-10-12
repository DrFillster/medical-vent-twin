'use strict';

const fs=require('fs');
const path=require('path');

const registryPath=path.resolve(__dirname,'../docs/physiology-registry.json');
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));

function countBy(items,key){
  const out={};
  for(const item of items||[]){
    const k=item[key]??'UNCLASSIFIED';
    out[k]=(out[k]||0)+1;
  }
  return out;
}

function assertUnique(items,label){
  const seen=new Set();
  for(const item of items||[]){
    if(!item.id) throw new Error(label+' entry missing id');
    if(seen.has(item.id)) throw new Error('duplicate '+label+' id: '+item.id);
    seen.add(item.id);
  }
}

assertUnique(registry.equations,'equation');
assertUnique(registry.variables,'variable');

const summary={
  schema:'medical-vent-twin/physiology-registry-summary/v1',
  sourceSnapshot:registry.sourceSnapshot,
  completeness:registry.completeness,
  counts:{
    equations:(registry.equations||[]).length,
    variables:(registry.variables||[]).length,
  },
  equationsByAuthority:countBy(registry.equations,'authority'),
  equationsByProvenance:countBy(registry.equations,'provenance'),
  equationsBySubsystem:countBy(registry.equations,'subsystem'),
  variablesByAuthority:countBy(registry.variables,'authority'),
  variablesBySubsystem:countBy(registry.variables,'subsystem'),
};

if(process.argv.includes('--exact')){
  if(!registry.completeness ||
     registry.completeness.status!=='COMPLETE' ||
     registry.completeness.exactTotalsAllowed!==true){
    throw new Error('Exact totals are fail-closed until physiology registry completeness=COMPLETE.');
  }
}

process.stdout.write(JSON.stringify(summary,null,2)+'\n');
