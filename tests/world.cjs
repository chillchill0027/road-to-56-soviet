const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { runtime } = require("./helpers/runtime.cjs");
test("all events and agendas use real, distinct in-world sources, at least twenty types", () => {
  const { game: g } = runtime({ novel: true });
  assert.deepEqual(
    Object.keys(g.worldEvents).sort(),
    Object.keys(g.novelEvents).sort(),
  );
  assert.deepEqual(
    Object.keys(g.worldAgendas).sort(),
    Array.from(g.decisions, (d) => d.id).sort(),
  );
  const seen = new Set();
  let count = 0;
  const check = (r) => {
    for (const k of ["type", "from", "title", "body", "art"])
      assert.ok(r[k], k);
    assert.ok(g.worldTypes[r.type]);
    assert.ok(r.body.length <= 110, "short fragments, not explanatory essays");
    seen.add(r.type);
    count++;
  };
  for (const rows of Object.values(g.worldEvents))
    for (const r of rows) check(r);
  for (const rows of Object.values(g.worldIntros))
    for (const r of rows) check(r);
  for (const r of Object.values(g.worldAgendas)) check(r);
  assert.ok(seen.size >= 20);
  assert.equal(seen.size, 30);
  assert.equal(count, 147);
  assert.equal(
    seen.size,
    Object.keys(g.worldTypes).length,
    "no unused labels added merely to inflate the count",
  );
});
test("messages are distributed through each conversation without repeating every round", () => {
  const { game: g } = runtime({ novel: true });
  for (const [id, rows] of Object.entries(g.worldEvents)) {
    const n = g.novelEvents[id].rounds.length,
      slots = Array.from(g.world.positions(rows.length, n));
    assert.equal(new Set(slots).size, rows.length, id);
    assert.equal(slots[0], 0);
    assert.equal(slots.at(-1), n - 1);
  }
});
test("opening establishes old news, current broadcasts and nearby conversation before a policy choice", () => {
  const { game: g } = runtime({ novel: true });
  g.advance();
  assert.equal(g.state().curId, "p0-intro");
  assert.equal(g.state()._novel, undefined);
  assert.deepEqual(
    Array.from(g.worldIntros["p0-intro"], (r) => r.type),
    ["paper", "radio", "guard"],
  );
  assert.match(g.worldIntros["p0-intro"][0].stamp, /1934.*旧报/);
  assert.equal(g.state().year, 1936);
});
test("an interlude resumes at its current message without applying entry gains again", () => {
  const { game: g } = runtime({ novel: true });
  g.cursor("a1-intro");
  g.renderScene(g.scenes["a1-intro"]);
  g.state()._worldPage.index = 1;
  g.renderScene(g.scenes["a1-intro"]);
  const before = JSON.stringify(g.state());
  g.fresh();
  g.resume();
  assert.equal(JSON.stringify(g.state()), before);
  assert.equal(g.state()._worldPage.index, 1);
});
test("news snapshots remain what was read, while a new report reflects the current war outcome", () => {
  const { game: g } = runtime({ novel: true });
  g.cursor("a4-intro");
  g.state().warOutcome = "held";
  const fragment = g.worldIntros["a4-intro"][0],
    one = g.world.materialize(fragment, "one");
  assert.match(one.body, /本土守住/);
  g.state().warOutcome = "defeat";
  assert.equal(g.world.materialize(fragment, "one").body, one.body);
  const two = g.world.materialize(fragment, "two");
  assert.match(two.body, /战败/);
  assert.doesNotMatch(two.body, /大规模胜利/);
});
test("handover reports distinguish interim control from assassination or natural death", () => {
  const { game: g } = runtime({ novel: true });
  g.cursor("5-0");
  const f = g.worldIntros["5-0"][1];
  for (const [mode, word] of [
    ["natural", "逝世"],
    ["assassinated", "暗杀"],
    ["military", "军方接管"],
    ["beria", "内务部"],
  ]) {
    g.state().deathMode = mode;
    assert.match(g.world.materialize(f, mode).body, new RegExp(word));
  }
});
test("older dialogue saves acquire context without resetting answers or resources", () => {
  const { game: g } = runtime({ novel: true });
  g.cursor("0-1");
  g.renderScene(g.scenes["0-1"]);
  g.novel.respond(2, 0);
  delete g.state()._worldInbox;
  g.saveGame();
  const stats = JSON.stringify(g.effectSnapshot()),
    answers = JSON.stringify(g.state()._novel.answers);
  g.fresh();
  g.resume();
  assert.equal(JSON.stringify(g.effectSnapshot()), stats);
  assert.equal(JSON.stringify(g.state()._novel.answers), answers);
  assert.ok(Object.keys(g.state()._worldInbox).length);
});
test("all twelve new scene crops are backed by local generated image atlases", () => {
  const { game: g } = runtime({ novel: true });
  assert.equal(Object.keys(g.world.art).length, 12);
  for (const [file, cell] of Object.values(g.world.art)) {
    assert.ok(cell >= 0 && cell <= 3);
    assert.ok(
      fs.statSync(path.join(__dirname, "../assets/images", file + ".webp"))
        .size > 1000,
    );
  }
});
