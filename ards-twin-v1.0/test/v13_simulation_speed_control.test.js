'use strict';

const fs=require('node:fs');
const path=require('node:path');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');

test('clinical speed control defaults to one-times real time',()=>{
  assert(/id="clinical-speed"/.test(html));
  assert(/<option value="1" selected>1× · real time<\/option>/.test(html));
  for(const speed of ['0.25','0.5','1','2','5','10']){
    assert(html.includes('value="'+speed+'"'),'missing speed '+speed);
  }
});

test('continuous speed changes pacing only and retains one-second patient steps',()=>{
  assert(app.includes("let clinicalPlaybackSpeed = 1;"));
  assert(app.includes("const delayMs = 1000 / clinicalPlaybackSpeed;"));
  assert(app.includes("clinicalWorker.postMessage({ type: 'runFor', seconds: 1 });"));
  assert(!app.includes("seconds: clinicalPlaybackSpeed"));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
