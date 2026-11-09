'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {chromium} = require('playwright');
(async () => {
  let server, browser;
  try {
    server = spawn(process.execPath,['scripts/serve.js'],{cwd:path.resolve(__dirname,'..'),stdio:['ignore','pipe','inherit']});
    await once(server.stdout,'data');
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/');
    await page.waitForFunction(()=>!document.querySelector('#clinical-quick-start').disabled);
    await page.locator('#clinical-quick-start').click();
    await page.waitForFunction(()=>document.querySelector('#servo-o2').textContent==='60');
    assert.equal(await page.locator('#servo-volume').textContent(),'420');
    await page.locator('.servo-nav [data-panel="settings"]').click();
    assert.equal(await page.locator('#servo-vt').inputValue(),'420');
    assert.equal(await page.locator('#servo-flow').inputValue(),'42');
    await page.locator('#servo-flow').fill('30');
    assert.equal(await page.locator('#clinical-flow').inputValue(),'0.5');
    await page.locator('#servo-vt').fill('500');
    assert.equal(await page.locator('#clinical-vt').inputValue(),'0.5');
    assert.equal(await page.locator('#servo-volume').textContent(),'420','draft must not appear as active');
    await page.locator('#servo-cancel-settings').click();
    assert.equal(await page.locator('#servo-vt').inputValue(),'420');
    assert.equal(await page.locator('#servo-flow').inputValue(),'42');
    await page.locator('#servo-settings-panel [data-close-panel]').click();
    for (const width of [1440,768,390]) {
      await page.setViewportSize({width,height:900});
      const overflow = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right}))}));
      assert(overflow.scroll<=width,'workstation horizontal overflow: '+JSON.stringify(overflow));
      await page.locator('.servo-nav [data-panel="settings"]').click();
      assert(await page.locator('#servo-vt').isVisible());
      assert(await page.evaluate(()=>{const p=document.querySelector('dialog[open]');return p.scrollWidth<=p.clientWidth;}),'settings drawer overflow at '+width);
      await page.locator('#servo-settings-panel [data-close-panel]').click();
    }
    assert.equal(await page.locator('#clinical-mode option[value="PS"]').isDisabled(),true);
    assert.equal(await page.locator('#clinical-mode option[value="SIMV"]').isDisabled(),true);
    assert.equal(await page.locator('#clinical-mode option[value="APRV"]').isDisabled(),true);
    await page.locator('.servo-nav [data-panel="settings"]').click();
    await page.locator('#clinical-reset').click();
    await page.waitForFunction(()=>document.querySelector('#servo-run-state').textContent==='STANDBY');
    assert.equal(await page.locator('#clinical-hr').textContent(),'—','reset must clear stale vital signs');
    assert.equal(await page.locator('#clinical-apply-vent').isDisabled(),true);
    await page.locator('#servo-settings-panel [data-close-panel]').click();
    await page.getByRole('link',{name:'Open v2.4'}).click();
    assert.match(await page.title(),/v2\.4/);
    await page.waitForFunction(()=>!document.querySelector('#clinical-quick-start').disabled);
    assert.equal(await page.locator('#clinical-fio2').inputValue(),'0.60');
    assert.deepEqual(errors,[]);
    console.log('ok - v3 unit conversion, unapplied edits, cancel, responsive controls, unsupported modes and runnable v2.4');
  } finally {if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
