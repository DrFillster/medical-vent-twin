'use strict';

const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const URL=process.env.BASE_URL;
if(!URL) throw new Error('BASE_URL is required');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));

  const response=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response.status(),200);
  await page.waitForFunction(
    ()=>document.querySelectorAll('#clinical-case option').length===9,
    null,{timeout:15000}
  );

  assert(
    (await page.locator('.physician-comparison-card').textContent())
      .includes('Live model vs candidate model')
  );

  await page.locator('#clinical-quick-start').click();
  await page.waitForFunction(
    ()=>document.querySelector('#clinical-session-status')
      ?.textContent.startsWith('Patient active'),
    null,{timeout:60000}
  );

  await page.locator('.physician-comparison-card').evaluate(el=>{el.open=true;});
  await page.waitForFunction(()=>{
    const ids=[
      'clinical-compare-shadow-hr',
      'clinical-compare-shadow-map',
      'clinical-compare-shadow-co',
      'clinical-compare-shadow-sv',
      'clinical-compare-shadow-svr',
    ];
    return ids.every(id=>{
      const t=document.getElementById(id)?.textContent.trim();
      return t && t!=='—' && t!=='Not source-complete';
    });
  },null,{timeout:20000});

  const result=await page.evaluate(()=>({
    liveHr:document.getElementById('clinical-compare-live-hr').textContent.trim(),
    candidateHr:document.getElementById('clinical-compare-shadow-hr').textContent.trim(),
    candidateMap:document.getElementById('clinical-compare-shadow-map').textContent.trim(),
    candidateCo:document.getElementById('clinical-compare-shadow-co').textContent.trim(),
    candidateSv:document.getElementById('clinical-compare-shadow-sv').textContent.trim(),
    candidateResistance:document.getElementById('clinical-compare-shadow-svr').textContent.trim(),
    status:document.getElementById('clinical-compare-status').textContent.trim(),
  }));

  assert(result.status.includes('no live-patient control authority'));
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(e=>{
  console.error(e);
  process.exit(1);
});
