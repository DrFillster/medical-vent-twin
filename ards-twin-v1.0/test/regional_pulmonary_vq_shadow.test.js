'use strict';

const assert=require('node:assert/strict');
const {
  MARQUIS_PHPV_MMHG,
  marquisTerminalHpvStimulus,
  deriveRegionalVentilationAudit,
}=require('../src/regional_pulmonary_vq_shadow.js');

let passed=0;
function ok(name,fn){
  fn();
  passed+=1;
  console.log('ok - '+name);
}

ok('Marquis terminal HPV stimulus reproduces source equation and remains non-authoritative',()=>{
  const atZero=marquisTerminalHpvStimulus({alveolarPo2MmHg:0});
  const at80=marquisTerminalHpvStimulus({alveolarPo2MmHg:80});
  assert.equal(atZero.stimulus,1);
  assert(at80.stimulus<1);
  assert(Math.abs(MARQUIS_PHPV_MMHG-(80/Math.log(2)))<1e-12);
  assert.equal(at80.provenance.species,'rat-pulmonary-vascular-network/reference-only');
  assert.equal(at80.provenance.controlAuthority,false);
});

ok('regional audit uses actual Vent breath volumes and exposes synthetic perfusion without authority',()=>{
  const simulation={
    params:{compartments:[
      {id:'normal',perfusionFraction:0.55},
      {id:'recruitable',perfusionFraction:0.35},
      {id:'consolidated',perfusionFraction:0.10},
    ]},
    state:{compartments:[
      {recruitment:1},
      {recruitment:0.4},
      {recruitment:0},
    ]},
    metrics(){return [{
      breathIndex:7,breathStartT:20,breathEndT:23,RR:20,
      compartments:{
        comp_0:{endInspV:1.30,endExpV:1.00,endInspP:18,endExpP:8},
        comp_1:{endInspV:0.60,endExpV:0.50,endInspP:20,endExpP:8},
        comp_2:{endInspV:0,endExpV:0,endInspP:0,endExpP:0},
      },
    }];},
  };
  const out=deriveRegionalVentilationAudit({simulation});
  assert.equal(out.status,'regional-ventilation-measured-perfusion-not-source-complete');
  assert(Math.abs(out.totalTidalVolumeL-0.4)<1e-12);
  assert(Math.abs(out.regions[0].tidalVolumeL-0.3)<1e-12);
  assert(Math.abs(out.regions[1].tidalVolumeL-0.1)<1e-12);
  assert.equal(out.regions[2].tidalVolumeL,0);
  assert.equal(out.regions[0].perfusionAuthority,false);
  assert.equal(out.controlAuthority,false);
  assert.equal(out.physiologyAuthority,false);
});

ok('regional audit fails closed before a complete breath',()=>{
  const simulation={
    params:{compartments:[{id:'normal',perfusionFraction:1}]},
    state:{compartments:[{recruitment:1}]},
    metrics(){return [];},
  };
  const out=deriveRegionalVentilationAudit({simulation});
  assert.equal(out.status,'waiting-for-completed-breath');
  assert.deepEqual(out.regions,[]);
});

console.log('Tests: passed='+passed+' failed=0');
