const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startServer}=require('./helpers/server.cjs');
const {choosePolicy,executeAgenda,advanceScene,continueReports}=require('./helpers/dialogue.cjs');
const fixture=require('./fixtures/routes.json').routes[0];
(async()=>{
  const local=process.argv[2]?null:await startServer(),url=process.argv[2]||local.url;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const out=path.resolve(process.env.STATISTICS_OUTPUT||'docs/qa/statistics/report.json');fs.mkdirSync(path.dirname(out),{recursive:true});
  const report={url,passed:false,checks:[],errors:[]};
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(url);await page.click('#ts-new');
    for(const [id,action] of fixture.steps){
      assert.equal(await page.evaluate(()=>S.curId),id);
      if(Array.isArray(action)) for(const decision of action) await executeAgenda(page,decision);
      else if(typeof action==='number') await choosePolicy(page,action);
      if(id==='dec-prologue'){
        await page.click('#next');
        assert.equal(await page.locator('#annual-dialog[open]').count(),1);
        assert.match(await page.locator('#annual-content').innerText(),/回望 1936/);
        assert.equal(await page.locator('#annual-dialog').evaluate(d=>d.scrollTop),0,'review opens at its title');
        assert.match(await page.locator('.annual-author').innerText(),/斯大林/);
        const before=await page.evaluate(()=>JSON.stringify(S));
        await page.keyboard.press('a');
        assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'review blocks game shortcuts');
        await page.reload();await page.click('#ts-continue');
        assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'pending annual report restores exactly');
        assert.equal(await page.locator('#annual-dialog[open]').count(),1);
        await page.screenshot({path:path.join(path.dirname(out),'new-year-desktop.png')});
        const annual=page.locator('#annual-content .annual-synthesis');
        assert.equal(await annual.locator('[data-annual-line]').count(),9);
        assert.equal(await annual.locator('[data-annual-toggle]').count(),9);
        const annualReport=await page.evaluate(()=>S._statistics.years[0]);
        await annual.locator('[data-annual-position]').focus();await page.keyboard.press('Home');
        assert.deepEqual(await annual.locator('.annual-chart-values dd').evaluateAll(nodes=>nodes.map(n=>Number(n.firstChild.textContent))),Object.values(annualReport.start));
        await annual.locator('[data-annual-toggle="PP"]').click();assert.equal(await annual.locator('[data-annual-line]').count(),8);
        await annual.locator('[data-annual-position]').focus();await page.keyboard.press('End');
        assert.deepEqual(await annual.locator('.annual-chart-values dd').evaluateAll(nodes=>nodes.map(n=>Number(n.firstChild.textContent))),Object.values(annualReport.end));
        for(const key of ['PAR','IND','ARMY','MOR','COM','STAL','LEFT','RIGHT'])await annual.locator(`[data-annual-toggle="${key}"]`).click();
        assert.equal(await annual.locator('[data-annual-line]').count(),0);
        assert.doesNotMatch(await annual.innerHTML(),/NaN|Infinity/);
        for(const key of ['PP','PAR','IND','ARMY','MOR','COM','STAL','LEFT','RIGHT'])await annual.locator(`[data-annual-toggle="${key}"]`).click();
        assert.equal(await annual.locator('[data-annual-line]').count(),9);
        assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'combined chart controls never change the game');
        await annual.evaluate(n=>n.scrollIntoView({block:'start'}));
        await page.screenshot({path:path.join(path.dirname(out),'annual-combined-1440.png')});
        await page.setViewportSize({width:390,height:1000});await annual.evaluate(n=>n.scrollIntoView({block:'start'}));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
        await page.screenshot({path:path.join(path.dirname(out),'annual-combined-390.png')});
        for(const width of [320,390,768,1440]){
          await page.setViewportSize({width,height:1000});
          assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth),0,'annual combined chart fits '+width);
          assert.equal(await annual.locator('[data-annual-line]').count(),9);
        }
        await page.setViewportSize({width:1440,height:1000});
        report.checks.push('annual combined chart includes nine original indicators; legend toggles, all-hidden state and chronological inspection preserve exact yearly values and game state');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#annual-dialog[open]').count(),0);
        assert.deepEqual(await page.evaluate(()=>S._statistics.pending),[]);
        await page.click('#nav-statistics');
        assert.equal(await page.locator('[data-metric]').count(),9);
        await page.click('[data-metric="MOR"]');
        assert.match(await page.locator('#chart-title').textContent(),/民心/);
        await page.click('[data-metric="PP"]');
        assert.ok(await page.locator('#statistics-dialog .stat-chart').evaluate(svg=>{const ticks=[...svg.querySelectorAll('.chart-grid')].map(line=>({y:Number(line.getAttribute('y1')),value:Number(line.nextElementSibling.textContent)}));const low=ticks[0],high=ticks.at(-1);return ticks.every(t=>Math.abs(t.y-(low.y-(low.y-high.y)*t.value/high.value))<0.001);}),'axis grid positions represent their displayed values exactly');
        await page.click('[data-metric="MOR"]');
        const slider=page.locator('#stat-position');
        await slider.focus();await page.keyboard.press('Home');
        const first=await page.evaluate(()=>S._statistics.events[0]);
        assert.equal(Number(await page.locator('.stat-event-number b').innerText()),first.values.MOR);
        await page.keyboard.press('ArrowRight');
        assert.equal(Number(await slider.inputValue()),1);
        const e=await page.evaluate(()=>S._statistics.events[1]);
        assert.equal(Number(await page.locator('.stat-event-number b').innerText()),e.values.MOR);
        const stable=await page.evaluate(()=>JSON.stringify(S));
        await page.keyboard.press('a');assert.equal(await page.evaluate(()=>JSON.stringify(S)),stable);
        for(const width of [1440,768,390,320]){
          await page.setViewportSize({width,height:1000});
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
          assert.ok(await page.locator('#statistics-dialog .stat-chart').isVisible());
          assert.ok(await page.locator('#statistics-dialog .stat-chart').evaluate(svg=>parseFloat(getComputedStyle(svg.querySelector('text')).fontSize)*svg.getBoundingClientRect().width/svg.viewBox.baseVal.width>=10),'chart labels remain readable after scaling');
          assert.ok(await page.locator('#statistics-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth),'dashboard fits its own viewport');
          if(width===1440||width===390) {await page.locator('#statistics-dialog').evaluate(d=>d.scrollTop=0);await page.screenshot({path:path.join(path.dirname(out),`dashboard-${width}.png`)});}
        }
        await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
        report.checks.push('first annual review restores without replaying events; shortcuts blocked; nine indicators and keyboard event inspection match actual ledger; 320/390/768/1440px fit');
      }else await advanceScene(page);
    }
    const data=await page.evaluate(()=>S._statistics);
    assert.deepEqual(data.years.map(r=>r.year),Array.from({length:21},(_,i)=>1936+i));
    assert.notEqual(data.years.find(r=>r.year===1953).leader.key,'stalin');
    assert.equal(data.years.find(r=>r.year===1952).leader.key,'stalin');
    assert.deepEqual(data.pending,[]);
    await page.click('#nav-statistics');await page.click('[data-stats-tab="years"]');
    await page.selectOption('#annual-year','1953');
    assert.match(await page.locator('#annual-archive .annual-author').innerText(),new RegExp(data.years.find(r=>r.year===1953).leader.name));
    assert.equal(await page.locator('#annual-archive [data-annual-line]').count(),9,'historical yearbook also includes the combined chart');
    await page.locator('#annual-archive [data-annual-toggle="PP"]').click();assert.equal(await page.locator('#annual-archive [data-annual-line]').count(),8);
    await page.selectOption('#annual-year','1954');assert.equal(await page.locator('#annual-archive [data-annual-line]').count(),9);assert.match(await page.locator('#annual-archive').innerText(),/沿用那份报告/);
    await page.setViewportSize({width:390,height:844});await page.selectOption('#annual-year','1953');await page.locator('#statistics-dialog').evaluate(d=>d.scrollTop=0);
    await page.screenshot({path:path.join(path.dirname(out),'successor-yearbook-mobile.png')});
    await page.keyboard.press('Escape');await page.click('#to-menu');await page.reload();await page.click('#nav-statistics');
    await page.click('[data-stats-tab="years"]');assert.equal(await page.locator('#annual-year option').count(),21,'completed yearbook survives reload');
    assert.deepEqual(report.errors,[]);report.passed=true;report.checks.push('all 21 years including skipped years; Stalin-to-successor viewpoint; final year review; completed archive survives reload');
    console.log('STATISTICS VERIFIED',JSON.stringify(report));
  }catch(e){report.failure=e.stack;throw e;}
  finally {fs.writeFileSync(out,JSON.stringify(report,null,2));await browser.close();local?.server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
