const test = require("node:test");
const assert = require("node:assert/strict");
const { runtime } = require("./helpers/runtime.cjs");
const { checkDeltas } = require("./helpers/routes.cjs");
function phase(game, id) {
  game.cursor(id);
  game.renderDecisions(game.scenes[id]);
}
function choice(game, id, key) {
  game.cursor(id);
  game.renderScene(game.scenes[id]);
  const o = game.scenes[id].options.find(
    (o) => o.k === key && (!o.when || o.when(game.state())),
  );
  assert.ok(o);
  game.choose(game.scenes[id], o);
  return game.state()._pendingResult;
}
function decision(game, id) {
  return game.decisions.find((d) => d.id === id);
}

test("left-wing preparations require an opening and paid political investment", () => {
  const { game } = runtime();
  phase(game, "dec-act1");
  const s = game.state(),
    d = decision(game, "party-debate");
  const before = JSON.stringify(s);
  assert.equal(game.executeDecision(d), null);
  assert.equal(JSON.stringify(s), before);
  s.tolerance = true;
  s.PP = 100;
  const left = s.LEFT,
    right = s.RIGHT;
  assert.ok(game.executeDecision(d));
  assert.equal(s.PP, 70);
  assert.equal(s.LEFT, left + 10);
  assert.equal(s.RIGHT, right + 10);
  assert.ok(game.executeDecision(d));
  assert.equal(s.PP, 40);
  assert.equal(game.executeDecision(d), null);
});
test("Beria grows through delegation and targeted purges rather than a circular unlock", () => {
  const { game } = runtime();
  phase(game, "dec-act1");
  const s = game.state(),
    d = decision(game, "nkvd-delegate");
  assert.equal(game.executeDecision(d), null);
  s.beria = 15;
  s.PP = 100;
  const morale = s.MOR;
  assert.ok(game.executeDecision(d));
  assert.ok(game.executeDecision(d));
  assert.equal(s.PP, 40);
  assert.equal(s.beria, 45);
  assert.equal(s.MOR, morale - 8);
  assert.equal(game.executeDecision(d), null);
  assert.equal(
    game.scenes["5-1"].options.find((o) => o.k === "C").when(s),
    true,
  );
  s.nuclear = 40;
  choice(game, "4-6", "C");
  assert.equal(s.beria, 70);
  assert.equal(s.nuclear, 35);
  game.cursor("5-0");
  game.renderScene(game.scenes["5-0"]);
  assert.equal(s.deathMode, "beria");
  assert.equal(s.interimLeader, "beria");
  assert.equal(s.route, undefined);
});
test("inertia is an explicit eighth successor choice", () => {
  const { game } = runtime();
  const pending = choice(game, "5-1", "H");
  assert.equal(game.state().route, "caretaker");
  assert.equal(pending.optionIndex, 7);
  assert.equal(game.decideEnding().heads[0].id, "mediocre");
});
test("the constitution discount is both displayed and charged exactly once", () => {
  const { game, nodes } = runtime();
  game.state().constitution = true;
  game.state().PP = 24;
  phase(game, "dec-prologue");
  const d = decision(game, "purge-army");
  assert.equal(game.decisionCost(d).PP, 24);
  assert.match(nodes.get("stage").innerHTML, /政治资本 −24/);
  assert.ok(game.executeDecision(d));
  assert.equal(game.state().PP, 0);
  const before = JSON.stringify(game.state());
  assert.equal(game.executeDecision(d), null);
  assert.equal(JSON.stringify(game.state()), before);
});
test("Comintern diplomacy doubles the actual lend-lease political cost", () => {
  const { game } = runtime();
  phase(game, "dec-mid3");
  game.state().cominternPath = true;
  const d = decision(game, "lend");
  assert.equal(game.decisionCost(d).PP, 50);
  game.state().PP = 49;
  assert.equal(game.executeDecision(d), null);
  game.state().PP = 50;
  assert.ok(game.executeDecision(d));
  assert.equal(game.state().PP, 0);
});
test("consumer goods have one transparent net industrial cost", () => {
  const { game } = runtime();
  phase(game, "dec-act3");
  Object.assign(game.state(), { IND: 20, MOR: 40 });
  const out = game.executeDecision(decision(game, "consumer"));
  assert.equal(game.state().IND, 0);
  assert.equal(game.state().MOR, 52);
  assert.equal(out.filter((x) => x.k === "IND").length, 1);
  assert.equal(out.find((x) => x.k === "IND").d, -20);
});
test("decisions outside their phase and forged scene options never execute", () => {
  const { game } = runtime();
  const before = JSON.stringify(game.state());
  assert.equal(game.executeDecision(decision(game, "religion")), null);
  game.choose(game.scenes["0-1"], game.scenes["0-1"].options[0]);
  assert.equal(JSON.stringify(game.state()), before);
  phase(game, "dec-prologue");
  const state = JSON.stringify(game.state());
  assert.equal(game.executeDecision({ ...decision(game, "religion") }), null);
  assert.equal(JSON.stringify(game.state()), state);
});
test("guerrilla and diplomatic enemy modifiers affect later campaigns exactly once", () => {
  const { game } = runtime();
  Object.assign(game.state(), {
    ARMY: 80,
    MOR: 70,
    enemyMod: 15,
    fort: 0,
    warning: 1,
  });
  const border = game.scenes["3-1"].options[0].battle(game.state());
  assert.equal(border.enemy, 110);
  assert.equal(game.battle(border.name, border.enemy, border).enemy, 125);
  phase(game, "dec-mid3");
  assert.ok(game.executeDecision(decision(game, "partisan")));
  const result = game.battle("莫斯科保卫战", 78, { hold: 0.9 });
  assert.equal(result.enemy, 85);
  assert.equal(result.enemyMod, 7);
  game.addRaw("enemyMod", -30);
  const later = game.battle("柏林战役", 48, { hold: 0.8 });
  assert.equal(later.enemy, 25);
});
test("enemy strength has a physical floor and never produces infinite ratios", () => {
  const { game } = runtime();
  game.state().enemyMod = -999;
  const b = game.battle("floor", 48);
  assert.equal(b.enemy, 20);
  assert.ok(Number.isFinite(Number(b.R)));
});
test("coercive discipline improves defensive ratios by 25% and leaves attacks alone", () => {
  const { game } = runtime();
  Object.assign(game.state(), { ARMY: 80, MOR: 70, fort: 32, warning: 0.85 });
  const attack = game.battle("attack", 90, { hold: 1 });
  game.state().harsh = true;
  assert.equal(game.battle("attack", 90, { hold: 1 }).R, attack.R);
  const defense = game.battle("defense", 90, { hold: 0.85, defensive: true });
  assert.equal(defense.factors.discipline, 1.25);
  assert.equal(
    defense.R,
    (((80 * 1.2) / (90 * 0.85 * 0.85)) * 1.25).toFixed(2),
  );
});
test("battle costs apply on defeat while victory-only rewards do not", () => {
  const { game } = runtime();
  Object.assign(game.state(), { ARMY: 1, MOR: 1 });
  const lost = game.battle("defeat", 100, {
    fx: { ARMY: 15, MOR: 20, IND: -10 },
  });
  assert.equal(lost.success, false);
  assert.equal(lost.fx.ARMY, -8);
  assert.equal(lost.fx.MOR, -18);
  assert.equal(lost.fx.IND, -10);
  Object.assign(game.state(), { ARMY: 100, MOR: 100 });
  const won = game.battle("victory", 20, {
    fx: { ARMY: 15, MOR: 20, IND: -10 },
  });
  assert.equal(won.success, true);
  assert.equal(won.fx.ARMY, 20);
  assert.equal(won.fx.MOR, 30);
  assert.equal(won.fx.IND, -10);
});
test("losing Berlin cannot claim the capture or print the victory story", () => {
  const { game, nodes } = runtime();
  Object.assign(game.state(), { ARMY: 1, MOR: 1 });
  const scene = game.scenes["3-12"];
  game.cursor("3-12");
  game.choose(scene, scene.options[0]);
  const p = game.state()._pendingResult;
  assert.equal(game.state().berlinSoviet, undefined);
  game.renderRealResult(scene, scene.options[0], p.deltas, p.battles, p.extra);
  const html = nodes.get("stage").innerHTML;
  assert.match(html, /未达成计划目标/);
  assert.doesNotMatch(html, /红旗插上国会大厦/);
});
test("a successful Berlin battle records its conditional capture flag", () => {
  const { game } = runtime();
  Object.assign(game.state(), {
    ARMY: 100,
    MOR: 100,
    fort: 48,
    enemyMod: -30,
    warning: 0.7,
  });
  game.cursor("3-12");
  game.choose(game.scenes["3-12"], game.scenes["3-12"].options[0]);
  assert.equal(game.state().berlinSoviet, true);
});
test("capped stats and absolute progress flags are reported as actual deltas", () => {
  const { game } = runtime();
  Object.assign(game.state(), { ARMY: 98, MOR: 98 });
  game.cursor("1-4");
  const before = game.effectSnapshot();
  game.choose(game.scenes["1-4"], game.scenes["1-4"].options[0]);
  const deltas = game.state()._pendingResult.deltas;
  assert.equal(deltas.find((x) => x.k === "nuclear").d, 40);
  for (const [k, v] of Object.entries(game.effectSnapshot()))
    assert.equal(
      deltas.find((x) => x.k === k)?.d || 0,
      Math.round((v - before[k]) * 100) / 100,
    );
});
test("effect previews show remaining capacity rather than impossible gains", () => {
  const { game } = runtime();
  game.state().MOR = 99;
  const preview = game.previewEffects(game.scenes["0-2"].options[1]);
  assert.equal(preview.find((x) => x.k === "MOR").d, 1);
  assert.equal(game.effectTone("PAR", 20), "dn");
  assert.equal(game.effectTone("PAR", -10), "up");
  assert.equal(game.effectTone("nationalQ", 15), "dn");
  assert.equal(game.effectTone("enemyMod", -8), "up");
  assert.equal(game.effectTone("LEFT", 10), "");
});
test("evacuated industry restores actual capacity and respects the industrial cap", () => {
  const { game, nodes } = runtime();
  Object.assign(game.state(), { IND: 295, indSaved: 75 });
  game.cursor("a3-end");
  game.renderScene(game.scenes["a3-end"]);
  assert.equal(game.state().IND, 300);
  assert.match(nodes.get("stage").innerHTML, /本阶段工业恢复 \+5/);
  game.renderScene(game.scenes["a3-end"]);
  assert.equal(game.state().IND, 300);
});
test("leaving Leningrad within range has a visible one-time industrial and morale cost", () => {
  const { game } = runtime();
  game.state().leninRisk = true;
  game.cursor("3-2");
  const { IND, MOR } = game.state();
  game.renderScene(game.scenes["3-2"]);
  assert.equal(game.state().IND, IND - 5);
  assert.equal(game.state().MOR, MOR - 5);
  game.resume();
  assert.equal(game.state().MOR, MOR - 5);
});
test("destalinization unrest has a smaller impact after negotiated allied governments", () => {
  for (const peoplesDemocracy of [false, true]) {
    const { game } = runtime();
    Object.assign(game.state(), {
      COM: 50,
      destalinUnrest: 30,
      peoplesDemocracy,
    });
    game.cursor("5-3");
    game.renderScene(game.scenes["5-3"]);
    assert.equal(game.state().COM, peoplesDemocracy ? 47 : 42);
    game.resume();
    assert.equal(game.state().COM, peoplesDemocracy ? 47 : 42);
  }
});
test("partial military purges do not falsely kill the surviving marshal", () => {
  const { game } = runtime();
  choice(game, "1-1", "C");
  assert.equal(game.state().tukh, true);
  assert.equal(game.state().napoleon, false);
  assert.equal(game.scenes["1-5"].options[0].when(game.state()), false);
  const mods = game.decideEnding().mods.join(" ");
  assert.match(mods, /军官团在部分清洗中受损/);
  assert.doesNotMatch(mods, /没有活过 1937/);
});
test("retiring the marshal prevents a later automatic military takeover", () => {
  const { game } = runtime();
  Object.assign(game.state(), { napoleon: true, tukh: true, ARMY: 100 });
  choice(game, "x-napoleon", "B");
  game.state().ARMY = 100;
  game.cursor("5-0");
  game.renderScene(game.scenes["5-0"]);
  assert.equal(game.state().deathMode, "natural");
  assert.equal(game.state().napoleon, false);
});
test("postwar conference follows the war result and later events keep calendar order", () => {
  const { game, nodes } = runtime();
  assert.ok(game.flow.indexOf("a3-end") < game.flow.indexOf("3-13"));
  assert.ok(game.flow.indexOf("4-4") < game.flow.indexOf("4-3"));
  game.state().warYear = 1942;
  game.cursor("a2-end");
  game.renderScene(game.scenes["a2-end"]);
  assert.equal(game.state().year, 1942);
  assert.match(nodes.get("stage").innerHTML, /1942 年 6 月 22 日/);
  game.cursor("3-9");
  game.renderScene(game.scenes["3-9"]);
  assert.equal(game.state().year, 1944);
});
test("hostile diplomacy creates a real trust deficit that later concessions must offset", () => {
  const { game } = runtime();
  game.addRaw("westTrust", -20);
  assert.equal(game.state().westTrust, -20);
  game.addRaw("westTrust", 30);
  assert.equal(game.state().westTrust, 10);
});
test("old conference and nuclear-result saves keep their original next event", () => {
  for (const [id, next] of [
    ["3-13", "a3-end"],
    ["4-3", "4-4"],
  ]) {
    const { game, storage } = runtime();
    const scene = game.scenes[id];
    game.cursor(id);
    const o = scene.options.find((o) => !o.when || o.when(game.state()));
    game.choose(scene, o);
    const saved = JSON.parse(storage.get(game.saveKey));
    delete saved.S.flowVersion;
    delete saved.S.rulesVersion;
    delete saved.S._pendingResult.nextSceneId;
    saved.i = game.legacyFlow.indexOf(id);
    saved.S._pendingResult.nextIndex = saved.i;
    storage.set(game.saveKey, JSON.stringify(saved));
    game.fresh();
    game.resume();
    assert.equal(game.state().flowVersion, 1);
    game.advance();
    assert.equal(game.state().curId, next);
  }
});
test("old out-of-range raw scores normalize once instead of rewarding a harmful action", () => {
  const { game, storage } = runtime();
  const saved = {
    v: 1,
    i: game.flow.indexOf("dec-act3"),
    LOG: [],
    S: { ...game.state(), curId: "dec-act3", nationalQ: 130, PP: 100 },
  };
  delete saved.S.rulesVersion;
  delete saved.S.flowVersion;
  storage.set(game.saveKey, JSON.stringify(saved));
  game.resume();
  assert.equal(game.state().nationalQ, 100);
  const changes = game.executeDecision(decision(game, "deport"));
  assert.ok(changes);
  assert.equal(
    changes.find((x) => x.k === "nationalQ"),
    undefined,
  );
});
test("ending text never invents a secret report that the player declined to publish", () => {
  for (const destalin of ["none", "limited", "full"]) {
    const { game } = runtime();
    Object.assign(game.state(), { route: "khrushchev", destalin });
    const text = game.decideEnding().heads[0].b;
    assert.equal(text.includes("秘密报告念完"), destalin === "full");
  }
});

