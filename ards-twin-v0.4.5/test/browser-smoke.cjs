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
      await page.locator('#run').click();
      await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Run complete'),null,{timeout:120000});
      assert(Number.isFinite(Number(await page.locator('#m-ppeak').textContent())));
      assert.equal(await page.locator('svg path.trace').count(),3);
      assert.equal(await page.locator('.recruit-row').count(),3);
      const dimensions=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert(dimensions.page<=dimensions.viewport+1,`Horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
      for(const locator of ['#run','#mode','#peep','#preset']) {const box=await page.locator(locator).boundingBox();assert(box.height>=44);}
      await page.screenshot({path:path.join(artifactDir,`${process.env.BROWSER||'chromium'}-${width}.png`),fullPage:true});
      await page.locator('#example').selectOption('pressure');
      await page.locator('#run').click();
      await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Run complete'),null,{timeout:120000});
      assert.equal(await page.locator('#m-pplat').textContent(),'—');
      await page.locator('#peep').fill('11');assert.equal(await page.locator('#m-ppeak').textContent(),'—');
      await page.locator('#example').selectOption('reference');
      await page.locator('#vt').fill('1000');await page.locator('#flow').fill('6');await page.locator('#rr').fill('40');
      await page.locator('#run').click();await page.locator('#error').waitFor({state:'visible'});
      assert((await page.locator('#error').textContent()).includes('Inspiration'));
      await page.locator('#example').selectOption('recruitment');
      await page.locator('.advanced summary').click();await page.locator('#breaths').fill('10');await page.locator('#dt').selectOption('0.0005');
      await page.locator('#run').click();await page.locator('#cancel').click();
      assert.equal(await page.locator('#status').textContent(),'Canceled.');
      assert.equal(await page.locator('#run').isEnabled(),true);
      // A fresh run still works after worker cancellation.
      await page.locator('#example').selectOption('reference');await page.locator('#breaths').fill('3');await page.locator('#dt').selectOption('0.001');
      await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Run complete'),null,{timeout:120000});
      const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;
      const downloaded=path.join(artifactDir,`run-${width}.json`);await download.saveAs(downloaded);
      const data=JSON.parse(fs.readFileSync(downloaded));assert.equal(data.version,'0.4.5');
      assert.deepEqual(errors,[]);reports.push({width,status:'passed'});console.log(`PASS ${width}px: run, charts, layout, PC, invalid inputs, cancellation, export`);
      await page.close();
    }
    fs.writeFileSync(path.join(artifactDir,`report-${process.env.BROWSER||'chromium'}.json`),JSON.stringify({url,date:new Date().toISOString(),reports},null,2));
  } finally {if(browser)await browser.close();if(server)server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
