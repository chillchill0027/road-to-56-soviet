const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function runtime(options = {}) {
  const listeners = new Map();
  const storage = new Map();
  const nodes = new Map();
  const node = () => ({
    innerHTML: "",
    children: [],
    textContent: "",
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    setAttribute() {},
    appendChild() {},
  });
  const document = {
    options: [],
    body: node(),
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, node());
      return nodes.get(id);
    },
    querySelector(selector) {
      return selector === "dialog[open]"
        ? document.dialogOpen
          ? node()
          : null
        : node();
    },
    querySelectorAll(selector) {
      return selector === ".opt" ? document.options : [];
    },
    createElement: node,
  };
  const math = Object.assign(Object.create(Math), { random: () => 0 });
  const context = vm.createContext({
    document,
    window: { scrollTo() {} },
    Math: math,
    console,
    requestNewGame() {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setTimeout() {},
    clearTimeout() {},
  });
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "script.js"),
    "utf8",
  );
  vm.runInContext(
    source +
      `
    const renderRealResult = renderResult;
    renderHUD = () => {};
    showDeltas = () => {};
    globalThis.resultCalls = [];
    renderResult = (...args) => globalThis.resultCalls.push(args);
    globalThis.game = {
      fresh, advance, choose, renderScene, renderDecisions, renderTitle, resume,
      saveGame, loadGame, hasSave, addRaw, battle, battleHTML, apply, executeDecision,
      decideEnding, decisionCost, effectTone, effectSnapshot, effectChanges, previewEffects, renderRealResult,
      optionHTML, effectsHTML, enterScene, enterDecisionPhase,
      meta:META, names:EFFECT_NAMES, limits:RAW_LIMITS, endings:ENDINGS, purgeTargets:PURGE_TARGETS, legacyFlow:FLOW_V1,
      scenes: SCENES, get flow(){ return FLOW; }, decisions: DECISIONS,
      saveKey: SAVE_KEY, galleryKey: GALLERY_KEY,
      state: () => S, ended: () => ENDED, index: () => i,
      results: () => globalThis.resultCalls,
      cursor(id) { i = FLOW.indexOf(id); S.curId = id; },
    };
  `,
    context,
  );
  if (options.fast)
    vm.runInContext(
      `
    renderScene = sc => enterScene(sc);
    renderDecisions = sc => enterDecisionPhase(sc);
    renderResult = () => {};
    saveGame = () => {};
    renderEnding = () => { ENDED=true; unlockEnding(decideEnding().heads[0].id); clearSave(); };
  `,
      context,
    );
  const game = context.game;
  game.fresh();
  return { game, document, storage, listeners, nodes, math };
}

module.exports = { runtime };