test("industrial investments cannot buy full projects with insufficient capacity", () => {
  for (const [id, key] of [
    ["1-4", "A"],
    ["1-4", "B"],
    ["1-5", "A"],
    ["1-5", "D"],
    ["2-1", "D"],
    ["2-2", "B"],
    ["3-2", "A"],
    ["3-2", "C"],
    ["4-3", "A"],
    ["4-3", "B"],
    ["4-3", "C"],
    ["4-5", "A"],
    ["5-4", "C"],
  ]) {
    const { game } = runtime();
    Object.assign(game.state(), {
      IND: 0,
      nuclear: 40,
      napoleon: true,
      guns: true,
    });
    game.cursor(id);
    const option = game.scenes[id].options.find((o) => o.k === key);
    assert.equal(
      option.when(game.state()),
      false,
      `${id}:${key} has a real affordability gate`,
    );
    const before = JSON.stringify(game.state());
    game.choose(game.scenes[id], option);
    assert.equal(JSON.stringify(game.state()), before);
    assert.ok(
      game.scenes[id].options.some((o) => !o.when || o.when(game.state())),
      `${id} still has a legal fallback`,
    );
  }
});
test("completed tank and nuclear programs stop accepting payments for no progress", () => {
  const { game } = runtime();
  phase(game, "2-5");
  game.state().ARMY = 100;
  const before = game.state().PP;
  assert.equal(game.executeDecision(decision(game, "tanks")), null);
  assert.equal(game.state().PP, before);
  phase(game, "dec-act3");
  game.state().nuclear = 100;
  const industry = game.state().IND;
  assert.equal(game.executeDecision(decision(game, "hydrogen")), null);
  assert.equal(game.state().IND, industry);
});
test("numeric shortcuts resolve duplicate winter-war letters and the eighth successor", () => {
  const { document, listeners } = runtime();
  let selected = "";
  const button = (key, disabled, name) => ({
    disabled,
    querySelector: () => ({ textContent: key }),
    click: () => {
      selected = name;
    },
  });
  document.options = [
    button("A", true, "strong"),
    button("A", false, "weak"),
    button("B", false, "B"),
    button("C", false, "C"),
  ];
  const press = (key) => listeners.get("keydown")({ key, preventDefault() {} });
  press("1");
  assert.equal(selected, "weak");
  press("2");
  assert.equal(selected, "B");
  document.options = "ABCDEFGH".split("").map((k) => button(k, false, k));
  press("8");
  assert.equal(selected, "H");
});
test("the one-option war settlement supports Enter without choosing arbitrary story options", () => {
  const { document, listeners } = runtime();
  let clicked = 0;
  document.options = [
    {
      disabled: false,
      querySelector: () => ({ textContent: "→" }),
      click: () => clicked++,
    },
  ];
  document.getElementById = () => null;
  listeners.get("keydown")({ key: "Enter", preventDefault() {} });
  assert.equal(clicked, 1);
  document.options[0].querySelector = () => ({ textContent: "A" });
  listeners.get("keydown")({ key: "Enter", preventDefault() {} });
  assert.equal(clicked, 1);
});

test("Zhukov earns a complete independent political path from actual defensive victories", () => {
  const { game } = runtime();
  Object.assign(game.state(), {
    ARMY: 100,
    MOR: 100,
    fort: 48,
    warning: 0.7,
    enemyMod: -24,
  });
  choice(game, "3-3b", "C");
  assert.equal(game.state().zhukov, 20);
  choice(game, "3-7", "A");
  assert.equal(game.state().zhukov, 40);
  assert.equal(game.state().napoleonGov, undefined);
  assert.equal(game.state().interimLeader, undefined);
  assert.equal(
    game.scenes["5-1"].options.find((o) => o.k === "D").when(game.state()),
    true,
  );
  const lost = runtime().game;
  Object.assign(lost.state(), { ARMY: 1, MOR: 1 });
  choice(lost, "3-3b", "C");
  assert.equal(lost.state().zhukov, 0);
});
test("an interim military takeover can be confirmed without a previous coup", () => {
  const { game } = runtime();
  game.state().interimLeader = "military";
  assert.equal(game.state().zhukov, 0);
  assert.equal(game.state().napoleonGov, undefined);
  assert.equal(
    game.scenes["5-1"].options.find((o) => o.k === "D").when(game.state()),
    true,
  );
});
