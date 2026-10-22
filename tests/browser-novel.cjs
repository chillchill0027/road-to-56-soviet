const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server.cjs");
const { choosePolicy, replyPolicy,advanceScene } = require("./helpers/dialogue.cjs");
(async () => {
  const local = process.argv[2] ? null : await startServer(),
    url = process.argv[2] || local.url;
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const report = { url, passed: false, checks: [], errors: [] };
  const out = path.resolve(
    process.env.NOVEL_BROWSER_OUTPUT || "docs/qa/novel-browser.json",
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.click("#ts-new");
    await advanceScene(page);
    const core = () => page.evaluate(() => JSON.stringify(effectSnapshot())),
      base = await core();
    const sequence = [2, 2, 0, 0, 2, 2, 0];
    for (let r = 0; r < sequence.length; r++) {
      assert.match(
        await page.locator(".vn-progress").innerText(),
        new RegExp(`第 ${r + 1} / 7`),
      );
      assert.ok((await page.locator(".vn-line").innerText()).length > 15);
      if (r === 2) {
        const saved = await page.evaluate(() => JSON.stringify(S));
        await page.reload({ waitUntil: "load" });
        await page.click("#ts-continue");
        assert.equal(await page.evaluate(() => JSON.stringify(S)), saved);
        await page.click("#nav-dialogue");
        assert.match(
          await page.locator("#novel-log-content").innerText(),
          /柯巴/,
        );
        const dialogState = await page.evaluate(() => JSON.stringify(S));
        await page.keyboard.press("a");
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => JSON.stringify(S)), dialogState);
        await page.keyboard.press("Escape");
      }
      if (r < 6) assert.equal(await core(), base);
      await page.locator(`.vn-choice[data-i="${sequence[r]}"]`).click();
    }
    assert.equal(await page.evaluate(() => S._pendingResult.optionIndex), 2);
    await page.locator(".vn-resolution summary").click();
    assert.match(await page.locator(".vn-resolution").innerText(), /容忍/);
    assert.equal(await page.locator(".vn-resolution li").count(), 7);
    report.checks.push(
      "seven mixed replies form a 4:3 majority, not the final reply; no interim resource changes; exact dialogue reload; transcript modal blocks shortcuts",
    );
    await advanceScene(page);
    await choosePolicy(page, 1);
    await advanceScene(page);
    await choosePolicy(page, 0);
    await advanceScene(page);
    assert.equal(await page.evaluate(() => S.curId), "dec-prologue");
    await page.click('.db2[data-id="religion"]');
    const before = await core();
    assert.equal(await page.locator('.vn-choice').count(), 2);
    assert.match(await page.locator('.vn-progress').innerText(), /一次批示/);
    await page.locator('.vn-choice[data-i="1"]').click();
    assert.equal(await core(), before);
    assert.equal(await page.evaluate(() => S._c_religion || 0), 0);
    assert.match(
      await page.locator(".vn-decision-outcome").innerText(),
      /维持现状/,
    );
    const declined = await page.evaluate(() => JSON.stringify(S));
    await page.reload({ waitUntil: "load" });
    await page.click("#ts-continue");
    assert.equal(await page.evaluate(() => JSON.stringify(S)), declined);
    assert.match(
      await page.locator(".vn-decision-outcome").innerText(),
      /维持现状/,
    );
    await page.click('.db2[data-id="religion"]');
    const midway = await page.evaluate(() => JSON.stringify(S));
    await page.reload({ waitUntil: "load" });
    await page.click("#ts-continue");
    assert.equal(await page.evaluate(() => JSON.stringify(S)), midway);
    await page.click('.vn-choice[data-i="0"]');
    assert.equal(await page.locator('.vn-choice').count(), 0, 'one reply settles the agenda');
    assert.equal(await page.evaluate(() => S._c_religion), 1);
    report.checks.push(
      "one-reply agenda approval charges exactly once; deferral charges nothing; pending and settled saves both restore",
    );
    await advanceScene(page);
    await advanceScene(page);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () =>
            Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ) - innerWidth,
        ),
        0,
        `${width}px overflow`,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: path.join(path.dirname(out), "novel-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(path.dirname(out), "novel-mobile.png"),
      fullPage: true,
    });
    assert.deepEqual(report.errors, []);
    report.checks.push(
      "desktop, tablet, 390px and 320px layouts fit; character portraits load",
    );
    const portrait = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im.naturalWidth);
          im.onerror = () => resolve(0);
          im.src = "assets/images/cast-sheet.webp";
        }),
    );
    assert.ok(portrait > 1000);
    report.passed = true;
    console.log("VISUAL NOVEL VERIFIED", JSON.stringify(report));
  } catch (e) {
    report.failure = e.stack;
    throw e;
  } finally {
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
    await browser.close();
    local?.server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
