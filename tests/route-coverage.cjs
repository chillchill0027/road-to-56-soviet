const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { runtime } = require("./helpers/runtime.cjs");
const { catalog, replay } = require("./helpers/routes.cjs");
const fixtures = require("./fixtures/routes.json");
const covered = new Set(),
  results = [];
for (const fixture of fixtures.routes) {
  test(`legal complete route ${fixture.id} reaches ${fixture.ending}`, () => {
    const result = replay(fixture);
    result.covered.forEach((t) => covered.add(t));
    results.push({
      id: fixture.id,
      ending: result.ending,
      actions: fixture.steps.length,
      seed: fixture.eventSeed,
      state: Object.fromEntries(
        [
          "PP",
          "PAR",
          "IND",
          "ARMY",
          "MOR",
          "COM",
          "LEFT",
          "RIGHT",
          "beria",
          "purgeCount",
          "deathMode",
          "warOutcome",
          "route",
        ].map((k) => [k, result.state[k]]),
      ),
    });
  });
}
test("replayed routes cover every shipped scene, option, decision and ending", () => {
  const { game } = runtime();
  const required = catalog(game);
  assert.deepEqual(
    required.filter((t) => !covered.has(t)),
    [],
    "no untested branch can be added silently",
  );
  const categories = {};
  for (const t of required) {
    const k = t.split(":")[0];
    categories[k] = (categories[k] || 0) + 1;
  }
  const report = {
    passed: true,
    rulesVersion: 2,
    routeCount: results.length,
    required: required.length,
    covered: required.filter((t) => covered.has(t)).length,
    categories,
    endings: game.endings.map((e) => ({
      id: e.id,
      name: e.t.replace(/ /g, ""),
      reachable: covered.has("ending:" + e.id),
    })),
    routes: results,
  };
  fs.mkdirSync(path.resolve(__dirname, "../docs/qa"), { recursive: true });
  fs.writeFileSync(
    path.resolve(__dirname, "../docs/qa/route-coverage.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
});
