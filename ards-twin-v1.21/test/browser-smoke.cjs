// Deployment gate: run after `npm install` and `npx playwright install chromium webkit`.
// BROWSER=webkit npm run test:browser checks WebKit as an iOS-engine approximation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium, webkit } = require('playwright');
(async () => {
  let server, browser;
  const reports = [];
  const url = process.env.BASE_URL || 'http://127.0.0.1:8765/';
  const artifactDir = path.resolve(__dirname, '../browser-results'); fs.mkdirSync(artifactDir, {recursive:true});
  try {
    if (!process.env.BASE_URL) {
      server = spawn(process.execPath, ['scripts/serve.js'], { cwd: path.resolve(__dirname,'..'), stdio:['ignore','pipe','inherit'] });
      let startupTimer;
      try {
        await Promise.race([once(server.stdout,'data'), once(server,'exit').then(()=>{throw new Error('Preview server exited');}), new Promise((_,reject)=>{startupTimer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);})]);
      } finally { clearTimeout(startupTimer); }
    }
    const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
    browser = await engine.launch({headless:true});
    for (const width of [320,390,768,1440]) {
      const page = await browser.newPage({viewport:{width,height:900},hasTouch:width<700});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
      const response=await page.goto(url);assert.equal(response.status(),200);
      await page.waitForFunction(()=>document.querySelectorAll('#clinical-case option').length===9,null,{timeout:10000});
      assert.equal(await page.locator('#clinical-case').inputValue(),'berlin-moderate-moderate-aspiration');
      assert.equal((await page.locator('#clinical-severity').textContent()).trim(),'Moderate');
      assert.equal((await page.locator('#clinical-recruitability').textContent()).trim(),'Moderate');
      assert.equal((await page.locator('#clinical-executable').textContent()).trim(),'Not yet');
      assert.equal((await page.locator('#clinical-calibration-ri').textContent()).trim(),'Not assigned');
      assert((await page.locator('#clinical-calibration-aop').textContent()).includes('model construct'));
      assert((await page.locator('#clinical-readiness').textContent()).includes('External data required'));

      // Replay demo remains available and explicitly synthetic. Live reduced HumMod is the default provider.
      await page.locator('#clinical-session-panel').evaluate(el => {
        el.open = true;
      });
      await page.locator('.engineering-provider').evaluate(el => {
        el.open = true;
      });
      assert.equal(await page.locator('#clinical-systemic-provider').inputValue(),'live-reduced-hummod');
      await page.locator('#clinical-systemic-provider').selectOption('replay');
      await page.locator('#clinical-load-demo').click();
      assert((await page.locator('#clinical-hummod-status').textContent()).includes('SYNTHETIC DEMO DATA LOADED'));
      assert.equal(await page.locator('#clinical-mode').inputValue(),'VC_AC');
      assert.equal(await page.locator('#clinical-peep').inputValue(),'8');
      assert.equal(await page.locator('#clinical-recruitment').inputValue(),'0.35');

      await page.locator('#clinical-case').selectOption('berlin-severe-high-diffuse-inflammatory');
      assert.equal((await page.locator('#clinical-severity').textContent()).trim(),'Severe');
      assert.equal((await page.locator('#clinical-recruitability').textContent()).trim(),'High');

      // End-to-end replay smoke uses a clearly labeled test-only HumMod fixture.
      // No fixture value is presented as clinical truth.
      await page.locator('#clinical-case').selectOption('berlin-moderate-moderate-aspiration');
      // Keep the executable-session details panel open. The earlier synthetic
      // demo path already opened it; clicking the summary again would close
      // the panel and make the form controls intentionally invisible.
      await page.locator('#clinical-session-panel').evaluate(el => {
        el.open = true;
      });
      await page.locator('#clinical-hummod-file').setInputFiles(
        path.resolve(__dirname,'fixtures/hummod-browser-raw-fixture.json'));
      await page.waitForFunction(()=>document.querySelector('#clinical-hummod-status').textContent.includes('raw System.X series converted to canonical seconds'));
      await page.locator('#clinical-mode').selectOption('VC_AC');
      await page.locator('#clinical-fio2').fill('0.6');
      await page.locator('#clinical-peep').fill('8');
      await page.locator('#clinical-rr').fill('20');
      await page.locator('#clinical-init-mode').selectOption('history');
      await page.locator('#clinical-recruitment-history-file').setInputFiles(
        path.resolve(__dirname,'fixtures/recruitment-history-browser-fixture.json'));
      await page.waitForFunction(()=>document.querySelector('#clinical-recruitment-history-status').textContent.startsWith('Loaded recruitment history'));
      await page.locator('#clinical-vt').fill('0.42');
      await page.locator('#clinical-flow').fill('0.7');
      await page.locator('#clinical-vc-pause').fill('0.2');
      await page.locator('#clinical-initialize').click();
      await page.waitForFunction(()=>document.querySelector('#clinical-session-status').textContent.startsWith('Patient active'),null,{timeout:30000});
      assert.equal((await page.locator('#clinical-time').textContent()).trim(),'0');
      assert.equal((await page.locator('#clinical-hr').textContent()).trim(),'90');
      await page.locator('#clinical-run-seconds').fill('1');
      await page.locator('#clinical-run').click();
      await page.waitForFunction(()=>document.querySelector('#clinical-time').textContent!=='0',null,{timeout:30000});
      assert.equal((await page.locator('#clinical-hr').textContent()).trim(),'91');
      assert.equal((await page.locator('#clinical-current-mode').textContent()).trim(),'VC_AC');
      assert((await page.locator('.clinical-waveforms svg path.trace').count()) >= 3);

      await page.locator('.clinical-advanced-actions').evaluate(el => {
        el.open = true;
      });
      await page.locator('#clinical-measure-mechanics').click();
      await page.waitForFunction(() => {
        const pplat = document.querySelector('#clinical-pplat').textContent.trim();
        const peep = document.querySelector('#clinical-total-peep').textContent.trim();
        const dp = document.querySelector('#clinical-dp').textContent.trim();
        return pplat !== '—' && peep !== '—' && dp !== '—';
      }, null, { timeout: 30000 });
      assert(Number.isFinite(Number((await page.locator('#clinical-pplat').textContent()).trim())));
      assert(Number.isFinite(Number((await page.locator('#clinical-total-peep').textContent()).trim())));
      assert(Number.isFinite(Number((await page.locator('#clinical-dp').textContent()).trim())));

      await page.locator('#clinical-mode').selectOption('PC_AC');
      await page.locator('#clinical-fio2').fill('0.5');
      await page.locator('#clinical-peep').fill('10');
      await page.locator('#clinical-rr').fill('18');
      await page.locator('#clinical-pinsp').fill('12');
      await page.locator('#clinical-ti').fill('0.8');
      await page.locator('#clinical-pc-pause').fill('0.1');
      await page.locator('#clinical-apply-vent').click();
      await page.waitForFunction(()=>document.querySelector('#clinical-session-status').textContent.includes('pending next breath boundary'));
      assert.equal((await page.locator('#clinical-current-mode').textContent()).trim(),'VC_AC');
      await page.locator('#clinical-run-seconds').fill('2.2');
      await page.locator('#clinical-run').click();
      await page.waitForFunction(()=>document.querySelector('#clinical-current-mode').textContent.trim()==='PC_AC',null,{timeout:30000});
      assert.equal((await page.locator('#clinical-current-peep').textContent()).trim(),'10');

      const dimensions=await page.evaluate(()=>{
        const viewport=innerWidth;
        const offenders=[...document.querySelectorAll('body *')].map(el=>{
          const r=el.getBoundingClientRect();
          return {
            tag:el.tagName,
            id:el.id||null,
            className:typeof el.className==='string'?el.className:null,
            left:r.left,right:r.right,width:r.width,
            scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
          };
        }).filter(x=>x.right>viewport+1||x.left<-1||x.scrollWidth>x.clientWidth+1)
          .sort((a,b)=>Math.max(b.right-viewport,b.scrollWidth-b.clientWidth)-Math.max(a.right-viewport,a.scrollWidth-a.clientWidth))
          .slice(0,12);
        return {page:document.documentElement.scrollWidth,viewport,offenders};
      });
      assert(dimensions.page<=dimensions.viewport+1,`Horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
      for(const locator of ['#clinical-quick-start','#clinical-apply-vent','#clinical-run','#clinical-export-session']) {const box=await page.locator(locator).boundingBox();assert(box && box.height>=44);}
      await page.screenshot({path:path.join(artifactDir,`${process.env.BROWSER||'chromium'}-${width}.png`),fullPage:true});
      const exportCapture=await page.evaluate(() => {
        let captured=null;
        const original=HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click=function(){
          captured={href:this.href,download:this.download};
        };
        try { document.querySelector('#clinical-export-session').click(); }
        finally { HTMLAnchorElement.prototype.click=original; }
        return captured;
      });
      assert(exportCapture && exportCapture.download.includes('clinical-session'));
      assert(exportCapture.href.startsWith('data:application/json'));
      const encoded=exportCapture.href.slice(exportCapture.href.indexOf(',')+1);
      const data=JSON.parse(decodeURIComponent(encoded));
      assert(Array.isArray(data.interventions));
      assert(Array.isArray(data.physiologyTrend));
      assert.deepEqual(errors,[]);reports.push({width,status:'passed'});console.log(`PASS ${width}px: clinical catalog, session run, charts, layout, PC transition, mechanics, export`);
      await page.close();
    }
    fs.writeFileSync(path.join(artifactDir,`report-${process.env.BROWSER||'chromium'}.json`),JSON.stringify({url,date:new Date().toISOString(),reports},null,2));
  } finally {if(browser)await browser.close();if(server)server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
