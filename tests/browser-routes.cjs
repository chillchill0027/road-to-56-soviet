/* Real clicks only: replays every fixture and collects all 14 endings in one browser profile. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server.cjs");
const {
  choosePolicy,
  executeAgenda,
  advanceScene,
  sourceKinds,
} = require("./helpers/dialogue.cjs");
const { runtime } = require("./helpers/runtime.cjs");
const {
  catalog,
  visit,
  stateInvariants,
  optionPaths,
} = require("./helpers/routes.cjs");
const fixtures = require("./fixtures/routes.json").routes;
const output = path.resolve(
  process.env.ROUTE_BROWSER_OUTPUT ||
    path.join(__dirname, "../docs/qa/browser-routes.json"),
);
(async () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const local = process.argv[2] ? null : await startServer(),
    url = process.argv[2] || local.url;
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    let value = Number(sessionStorage.getItem("r56.test.rng") ?? 1) >>> 0;
    Math.random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      sessionStorage.setItem("r56.test.rng", String(value));
      return value / 4294967296;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const report = {
      url,
      passed: false,
      routes: [],
      pageErrors: [],
      resourceFailures: [],
    },
    covered = new Set(),
    model = runtime().game,
    screenshots = new Set();
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      report.resourceFailures.push({ url: r.url(), status: r.status() });
  });
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(S)));
  const capture = async (name) => {
    if (screenshots.has(name)) return;
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: path.join(path.dirname(output), name + ".png"),
      fullPage: true,
    });
    screenshots.add(name);
  };
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    for (const [number, fixture] of fixtures.entries()) {
      await page.evaluate(
        (seed) => sessionStorage.setItem("r56.test.rng", String(seed)),
        fixture.eventSeed,
      );
      await page.setViewportSize(
        number % 2
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
      );
      await page.reload({ waitUntil: "load" });
      await page.click("#ts-new");
      let resultRestore = false,
        decisionRestore = false,
        dialogueRestore = false,
        previousYear = 1936;
      const summary = {
        id: fixture.id,
        ending: fixture.ending,
        width: number % 2 ? 390 : 1440,
        steps: 0,
        paidDecisions: 0,
        resultRestored: false,
        decisionRestored: false,
      };
      for (const [id, action] of fixture.steps) {
        let s = await state();
        assert.equal(s.curId, id, `${fixture.id}: next scene matches`);
        assert.ok(s.year >= previousYear, `${id}: calendar order`);
        previousYear = s.year;
        visit({ state: () => s, purgeTargets: model.purgeTargets }, covered);
        assert.equal(
          await page.evaluate(
            () =>
              Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
              ) - innerWidth,
          ),
          0,
          `${id}: no horizontal overflow`,
        );
        for (const k of Object.keys(model.meta))
          assert.equal(
            await page.locator("#v-" + k).textContent(),
            String(s[k]),
            `${id}: HUD ${k} matches state`,
          );
        if (
          id === "5-1" &&
          ["beria", "left", "mediocre"].includes(fixture.ending)
        )
          await capture("successor-" + fixture.ending);
        if (Array.isArray(action)) {
          for (const decisionId of action) {
            const button = page.locator(`.db2[data-id="${decisionId}"]`);
            assert.equal(
              await button.isEnabled(),
              true,
              `${id}: ${decisionId} affordable`,
            );
            const count = s["_c_" + decisionId] || 0;
            summary.dialogueRounds =
              (summary.dialogueRounds || 0) +
              (await executeAgenda(page, decisionId));
            s = await state();
            assert.equal(s["_c_" + decisionId], count + 1);
            covered.add("decision:" + decisionId);
            if (decisionId === "party-debate")
              covered.add(
                s.tolerance ? "path:debate-tolerance" : "path:debate-cooption",
              );
            summary.paidDecisions++;
            assert.match(
              await page.locator(".decision-result").innerText(),
              new RegExp(model.decisions.find((d) => d.id === decisionId).name),
            );
            if (["party-debate", "nkvd-delegate"].includes(decisionId))
              await capture("decision-" + decisionId);
            if (!decisionRestore) {
              const before = JSON.stringify(s);
              await page.reload({ waitUntil: "load" });
              await page.click("#ts-continue");
              assert.equal(
                JSON.stringify(await state()),
                before,
                "paid decision persists without charging twice",
              );
              decisionRestore = true;
              summary.decisionRestored = true;
            }
          }
        } else if (typeof action === "number") {
          const button = page.locator(`.opt[data-i="${action}"]`);
          assert.equal(
            await button.isEnabled(),
            true,
            `${id}:${action} is unlocked in the actual UI`,
          );
          const key = await button.locator(".key").innerText();
          optionPaths(s, { k: key }, covered);
          const inputKey =
            id === "5-1" && key === "H"
              ? "8"
              : id === "2-2" && key === "A"
                ? "1"
                : key === "→"
                  ? "Enter"
                  : undefined;
          if (!dialogueRestore && (await page.locator(".vn-choice").count())) {
            await button.click();
            const before = JSON.stringify(await state());
            await page.reload({ waitUntil: "load" });
            await page.click("#ts-continue");
            assert.equal(
              JSON.stringify(await state()),
              before,
              "mid-dialogue state restores exactly",
            );
            dialogueRestore = true;
            summary.dialogueRestored = true;
            summary.dialogueRounds = (summary.dialogueRounds || 0) + 1;
          }
          summary.dialogueRounds =
            (summary.dialogueRounds || 0) +
            (await choosePolicy(page, action, inputKey));
          s = await state();
          assert.equal(
            s._pendingResult.optionIndex,
            action,
            `${id}: input selected the displayed option`,
          );
          covered.add(`option:${id}:${action}`);
          if (id === "5-1") {
            const seat = await page.evaluate(() => Novel.leader());
            assert.notEqual(
              seat.key,
              "stalin",
              "successor viewpoint replaces Stalin",
            );
            assert.notEqual(seat.key, "vacant", "interregnum ends");
            summary.successor = seat.name;
          }
          for (const battle of s._pendingResult.battles)
            covered.add("battle:" + battle.tier);
          for (const { k, d } of s._pendingResult.deltas) {
            const text = `${model.names[k]} ${d > 0 ? "+" : ""}${d}`;
            assert.ok(
              (
                await page.locator(".scene-copy > .deltas").innerText()
              ).includes(text),
              `${id}: actual ${k} delta is visible`,
            );
          }
          if (s._pendingResult.battles.some((b) => !b.success)) {
            assert.match(
              await page.locator(".verdict").innerText(),
              /未达成计划目标/,
            );
            await capture("battle-costs");
          }
          if (!resultRestore) {
            const before = JSON.stringify(s);
            await page.reload({ waitUntil: "load" });
            await page.click("#ts-continue");
            assert.equal(
              JSON.stringify(await state()),
              before,
              "result restores without repeating costs, rewards or randomness",
            );
            resultRestore = true;
            summary.resultRestored = true;
          }
        }
        s = await state();
        stateInvariants({
          state: () => s,
          meta: model.meta,
          limits: model.limits,
        });
        await advanceScene(page);
        summary.steps++;
      }
      assert.equal(
        await page.locator(".ending").count(),
        1,
        `${fixture.id}: rendered ending`,
      );
      const title = (await page.locator(".ending h2").innerText()).replace(
        /\s/g,
        "",
      );
      assert.equal(
        title,
        model.endings.find((e) => e.id === fixture.ending).t.replace(/\s/g, ""),
      );
      covered.add("ending:" + fixture.ending);
      const gallery = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("r56sov.gallery.v1")),
      );
      assert.ok(gallery.includes(fixture.ending));
      assert.equal(
        await page.evaluate(() => localStorage.getItem("r56sov.save.v1")),
        null,
      );
      summary.passed = true;
      report.routes.push(summary);
      console.log(
        "PASS",
        fixture.id,
        fixture.ending,
        summary.width + "px",
        summary.steps + " scenes",
      );
      await page.click("#to-menu");
    }
    await page.click("#ts-gallery");
    assert.equal(
      await page.locator(".gal-item.got").count(),
      14,
      "all 14 endings collected in one real browser profile",
    );
    await capture("all-endings-gallery");
    const required = catalog(model);
    report.missing = required.filter((t) => !covered.has(t));
    assert.deepEqual(report.missing, []);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.resourceFailures, []);
    report.covered = required.length;
    report.galleryUnlocked = 14;
    report.informationSources = [...sourceKinds].sort();
    assert.ok(
      sourceKinds.size >= 20,
      "at least 20 source types were encountered through real play",
    );
    console.log("INFORMATION SOURCES VERIFIED:", sourceKinds.size);
    report.passed = true;
    console.log(
      "ALL BRANCHES VERIFIED:",
      required.length,
      "targets; gallery 14/14",
    );
  } catch (e) {
    report.failure = e.stack;
    try {
      await capture("routes-failure");
    } catch {}
    throw e;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    await browser.close();
    if (local) local.server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
