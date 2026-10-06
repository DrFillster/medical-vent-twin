'use strict';

// Phase-0 HumMod DES source inventory.
// This is intentionally NOT a solver. It inventories language constructs and
// source metadata so unsupported semantics are explicit before execution work.

const {
  HUMMOD_CANONICAL_REPOSITORY,
  HUMMOD_CANONICAL_REVISION,
  HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
  HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
} = require('./hummod_source_identity.js');

const HUMMOD_PINNED_REPOSITORY = HUMMOD_CANONICAL_REPOSITORY;
const HUMMOD_PINNED_REVISION = HUMMOD_CANONICAL_REVISION;

const KNOWN_TAGS = Object.freeze(new Set([
  'model','title','basic','navigator','math','context','parms','dervs','wrapup',
  'structure','name','variables','constant','parm','var','functions','curve',
  'point','x','y','slope','definitions','block','testcase','case','test','def',
  'val','conditional','true','false','copy','from','to','call'
]));

function uniqueSorted(values){
  return Object.freeze(Array.from(new Set(values)).sort());
}

function inventoryHumModDesSource({
  path,
  content,
  repository=HUMMOD_PINNED_REPOSITORY,
  revision=HUMMOD_PINNED_REVISION,
  mirrorRepository=HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
  mirrorRevision=HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
}={}){
  if(typeof path!=='string'||!path.length) throw new Error('path is required');
  if(typeof content!=='string') throw new Error('content must be a string');
  if(typeof repository!=='string'||!repository.length) throw new Error('repository is required');
  if(revision!=null && (typeof revision!=='string'||!revision.length)) throw new Error('revision must be null or non-empty string');
  if(typeof mirrorRepository!=='string'||!mirrorRepository.length) throw new Error('mirrorRepository is required');
  if(typeof mirrorRevision!=='string'||!mirrorRevision.length) throw new Error('mirrorRevision is required');

  const createTokens=[];
  const includes=[];
  const directives=[];
  for(const m of content.matchAll(/<\?\s*(create|include)\s+([^?]+?)\s*\?>/gi)){
    const kind=m[1].toLowerCase();
    const value=m[2].trim();
    directives.push(Object.freeze({kind,value}));
    if(kind==='create') createTokens.push(value);
    if(kind==='include') includes.push(value.replace(/\\/g,'/'));
  }

  const tags=[];
  for(const m of content.matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9_-]*)\b[^>]*>/g)){
    tags.push(m[1].toLowerCase());
  }
  const tagSet=uniqueSorted(tags);
  const unsupportedTags=Object.freeze(tagSet.filter(t=>!KNOWN_TAGS.has(t)));

  const structureMatch=content.match(/<structure>\s*<name>\s*([^<]+?)\s*<\/name>/i);
  const modelPresent=/<model\b/i.test(content);

  const variables=[];
  for(const type of ['constant','parm','var']){
    const re=new RegExp('<'+type+'>\\s*<name>\\s*([^<]+?)\\s*<\\/name>(?:\\s*<val>\\s*([\\s\\S]*?)\\s*<\\/val>)?\\s*<\\/'+type+'>','gi');
    for(const m of content.matchAll(re)){
      variables.push(Object.freeze({
        type,
        name:m[1].trim(),
        initialExpression:m[2]==null?null:m[2].replace(/\s+/g,' ').trim(),
      }));
    }
  }

  const curves=[];
  for(const m of content.matchAll(/<curve>\s*<name>\s*([^<]+?)\s*<\/name>([\s\S]*?)<\/curve>/gi)){
    const points=[];
    for(const p of m[2].matchAll(/<point>\s*<x>\s*([^<]+?)\s*<\/x>\s*<y>\s*([^<]+?)\s*<\/y>\s*<slope>\s*([^<]+?)\s*<\/slope>\s*<\/point>/gi)){
      points.push(Object.freeze({x:p[1].trim(),y:p[2].trim(),slope:p[3].trim()}));
    }
    curves.push(Object.freeze({name:m[1].trim(),points:Object.freeze(points)}));
  }

  const blocks=[];
  for(const m of content.matchAll(/<block>\s*<name>\s*([^<]+?)\s*<\/name>/gi)){
    blocks.push(m[1].trim());
  }

  const constructCounts=Object.freeze(Object.fromEntries(tagSet.map(tag=>[
    tag,
    tags.filter(x=>x===tag).length,
  ])));

  return Object.freeze({
    schema:'hummod-des-source-inventory/v1',
    source:Object.freeze({
      repository,
      revision,
      path,
      mirrorRepository,
      mirrorRevision,
      canonicalRevisionResolved: revision != null,
    }),
    modelPresent,
    structureName:structureMatch?structureMatch[1].trim():null,
    directives:Object.freeze(directives),
    includes:Object.freeze(includes),
    createTokens:Object.freeze(createTokens),
    tags:tagSet,
    unsupportedTags,
    constructCounts,
    variables:Object.freeze(variables),
    curves:Object.freeze(curves),
    blocks:Object.freeze(blocks),
    solverReady:false,
    limitations:Object.freeze([
      'inventory-only-no-expression-evaluation',
      'inventory-only-no-block-execution',
      'inventory-only-no-curve-interpolation',
      'inventory-only-no-state-integration',
    ]),
  });
}

function assertInventorySupported(inventory){
  if(!inventory||inventory.schema!=='hummod-des-source-inventory/v1'){
    throw new Error('invalid HumMod DES inventory');
  }
  if(inventory.unsupportedTags.length){
    throw new Error('unsupported DES tags: '+inventory.unsupportedTags.join(', '));
  }
  return true;
}

module.exports={
  HUMMOD_PINNED_REPOSITORY,
  HUMMOD_PINNED_REVISION,
  HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
  HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
  KNOWN_TAGS,
  inventoryHumModDesSource,
  assertInventorySupported,
};
