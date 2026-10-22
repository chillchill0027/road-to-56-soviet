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
    insertAdjacentHTML() {},
    scrollIntoView() {},
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
    source + (options.war ? ['war-content.js','war.js'].map(file=>fs.readFileSync(path.join(__dirname,'../..',file),'utf8')).join('\n') : '') + (options.statistics ? fs.readFileSync(path.join(__dirname,'../../statistics.js'),'utf8') : '') + (options.novel ? ['novel-content.js','world-content.js','world.js','novel.js'].map(file=>fs.readFileSync(path.join(__dirname,'../..',file),'utf8')).join('\n') : '') +
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
      war:typeof WarReports==='undefined'?null:WarReports,
      warSectors:typeof WAR_SECTORS==='undefined'?null:WAR_SECTORS,
      warEndings:typeof WAR_ENDINGS==='undefined'?null:WAR_ENDINGS,
      warIncidents:typeof WAR_INCIDENTS==='undefined'?null:WAR_INCIDENTS,
      statistics:typeof Statistics==='undefined'?null:Statistics,
      novel:typeof Novel==='undefined'?null:Novel,
      world:typeof World==='undefined'?null:World,
      worldEvents:typeof WORLD_EVENTS==='undefined'?null:WORLD_EVENTS,
      worldIntros:typeof WORLD_INTERLUDES==='undefined'?null:WORLD_INTERLUDES,
      worldTypes:typeof WORLD_SOURCE_TYPES==='undefined'?null:WORLD_SOURCE_TYPES,
      worldAgendas:typeof WORLD_AGENDAS==='undefined'?null:WORLD_AGENDAS,
      novelEvents:typeof NOVEL_EVENTS==='undefined'?null:NOVEL_EVENTS,
      novelDecisions:typeof NOVEL_DECISIONS==='undefined'?null:NOVEL_DECISIONS,
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
  if(options.endings) vm.runInContext(fs.readFileSync(path.join(__dirname,'../../endings.js'),'utf8')+'\ngame.archive=EndingArchive; game.renderEnding=renderEnding; game.unlockEnding=unlockEnding; game.renderGallery=renderGallery;',context);
  const game = context.game;
  game.fresh();
  return { game, document, storage, listeners, nodes, math };
}

module.exports = { runtime };
