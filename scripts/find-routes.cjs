// Search only through legal UI actions. Never assigns player resources or route flags.
const fs = require("node:fs"),
  path = require("node:path");
const { runtime } = require("../tests/helpers/runtime.cjs");
const {
  rng,
  availableDecisions,
  catalog,
  visit,
  choose,
  decide,
} = require("../tests/helpers/routes.cjs");
const { game, math } = runtime({ fast: true });
const required = new Set(catalog(game)),
  found = new Set(),
  witnesses = new Map(),
  candidates = [];
const runs = Number(process.argv[2] || 40000),
  began = Date.now();
let simulations = 0;
const weights = {
  1: {
    "fort-stalin": 10,
    "fort-molotov": 10,
    tanks: 8,
    partisan: 8,
    religion: 2,
    rebuild: 5,
    consumer: 4,
  },
  2: {
    "party-debate": 10,
    "nkvd-delegate": 6,
    atheist: 4,
    rebuild: 6,
    consumer: 6,
    amnesty: 3,
  },
  3: { "party-debate": 10, "fort-stalin": 6, tanks: 6, partisan: 6 },
  4: { "nkvd-delegate": 20, "fort-stalin": 5, partisan: 5, religion: 2 },
  5: { "purge-army": 10, "purge-party": 10, religion: 5 },
};
function pick(list, random, weight) {
  const total = list.reduce((n, x) => n + (weight(x) || 1), 0);
  let t = random() * total;
  return list.find((x) => (t -= weight(x) || 1) < 0) || list.at(-1);
}
for (let seed = 1; seed <= runs; seed++) {
  simulations++;
  const policy = rng(seed),
    eventSeed = (seed ^ 0x9e3779b9) >>> 0;
  math.random = rng(eventSeed);
  game.fresh();
  game.advance();
  const covered = new Set(),
    steps = [],
    mode = seed % 8;
  while (!game.ended()) {
    visit(game, covered);
    const s = game.state(),
      id = s.curId,
      scene = game.scenes[id];
    if (scene.decisions) {
      const actions = [];
      const n = mode === 6 ? 0 : Math.floor(policy() * 7);
      for (let j = 0; j < n; j++) {
        const ds = availableDecisions(game);
        if (!ds.length) break;
        const d = pick(ds, policy, (d) => weights[mode]?.[d.id] || 1);
        decide(game, d.id, covered);
        actions.push(d.id);
      }
      steps.push([id, actions]);
    } else if (scene.options?.length) {
      const opts = scene.options
        .map((o, index) => ({ o, index }))
        .filter(({ o }) => !o.when || o.when(s));
      const preferred =
        mode === 3
          ? {
              "0-1": "B",
              "0-3": "B",
              "1-1": "B",
              "1-2": "C",
              "1-3": "A",
              "2-4": "A",
              "3-3a": "B",
              "3-5": "A",
              "x-left": "B",
              "x-napoleon": "B",
              "4-1": "D",
              "4-6": "B",
              "5-1": "F",
              "5-2": "C",
            }
          : mode === 4
            ? { "1-3": "B", "4-6": "C", "5-1": "C" }
            : mode === 5
              ? {
                  "0-1": "A",
                  "0-3": "B",
                  "1-1": "B",
                  "1-2": "C",
                  "1-3": "A",
                  "1-5": "B",
                  "2-2": "A",
                  "2-4": "A",
                  "3-3a": "B",
                  "x-napoleon": "B",
                  "4-6": "B",
                  "5-1": "B",
                  "5-2": "C",
                }
              : {};
      const chosen =
        (policy() < 0.8 ? opts.find(({ o }) => o.k === preferred[id]) : null) ||
        opts[Math.floor(policy() * opts.length)];
      if (!chosen) throw Error("No available option at " + id);
      choose(game, chosen.index, covered);
      steps.push([id, chosen.index]);
    } else steps.push([id]);
    game.advance();
  }
  const ending = game.decideEnding().heads[0].id;
  covered.add("ending:" + ending);
  const novel = [...covered].some((t) => !found.has(t));
  const route = {
    id: "route-" + seed,
    seed,
    eventSeed,
    ending,
    steps,
    covered: [...covered],
  };
  if (!witnesses.has(ending)) {
    witnesses.set(ending, route);
    console.log("ENDING", ending, "seed", seed);
  }
  if (novel) {
    candidates.push(route);
    for (const t of covered) found.add(t);
  }
  if (seed % 10000 === 0)
    console.log(
      "SEARCH",
      seed,
      "covered",
      found.size,
      "missing",
      [...required].filter((t) => !found.has(t)),
    );
  if ([...required].every((t) => found.has(t))) break;
}
const selected = [...witnesses.values()],
  covered = new Set(selected.flatMap((r) => r.covered));
while ([...required].some((t) => !covered.has(t))) {
  let best,
    score = 0;
  for (const r of candidates) {
    const n = r.covered.filter(
      (t) => required.has(t) && !covered.has(t),
    ).length;
    if (n > score) {
      score = n;
      best = r;
    }
  }
  if (!best) break;
  selected.push(best);
  best.covered.forEach((t) => covered.add(t));
}
const missing = [...required].filter((t) => !covered.has(t));
const fixtures = { version: 2, routes: selected.map(({ covered, ...r }) => r) };
fs.writeFileSync(
  path.resolve(__dirname, "../tests/fixtures/routes.json"),
  JSON.stringify(fixtures, null, 2) + "\n",
);
fs.writeFileSync(
  "/tmp/road56-route-search.json",
  JSON.stringify(
    {
      simulations,
      seconds: (Date.now() - began) / 1000,
      found: [...found],
      missing,
      required: required.size,
      routes: selected.length,
    },
    null,
    2,
  ),
);
console.log(
  "RESULT",
  JSON.stringify({
    seconds: (Date.now() - began) / 1000,
    required: required.size,
    covered: covered.size,
    routes: selected.length,
    missing,
  }),
);
if (missing.length) process.exitCode = 1;
