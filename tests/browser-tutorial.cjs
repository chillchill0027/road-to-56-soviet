/* Exercise the Island tutorial locally, or pass a public URL to test the deployment. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { trace } = require('./fixtures/island-tutorial.json');

// The fixture itself is checked against a complete real engine replay in island-tutorial.cjs.
// Check every visible ledger against those same replayed snapshots in the browser as well.
const entry = id => trace.find(record => record.id === id && record.after);
const final = trace.find(record => record.final).final;
const delta = (id, key, signed = false) => {
  const record = entry(id);
  const format = n => signed && n > 0 ? `+${n}` : String(n);
  return `${format(record.before[key])} → ${format(record.after[key])}`;
};
const battle = id => entry(id).battles[0];
const expectedLedgers = [
  {'偏执':delta('0-1','PAR'), '工业':delta('0-1','IND'), '红军':delta('0-1','ARMY'), '民心':delta('0-1','MOR'), '左翼':delta('0-1','LEFT'), '右翼':delta('0-1','RIGHT'), '清洗次数':delta('0-1','purgeCount')},
  {'工业':delta('0-2','IND'), '红军':delta('0-2','ARMY'), '民心':delta('0-2','MOR')},
  {'偏执':delta('1-1','PAR'), '红军':delta('1-1','ARMY'), '民心':delta('1-1','MOR'), '斯大林派':delta('1-1','STAL'), '清洗次数':delta('1-1','purgeCount')},
  {'工业':delta('1-2','IND'), '民心':delta('1-2','MOR')},
  {'工业':delta('1-5','IND'), '红军':delta('1-5','ARMY'), '民心':delta('1-5','MOR')},
  {'工业':delta('2-2','IND'), '民心':delta('2-2','MOR'), '阵营影响':delta('2-2','COM'), '敌军强度修正':delta('2-2','enemyMod',true), '民族问题':delta('2-2','nationalQ')},
  {'战前工业':String(entry('3-1').before.IND), '红军':delta('3-1','ARMY'), '民心':delta('3-1','MOR'), '敌军强度':String(battle('3-1').enemy), '战力比 R':`${battle('3-1').R} · ${battle('3-1').tier}`},
  {'民心':delta('3-5','MOR'), '阵营影响':delta('3-5','COM'), '敌军强度修正':delta('3-5','enemyMod',true), '左翼':delta('3-5','LEFT')},
  {'红军':delta('3-6','ARMY'), '民心':delta('3-6','MOR'), '敌军强度':String(battle('3-6').enemy), '战术系数':String(battle('3-6').factors.tactic), '战力比 R':`${battle('3-6').R} · ${battle('3-6').tier}`},
  {'战前动员':`红军 ${entry('3-6').after.ARMY} → ${entry('3-7').before.ARMY}`, '战斗后红军':delta('3-7','ARMY'), '民心':delta('3-7','MOR'), '敌军强度':String(battle('3-7').enemy), '战力比 R':`${battle('3-7').R} · ${battle('3-7').tier}`},
  {'民心':delta('3-11','MOR'), '阵营影响':delta('3-11','COM'), '民族问题':delta('3-11','nationalQ')},
  {'阵营影响':`${final.COM} · 条件 ≤ 20`, '民族问题':`${final.nationalQ} · 条件 ≥ 50`, '最终结局':'孤岛'},
];

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.TUTORIAL_OUTPUT || path.join(root, 'docs/qa/tutorial'));

function serve() {
  const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json' };
  const server = http.createServer((request, response) => {
    let file;
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw new Error('outside root');
    } catch { response.writeHead(400).end(); return; }
    fs.readFile(file, (error, data) => error ? response.writeHead(404).end() : response.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream' }).end(data));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({server, url:`http://127.0.0.1:${server.address().port}/`})));
}

(async () => {
  fs.mkdirSync(output, {recursive:true});
  const local = process.argv[2] ? null : await serve();
  const url = process.argv[2] || local.url;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--no-sandbox']});
  const report = {url, scenarios:[], passed:false};
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({viewport:{width, height:850}, reducedMotion:'reduce'});
      const page = await context.newPage();
      const errors = [], failures = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(url)) failures.push(`${response.status()} ${response.url()}`); });
      await page.goto(url, {waitUntil:'networkidle'});
      // Produce a real in-progress save, rather than a synthetic localStorage value.
      await page.locator('#ts-new').click();
      const savedState = await page.evaluate(() => JSON.stringify(S));
      await page.locator('#nav-home').click();
      assert.ok(await page.locator('#ts-continue').isVisible(), 'a real saved game exists');
      const before = await page.evaluate(() => JSON.stringify(localStorage));
      await page.locator('#ts-tutorial').focus();
      await page.keyboard.press('Enter');
      await page.locator('.island-tutorial').waitFor({state:'visible'});
      const explanations = [], states = new Set();
      for (let i = 0; i < 100; i++) {
        const step = page.locator('[data-tutorial-step]');
        assert.equal(await step.count(), 1, 'exactly one tutorial step is shown');
        const stepText = await step.innerText();
        assert.ok(!states.has(stepText), 'advance reaches a distinct step');
        states.add(stepText);
        const explanation = (await page.locator('.tutorial-explanation').innerText()).trim();
        const chars = (explanation.match(/[\u3400-\u9fff]/g) || []).length;
        assert.ok(chars >= 135 && chars <= 180, `step ${i + 1} has approximately 150 Chinese characters (${chars})`);
        explanations.push(chars);
        const rows = await page.locator('.tutorial-metric').evaluateAll(elements => Object.fromEntries(elements.map(row => [...row.querySelectorAll('span')].map(span => span.textContent.trim()))));
        assert.deepEqual(rows, expectedLedgers[i], `step ${i + 1} ledger matches the real game replay`);
        assert.ok(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 1, 'no horizontal overflow');
        for (const img of await step.locator('img').all()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate(element => element.decode());
          assert.ok(await img.evaluate(element => element.naturalWidth > 0), 'scene image decodes');
        }
        if (i === 0) await page.screenshot({path:path.join(output, `tutorial-${width}.png`), fullPage:true});
        const next = page.locator('#tutorial-next');
        if (!await next.isVisible() || !await next.isEnabled()) break;
        if (i === 0) { await next.focus(); await page.keyboard.press('Enter'); }
        else await next.click();
      }
      assert.equal(explanations.length, expectedLedgers.length, 'all the tutorial steps were checked');
      const last = await page.locator('[data-tutorial-step]').innerText();
      const prev = page.locator('#tutorial-prev');
      assert.ok(await prev.isEnabled(), 'previous step is available');
      await prev.click();
      assert.notEqual(await page.locator('[data-tutorial-step]').innerText(), last, 'previous returns to the preceding step');
      await page.locator('#tutorial-next').click();
      await page.locator('#tutorial-start').focus();
      await page.keyboard.press('Enter');
      assert.ok(await page.locator('#restart-dialog').evaluate(dialog => dialog.open), 'starting from the tutorial confirms before replacing an existing save');
      await page.locator('#restart-cancel').click();
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before, 'cancelling leaves the saved game intact');
      await page.locator('#tutorial-back').click();
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before, 'tutorial leaves saves and settings untouched');
      await page.locator('#ts-continue').click();
      assert.equal(await page.evaluate(() => JSON.stringify(S)), savedState, 'the original game resumes unchanged after tutorial');
      assert.deepEqual(errors, []);
      assert.deepEqual(failures, []);
      report.scenarios.push({width, steps:explanations.length, chineseCharacters:explanations, errors, failures});
      await context.close();
    }
    const fresh = await browser.newContext({viewport:{width:390,height:850}, reducedMotion:'reduce'});
    const page = await fresh.newPage();
    await page.goto(url, {waitUntil:'networkidle'});
    await page.locator('#ts-tutorial').click();
    for (let i = 1; i < expectedLedgers.length; i++) await page.locator('#tutorial-next').click();
    await page.locator('#tutorial-start').click();
    assert.equal(await page.evaluate(() => S.curId), 'p0-intro', 'the final action starts a new game when there is no existing save');
    assert.equal(await page.locator('#restart-dialog').evaluate(dialog => dialog.open), false);
    await fresh.close();
    report.freshStart = true;
    report.passed = true;
    console.log(JSON.stringify(report, null, 2));
  } catch (error) { report.failure = error.stack; throw error; }
  finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    if (local) await new Promise(resolve => local.server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
