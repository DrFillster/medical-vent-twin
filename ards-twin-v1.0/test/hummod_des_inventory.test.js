'use strict';

const {
  HUMMOD_PINNED_REVISION,
  inventoryHumModDesSource,
  assertInventorySupported,
} = require('../src/hummod_des_inventory.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('inventories include/create directives and normalizes Windows paths',()=>{
  const x=inventoryHumModDesSource({
    path:'HumMod.DES',
    content:'<?create SHOWCONTEXT ?>\n<?include Structure\\Structure.DES ?>',
  });
  assert(x.createTokens[0]==='SHOWCONTEXT');
  assert(x.includes[0]==='Structure/Structure.DES');
  assert(x.source.revision===HUMMOD_PINNED_REVISION);
});

test('inventories variables curves blocks and structure name',()=>{
  const x=inventoryHumModDesSource({
    path:'Structure/Test.DES',
    content:`<structure><name> Test </name>
<variables>
<constant><name> C </name><val> 5 </val></constant>
<parm><name> P </name><val> 2 </val></parm>
<var><name> X </name></var>
</variables>
<functions><curve><name> F </name>
<point><x>0</x><y>1</y><slope>0</slope></point>
</curve></functions>
<definitions><block><name> Calc </name>
<def><name>X</name><val>P * C</val></def>
</block></definitions></structure>`,
  });
  assert(x.structureName==='Test');
  assert(x.variables.length===3);
  assert(x.curves.length===1);
  assert(x.curves[0].points.length===1);
  assert(x.blocks.includes('Calc'));
  assert(x.solverReady===false);
});

test('known structural subset passes strict inventory check',()=>{
  const x=inventoryHumModDesSource({
    path:'Structure/PhGeneral.DES',
    content:`<structure><name>PhGeneral</name><variables><var><name>pH</name></var></variables>
<definitions><block><name>Calc</name><testcase><case><test>TRUE</test>
<def><name>pH</name><val>7.4</val></def></case></testcase></block></definitions></structure>`,
  });
  assert(assertInventorySupported(x)===true);
});

test('unknown DES tags fail explicitly',()=>{
  const x=inventoryHumModDesSource({
    path:'Structure/Future.DES',
    content:'<structure><name>Future</name><mystery><name>X</name></mystery></structure>',
  });
  let threw=false;
  try{assertInventorySupported(x);}catch(e){threw=/unsupported DES tags/.test(e.message);}
  assert(threw,'unknown tags must not be silently accepted');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
