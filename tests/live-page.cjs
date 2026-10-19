// Waits for Pages assets to match this checkout, then tests the public game.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const {choosePolicy,advanceScene}=require('./helpers/dialogue.cjs');
const target = process.env.LIVE_PAGE_URL || 'https://chillchill0027.github.io/road-to-56-soviet/';
const output = path.resolve(__dirname, '../docs/qa/live');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'] });
  const report = { target, checks: [], passed: false };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const root = path.resolve(__dirname, '..');
    const expected = ['script.js', 'novel.js', 'novel-content.js', 'world.js', 'world-content.js', 'presentation.js', 'statistics.js', 'style.css'].map(file => ({file, body:fs.readFileSync(path.join(root, file))}));
    let current = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const checks = await Promise.all(expected.map(async asset => {
        const response = await context.request.get(new URL(asset.file, target).href, {headers:{'Cache-Control':'no-cache'}});
        return response.status() === 200 && (await response.body()).equals(asset.body);
      }));
      if (checks.every(Boolean)) { current = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.equal(current, true, 'published game code and styles match the checked-out version');
    report.checks.push('published code and styles match this checkout byte for byte');
    const errors = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(target)) failures.push({url:r.url(), status:r.status()}); });
    const response = await page.goto(target, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.title-hero').count(), 1, 'published redesign is visible');
    assert.match(await page.locator('#ts-new').innerText(), /开启你的历史/);
    const assets = ['presentation.js', 'assets/fonts/archival-serif.woff2', 'assets/images/cover.webp', 'assets/images/cast-sheet.webp', ...['life','signals','state'].map(x=>`assets/images/world-${x}-sheet.webp`),
      ...['leader', 'industry', 'military', 'war', 'state', 'history'].map(x => `assets/images/${x}-sheet.webp`)];
    for (const asset of assets) {
      const result = await context.request.get(new URL(asset, target).href);
      assert.equal(result.status(), 200, `${asset} is public`);
      assert.ok((await result.body()).length > 100, `${asset} has content`);
    }
    const cover = await page.locator('.hero-image img').evaluate(img => ({loaded:img.complete&&img.naturalWidth>0,width:img.naturalWidth}));
    assert.equal(cover.loaded, true);
    await page.screenshot({ path: path.join(output, 'title-desktop.png'), fullPage: true });
    report.checks.push('public homepage, local font and all eleven image files return HTTP 200');
    await page.click('#ts-new');
    await advanceScene(page);
    assert.equal(await page.evaluate(() => S.curId), '0-1');
    await page.waitForFunction(() => [...document.querySelectorAll('#stage img')].every(i => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: path.join(output, 'choice-desktop.png'), fullPage: true });
    await choosePolicy(page,2);
    const state = await page.evaluate(() => JSON.stringify(S));
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#ts-continue');
    assert.equal(await page.evaluate(() => JSON.stringify(S)), state, 'published result page restores without recalculation');
    assert.equal(await page.locator('#next').count(), 1);
    await page.click('#nav-help');
    assert.equal(await page.locator('#help-dialog[open]').count(), 1);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: path.join(output, 'game-mobile.png'), fullPage: true });
    await page.click('#nav-home');
    await page.screenshot({ path: path.join(output, 'title-mobile.png'), fullPage: true });
    const cta = await page.locator('#ts-continue').boundingBox();
    assert.ok(cta.y + cta.height <= 844, 'mobile primary action is fully visible');
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    report.checks.push('new game, first choice, result reload, continue, guide and mobile layout work on the public URL');
    report.cover = cover; report.errors = errors; report.resourceFailures = failures; report.passed = true;
    console.log('LIVE PAGE VERIFIED:', target);
    console.log(JSON.stringify(report, null, 2));
    await context.close();
  } catch (e) { report.failure = e.stack; throw e; }
  finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
