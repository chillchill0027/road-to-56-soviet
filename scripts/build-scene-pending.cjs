/* Rebuild the remaining scene-art queue from approved files on disk. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const batchesFile = 'docs/scene-art/batches.json';
const outputFile = 'docs/scene-art/pending.json';
const promptFiles = ['a', 'b', 'c', 'e', 'f'].map(
  agent => `docs/scene-art/pending-prompts-${agent}.json`
);
const quota = {
  httpStatus: 429,
  type: 'usage_limit_reached',
  resetsAtUtc: '2026-10-23T11:45:04Z',
  resetsAtUnix: 1792755904,
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function readProvenance(batch) {
  const file = `docs/scene-art/batch-${String(batch.id).padStart(3, '0')}.json`;
  if (!fs.existsSync(path.join(root, file))) return { file, record: null };
  return { file, record: readJson(file) };
}

function approvedOnDisk(batch, provenance) {
  const record = provenance.record;
  return fs.existsSync(path.join(root, batch.file)) && record !== null &&
    record.approved === true && record.batch === batch.id && record.file === batch.file;
}

function sceneDetails(scene) {
  return {
    sceneKey: scene.sceneKey,
    cell: scene.cell,
    year: scene.year ?? null,
    title: scene.title,
    place: scene.place ?? null,
  };
}

function collectExactPrompts() {
  const prompts = new Map();
  for (const file of promptFiles) {
    if (!fs.existsSync(path.join(root, file))) continue;
    const visit = (value, pointer) => {
      if (value === null || typeof value !== 'object') return;
      if (Number.isInteger(value.batch) && typeof value.prompt === 'string') {
        prompts.set(value.batch, {
          prompt: value.prompt,
          promptSource: { file, pointer: `${pointer}/prompt`, kind: 'saved_exact_prompt' },
        });
      }
      for (const [key, child] of Object.entries(value)) {
        const escaped = key.replace(/~/g, '~0').replace(/\//g, '~1');
        visit(child, `${pointer}/${escaped}`);
      }
    };
    visit(readJson(file), '');
  }
  return prompts;
}

function buildPending() {
  const batches = readJson(batchesFile);
  const exactPrompts = collectExactPrompts();
  const helper = require('./scene-art-prompt.cjs');
  const pending = [];
  let approvedBatches = 0;

  for (const batch of batches) {
    const provenance = readProvenance(batch);
    if (approvedOnDisk(batch, provenance)) {
      approvedBatches++;
      continue;
    }
    const assetExists = fs.existsSync(path.join(root, batch.file));
    const savedPrompt = exactPrompts.get(batch.id);
    pending.push({
      batch: batch.id,
      file: batch.file,
      scenes: batch.scenes.map(sceneDetails),
      status: 'blocked_by_image_generation_usage_limit',
      reason: assetExists
        ? 'The atlas exists but has no matching approved provenance; review or generation is blocked by HTTP 429 usage_limit_reached.'
        : 'The dedicated atlas has not been generated; image generation is blocked by HTTP 429 usage_limit_reached.',
      assetExists,
      provenanceFile: provenance.file,
      prompt: savedPrompt ? savedPrompt.prompt : helper.prompt(batch.id),
      promptSource: savedPrompt ? savedPrompt.promptSource : {
        file: 'scripts/scene-art-prompt.cjs',
        export: 'prompt',
        argument: batch.id,
        kind: 'constructed_from_repository_helper',
      },
    });
  }

  const reviewIssues = batches.flatMap(batch => {
    const provenance = readProvenance(batch);
    return (provenance.record?.reviewIssues || []).filter(issue => issue.status === 'open').map(issue => {
      const scene = batch.scenes.find(candidate => candidate.cell === issue.cell);
      if (!scene) throw Error(`Review issue has no matching scene: batch ${batch.id}, cell ${issue.cell}`);
      return {
        batch: batch.id, file: batch.file, ...sceneDetails(scene),
        quadrant: ['top_left','top_right','bottom_left','bottom_right'][issue.cell],
        status: 'correction_blocked_by_image_generation_usage_limit', reason: issue.reason,
        assetExists: fs.existsSync(path.join(root, batch.file)),
        approvedProvenanceExists: approvedOnDisk(batch, provenance),
        originalPath: provenance.record.path, provenanceFile: provenance.file,
        countedAsMissingGeneration: false,
      };
    });
  });

  return {
    source: batchesFile,
    generationBlocker: pending.length || reviewIssues.length ? quota : null,
    summary: {
      totalBatches: batches.length,
      approvedBatches,
      pendingBatches: pending.length,
      pendingScenes: pending.reduce((sum, item) => sum + item.scenes.length, 0),
      reviewIssues: reviewIssues.length,
    },
    pending,
    reviewIssues,
  };
}

if (require.main === module) {
  const report = buildPending();
  fs.writeFileSync(path.join(root, outputFile), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ file: outputFile, ...report.summary }));
}

module.exports = { buildPending };
