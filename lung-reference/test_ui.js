/* DOM-adapter tests with a minimal in-memory DOM, NOT a browser rendering test. */
'use strict';
const assert=require('assert/strict'),fs=require('fs');
const M=require('./lung.js'),A=require('./app.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}}
function mockDocument(){
  const ids=new Map();
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.events={};this.value='';this.disabled=false;this._text='';}
    set id(v){this._id=v;ids.set(v,this);}get id(){return this._id;}
    set textContent(v){this._text=String(v);this.children=[];}
    get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this._text='';this.children=[...children];}
    addEventListener(name,fn){this.events[name]=fn;}
    click(){if(!this.disabled&&this.events.click)this.events.click();}
    input(v){this.value=String(v);if(this.events.input)this.events.input();}
  }
  const doc={createElement:tag=>new Element(tag),getElementById:id=>{if(!ids.has(id))throw new Error('Missing DOM id '+id);return ids.get(id);}};
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  for(const m of html.matchAll(/id="([^"]+)"/g)){const el=new Element('container');el.id=m[1];}
  return doc;
}
function setup(){const d=mockDocument(),app=A.mount(d);return {d,app,g:id=>d.getElementById(id)};}
test('default case uses every canonical parameter and single-step history',()=>{
  const {app}=setup(),r=app.getResult(),c=A.caseConfig('Injury C');
  assert.deepEqual(r.configuration,c);
  assert.deepEqual(r.snapshot.data,M.evaluate(new M.Lung(c.lung),new M.Vent(c.vent),new M.Gas(c.gas),c.history));
});
test('editing an input clears every previous output and disables export',()=>{
  const {app,g}=setup();g('vent-vt').input('.32');
  assert.equal(app.getResult(),null);assert.equal(g('metrics').textContent,'');
  assert.equal(g('ri-table').textContent,'');assert.equal(g('trial-table').textContent,'');assert.equal(g('export').disabled,true);
});
test('invalid tissue leaves no stale snapshot',()=>{
  const {app,g}=setup();g('lung-tissue-0').value='.9';app.compute();
  assert.equal(app.getResult(),null);assert.match(g('status').textContent,/Fractions must sum/);
  assert.equal(g('snapshot-table').textContent,'');
});
test('reset history uses actual set PEEP and recomputes successfully',()=>{
  const {app,g}=setup();g('vent-peep').input('12');g('reset-history').click();
  assert.equal(g('history').value,'12');app.compute();assert.equal(app.getResult().snapshot.ok,true);
});
test('history mismatch reports specific cause',()=>{
  const {app,g}=setup();g('history').input('30');app.compute();
  assert.match(g('status').textContent,/History must end at set PEEP/);assert.equal(app.getResult(),null);
});
test('conditioned history is explicit and changes snapshot not endpoint protocol',()=>{
  const {app,g}=setup(),initial=app.getResult();g('condition-history').click();app.compute();const next=app.getResult();
  assert.deepEqual(next.configuration.history,[30,14]);assert.notEqual(next.snapshot.data.pplat,initial.snapshot.data.pplat);
  assert.deepEqual(next.ri,initial.ri);assert.deepEqual(next.trial,initial.trial);
});
test('trial columns correspond to row values and expose failed-point reason',()=>{
  const {app,g}=setup();const t=g('trial-table').children[0],header=t.children[0].children[0].children;
  assert.deepEqual(header.map(x=>x.textContent),['Step','PEEP (cmH2O)','Pplat (cmH2O)','Tidal Crs (mL/cmH2O)','Status / reason']);
  const row=t.children[1].children[0].children.map(x=>x.textContent);
  const ref=app.getResult().trial.data.rows[0];assert.equal(row[0],'1');assert.equal(row[1],'20.0');assert.equal(row[2],ref.pplat.toFixed(2));assert.equal(row[3],ref.crs_tidal_ml_cmH2O.toFixed(2));
  assert.match(t.children[1].children.at(-1).textContent,/PEEP >= AOP/);
});
test('undefined R/I and snapshot errors remain separate',()=>{
  const {app,g}=setup();g('lung-aop').input(15);app.compute();
  assert.match(g('ri-error').textContent,/AOP >= high PEEP/);
  assert.match(g('snapshot-error').textContent,/PEEP >= AOP/);
  assert.equal(app.getResult().ri.data.valid,false);
});
test('no valid trial rows produce no optimum and retain reasons',()=>{
  const {app,g}=setup();for(const [key,v]of Object.entries({'tissue-0':0,'tissue-1':0,'tissue-2':1,'perfusion-0':0,'perfusion-1':0,'perfusion-2':1}))g('lung-'+key).value=String(v);
  app.compute();assert.equal(app.getResult().trial.ok,true);assert.match(g('trial-summary').textContent,/No valid sweep points/);
  assert.match(g('trial-table').textContent,/finite elastic capacity/);
});
test('loading Baseline resets gas and history and preserves negative index',()=>{
  const {app,g}=setup();g('gas-hb').value='8';g('case').value='Baseline';g('load-case').click();
  assert.deepEqual(app.getResult().configuration,A.caseConfig('Baseline'));
  assert.ok(app.getResult().ri.data.ri_signed<0);
});
test('numeric parsing rejects blanks and trailing junk',()=>{
  assert.throws(()=>A.number('','Vt'));assert.throws(()=>A.number('12abc','Vt'));
  assert.throws(()=>A.historyFrom('30, nope',14));assert.deepEqual(A.historyFrom('',14),[14]);
});
test('unknown configuration fields are rejected',()=>{
  assert.throws(()=>new M.Vent({fio:0.9}),/Unknown/);
  assert.throws(()=>new M.Gas({ph:7.4}),/Unknown/);
  assert.throws(()=>A.configuration({...A.caseConfig('Baseline'),extra:1}),/Unknown/);
});
test('configuration is deeply frozen and detached from caller arrays',()=>{
  const tissue=[.4,.4,.2],l=new M.Lung({tissue});tissue[0]=.8;
  assert.equal(l.cfg.tissue[0],.4);assert.throws(()=>{l.cfg.tissue[0]=.8;});assert.throws(()=>{l.cfg={};});
});
test('booleans and excessive relay resolution are rejected',()=>{
  assert.throws(()=>new M.Vent({vt:true}));assert.throws(()=>new M.Lung({units:100000}));
});
console.log(JSON.stringify({suite:'DOM adapter and input contract',passed,failed,real_browser_test:false}));
if(failed)process.exitCode=1;
