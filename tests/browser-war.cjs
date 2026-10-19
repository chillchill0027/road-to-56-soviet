const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startServer}=require('./helpers/server.cjs');
const {choosePolicy,executeAgenda,advanceScene}=require('./helpers/dialogue.cjs');
const fixture=require('./fixtures/routes.json').routes.find(f=>f.steps.some(([id,a])=>id==='3-10'&&a===1)&&f.steps.some(([id,a])=>id==='3-12'&&typeof a==='number'&&a<2));
(async()=>{
  const local=process.argv[2]?null:await startServer(),url=process.argv[2]||local.url;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const out=path.resolve(process.env.WAR_BROWSER_OUTPUT||'docs/qa/war/report.json');fs.mkdirSync(path.dirname(out),{recursive:true});
  const report={url,fixture:fixture.id,passed:false,checks:[],sectors:[],errors:[],resourceFailures:[]};
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(()=>{let value=Number(sessionStorage.getItem('r56.war.test.rng')??1)>>>0;Math.random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;sessionStorage.setItem('r56.war.test.rng',String(value));return value/4294967296;};});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400)report.resourceFailures.push(r.url());});
    await page.goto(url);await page.evaluate(seed=>sessionStorage.setItem('r56.war.test.rng',String(seed)),fixture.eventSeed);await page.reload();await page.click('#ts-new');
    for(const key of ['frontier','moscow','volga','kursk','belarus','romania','berlin','aftermath'])assert.equal((await context.request.get(new URL(`assets/images/battle-${key}-sheet.webp`,url).href)).status(),200);
    let reloaded=false;
    for(const [id,action] of fixture.steps){
      assert.equal(await page.evaluate(()=>S.curId),id);
      if(Array.isArray(action))for(const decision of action)await executeAgenda(page,decision);
      else if(typeof action==='number'){
        await choosePolicy(page,action);
        const state=await page.evaluate(()=>JSON.parse(JSON.stringify(S)));
        const record=state._warReports?.find(r=>r.sceneId===id&&r.optionIndex===action);
        if(record){
          assert.equal(await page.locator('#stage .war-report').getAttribute('data-war-tier'),record.tier);
          assert.match(await page.locator('#stage .war-map').innerText(),new RegExp(record.place));
          const html=await page.locator('#stage .war-report').innerText();for(const m of record.messages)assert.ok(html.includes(m.text));
          if(record.kind==='battle'){
            report.sectors.push(record.sector);
            assert.equal(record.tier,state._pendingResult.battles[0].tier);
            const expected=record.level<=1?0:record.level-1;
            assert.equal(await page.locator('#stage .visual-rail .scene-art').getAttribute('data-art'),`war-${record.sector}-${expected}`);
            if(record.level<3)assert.match(await page.locator('.verdict').innerText(),/未达成计划目标/);
          }
          if(!reloaded&&record.kind==='battle'){
            const before=JSON.stringify(state);await page.reload();await page.click('#ts-continue');
            assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'battle report and effects restore exactly');
            await page.click('#war-open-archive');assert.equal(await page.locator('#novel-log[open]').count(),1);
            const entry=page.locator('.war-archive-entry').filter({hasText:record.name}).first();await entry.locator('summary').click();
            assert.ok((await entry.innerText()).includes(record.messages[2].text));
            const ids=await page.locator('svg[aria-labelledby]').evaluateAll(nodes=>nodes.map(n=>n.querySelector('title').id));assert.equal(new Set(ids).size,ids.length,'current and archived maps have unique accessible IDs');
            await page.keyboard.press('a');assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'archive never triggers another choice');await page.keyboard.press('Escape');
            for(const width of [1440,768,390,320]){
              await page.setViewportSize({width,height:1000});
              assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
              assert.ok(await page.locator('#stage .war-map').isVisible());
              await page.waitForFunction(()=>[...document.querySelectorAll('#stage img')].every(img=>img.complete&&img.naturalWidth>0));
              if(width===1440||width===390)await page.screenshot({path:path.join(path.dirname(out),`battle-${width}.png`),fullPage:true});
            }
            await page.setViewportSize({width:1440,height:1000});reloaded=true;
          }
          if(id==='3-10'){
            assert.equal(record.sector,'romania');assert.ok(record.points.every(p=>p[2]<49));assert.match(html,/普鲁特河/);
            await page.screenshot({path:path.join(path.dirname(out),'southern-front.png'),fullPage:true});
          }
          if(id==='a3-end'){
            assert.equal(record.kind,'war');const n=Object.values(record.counts).reduce((a,b)=>a+b,0);assert.equal(n,state._warReports.filter(r=>r.kind==='battle').length);
            await page.screenshot({path:path.join(path.dirname(out),'war-outcome.png'),fullPage:true});
          }
        }
      }
      await advanceScene(page);
    }
    assert.equal(await page.locator('.ending').count(),1);
    const end=await page.evaluate(()=>({state:JSON.stringify(S),count:S._warReports.length}));await page.click('#nav-dialogue');
    assert.equal(await page.locator('.war-archive-entry').count(),end.count);assert.equal(await page.evaluate(()=>JSON.stringify(S)),end.state);
    await page.keyboard.press('Escape');await page.click('#to-menu');await page.reload();await page.click('#nav-dialogue');
    assert.equal(await page.locator('.war-archive-entry').count(),end.count,'completed archive survives reload');
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.resourceFailures,[]);report.passed=true;
    report.checks.push('all eight new photo atlases load','actual battle rating controls report, image and geography','frontline, logistics and civilian sources; five war outcome categories accounted by full-route suite','southern offensive uses Iasi–Chisinau and Prut geography','exact battle reload and immutable archive; unique map IDs','320/390/768/1440px fit; full campaign and ending remain playable');
    console.log('WAR REPORTS VERIFIED',JSON.stringify(report));
  }catch(e){report.failure=e.stack;throw e;}
  finally{fs.writeFileSync(out,JSON.stringify(report,null,2));await browser.close();local?.server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
