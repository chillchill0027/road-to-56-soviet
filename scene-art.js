/* A scene keeps its own photograph across play, reload and archive views. */
const SceneArt = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function entry(key) {
    const manifest = typeof SCENE_ART_MANIFEST === 'undefined' ? null : SCENE_ART_MANIFEST;
    return manifest && Object.hasOwn(manifest, key) ? manifest[key] : null;
  }
  function html(key, year, options = {}) {
    const image = entry(key);
    if (!image || typeof image.file !== 'string' || !/^assets\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.webp$/.test(image.file)) return '';
    const cols = Number.isInteger(image.cols) && image.cols > 0 ? image.cols : 2;
    const rows = Number.isInteger(image.rows) && image.rows > 0 ? image.rows : 2;
    const cell = Number.isInteger(image.cell) ? image.cell : 0;
    if (cell < 0 || cell >= cols * rows) return '';
    const caption = image.caption || key;
    const stamp = year ?? image.year ?? '';
    return `<figure class="scene-art dedicated-scene-art art-mid" data-art="${escape(options.artKey || key)}" data-scene-key="${escape(key)}" style="--scene-cols:${cols};--scene-rows:${rows}"><div class="art-window"><div class="art-cell"><img src="${escape(image.file)}" alt="${escape(caption)} · AI 生成的历史场景演绎" decoding="async"${options.lazy ? ' loading="lazy"' : ''} style="left:-${cell % cols * 100}%;top:-${Math.floor(cell / cols) * 100}%"></div></div><figcaption${options.captionClass ? ` class="${escape(options.captionClass)}"` : ''}><span>${escape(caption)} <span class="art-fiction">/ 历史场景演绎</span></span><span>${escape(stamp)}</span></figcaption></figure>`;
  }
  return { entry, html };
})();
