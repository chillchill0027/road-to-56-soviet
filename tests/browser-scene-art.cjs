const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {startServer} = require('./helpers/server.cjs');
const {advanceScene, choosePolicy, executeAgenda} = require('./helpers/dialogue.cjs');
const fixture = require('./fixtures/routes.json').routes[0];

(async () => {
  const partial = process.env.SCENE_ART_ALLOW_PARTIAL === '1';
  assert.ok(!partial || !process.argv[2], 'preliminary partial checks are local only; published URLs always require full assets');
  const assetAudit = partial ? JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/qa/scene-art/assets.json'), 'utf8')) : null;
  if (partial) assert.deepEqual(assetAudit.errors, [], 'fix structural asset errors before preliminary browser checks');
  const local = process.argv[2] ? null : await startServer();
  const url = process.argv[2] || local.url;
  const out = path.resolve(process.env.SCENE_ART_OUTPUT || 'docs/qa/scene-art/report.json');
  fs.mkdirSync(path.dirname(out), {recursive:true});
  const report = {url,fixture:fixture.id,mode:partial ? 'local-preliminary' : 'strict',passed:false,interactionsPassed:false,fullAssetAcceptance:false,checks:[],assets:[],skippedAssets:[],skippedSceneImages:[],layouts:[],scenes:[],errors:[],resourceFailures:[],expectedMissingResources:[]};
  let browser;
  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),args:['--no-sandbox']});
    const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(seed => {
      let value = Number(sessionStorage.getItem('r56.scene.test.rng') ?? seed) >>> 0;
      Math.random = () => {
        value = (Math.imul(value,1664525) + 1013904223) >>> 0;
        sessionStorage.setItem('r56.scene.test.rng',String(value));
        return value / 4294967296;
      };
    },fixture.eventSeed);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('response',response=>{if(response.url().startsWith(url) && response.status() >= 400) report.resourceFailures.push({url:response.url(),status:response.status()});});
    await page.goto(url,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof SceneArt !== 'undefined' && typeof SCENE_ART_MANIFEST !== 'undefined');

    // Fetch and decode every source atlas once, with bounded concurrency. This also
    // checks scenes that the following real playthrough cannot reach in one run.
    const manifestFiles = await page.evaluate(()=>[...new Set(Object.values(SCENE_ART_MANIFEST).map(image=>image.file))]);
    const available = partial ? new Set(assetAudit.assets.map(asset=>asset.file)) : null;
    const files = partial ? manifestFiles.filter(file=>available.has(file)) : manifestFiles;
    report.skippedAssets = partial ? manifestFiles.filter(file=>!available.has(file)) : [];
    report.assetReviewIssues = assetAudit?.reviewIssues || [];
    assert.ok(files.some(file=>file.startsWith('assets/images/scenes/')),'dedicated artwork is included in the manifest');
    report.assets = await page.evaluate(async files => {
      const output = new Array(files.length);
      let next = 0;
      await Promise.all(Array.from({length:Math.min(6,files.length)},async()=>{
        for (;;) {
          const index = next++;
          if (index >= files.length) return;
          const file = files[index],response = await fetch(new URL(file,document.baseURI));
          if (!response.ok) throw Error(`${file}: HTTP ${response.status}`);
          const blob = await response.blob(),objectURL = URL.createObjectURL(blob);
          const image = new Image();
          try {
            image.src = objectURL;
            await image.decode();
            output[index] = {file,status:response.status,bytes:blob.size,width:image.naturalWidth,height:image.naturalHeight};
          } finally { URL.revokeObjectURL(objectURL); }
        }
      }));
      return output;
    },files);
    assert.equal(report.assets.length,files.length);
    for (const asset of report.assets) {
      assert.ok(asset.bytes > 1000,`${asset.file} is a complete image`);
      assert.ok(asset.width > 0 && asset.height > 0,`${asset.file} decodes`);
      if (asset.file.startsWith('assets/images/scenes/')) {
        assert.ok(Math.abs(asset.width / asset.height - 1.5) < .003,`${asset.file}: four native 3:2 frames require a 3:2 atlas`);
        assert.ok(asset.width >= 1024,`${asset.file}: atlas resolution supports the enlarged scene`);
      }
    }
    report.fullAssetAcceptance = report.skippedAssets.length === 0 && report.assetReviewIssues.length === 0;
    report.checks.push(`${report.assets.length} ${partial ? 'available' : 'manifest'} image sources return HTTP 200 and decode; every dedicated atlas has the expected native ratio`);
    if (partial) report.checks.push(`preliminary only: ${report.skippedAssets.length} known missing image sources and ${report.assetReviewIssues.length} open visual review issues remain; full release acceptance is not passed`);

    async function photograph(expectedKey,scope='#stage') {
      const figure = page.locator(`${scope} .dedicated-scene-art`).first();
      await figure.waitFor({state:'visible'});
      const details = await figure.evaluate(async (element,knownMissing) => {
        const image = element.querySelector('img');
        const key = element.dataset.sceneKey,entry = SCENE_ART_MANIFEST[key];
        const pending = knownMissing.includes(entry?.file);
        if (!pending) await image.decode();
        const frame = element.querySelector('.art-window').getBoundingClientRect();
        const cell = element.querySelector('.art-cell').getBoundingClientRect();
        const picture = image.getBoundingClientRect();
        return {key,file:image.getAttribute('src'),position:image.getAttribute('style'),pending,loaded:image.complete && image.naturalWidth > 0,
          width:frame.width,height:frame.height,cellWidth:cell.width,cellHeight:cell.height,imageWidth:picture.width,imageHeight:picture.height,
          expected:entry ? {file:entry.file,cell:entry.cell,cols:entry.cols,rows:entry.rows} : null};
      },report.skippedAssets);
      assert.equal(details.key,expectedKey);
      assert.ok(details.loaded || partial && details.pending,`${expectedKey} loaded or explicitly inventoried as pending in local preliminary mode`);
      assert.ok(details.expected,`${expectedKey} has a manifest entry`);
      assert.equal(details.file,details.expected.file);
      assert.ok(details.position.includes(`left:-${details.expected.cell % details.expected.cols * 100}%`));
      assert.ok(details.position.includes(`top:-${Math.floor(details.expected.cell / details.expected.cols) * 100}%`));
      assert.ok(Math.abs(details.width / details.height - 1.5) < .003,`${expectedKey} displays its complete 3:2 frame`);
      assert.ok(Math.abs(details.cellWidth-details.width)<1 && Math.abs(details.cellHeight-details.height)<1,'crop cell matches the visible frame');
      assert.ok(Math.abs(details.imageWidth-details.width*details.expected.cols)<1 && Math.abs(details.imageHeight-details.height*details.expected.rows)<1,'atlas is scaled proportionally without a neighboring cell leaking into view');
      report.scenes.push({key:details.key,file:details.file,position:details.position,loaded:details.loaded});
      if (details.pending && !report.skippedSceneImages.includes(details.key)) report.skippedSceneImages.push(details.key);
      return details;
    }
    async function layout(expectedKey) {
      for (const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:1000});
        const picture = await photograph(expectedKey);
        const state = await page.evaluate(()=>({overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
          bodyWidth:document.querySelector('.vn-body')?.getBoundingClientRect().width,
          visible:[...document.querySelectorAll('#stage .vn-choice')].every(button=>{const box=button.getBoundingClientRect();return box.width>0 && box.left>=0 && box.right<=innerWidth;})}));
        assert.ok(state.overflow<=1,`${expectedKey} fits ${width}px`);
        assert.ok(state.visible,'visible choices stay inside the screen');
        if (width===1440 && state.bodyWidth) assert.ok(picture.width>state.bodyWidth+100,'desktop artwork is wider than the reading column');
        report.layouts.push({key:expectedKey,width,imageWidth:picture.width,imageHeight:picture.height,...state});
      }
    }
    async function screenshot(name) {
      await page.evaluate(async knownMissing=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#stage img')].filter(image=>!knownMissing.includes(image.getAttribute('src'))).map(image=>image.decode()));window.scrollTo({top:0,behavior:'instant'});},report.skippedAssets);
      await page.screenshot({path:path.join(path.dirname(out),name),fullPage:true});
    }

    await page.click('#ts-new');
    await photograph('interlude/p0-intro/page/0');
    await advanceScene(page);
    assert.equal(await page.evaluate(()=>S.curId),'0-1');
    await layout('event/0-1/round/0');
    await screenshot('conversation-1440.png');
    const firstOption = fixture.steps.find(([id])=>id==='0-1')[1],roundPictures = new Set();
    for(let round=0;round<7;round++) {
      const image = await photograph(`event/0-1/round/${round}`);
      roundPictures.add(image.file+'|'+image.position);
      if(round===3) {
        await page.setViewportSize({width:390,height:1000});
        await screenshot('conversation-390.png');
        await page.setViewportSize({width:1440,height:1000});
      }
      await page.locator(`.vn-choice[data-i="${firstOption}"]`).click();
    }
    assert.equal(roundPictures.size,7,'all seven actual replies show different photographs');
    await photograph(`result/0-1/option/${firstOption}`);
    const pending = await page.evaluate(()=>JSON.stringify(S));
    await page.reload();await page.click('#ts-continue');
    assert.equal(await page.evaluate(()=>JSON.stringify(S)),pending,'a result image never replays its policy');
    await photograph(`result/0-1/option/${firstOption}`);
    report.checks.push('opening page, seven live dialogue rounds and the chosen result use dedicated photographs; the pending result restores exactly');

    await advanceScene(page);
    for(const id of ['0-2','0-3']) {
      assert.equal(await page.evaluate(()=>S.curId),id);
      await choosePolicy(page,fixture.steps.find(([scene])=>scene===id)[1]);
      await advanceScene(page);
    }
    await photograph('phase/dec-prologue');
    await page.locator('.db2[data-id="religion"]').click();
    await photograph('agenda/religion');
    await page.locator('.vn-choice[data-i="1"]').click();
    await photograph('agenda/religion/deferred');
    await page.setViewportSize({width:390,height:1000});await screenshot('agenda-deferred-390.png');
    await page.locator('.db2[data-id="religion"]').click();
    await page.locator('.vn-choice[data-i="0"]').click();
    await photograph('agenda/religion/approved');
    await layout('agenda/religion/approved');
    await page.setViewportSize({width:390,height:1000});await screenshot('agenda-approved-390.png');
    await page.setViewportSize({width:1440,height:1000});
    report.checks.push('decision hub, specific meeting, deferral and approved work select their own image bindings; phone and desktop framing remains complete; unavailable images are listed separately as not visually verified');

    // Continue the same legal fixture until its first real battle; no injected
    // resources or fabricated save is needed to check the result and archive.
    let started=false,battleChecked=false;
    for(const [id,action] of fixture.steps) {
      if(id==='dec-prologue')started=true;
      if(!started)continue;
      assert.equal(await page.evaluate(()=>S.curId),id);
      if(Array.isArray(action)) {
        const remaining=id==='dec-prologue'?action.slice(1):action;
        if(id==='dec-prologue')assert.equal(action[0],'religion','the approval above performs this fixture action');
        for(const decision of remaining)await executeAgenda(page,decision);
      } else if(typeof action==='number') {
        await choosePolicy(page,action);
        const record=await page.evaluate(({id,action})=>S._warReports?.find(report=>report.sceneId===id && report.optionIndex===action),{id,action});
        if(record?.kind==='battle') {
          const key=`result/${id}/option/${action}/tier/${record.level}`;
          const original=await photograph(key);
          await layout(key);
          await page.setViewportSize({width:390,height:1000});await screenshot('battle-390.png');
          const before=await page.evaluate(()=>JSON.stringify(S));
          await page.click('#war-open-archive');
          const entry=page.locator('.war-archive-entry').filter({hasText:record.name}).first();
          await entry.locator('summary').click();
          const archived=await photograph(key,'.war-archive-entry[open]');
          assert.equal(archived.file+'|'+archived.position,original.file+'|'+original.position,'the archive shows this actual battle photograph');
          assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'viewing the photograph never mutates the battle');
          await page.keyboard.press('Escape');
          battleChecked=true;break;
        }
      }
      await advanceScene(page);
    }
    assert.ok(battleChecked,'legal play reaches a real battle report');
    report.checks.push('a real campaign result selects its tactic and actual rating image; its archive repeats that recorded moment without changing the save');
    assert.deepEqual(report.errors,[]);
    if (partial) {
      const missing = new Set(report.skippedAssets.map(file=>new URL(file,url).href));
      report.expectedMissingResources = report.resourceFailures.filter(failure=>failure.status===404 && missing.has(failure.url));
      assert.deepEqual(report.resourceFailures.filter(failure=>!report.expectedMissingResources.includes(failure)),[],'only explicitly inventoried missing assets may fail during local preliminary checks');
    } else assert.deepEqual(report.resourceFailures,[]);
    report.interactionsPassed=true;
    report.passed=report.fullAssetAcceptance;
    console.log(partial ? 'PRELIMINARY SCENE ART INTERACTIONS VERIFIED' : 'DEDICATED SCENE ART VERIFIED',JSON.stringify({url,passed:report.passed,interactionsPassed:true,fullAssetAcceptance:report.fullAssetAcceptance,assets:report.assets.length,skippedAssets:report.skippedAssets.length,scenes:report.scenes.length,layouts:report.layouts.length,checks:report.checks}));
  } catch(error) {
    report.failure=error.stack;
    throw error;
  } finally {
    fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    await browser?.close();local?.server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
