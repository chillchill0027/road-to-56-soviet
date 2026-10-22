const test = require("node:test"),
  assert = require("node:assert/strict");
const { runtime } = require("./helpers/runtime.cjs");
const coreKeys = [
  "PP",
  "PAR",
  "IND",
  "ARMY",
  "MOR",
  "COM",
  "STAL",
  "LEFT",
  "RIGHT",
  "nuclear",
  "beria",
  "zhukov",
  "purgeCount",
];
const snapshot = (g) =>
  JSON.stringify(
    Object.fromEntries(coreKeys.map((k) => [k, g.state()[k] || 0])),
  );
const prepare = (id, setup = {}) => {
  const r = runtime({ novel: true }),
    g = r.game;
  Object.assign(g.state(), setup);
  g.cursor(id);
  const sc = g.scenes[id];
  if (sc.decisions) g.renderDecisions(sc);
  else g.renderScene(sc);
  return r;
};
test("every genuine policy decision has a complete authored odd-length conversation", () => {
  const { game: g } = runtime({ novel: true });
  const ids = Object.entries(g.scenes)
    .filter(([id, s]) => s.options && id !== "a3-end")
    .map(([id]) => id);
  assert.deepEqual(Object.keys(g.novelEvents).sort(), ids.sort());
  let rounds = 0;
  for (const id of ids) {
    const p = g.novelEvents[id];
    assert.ok([3, 5, 7].includes(p.rounds.length), id);
    assert.ok(p.reason.length > 15);
    assert.equal(p.voices.length, g.scenes[id].options.length, id);
    rounds += p.rounds.length;
    for (const r of p.rounds)
      for (const key of ["actor", "place", "time", "aside", "line"])
        assert.ok(r[key], `${id}:${key}`);
    for (const voice of p.voices) {
      assert.equal(voice.length, p.rounds.length, id);
      for (const s of voice) assert.ok(s.length > 4, id);
    }
  }
  assert.equal(ids.length, 37);
  assert.equal(rounds, 185);
  assert.equal(Object.keys(g.novelDecisions).length, g.decisions.length);
});
test("an early majority can prevail over a different final reply, without interim resource rewards", () => {
  const { game: g } = prepare("0-1");
  const before = snapshot(g);
  for (let n = 0; n < 6; n++) {
    assert.equal(g.novel.respond(n < 4 ? 2 : 0, n), true);
    assert.equal(snapshot(g), before);
  }
  g.novel.respond(0, 6);
  assert.equal(g.state()._pendingResult.optionIndex, 2);
  assert.equal(g.state().tolerance, true);
  assert.equal(
    g.state()._novelResolution.scores.find((s) => s.id === 2).votes,
    4,
  );
  assert.equal(g.state()._novel, undefined);
});
test("a multi-policy tie uses the latest stance among the tied leaders", () => {
  const { game: g } = runtime({ novel: true });
  const opts = [0, 1, 2, 3].map((id) => ({ id, enabled: true }));
  const result = g.novel.tally(
    [0, 0, 1, 1, 2, 2, 3].map((option) => ({ option })),
    opts,
  );
  assert.equal(result.winner, 2);
  assert.equal(result.tied, true);
});
test("stale events, invalid candidates and repeated final settlement cannot advance dialogue", () => {
  const { game: g } = prepare("0-1");
  g.novel.respond(2, 0);
  assert.equal(g.novel.respond(0, 0), false);
  assert.equal(g.novel.respond(99, 1), false);
  for (let n = 1; n < 7; n++) g.novel.respond(2, n);
  const before = JSON.stringify(g.state());
  assert.equal(g.novel.respond(2, 6), false);
  assert.equal(JSON.stringify(g.state()), before);
});
test("a paid project cannot be promised through a locked reply", () => {
  const { game: g } = prepare("1-4", { IND: 0 });
  assert.equal(g.novel.respond(0, 0), false);
  assert.equal(g.state()._novel.round, 0);
  for (let n = 0; n < 7; n++) g.novel.respond(2, n);
  assert.equal(g.state()._pendingResult.optionIndex, 2);
  assert.equal(g.state().nuclear, 0);
});
test("mid-conversation reload preserves answers and never repeats entry effects", () => {
  const { game: g } = prepare("0-1");
  g.novel.respond(2, 0);
  g.novel.respond(1, 1);
  const before = JSON.stringify(g.state());
  g.fresh();
  g.resume();
  assert.equal(JSON.stringify(g.state()), before);
  assert.equal(g.state()._novel.round, 2);
  for (let n = 2; n < 7; n++) g.novel.respond(2, n);
  const settled = JSON.stringify(g.state());
  g.fresh();
  g.resume();
  assert.equal(JSON.stringify(g.state()), settled);
});
for (const id of [
  "party-debate",
  "nkvd-delegate",
  "purge-army",
  "purge-party",
  "purge-nkvd",
  "collectivize",
  "fort-stalin",
  "fort-molotov",
  "tanks",
  "relocate",
  "lend",
  "partisan",
  "lessons",
  "mobilize",
  "religion",
  "atheist",
  "amnesty",
  "rebuild",
  "comintern",
  "hydrogen",
  "consumer",
  "destalin",
  "deport",
]) {
  test(`agenda ${id}: approval charges once and deferral charges nothing`, () => {
    const setup = {
      PP: 999,
      IND: 250,
      ARMY: 70,
      MOR: 50,
      nuclear: 50,
      beria: 20,
      tolerance: true,
      loses: 1,
    };
    for (const approve of [true, false]) {
      const { game: g } = runtime({ novel: true }),
        d = g.decisions.find((d) => d.id === id),
        act = d.act[0];
      const phase = [
        "dec-prologue",
        "dec-act1",
        "2-5",
        "dec-mid3",
        "dec-act4",
        "dec-act5",
      ][act];
      Object.assign(g.state(), setup, { act });
      g.cursor(phase);
      g.renderDecisions(g.scenes[phase]);
      const before = snapshot(g);
      const effectBefore = g.effectSnapshot();
      assert.equal(g.novel.startDecision(d), true);
      const n = g.novel.profile().rounds.length;
      assert.equal(n, 1, "standing agendas need exactly one reply");
      for (let r = 0; r < n - 1; r++) {
        g.novel.respond(approve ? 0 : 1, r);
        assert.equal(snapshot(g), before);
      }
      if (id === "hydrogen" || id === "consumer") {
        const saved = JSON.stringify(g.state());
        g.fresh();
        g.resume();
        assert.equal(JSON.stringify(g.state()), saved);
      }
      g.novel.respond(approve ? 0 : 1, n - 1);
      assert.equal(g.state()["_c_" + id] || 0, approve ? 1 : 0);
      assert.equal(g.state()._novelResolution.answers.length, 1);
      assert.equal(JSON.stringify(g.state()._novelResolution.resultDeltas), JSON.stringify(g.effectChanges(effectBefore)));
      const settled = JSON.stringify(g.state());
      assert.equal(g.novel.respond(0, 0), false);
      g.fresh(); g.resume();
      assert.equal(JSON.stringify(g.state()), settled, "reload never repeats an agenda settlement");
      if (!approve) assert.equal(snapshot(g), before);
      else {
        const direct = runtime().game;
        Object.assign(direct.state(), setup, { act });
        direct.cursor(phase);
        direct.executeDecision(direct.decisions.find((d) => d.id === id));
        assert.equal(snapshot(g), snapshot(direct));
        assert.equal(JSON.stringify(g.effectSnapshot()), JSON.stringify(direct.effectSnapshot()));
      }
    }
  });
}
test("death creates an interregnum and every successor has a distinct playable seat", () => {
  const { game: g } = prepare("5-0");
  assert.equal(g.novel.leader().key, "vacant");
  for (const [index, key] of [
    [0, "khrushchev"],
    [1, "malenkov"],
    [2, "beria"],
    [3, "zhukov"],
    [4, "mikoyan"],
    [5, "left-chair"],
    [6, "soviet-chair"],
    [7, "malenkov"],
  ]) {
    const { game: h } = prepare("5-1", {
      beria: 80,
      zhukov: 80,
      LEFT: 80,
      RIGHT: 80,
      tolerance: true,
      MOR: 90,
      _novelLeader: "vacant",
    });
    for (let r = 0; r < 3; r++) h.novel.respond(index, r);
    assert.equal(h.novel.leader().key, key);
    assert.notEqual(h.novel.leader().key, "stalin");
    assert.equal(h.state()._pendingResult.optionIndex, index);
  }
});
test("malformed dialogue save recovers the current scene without settling a policy", () => {
  const { game: g } = prepare("0-1");
  g.state()._novel.round = 500;
  g.saveGame();
  g.resume();
  assert.equal(g.state()._novel.round, 0);
  assert.equal(g.state()._pendingResult, undefined);
});
test("locked missing letters cannot fall through to a different numerical reply", () => {
  const { document, listeners } = runtime();
  let chosen = "";
  document.options = ["B", "C"].map((key) => ({
    disabled: false,
    querySelector: () => ({ textContent: key }),
    click: () => {
      chosen = key;
    },
  }));
  listeners.get("keydown")({ key: "1", preventDefault() {} });
  assert.equal(chosen, "");
  listeners.get("keydown")({ key: "2", preventDefault() {} });
  assert.equal(chosen, "B");
});
test("legacy saves retain their direct policy flow while new journeys enable dialogue", () => {
  const { game: g, nodes } = runtime({ novel: true });
  g.cursor("0-1");
  delete g.state().novelVersion;
  g.saveGame();
  g.resume();
  assert.equal(g.state().novelVersion, undefined);
  assert.doesNotMatch(nodes.get("stage").innerHTML, /vn-choice/);
  g.fresh();
  assert.equal(g.state().novelVersion, 1);
});
test("a successor receives reports from a different person, never their own portrait", () => {
  const { game: g, nodes } = prepare("5-2", { _novelLeader: "right" });
  g.novel.respond(0, 0);
  assert.match(nodes.get("stage").innerHTML, /vn-speaker">主席团秘书/);
  assert.doesNotMatch(nodes.get("stage").innerHTML, /vn-speaker">米高扬/);
});

test('all 23 agendas have distinct authored places, introductions, replies and outcomes',()=>{
  const {game:g}=runtime({novel:true});const seen={place:new Set(),arrival:new Set(),line:new Set(),yes:new Set(),no:new Set(),approved:new Set(),deferred:new Set()};
  for(const d of g.decisions){
    const p=g.novel.profile({kind:'decision',decisionId:d.id});
    assert.equal(p.rounds.length,1);
    assert.ok(p.arrival.length>30);assert.ok(p.rounds[0].line.length>40);
    assert.ok(p.approved.length>30);assert.ok(p.deferred.length>20);
    for(const[key,value]of Object.entries({place:p.rounds[0].place,arrival:p.arrival,line:p.rounds[0].line,yes:p.voices[0][0],no:p.voices[1][0],approved:p.approved,deferred:p.deferred})){
      assert.ok(!seen[key].has(value),`${d.id}: reused ${key}`);seen[key].add(value);
    }
  }
});
test('an unfinished old multi-round agenda becomes one uncharged final decision and keeps prior discussion',()=>{
  const{game:g}=prepare('dec-prologue');const before=JSON.stringify(g.effectSnapshot());
  g.state()._novel={v:1,kind:'decision',sceneId:'dec-prologue',decisionId:'religion',round:2,answers:[0,1].map((option,round)=>({round,option,text:'旧会谈回应'+round,speaker:'莫洛托夫',prompt:'旧会谈问题',leader:'约瑟夫·斯大林',place:'办公厅',time:'会谈中'}))};
  g.saveGame();g.fresh();g.resume();
  assert.equal(JSON.stringify(g.effectSnapshot()),before);
  assert.equal(g.state()._novel.round,0);assert.equal(g.novel.profile().rounds.length,1);
  assert.equal(g.state()._novel.previousDiscussion.length,2);
  const pending=JSON.stringify(g.state());g.fresh();g.resume();assert.equal(JSON.stringify(g.state()),pending);
  assert.equal(g.novel.respond(1,0),true);
  assert.equal(JSON.stringify(g.effectSnapshot()),before);
  assert.equal(g.state()._novelResolution.previousDiscussion.length,2);
  assert.equal(g.state()._novelResolution.answers.length,1);
  assert.match(g.novel.decisionOutcomeHTML(),/未拨付资源/);
});
test('deferring after an approval reports this deferral without a stale charged ledger',()=>{
 const{game:g}=prepare('dec-prologue');const d=g.decisions.find(d=>d.id==='religion');
 g.novel.startDecision(d);g.novel.respond(0,0);
 g.novel.startDecision(d);const before=JSON.stringify(g.effectSnapshot());g.novel.respond(1,0);
 assert.equal(JSON.stringify(g.effectSnapshot()),before);
 const html=g.novel.decisionOutcomeHTML();assert.match(html,/本期暂缓/);assert.match(html,/未拨付资源/);assert.doesNotMatch(html,/政治资本.*−15/);
});
