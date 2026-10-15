/* Run: node tests/browser-smoke.cjs [http://127.0.0.1:8000]
   Without a URL this starts its own static server. Results: docs/qa/browser-smoke.json. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.SMOKE_OUTPUT || path.join(root, 'docs/qa/browser-smoke.json'));
const coreKeys = ['PP', 'PAR', 'IND', 'ARMY', 'MOR', 'COM', 'STAL', 'LEFT', 'RIGHT', 'purgeCount'];
const balancedChoices = {
  '0-1': 'C', '0-2': 'D', '0-3': 'A', '1-1': 'B', '1-2': 'B',
  '1-3': 'B', '1-4': 'B', '1-5': 'A', '2-1': 'D', '2-2': 'C',
  '2-3': 'B', '2-4': 'B', '3-1': 'B', '3-2': 'A', '3-3a': 'A',
  '3-3b': 'C', '3-5': 'A', '3-6': 'A', '3-7': 'A', '3-9': 'B',
  '3-10': 'A', '3-11': 'A', '3-12': 'A', '3-13': 'B',
  'x-left': 'A', 'x-napoleon': 'B', 'x-right': 'B',
  '4-1': 'B', '4-2': 'B', '4-3': 'B', '4-4': 'B', '4-5': 'A',
  '4-6': 'B', '5-1': 'G', '5-2': 'A', '5-3': 'B', '5-4': 'B',
};
const balancedDecisions = {
  'dec-act1': [['fort-stalin', 3]],
  '2-5': [['fort-molotov', 3], ['tanks', 3]],
  'dec-mid3': [['lend', 2], ['partisan', 1]],
  'dec-mid3b': [['partisan', 2]],
  'dec-act3': [['rebuild', 1]],
  'dec-act5': [['destalin', 1]],
};

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const server = http.createServer((request, response) => {
    let file;
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw new Error('outside project');
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) response.writeHead(404).end('Not found');
      else response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    server, url: `http://127.0.0.1:${server.address().port}/`,
  })));
}

async function snapshot(page, action) {
  const result = await page.evaluate(() => ({
    scene: typeof S === 'undefined' ? null : S.curId,
    state: typeof S === 'undefined' ? null : JSON.parse(JSON.stringify(S)),
    ended: typeof ENDED !== 'undefined' && ENDED,
    heading: document.querySelector('#stage h1, #stage h2')?.textContent.trim() || '',
    options: [...document.querySelectorAll('.opt')].map(button => ({
      index: Number(button.dataset.i), key: button.querySelector('.key')?.textContent.trim(),
      label: button.querySelector('.lb')?.textContent.trim(), disabled: button.disabled,
    })),
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    battle: document.querySelector('.battle')?.innerText || null,
    images: [...document.querySelectorAll('#stage img')].map(img => ({
      source: img.getAttribute('src'), complete: img.complete, width: img.naturalWidth,
    })),
  }));
  result.action = action;
  assert.ok(result.overflow <= 1, `${result.scene || 'menu'} overflows viewport by ${result.overflow}px`);
  for (const key of coreKeys) assert.ok(Number.isFinite(result.state[key]), `${key} is numeric`);
  return result;
}

async function scenario(browser, url, config) {
  const context = await browser.newContext({ viewport: config.viewport, isMobile: config.mobile,
    hasTouch: config.mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const result = { name: config.name, viewport: config.viewport, snapshots: [], pageErrors: [], resourceFailures: [] };
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(url)) {
      result.resourceFailures.push({ url: response.url(), status: response.status() });
    }
  });
  const record = async action => {
    const value = await snapshot(page, action);
    result.snapshots.push(value);
    return value;
  };
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await record('open title');
    await page.locator('#ts-gallery').click();
    assert.equal(await page.locator('.gal-item').count(), 14);
    await record('open ending gallery');
    await page.locator('#gal-back').click();
    await page.locator('#ts-new').click();
    let reloadChecked = false;
    let resultReloadChecked = false;
    let resultHomeChecked = false;
    let dialogChecked = false;
    const acts = new Set();
    for (let step = 0; step < 150; step++) {
      let current = await record('inspect scene');
      acts.add(current.state.act);
      if (current.ended) break;
      if (!dialogChecked) {
        const before = JSON.stringify(current.state);
        await page.locator('#nav-help').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#help-dialog').evaluate(dialog => dialog.open), true, 'focused guide navigation uses native Enter activation');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => JSON.stringify(S)), before, 'guide Enter does not advance the story');
        if (await page.locator('#help-dialog').evaluate(dialog => dialog.open)) await page.keyboard.press('Escape');
        await page.locator('#nav-help').click();
        await page.keyboard.press('a');
        assert.equal(await page.evaluate(() => JSON.stringify(S)), before, 'guide letters do not select story options');
        await page.keyboard.press('Escape');
        await record('guide blocks story shortcuts');
        dialogChecked = true;
      }
      if (current.state._pendingResult && (!resultReloadChecked || !resultHomeChecked)) {
        const before = JSON.stringify(current.state);
        const historyBefore = await page.evaluate(() => JSON.stringify(LOG));
        if (!resultReloadChecked) {
          await page.reload({ waitUntil: 'networkidle' });
          await page.locator('#ts-continue').click();
          current = await record('reload restores executed result');
          resultReloadChecked = true;
        } else {
          await page.locator('#nav-home').click();
          await page.locator('#ts-continue').click();
          current = await record('return to title restores executed result');
          resultHomeChecked = true;
        }
        assert.equal(JSON.stringify(current.state), before, 'result restoration preserves the entire settled state');
        assert.equal(await page.evaluate(() => JSON.stringify(LOG)), historyBefore, 'result restoration preserves decision history');
        assert.equal(current.options.length, 0, 'the settled result is shown instead of repeating the decision');
      }
      if (!reloadChecked && current.scene === 'a1-intro') {
        const before = Object.fromEntries(coreKeys.map(key => [key, current.state[key]]));
        await page.reload({ waitUntil: 'networkidle' });
        await page.locator('#ts-continue').click();
        current = await record('reload and continue');
        const after = Object.fromEntries(coreKeys.map(key => [key, current.state[key]]));
        assert.deepEqual(after, before, 'reload preserves entry rewards and all resource values');
        reloadChecked = true;
      }
      if (current.options.length) {
        const available = current.options.filter(option => !option.disabled);
        assert.ok(available.length, `${current.scene} has at least one available choice`);
        const preferred = config.balanced ? balancedChoices[current.scene] : undefined;
        const option = available.find(option => option.key === preferred) || available[0];
        if (config.balanced && ((current.scene === '2-2' && option.key === 'C') ||
            (current.scene === '5-1' && option.key === 'G'))) {
          await page.keyboard.press(option.key.toLowerCase());
          const label = await page.evaluate(() => LOG.at(-1));
          assert.equal(label, option.label, 'the letter shortcut selects its displayed option');
          await record(`keyboard choice ${option.key}`);
        } else {
          await page.locator(`.opt[data-i="${option.index}"]`).click();
          await record(`click choice ${option.key}`);
        }
        continue;
      }
      if (config.balanced && balancedDecisions[current.scene]) {
        for (const [id, count] of balancedDecisions[current.scene]) {
          for (let n = 0; n < count; n++) {
            const button = page.locator(`.db2[data-id="${id}"]`);
            if (!await button.count() || !await button.isEnabled()) break;
            const before = await page.evaluate(id => S['_c_' + id] || 0, id);
            await button.click();
            assert.equal(await page.evaluate(id => S['_c_' + id], id), before + 1);
            await record(`execute decision ${id}`);
          }
        }
      }
      const next = page.locator('#next');
      assert.equal(await next.count(), 1, `${current.scene} has a continue button`);
      await next.click();
    }
    const final = await record('ending reached');
    assert.equal(final.ended, true, 'the entire playthrough terminates');
    assert.equal(reloadChecked, true, 'save restoration was tested');
    assert.equal(resultReloadChecked && resultHomeChecked, true, 'both result restoration routes were tested');
    assert.equal(dialogChecked, true, 'modal keyboard isolation was tested');
    if (config.balanced) assert.deepEqual([...acts].sort(), [0, 1, 2, 3, 4, 5]);
    const stored = await page.evaluate(() => ({ save: localStorage.getItem(SAVE_KEY),
      gallery: JSON.parse(localStorage.getItem(GALLERY_KEY)) }));
    assert.equal(stored.save, null);
    assert.equal(stored.gallery.length, 1);
    result.endingId = stored.gallery[0];
    result.actsVisited = [...acts].sort();
    await page.locator('#to-menu').click();
    await page.locator('#ts-gallery').click();
    assert.equal(await page.locator('.gal-item.got').count(), 1);
    await record('ending unlocked in gallery');
    await page.locator('#gal-back').click();
    await page.locator('#ts-new').click();
    assert.equal(await page.evaluate(() => S.curId), 'p0-intro');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(GALLERY_KEY)).length), 1);
    await record('restart preserves ending collection');
    assert.deepEqual(result.pageErrors, [], 'no browser JavaScript errors');
    if (process.env.SMOKE_STRICT_ASSETS !== '0') assert.deepEqual(result.resourceFailures, [], 'all local assets load');
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.failure = error.stack;
    try { await page.screenshot({ path: path.join(path.dirname(output), `browser-failure-${config.name}.png`), fullPage: true }); } catch {}
  } finally {
    await context.close();
  }
  return result;
}

(async () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const local = process.argv[2] ? null : await startServer();
  const url = process.argv[2] || local.url;
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const report = { createdAt: new Date().toISOString(), url, scenarios: [] };
  try {
    for (const config of [
      { name: 'desktop-balanced', viewport: { width: 1440, height: 1000 }, mobile: false, balanced: true },
      { name: 'mobile-historical', viewport: { width: 390, height: 844 }, mobile: true, balanced: false },
    ]) {
      const result = await scenario(browser, url, config);
      report.scenarios.push(result);
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}: ${result.snapshots.length} snapshots, ending=${result.endingId || 'none'}`);
      if (result.failure) console.error(result.failure.split('\n').slice(0, 3).join('\n'));
    }
    report.passed = report.scenarios.every(result => result.passed);
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Report: ${output}`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (local) local.server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
