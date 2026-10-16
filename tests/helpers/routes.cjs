const assert = require("node:assert/strict");
const { runtime } = require("./runtime.cjs");
function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function availableDecisions(game) {
  const s = game.state();
  return game.decisions.filter(
    (d) =>
      (!d.act || d.act.includes(s.act)) &&
      (!d.when || d.when(s)) &&
      (d.max === undefined || (s["_c_" + d.id] || 0) < d.max) &&
      Object.entries(game.decisionCost(d)).every(([k, cost]) => s[k] >= cost),
  );
}
function catalog(game) {
  const targets = Array.from(game.flow, (id) => `scene:${id}`);
  for (const id of game.flow)
    (game.scenes[id].options || []).forEach((o, index) =>
      targets.push(`option:${id}:${index}`),
    );
  game.decisions.forEach((d) => targets.push(`decision:${d.id}`));
  game.endings.forEach((e) => targets.push(`ending:${e.id}`));
  ["natural", "military", "beria", "assassinated"].forEach((k) =>
    targets.push(`death:${k}`),
  );
  ["defeat", "costly", "great", "held", "stalemate"].forEach((k) =>
    targets.push(`war:${k}`),
  );
  ["崩溃", "失守", "僵持", "守住", "反攻"].forEach((k) =>
    targets.push(`battle:${k}`),
  );
  game.purgeTargets.forEach((p, i) => targets.push(`purge:${i}`));
  targets.push(
    "purge:moderate",
    "border:unfinished",
    "border:completed",
    "calendar:1941",
    "calendar:1942",
  );
  targets.push(
    "path:military-zhukov-only",
    "path:military-takeover",
    "path:left-influence-only",
    "path:left-coup-only",
    "path:right-influence-only",
    "path:right-reform-only",
    "path:debate-tolerance",
    "path:debate-cooption",
    "path:military-interim-only",
  );
  return targets;
}
function visit(game, covered) {
  const s = game.state();
  covered.add(`scene:${s.curId}`);
  if (s.curId === "5-0") covered.add(`death:${s.deathMode}`);
  if (s.curId === "a3-end") covered.add(`war:${s.warOutcome}`);
  if (s.curId === "a2-end") {
    covered.add(`calendar:${s.warYear || 1941}`);
    if (s["_c_fort-molotov"] >= 3) covered.add("border:completed");
    else if (s["_c_fort-molotov"] > 0) covered.add("border:unfinished");
  }
  for (const [index, p] of game.purgeTargets.entries())
    if (s._entryHTML?.includes(p.t)) covered.add(`purge:${index}`);
  if (s._entryHTML?.includes("没有人下达命令，但昨晚"))
    covered.add("purge:moderate");
}
function stateInvariants(game) {
  const s = game.state();
  for (const [k, m] of Object.entries(game.meta)) {
    assert.ok(
      Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= m.cap,
      `${s.curId}: ${k} is within its bounds`,
    );
  }
  for (const k of ["STAL", "LEFT", "RIGHT"])
    assert.ok(
      Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 100,
      `${k} faction bound`,
    );
  for (const [k, cap] of Object.entries(game.limits))
    if (s[k] !== undefined) {
      assert.ok(
        Number.isFinite(s[k]) &&
          s[k] >= (k === "westTrust" ? -100 : 0) &&
          s[k] <= cap,
        `${s.curId}: ${k} extra bound`,
      );
    }
}
function checkDeltas(game, before, deltas) {
  const after = game.effectSnapshot();
  const actual = {};
  for (const { k, d } of deltas) {
    assert.ok(!(k in actual), `one net delta per ${k}`);
    actual[k] = d;
  }
  for (const k of Object.keys(after)) {
    const difference = Math.round((after[k] - before[k]) * 100) / 100;
    assert.equal(
      actual[k] || 0,
      difference,
      `${game.state().curId}: displayed net ${k} equals the real state change`,
    );
  }
}
function optionPaths(s, option, covered) {
  if (s.curId === "5-1") {
    if (
      option.k === "D" &&
      s.zhukov >= 40 &&
      !s.napoleonGov &&
      s.interimLeader !== "military"
    )
      covered.add("path:military-zhukov-only");
    if (option.k === "D" && (s.napoleonGov || s.interimLeader === "military"))
      covered.add("path:military-takeover");
    if (
      option.k === "D" &&
      s.interimLeader === "military" &&
      !s.napoleonGov &&
      s.zhukov < 40
    )
      covered.add("path:military-interim-only");
    if (option.k === "F" && s.LEFT >= 60 && !s.leftCoup)
      covered.add("path:left-influence-only");
    if (option.k === "F" && s.LEFT < 60 && s.leftCoup)
      covered.add("path:left-coup-only");
    if (option.k === "E" && s.RIGHT >= 60 && !s.rightPath)
      covered.add("path:right-influence-only");
    if (option.k === "E" && s.RIGHT < 60 && s.rightPath)
      covered.add("path:right-reform-only");
  }
}
function choose(game, index, covered, verify = false) {
  const s = game.state(),
    scene = game.scenes[s.curId],
    option = scene.options[index];
  assert.ok(
    option && (!option.when || option.when(s)),
    `${s.curId}:${index} is unlocked`,
  );
  const before = verify ? game.effectSnapshot() : null;
  covered.add(`option:${s.curId}:${index}`);
  optionPaths(s, option, covered);
  game.choose(scene, option);
  const pending = game.state()._pendingResult;
  assert.ok(pending, "a valid choice settles a result");
  for (const b of pending.battles) {
    covered.add(`battle:${b.tier}`);
    assert.ok(
      Number.isFinite(Number(b.R)) && b.enemy >= 20,
      "combat stays finite",
    );
  }
  if (verify) checkDeltas(game, before, pending.deltas);
}
function decide(game, id, covered, verify = false) {
  const decision = availableDecisions(game).find((d) => d.id === id);
  assert.ok(
    decision,
    `${game.state().curId}: ${id} is unlocked, affordable, and below its limit`,
  );
  const before = verify ? game.effectSnapshot() : null;
  const deltas = game.executeDecision(decision);
  assert.ok(deltas, `${id} executes`);
  covered.add(`decision:${id}`);
  if (id === "party-debate")
    covered.add(
      game.state().tolerance ? "path:debate-tolerance" : "path:debate-cooption",
    );
  if (verify) checkDeltas(game, before, deltas);
}
function replay(fixture, options = {}) {
  const run = runtime({ fast: !!options.fast });
  const { game, math, storage } = run;
  math.random = rng(fixture.eventSeed);
  const covered = new Set();
  game.advance();
  let previousYear = 1936,
    choiceRestored = false,
    entryRestored = false,
    decisionRestored = false;
  for (const [id, action] of fixture.steps) {
    assert.equal(
      game.state().curId,
      id,
      "the actual next scene matches the recorded route",
    );
    assert.ok(!game.ended());
    assert.ok(
      game.state().year >= previousYear,
      `${id} never moves the calendar backwards`,
    );
    previousYear = game.state().year;
    visit(game, covered);
    const scene = game.scenes[id];
    if (!options.fast && !entryRestored && id === "a1-intro") {
      const before = JSON.stringify(game.state());
      game.resume();
      assert.equal(
        JSON.stringify(game.state()),
        before,
        "entry restoration never repeats an event",
      );
      entryRestored = true;
    }
    if (Array.isArray(action)) {
      assert.ok(scene.decisions);
      for (const decisionId of action) decide(game, decisionId, covered, true);
      if (!options.fast && action.length && !decisionRestored) {
        const before = JSON.stringify(game.state());
        game.resume();
        assert.equal(
          JSON.stringify(game.state()),
          before,
          "decision restoration never repeats costs",
        );
        decisionRestored = true;
      }
    } else if (typeof action === "number") {
      choose(game, action, covered, true);
      if (!options.fast && !choiceRestored) {
        const before = JSON.stringify(game.state());
        game.fresh();
        game.resume();
        assert.equal(
          JSON.stringify(game.state()),
          before,
          "result restoration never repeats settlement",
        );
        choiceRestored = true;
      }
    } else
      assert.ok(
        !scene.options?.length && !scene.decisions,
        `${id} is an automatic scene`,
      );
    stateInvariants(game);
    game.advance();
  }
  assert.equal(
    game.ended(),
    true,
    "the route terminates through the real ending renderer",
  );
  const ending = game.decideEnding().heads[0].id;
  assert.equal(
    ending,
    fixture.ending,
    "the expected ending is actually chosen",
  );
  covered.add(`ending:${ending}`);
  assert.ok(
    JSON.parse(storage.get(game.galleryKey)).includes(ending),
    "the ending is recorded in the gallery",
  );
  assert.equal(
    storage.has(game.saveKey),
    false,
    "completion clears the in-progress save",
  );
  return { ending, covered, state: JSON.parse(JSON.stringify(game.state())) };
}
module.exports = {
  optionPaths,
  checkDeltas,
  rng,
  availableDecisions,
  catalog,
  visit,
  choose,
  decide,
  replay,
  stateInvariants,
};
