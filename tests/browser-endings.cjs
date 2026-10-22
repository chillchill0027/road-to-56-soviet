const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startServer}=require('./helpers/server.cjs');
const {replay}=require('./helpers/routes.cjs');
const fixtures=require('./fixtures/routes.json').routes;
(async()=>{
 const local=process.argv[2]?null:await startServer(),url=process.argv[2]||local.url;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const out=path.resolve(process.env.ENDINGS_OUTPUT||'docs/qa/endings/report.json');fs.mkdirSync(path.dirname(out),{recursive:true});
 const report={url,passed:false,checks:[],errors:[],resourceFailures:[],layouts:[]};
 const records=fixtures.map(f=>replay(f,{statistics:true,endings:true}).game.archive.all()[0]);
 const pair=records.flatMap((r,i)=>records.slice(i+1).map(other=>[r,other])).find(([a,b])=>a.endingId===b.endingId&&Object.keys(a.final).some(k=>a.final[k]!==b.final[k]));
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(url))report.resourceFailures.push(r.url())});
 const upload=async(data,message)=>{
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.click('#runs-import')]);
  await chooser.setFiles({name:'playthroughs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(m=>document.getElementById('runs-message')?.textContent.includes(m),message);
 };
 const fit=async(name,width)=>{
  await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
  const result=await page.evaluate(()=>({overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
  assert.equal(result.overflow,0,`${name} ${width}px fits`);assert.deepEqual(result.broken,[]);report.layouts.push({name,width,...result});
 };
 try{
  await page.goto(url);await page.click('#nav-gallery');await upload({v:1,runs:records},'已导入 24 次游玩');
  assert.equal(await page.locator('.gal-item.got').count(),14);assert.equal(await page.locator('.gal-item.got img').count(),14);
  const coverCells=await page.locator('.gal-item.got img').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')+'|'+n.getAttribute('style')));
  assert.equal(new Set(coverCells).size,14,'all fourteen endings use distinct generated scenes');
  const before=await page.evaluate(()=>localStorage.getItem(EndingArchive.key));
  await upload({v:1,runs:records},'已导入 0 次游玩');assert.equal(await page.evaluate(()=>localStorage.getItem(EndingArchive.key)),before);
  const invalid=JSON.parse(JSON.stringify(records));invalid[0].statistics.events[0].values.MOR=null;
  await upload({v:1,runs:invalid},'格式或数值记录不完整');assert.equal(await page.evaluate(()=>localStorage.getItem(EndingArchive.key)),before);
  report.checks.push('24 engine-completed backups import through file chooser; duplicate imports do not duplicate runs; malformed backup preserves all records');
  await page.click('#nav-gallery');
  for(const width of [1440,1024,768,390,320]){
   await fit('gallery',width);
   if([1440,390].includes(width))await page.screenshot({path:path.join(path.dirname(out),`gallery-${width}.png`),fullPage:true});
  }
  await page.locator(`[data-ending="${pair[0].endingId}"]`).click();
  await page.click('#run-chart-jump');assert.equal(await page.locator('#ending-ledger-title').evaluate(n=>document.activeElement===n),true);
  const selectedId=await page.locator('#ending-run-select').inputValue();const selected=records.find(r=>r.id===selectedId);
  const verify=async(r)=>{
   for(const[k,v]of Object.entries(r.final))assert.equal(await page.locator(`#ending-run-statistics [data-metric="${k}"] > b`).innerText(),String(v));
   assert.equal(await page.locator('#run-stat-position').getAttribute('max'),String(r.statistics.events.length-1));
   await page.click('#ending-run-statistics [data-metric="IND"]');
   await page.locator('#run-stat-position').focus();await page.keyboard.press('Home');
   assert.match(await page.locator('#run-stat-event-detail').innerText(),new RegExp(r.statistics.events[0].title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   assert.equal(await page.locator('#run-stat-event-detail b').innerText(),String(r.statistics.events[0].values.IND));
  };
  await verify(selected);await page.selectOption('#ending-run-select',pair[0].id);await verify(pair[0]);
  await page.selectOption('#ending-run-select',pair[1].id);await verify(pair[1]);
  await page.click('#ending-run-statistics [data-stats-tab="years"]');assert.equal(await page.locator('#run-annual-year option').count(),21);
  await page.selectOption('#run-annual-year','1953');assert.match(await page.locator('#run-annual-archive').innerText(),new RegExp(pair[1].statistics.years.find(y=>y.year===1953).leader.name));
  await page.click('#ending-run-statistics [data-stats-tab="chart"]');
  for(const width of [1440,1024,768,390,320]){
   await fit('playthrough',width);
   if([1440,390].includes(width)){
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(path.dirname(out),`detail-${width}.png`)});
    await page.locator('.ending-run-ledger').screenshot({path:path.join(path.dirname(out),`chart-${width}.png`)});
   }
  }
  report.checks.push('same ending retains different runs; all nine final metrics, chronological event slider and 21 annual reviews match the selected historical ledger');
  await page.click('#ending-back');await page.reload();await page.click('#nav-gallery');
  assert.equal(await page.evaluate(()=>EndingArchive.all().length),24);
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#runs-export')]);
  const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.runs.length,24);
  const other=await browser.newPage();await other.goto(url);await other.click('#nav-gallery');
  await other.locator('#runs-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await other.waitForFunction(()=>EndingArchive.all().length===24);await other.close();
  report.checks.push('completed records survive reload; downloaded backup restores all runs in a separate browser profile');
  await page.click('#nav-start');await page.click('#ts-new');const active=await page.evaluate(()=>JSON.stringify(S));
  const activeSave=await page.evaluate(()=>localStorage.getItem(SAVE_KEY));
  await page.click('#nav-gallery');await page.locator(`[data-ending="${pair[0].endingId}"]`).click();
  await page.click('#nav-statistics');assert.equal(await page.locator('#statistics-dialog [data-metric="IND"] > b').innerText(),'95');
  const dup=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.filter((id,n)=>ids.indexOf(id)!==n)});assert.deepEqual(dup,[],'live and archived charts have independent accessible identifiers');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify(S)),active);assert.equal(await page.evaluate(()=>localStorage.getItem(SAVE_KEY)),activeSave);
  assert.equal(await page.evaluate(()=>EndingArchive.all().length),24);
  report.checks.push('archive browsing and live statistics remain independent; starting a new game preserves all completed histories and viewing a run never changes the active save');
  const legacy=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await legacy.goto(url);
  await legacy.evaluate(()=>localStorage.setItem(GALLERY_KEY,JSON.stringify(['rome'])));await legacy.reload();await legacy.click('#nav-gallery');
  assert.equal(await legacy.locator('.gal-item.got').count(),1);await legacy.click('[data-ending="rome"]');
  assert.equal(await legacy.locator('.stat-chart').count(),0);assert.match(await legacy.locator('.archive-legacy').innerText(),/无法还原/);
  await legacy.screenshot({path:path.join(path.dirname(out),'legacy-390.png'),fullPage:true});await legacy.close();
  report.checks.push('legacy unlocks retain artwork and access, with an explicit missing-history note and no fabricated chart');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.resourceFailures,[]);report.passed=true;console.log('ENDING ARCHIVES VERIFIED',JSON.stringify(report));
 }catch(e){report.failure=e.stack;throw e;}
 finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');await browser.close();local?.server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
