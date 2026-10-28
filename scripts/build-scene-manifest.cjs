/* Stable illustration bindings. Rebuild after changing the reviewed scene inventory. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/scene-art/inventory.json'), 'utf8'));
const compact = text => String(text || '').replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '').trim();
const manifest = {};
for (const scene of inventory.scenes) {
  if (manifest[scene.sceneKey]) throw Error('Duplicate scene key: ' + scene.sceneKey);
  manifest[scene.sceneKey] = {
    file: scene.asset, cell: scene.cell, cols: 2, rows: 2,
    caption: [...new Set([compact(scene.title),scene.place,scene.time || scene.tierName].filter(Boolean))].join(' · '),
  };
}
manifest.cover = {file:'assets/images/cover.webp',cell:0,cols:1,rows:1,caption:'莫斯科，1936年 · 卷首'};
const endings = {
  khrushchev:['leadership',0],beria:['leadership',1],military:['leadership',2],soviet:['leadership',3],
  right:['society',0],left:['society',1],comecon:['society',2],detente:['society',3],
  'stalin-quiet':['continuity',0],eternal:['continuity',1],mediocre:['continuity',2],island:['continuity',3],
  dusk:['rupture',0],rome:['rupture',1],
};
for(const scene of inventory.existing.filter(e=>e.category==='ending')){
  const [group,cell]=endings[scene.endingId];
  manifest[scene.sceneKey]={file:`assets/images/ending-${group}-sheet.webp`,cell,cols:group==='rupture'?1:2,rows:2,caption:compact(scene.title)};
}
fs.writeFileSync(path.join(root,'scene-art-manifest.js'),'/* One distinct photograph per narrative scene. Generated from docs/scene-art/inventory.json. */\nconst SCENE_ART_MANIFEST = Object.freeze('+JSON.stringify(manifest,null,2)+');\n');
console.log('Bound '+Object.keys(manifest).length+' dedicated scene illustrations.');
