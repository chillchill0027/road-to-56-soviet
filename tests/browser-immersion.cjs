const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright"),
  { startServer } = require("./helpers/server.cjs");
(async () => {
  const local = process.argv[2] ? null : await startServer(),
    url = process.argv[2] || local.url;
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const out = path.resolve(
    process.env.IMMERSION_OUTPUT || "docs/qa/immersion/report.json",
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const report = {
    url,
    passed: false,
    checks: [],
    errors: [],
    resourceFailures: [],
  };
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(url) && r.status() >= 400)
        report.resourceFailures.push(r.url());
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.click("#ts-new");
    const base = await page.evaluate(() => JSON.stringify(effectSnapshot()));
    for (const [n, kind] of ["paper", "radio", "guard"].entries()) {
      assert.equal(
        await page.locator(".world-source").getAttribute("data-kind"),
        kind,
      );
      assert.equal(
        await page.locator(".opt").count(),
        0,
        "background precedes the first political reply",
      );
      assert.equal(
        await page.evaluate(() => JSON.stringify(effectSnapshot())),
        base,
      );
      await page.evaluate(() =>
        Promise.all(
          [...document.querySelectorAll("#stage img")].map((i) => i.decode()),
        ),
      );
      await page.screenshot({
        path: path.join(path.dirname(out), `opening-${n}.png`),
        fullPage: true,
      });
      if (n === 1) {
        const before = await page.evaluate(() => JSON.stringify(S));
        await page.reload({ waitUntil: "load" });
        await page.click("#ts-continue");
        assert.equal(await page.evaluate(() => JSON.stringify(S)), before);
      }
      await page.click("#next");
    }
    assert.equal(await page.evaluate(() => S.curId), "0-1");
    assert.equal(
      await page.locator(".world-source").getAttribute("data-kind"),
      "paper",
    );
    assert.match(await page.locator(".world-source").innerText(), /新年的社论/);
    assert.equal(
      await page
        .locator(
          ".vn-rule,.vn-process,.vn-bridge,.vn-previous,.vn-memory,.vn-entry",
        )
        .count(),
      0,
    );
    assert.doesNotMatch(
      await page.locator("#stage").innerText(),
      /本轮不扣除|为什么需要|叙事压缩|国家意志贯穿|累计形成政策/,
    );
    assert.equal(
      await page.evaluate(
        () =>
          !!(
            document
              .querySelector(".world-source")
              .compareDocumentPosition(document.querySelector(".vn-dialogue")) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
      true,
    );
    await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll("#stage img")].map((i) => i.decode()),
      ),
    );
    await page.screenshot({
      path: path.join(path.dirname(out), "dialogue-desktop.png"),
      fullPage: true,
    });
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () =>
            Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ) - innerWidth,
        ),
        0,
        `${width}px fit`,
      );
      if (width === 390)
        await page.screenshot({
          path: path.join(path.dirname(out), "dialogue-mobile.png"),
          fullPage: true,
        });
    }
    await page.click('.vn-choice[data-i="2"]');
    assert.equal(
      await page.locator("#stage .world-source").count(),
      0,
      "no repeated news card between new arrivals",
    );
    await page.click('.vn-choice[data-i="2"]');
    assert.equal(
      await page.locator("#stage .world-source").getAttribute("data-kind"),
      "petition",
    );
    const inbox = await page.evaluate(() => JSON.stringify(S._worldInbox)),
      before = await page.evaluate(() => JSON.stringify(S));
    await page.reload({ waitUntil: "load" });
    await page.click("#ts-continue");
    assert.equal(await page.evaluate(() => JSON.stringify(S)), before);
    await page.click("#nav-dialogue");
    assert.match(
      await page.locator(".world-archive").innerText(),
      /新年的社论/,
    );
    await page
      .locator(".world-archive details")
      .first()
      .locator("summary")
      .click();
    assert.match(
      await page.locator(".world-archive .world-source:visible").innerText(),
      /请让他回来解释/,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => JSON.stringify(S._worldInbox)),
      inbox,
    );
    for (const family of ["life", "signals", "state"]) {
      const r = await page.request.get(
        new URL(`assets/images/world-${family}-sheet.webp`, url).href,
      );
      assert.equal(r.status(), 200);
      assert.ok((await r.body()).length > 1000);
    }
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.resourceFailures, []);
    report.checks = [
      "three opening fragments before policy replies",
      "short source before dialogue, no repeated rule explanations",
      "interlude and mid-dialogue reload preserve state and inbox",
      "news archive reopens actual received material",
      "three generated scene atlases load; desktop/tablet/390/320px fit",
    ];
    report.passed = true;
    console.log("IMMERSION VERIFIED", JSON.stringify(report));
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
