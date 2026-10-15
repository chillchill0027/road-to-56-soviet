const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the shipped, dependency-free engine with only its DOM surface replaced.
function runtime() {
  const listeners = new Map();
  const storage = new Map();
  const nodes = new Map();
  const node = () => ({
    innerHTML: '', children: [], textContent: '', style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, querySelectorAll() { return []; },
    querySelector() { return null; }, setAttribute() {}, appendChild() {},
  });
  const document = {
    options: [], body: node(),
    addEventListener(type, listener) { listeners.set(type, listener); },
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, node());
      return nodes.get(id);
    },
    querySelector(selector) { return selector === 'dialog[open]' ? (document.dialogOpen ? node() : null) : node(); },
    querySelectorAll(selector) { return selector === '.opt' ? document.options : []; },
    createElement: node,
  };
  const math = Object.assign(Object.create(Math), { random: () => 0 });
  const context = vm.createContext({
    document, window: { scrollTo() {} }, Math: math, console, requestNewGame() {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    setTimeout() {}, clearTimeout() {},
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  vm.runInContext(source + `
    renderHUD = () => {};
    showDeltas = () => {};
    globalThis.resultCalls = [];
    renderResult = (...args) => globalThis.resultCalls.push(args);
    globalThis.game = {
      fresh, advance, choose, renderScene, renderDecisions, renderTitle, resume,
      saveGame, loadGame, hasSave, addRaw, battle, battleHTML, apply, executeDecision,
      scenes: SCENES, flow: FLOW, decisions: DECISIONS,
      saveKey: SAVE_KEY, galleryKey: GALLERY_KEY,
      state: () => S, ended: () => ENDED, index: () => i,
      results: () => globalThis.resultCalls,
      cursor(id) { i = FLOW.indexOf(id); S.curId = id; },
    };
  `, context);
  const game = context.game;
  game.fresh();
  return { game, document, storage, listeners, nodes, math };
}

test('scene entry is applied once across redraws and continue-game', () => {
  const { game } = runtime();
  game.cursor('a1-intro');
  game.renderScene(game.scenes['a1-intro']);
  assert.equal(game.state().PP, 200);
  game.renderScene(game.scenes['a1-intro']);
  assert.equal(game.state().PP, 200);
  game.fresh();
  game.resume();
  assert.equal(game.state().PP, 200);
});

test('existing version-one saves do not replay an already granted entry bonus', () => {
  const { game, storage } = runtime();
  const state = { ...game.state(), PP: 200, act: 1, year: 1937, curId: 'a1-intro' };
  storage.set(game.saveKey, JSON.stringify({ v: 1, S: state, i: game.flow.indexOf('a1-intro'), LOG: [] }));
  game.resume();
  assert.equal(game.state().PP, 200);
});

test('older saves follow their scene ID when a decision phase moves the flow index', () => {
  const { game, storage } = runtime();
  const state = { ...game.state(), act: 5, year: 1956, curId: '5-2' };
  storage.set(game.saveKey, JSON.stringify({ v: 1, S: state, i: game.flow.indexOf('5-2') - 1, LOG: [] }));
  game.resume();
  assert.equal(game.state().curId, '5-2');
  assert.equal(game.index(), game.flow.indexOf('5-2'));
});

test('refreshing after a choice restores its saved result without applying the choice twice', () => {
  const { game, storage } = runtime();
  game.cursor('0-2');
  game.renderScene(game.scenes['0-2']);
  game.choose(game.scenes['0-2'], game.scenes['0-2'].options[0]);
  const saved = JSON.parse(storage.get(game.saveKey));
  assert.equal(saved.S.IND, 135);
  assert.equal(saved.S._pendingResult.optionIndex, 0);
  game.fresh();
  game.resume();
  assert.equal(game.state().IND, 135);
  assert.equal(game.state().curId, '0-2');
  assert.equal(game.results().length, 2);
  assert.equal(game.results().at(-1)[1].label, game.scenes['0-2'].options[0].label);
  game.advance();
  assert.equal(game.state().curId, '0-3');
  assert.equal(game.state()._pendingResult, undefined);
});

test('returning to the title and continuing restores the current result and history', () => {
  const { game, storage } = runtime();
  game.cursor('0-1');
  game.renderScene(game.scenes['0-1']);
  game.choose(game.scenes['0-1'], game.scenes['0-1'].options[0]);
  const before = JSON.stringify(game.state());
  const logBefore = JSON.parse(storage.get(game.saveKey)).LOG;
  game.renderTitle();
  game.resume();
  assert.equal(JSON.stringify(game.state()), before);
  assert.deepEqual(JSON.parse(storage.get(game.saveKey)).LOG, logBefore);
  assert.equal(game.results().at(-1)[1].label, game.scenes['0-1'].options[0].label);
});

test('a saved battle result restores the same casualties, counters and formula snapshot', () => {
  const { game } = runtime();
  game.cursor('3-1');
  game.renderScene(game.scenes['3-1']);
  game.choose(game.scenes['3-1'], game.scenes['3-1'].options[0]);
  const before = JSON.stringify(game.state());
  const battle = JSON.stringify(game.results().at(-1)[3][0]);
  game.fresh();
  game.resume();
  assert.equal(JSON.stringify(game.state()), before);
  assert.equal(JSON.stringify(game.results().at(-1)[3][0]), battle);
});

test('a saved defeat result preserves its jump to act five after continuing', () => {
  const { game } = runtime();
  game.cursor('a3-end');
  Object.assign(game.state(), { warOutcome: 'defeat', collapses: 3 });
  const scene = game.scenes['a3-end'];
  game.choose(scene, scene.options.find(option => option.when(game.state())));
  game.fresh();
  game.resume();
  assert.equal(game.state().curId, 'a3-end');
  assert.equal(game.state().defeat, true);
  game.advance();
  assert.equal(game.state().curId, 'a5-intro');
  assert.equal(game.state().act, 5);
});

test('invalid saves cannot resume into an undefined scene or nonnumeric resources', () => {
  const { game, storage } = runtime();
  for (const save of [
    { v: 1, i: 999, S: game.state() },
    { v: 1, i: 1, S: { ...game.state(), PP: 'broken' } },
    { v: 1, i: 1, S: null },
  ]) {
    storage.set(game.saveKey, JSON.stringify(save));
    assert.equal(game.hasSave(), false);
    assert.equal(game.loadGame(), false);
    assert.equal(storage.has(game.saveKey), false);
  }
});

test('a high-paranoia purge applies one penalty and survives reload unchanged', () => {
  const { game, nodes } = runtime();
  game.state().PAR = 80;
  game.cursor('a1-end');
  game.renderScene(game.scenes['a1-end']);
  assert.equal(game.state().PAR, 72);
  assert.equal(game.state().MOR, 62);
  assert.equal(game.state().STAL, 63);
  assert.equal(game.state().purgeCount, 1);
  assert.match(nodes.get('stage').innerHTML, /名单上又多了三十七个名字/);
  game.fresh();
  game.resume();
  assert.equal(game.state().PAR, 72);
  assert.equal(game.state().purgeCount, 1);
  assert.match(nodes.get('stage').innerHTML, /名单上又多了三十七个名字/);
});

test('a scientist purge removes nuclear progress as well as industry exactly once', () => {
  const { game, math } = runtime();
  math.random = () => 0.45;
  Object.assign(game.state(), { PAR: 80, nuclear: 50 });
  game.cursor('a1-end');
  game.renderScene(game.scenes['a1-end']);
  assert.equal(game.state().IND, 89);
  assert.equal(game.state().nuclear, 40);
  assert.equal(game.state().PAR, 72);
});

test('the postwar decision table switches to reconstruction actions', () => {
  const { game, nodes } = runtime();
  Object.assign(game.state(), { act: 3, year: 1945 });
  game.cursor('dec-act3');
  game.renderDecisions(game.scenes['dec-act3']);
  assert.equal(game.state().act, 4);
  assert.match(nodes.get('stage').innerHTML, /data-id="rebuild"/);
  assert.doesNotMatch(nodes.get('stage').innerHTML, /data-id="relocate"/);
});

test('the actual second-act decision table offers the new-border fortifications', () => {
  const { game, nodes } = runtime();
  game.cursor('2-5');
  game.renderDecisions(game.scenes['2-5']);
  assert.equal(game.state().act, 2);
  assert.match(nodes.get('stage').innerHTML, /data-id="fort-molotov"/);
});

test('the fifth-act phase offers its documented anti-personality-cult decision once', () => {
  const { game, nodes } = runtime();
  game.cursor('dec-act5');
  game.renderDecisions(game.scenes['dec-act5']);
  assert.equal(game.state().act, 5);
  assert.match(nodes.get('stage').innerHTML, /data-id="destalin"/);
  const decision = game.decisions.find(d => d.id === 'destalin');
  assert.ok(game.executeDecision(decision));
  const after = game.state().PP;
  assert.equal(game.executeDecision(decision), null);
  assert.equal(game.state().PP, after);
});

test('war preparations retain diplomatic fortifications and add completed defense lines once', () => {
  const { game } = runtime();
  game.cursor('2-1');
  game.choose(game.scenes['2-1'], game.scenes['2-1'].options.find(o => o.k === 'D'));
  assert.equal(game.state().fort, 20);
  Object.assign(game.state(), { fortStalin: 8, fortMolotov: 24, '_c_fort-molotov': 3 });
  game.cursor('a2-end');
  game.renderScene(game.scenes['a2-end']);
  assert.equal(game.state().fort, 52);
  game.fresh();
  game.resume();
  assert.equal(game.state().fort, 52);
});

test('unfinished new-border defenses contribute nothing', () => {
  const { game } = runtime();
  Object.assign(game.state(), { fort: 20, fortStalin: 8, fortMolotov: 16, '_c_fort-molotov': 2 });
  game.cursor('a2-end');
  game.renderScene(game.scenes['a2-end']);
  assert.equal(game.state().fort, 28);
});

test('partisans reduce enemy strength below its baseline and improve the battle ratio', () => {
  const { game } = runtime();
  const before = Number(game.battle('test', 80 + game.state().enemyMod).R);
  game.addRaw('enemyMod', -8);
  assert.equal(game.state().enemyMod, -8);
  const after = Number(game.battle('test', 80 + game.state().enemyMod).R);
  assert.ok(after > before);
});

test('battle explanations retain the values used before casualties and rewards', () => {
  const { game } = runtime();
  Object.assign(game.state(), { ARMY: 80, MOR: 70, fort: 32, warning: 0.85 });
  const result = game.battle('snapshot', 90, { hold: 0.85 });
  const expected = 80 * 1.2 * 1 / (90 * 0.85 * 0.85);
  assert.equal(result.R, expected.toFixed(2));
  assert.equal(result.tier, '反攻');
  game.apply({ ARMY: -20, MOR: -30 });
  const html = game.battleHTML(result);
  assert.match(html, /红军 80/);
  assert.match(html, /民心 70/);
  assert.match(html, /战术系数 ×0\.85/);
  assert.doesNotMatch(html, /红军 60/);
});

test('manual purge decisions, story purges and automatic purges each count once', () => {
  const { game } = runtime();
  game.cursor('0-1');
  game.choose(game.scenes['0-1'], game.scenes['0-1'].options[0]);
  assert.equal(game.state().purgeCount, 1);
  game.choose(game.scenes['0-1'], game.scenes['0-1'].options[0]);
  assert.equal(game.state().purgeCount, 1);
  const decision = game.decisions.find(d => d.id === 'purge-party');
  game.executeDecision(decision);
  assert.equal(game.state().purgeCount, 2);
  game.state().PAR = 80;
  game.cursor('a1-end');
  game.renderScene(game.scenes['a1-end']);
  assert.equal(game.state().purgeCount, 3);
  game.resume();
  assert.equal(game.state().purgeCount, 3);
});

test('the assassination condition can be reached with six actual purge actions', () => {
  const { game } = runtime();
  Object.assign(game.state(), { act: 1, PP: 999 });
  const party = game.decisions.find(d => d.id === 'purge-party');
  const army = game.decisions.find(d => d.id === 'purge-army');
  for (let n = 0; n < 4; n++) game.executeDecision(party);
  for (let n = 0; n < 2; n++) game.executeDecision(army);
  assert.equal(game.state().purgeCount, 6);
  game.state().PAR = 90;
  game.cursor('5-0');
  game.renderScene(game.scenes['5-0']);
  assert.equal(game.state().assassinated, true);
});

test('older saves migrate logged manual purges without adding them again on later reloads', () => {
  const { game, storage } = runtime();
  const state = { ...game.state(), purgeCount: 1, curId: '0-1' };
  delete state._purgeAccounting;
  const storyPurge = game.scenes['0-1'].options[0].label;
  storage.set(game.saveKey, JSON.stringify({ v: 1, S: state, i: 1, LOG: ['清洗党', storyPurge] }));
  game.resume();
  assert.equal(game.state().purgeCount, 3);
  game.resume();
  assert.equal(game.state().purgeCount, 3);
});

test('repeated or unavailable choices never spend resources twice', () => {
  const { game } = runtime();
  const scene = game.scenes['0-2'];
  game.cursor('0-2');
  game.choose(scene, scene.options[0]);
  game.choose(scene, scene.options[0]);
  assert.equal(game.state().IND, 135);
  game.cursor('5-1');
  const before = game.state().IND;
  game.choose(game.scenes['5-1'], game.scenes['5-1'].options.find(o => o.k === 'C'));
  assert.equal(game.state().IND, before);
});

test('letter and number shortcuts preserve locked positions and support F/G', () => {
  const { document, listeners } = runtime();
  let chosen;
  document.options = [...'ABCDEFG'].map(key => ({
    disabled: key === 'B',
    querySelector: () => ({ textContent: key }),
    click: () => { chosen = key; },
  }));
  const press = key => {
    chosen = undefined;
    listeners.get('keydown')({ key, preventDefault() {}, target: {} });
    return chosen;
  };
  assert.equal(press('C'), 'C');
  assert.equal(press('3'), 'C');
  assert.equal(press('B'), undefined);
  assert.equal(press('2'), undefined);
  assert.equal(press('f'), 'F');
  assert.equal(press('G'), 'G');
  document.options = [
    { disabled: true, querySelector: () => ({ textContent: 'A' }), click: () => { chosen = 'locked'; } },
    { disabled: false, querySelector: () => ({ textContent: 'A' }), click: () => { chosen = 'available'; } },
  ];
  assert.equal(press('A'), 'available', 'conditional winter-war variants share their A shortcut');
  document.dialogOpen = true;
  assert.equal(press('A'), undefined, 'an open dialog prevents selecting the underlying option');
  let continued = false;
  document.getElementById('next').click = () => { continued = true; };
  press('Enter');
  assert.equal(continued, false, 'an open dialog prevents continuing the underlying story');
});

test('focused controls keep native activation and editable fields keep their typing keys', () => {
  const { document, listeners } = runtime();
  let activated = false;
  let prevented = false;
  document.getElementById('next').click = () => { activated = true; };
  document.options = [{ disabled: false, querySelector: () => ({ textContent: 'A' }), click: () => { activated = true; } }];
  const press = (key, target) => listeners.get('keydown')({ key, target, preventDefault() { prevented = true; } });
  for (const tagName of ['BUTTON', 'A', 'SUMMARY']) {
    press('Enter', { tagName, closest: () => ({ tagName }) });
    press(' ', { tagName, closest: () => ({ tagName }) });
  }
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { isContentEditable: true }]) press('a', target);
  assert.equal(activated, false, 'global controls do not activate story actions');
  assert.equal(prevented, false, 'native click and typing behavior is preserved');
});

for (const mode of ['first available', 'last available']) {
  test(`an entire ${mode} playthrough reaches a recorded ending`, () => {
    const { game, storage } = runtime();
    let steps = 0;
    while (!game.ended() && steps++ < 100) {
      game.advance();
      if (game.ended()) break;
      const scene = game.scenes[game.state().curId];
      assert.ok(scene, 'every flow node has scene data');
      if (scene.options?.length) {
        const available = scene.options.filter(o => !o.when || o.when(game.state()));
        assert.ok(available.length, `${game.state().curId} has an available option`);
        game.choose(scene, mode === 'first available' ? available[0] : available.at(-1));
      }
      for (const key of ['PP', 'PAR', 'IND', 'ARMY', 'MOR', 'COM', 'STAL', 'LEFT', 'RIGHT']) {
        assert.ok(Number.isFinite(game.state()[key]), `${key} stays numeric`);
      }
    }
    assert.equal(game.ended(), true);
    assert.ok(steps < 100, 'the flow terminates');
    assert.equal(storage.has(game.saveKey), false);
    assert.equal(JSON.parse(storage.get(game.galleryKey)).length, 1);
  });
}
