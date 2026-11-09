'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');

(async()=>{
  let server=null,browser=null;
  const url=process.env.BASE_URL || 'http://127.0.0.1:8765/';
  try{
    if (!process.env.BASE_URL) {
    server=spawn(process.execPath,['scripts/serve.js'],{
      cwd:path.resolve(__dirname,'..'),
      stdio:['ignore','pipe','inherit'],
    });
    let timer;
    try{
      await Promise.race([
        once(server.stdout,'data'),
        once(server,'exit').then(()=>{throw new Error('preview server exited');}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('server startup timed out')),10000);}),
      ]);
    }finally{clearTimeout(timer);}

    }
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));

    const response=await page.goto(url);
    assert.equal(response.status(),200);
    await page.waitForFunction(
      ()=>document.querySelectorAll('#clinical-case option').length===9,
      null,{timeout:10000}
    );

    await page.evaluate(() => {
      window.browserHrReadings = [];
      document.addEventListener('vent:snapshot', () => {
        window.browserHrReadings.push({timeSec:Number(document.querySelector('#clinical-time').textContent),heartRatePerMin:Number(document.querySelector('#clinical-hr').textContent)});
      });
    });
    const button=page.locator('#clinical-extremis-validation');
    assert.equal(await button.isEnabled(),true);
    await button.click();

    await page.waitForFunction(()=>{
      const status=document.querySelector('#clinical-session-status');
      const error=document.querySelector('#clinical-session-error');
      return (status && status.textContent.includes('TEST-HARNESS PARITY')) ||
        (error && !error.hidden && error.textContent.trim());
    },null,{timeout:240000});

    const hrReadings = await page.evaluate(() => window.browserHrReadings);
    for (const [time, expected] of [[100,91],[200,128],[300,163],[400,176],[500,179]]) {
      const row = hrReadings.find(r => Math.abs(r.timeSec-time)<0.01);
      assert(row && Math.abs(row.heartRatePerMin-expected)<=2,'visible HR at '+time+' s: '+JSON.stringify(row));
    }
    const peak = hrReadings.reduce((a,b)=>b.heartRatePerMin>a.heartRatePerMin?b:a);
    assert(peak.heartRatePerMin>=179 && peak.heartRatePerMin<=183,JSON.stringify(peak));

    const errorText=(await page.locator('#clinical-session-error').textContent()).trim();
    assert.equal(errorText,'','browser extremis error: '+errorText);

    const status=(await page.locator('#clinical-session-status').textContent()).trim();
    assert.match(status,/TEST-HARNESS PARITY · arrest at 800 s/);

    assert.equal((await page.locator('#clinical-hr').textContent()).trim(),'0');
    assert.equal((await page.locator('#clinical-co').textContent()).trim(),'0.00');

    const map=Number((await page.locator('#clinical-map').textContent()).trim());
    const ph=Number((await page.locator('#clinical-ph').textContent()).trim());
    const paco2=Number((await page.locator('#clinical-paco2').textContent()).trim());
    const sourceHrText=(await page.locator('#clinical-source-hr').textContent()).trim();
    const reserveText=(await page.locator('#clinical-chronotropic-reserve').textContent()).trim();

    assert(map>=16 && map<=18,'terminal MAP='+map);
    assert(ph>=6.66 && ph<=6.68,'terminal pH='+ph);
    assert(paco2>=224 && paco2<=226,'terminal PaCO2='+paco2);
    assert.equal(sourceHrText,'—','terminal source HR should be unavailable after arrest');
    assert.equal(reserveText,'—','terminal reserve should be unavailable in hemodynamic snapshot after arrest');

    const banner=page.locator('#clinical-arrest-banner');
    assert.equal(await banner.isHidden(),false);
    assert.match((await page.locator('#clinical-arrest-title').textContent()).trim(),/CARDIAC ARREST/);
    assert.deepEqual(errors,[]);

    if (process.env.CAPTURE_DIR) {
      const fs=require('node:fs');
      fs.mkdirSync(process.env.CAPTURE_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.CAPTURE_DIR,'extremis-workstation.png'),fullPage:true});
      await page.locator('.servo-nav [data-panel="trends"]').click();
      await page.locator('#clinical-hr-trend').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.CAPTURE_DIR,'extremis-hr-trend.png')});
      fs.writeFileSync(path.join(process.env.CAPTURE_DIR,'extremis-result.json'),JSON.stringify({url,status,map,ph,paco2,peak,hrReadings,hr:Number(await page.locator('#clinical-hr').textContent()),coLMin:Number(await page.locator('#clinical-co').textContent()),errors},null,2));
    }

    console.log(JSON.stringify({
      status,map,ph,paco2,sourceHrText,reserveText,
      hr:Number((await page.locator('#clinical-hr').textContent()).trim()),
      coLMin:Number((await page.locator('#clinical-co').textContent()).trim()),
    },null,2));
  }finally{
    if(browser) await browser.close();
    if(server) server.kill();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
