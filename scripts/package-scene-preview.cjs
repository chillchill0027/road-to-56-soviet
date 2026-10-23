/* A clearly labelled artwork preview; it never bypasses the full-release gate. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs/qa/scene-art/assets.json'), 'utf8'));
if (audit.errors.length) throw Error('Fix structural asset errors before creating a preview');
const pending = JSON.parse(fs.readFileSync(path.join(root, 'docs/scene-art/pending.json'), 'utf8'));
const catalog = fs.readFileSync(path.join(root, 'docs/scene-art/catalog.html'), 'utf8');
if (!catalog.includes('data-status=')) throw Error('Rebuild the catalog with explicit completion states first');
const out = path.resolve(process.argv[2] || path.join(root, '..', 'artifacts', 'road-to-56-soviet-v1.11.0-art-preview'));
if (out === root || root.startsWith(out + path.sep) || out.startsWith(root + path.sep)) throw Error('Use a separate artifact directory');
fs.mkdirSync(out, {recursive:true});
for (const asset of audit.assets) {
  const target = path.join(out, asset.file);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.copyFileSync(path.join(root, asset.file), target);
}
fs.copyFileSync(path.join(root, 'assets/images/cast-sheet.webp'), path.join(out, 'assets/images/cast-sheet.webp'));
fs.cpSync(path.join(root, 'docs/scene-art'), path.join(out, 'docs/scene-art'), {recursive:true});
fs.cpSync(path.join(root, 'docs/qa/scene-art'), path.join(out, 'docs/qa/scene-art'), {recursive:true});
fs.copyFileSync(path.join(root, 'docs/dedicated-scene-art.md'), path.join(out, 'docs/dedicated-scene-art.md'));
const generated = audit.ready - 15;
const remaining = audit.newScenePhotographs - generated;
const note = `56之路：苏维埃 v1.11 · 配图制作预览\n\n打开 index.html，然后进入图片目录。无需安装依赖或联网。\n\n本包仅供查看配图，不是完整游戏或最终发行包。\n已生成${generated}幅新场景图，其中${audit.reviewIssues.length}幅待修正；另${remaining}幅待生成。目录区分已完成、待生成和待修正，不会请求不存在的图片。\n\n图像服务触及HTTP429账户额度，返回的重置时间为2026-10-23 11:45:04 UTC（北京时间19:45:04）。\n194项逻辑检查通过；现有94个图片文件与12组响应式布局已做初步浏览器核对，全量素材和最终浏览器验收尚未完成。\nGitHub推送授权尚未恢复；完整游戏仍为v1.10。独立配图预览已发布：https://road-to-56-soviet.chillchill0027.chatgpt.site/art-preview/\n\n待补场景与提示：docs/scene-art/pending.json。\n素材检查：docs/qa/scene-art/assets.json。\n逻辑检查：docs/qa/scene-art/unit.json。\n`;
fs.writeFileSync(path.join(out, '请先阅读.txt'), note);
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>56之路 · 配图制作预览</title><style>body{margin:0;background:#f1ede5;color:#272523;font:17px/1.9 system-ui,sans-serif}main{max-width:700px;margin:8vh auto;padding:28px}small{color:#a12935}h1{font-size:clamp(30px,5vw,48px);line-height:1.4}p{color:#61594f}a{display:inline-block;background:#a12935;color:#fffdf8;text-decoration:none;padding:14px 24px;border-radius:12px}a:focus-visible{outline:3px solid #272523;outline-offset:4px}</style><main><small>56之路：苏维埃 · v1.11 制作中</small><h1>让每一段历史，<br>拥有自己的画面。</h1><p>已生成${generated}幅专属场景照片，其中${audit.reviewIssues.length}幅待修正，另${remaining}幅待生成。你可以按剧情、地点和人物查看，并对照场景文字。</p><p>这是配图预览包。完整游戏尚未完成配图和浏览器验收，线上仍为v1.10。</p><a href="docs/scene-art/catalog.html">打开场景图目录 →</a></main></html>`);
console.log(JSON.stringify({output:out,generated,remaining,reviewPending:audit.reviewIssues.length,approvedScenes:audit.approvedScenes,pendingBatches:(pending.batches || pending.pending || []).length}));
