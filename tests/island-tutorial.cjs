const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/runtime.cjs');
const { rng, replay } = require('./helpers/routes.cjs');
const fixture = require('./fixtures/island-tutorial.json');

test('the island tutorial case is a legal complete route and its complete ledger matches the real game', () => {
  const { route, trace } = fixture;
  const result = replay(route);
  assert.equal(result.ending, 'island');
  assert.equal(result.state.collapses, 1);
  assert.equal(result.state.loses, 2);
  assert.equal(result.state.warOutcome, 'defeat');
  const { game, math } = runtime({ fast: true });
  math.random = rng(route.eventSeed);
  game.advance();
  const keys = ['PP', 'PAR', 'IND', 'ARMY', 'MOR', 'COM', 'STAL', 'LEFT', 'RIGHT', 'purgeCount', 'fort', 'warning', 'enemyMod', 'nationalQ', 'collapses', 'loses', 'holds'];
  const snapshot = () => Object.fromEntries(keys.map(k => [k, game.state()[k]]));
  const actual = [];
  for (const [id, action] of route.steps) {
    const s = game.state(), scene = game.scenes[id], before = snapshot();
    assert.equal(s.curId, id);
    if (Array.isArray(action)) {
      for (const decisionId of action) {
        const d = game.decisions.find(item => item.id === decisionId);
        const start = snapshot(), deltas = game.executeDecision(d);
        actual.push({ id, year: s.year, decision: decisionId, name: d.name, before: start, deltas, after: snapshot() });
      }
    } else if (typeof action === 'number') {
      const option = scene.options[action];
      game.choose(scene, option);
      const pending = game.state()._pendingResult;
      actual.push({ id, year: s.year, title: scene.title, option: option.label, before,
        deltas: pending.deltas, battles: pending.battles, after: snapshot() });
    } else {
      actual.push({ id, year: s.year, title: scene.title, before });
    }
    game.advance();
  }
  actual.push({ ending: game.decideEnding().heads[0].id, final: snapshot() });
  // The fixture is JSON: normalize vm objects and omit undefined fields exactly as JSON does.
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), trace);
});
