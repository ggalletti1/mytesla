/* share-image: tap or click a card, or the rings, to copy a PNG (rings include the legend, composed off-screen). */
'use strict';
(function () {
  const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="link"]';
  let toastEl, toastTimer, busy = false;

  function pageBg() {
    const c = getComputedStyle(document.body).backgroundColor;
    return c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' ? c : (document.documentElement.dataset.theme === 'light' ? '#f5f5f7' : '#050506');
  }
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'share-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }
  function remapIds(root) {
    const map = new Map();
    const setId = el => { if (!el.id) return; const n = el.id + '-c' + Math.random().toString(36).slice(2, 8); map.set(el.id, n); el.id = n; };
    setId(root);
    root.querySelectorAll('[id]').forEach(setId);
    if (!map.size) return root;
    const rewrite = s => s.replace(/url\(\s*(?:["']|&quot;)?#([^)"'\s]+)(?:["']|&quot;)?\s*\)/g,
      (m, id) => map.has(id) ? m.replace('#' + id, '#' + map.get(id)) : m);
    const walk = el => {
      if (!el.attributes) return;
      [...el.attributes].forEach(a => {
        const v = a.value; if (!v) return;
        if ((a.name === 'href' || a.name === 'xlink:href') && v.charAt(0) === '#' && map.has(v.slice(1))) {
          el.setAttribute(a.name, '#' + map.get(v.slice(1))); return;
        }
        const n = rewrite(v); if (n !== v) el.setAttribute(a.name, n);
      });
    };
    walk(root);
    root.querySelectorAll('*').forEach(walk);
    return root;
  }
  function shotOptions() {
    return {
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      backgroundColor: pageBg(),
      cacheBust: false,
      includeQueryParams: true,
      skipFonts: true,
      style: {position: 'static', left: 'auto', top: 'auto', margin: '0'}
    };
  }
  function frame() {
    const el = document.createElement('div');
    el.className = 'share-shot';
    document.body.appendChild(el);
    return el;
  }
  function cardShot(card) {
    const el = frame();
    el.classList.add('share-card');
    const clone = remapIds(card.cloneNode(true));
    const w = Math.round(card.getBoundingClientRect().width);
    clone.style.width = w + 'px';
    clone.style.maxWidth = 'none';
    clone.style.margin = '0';
    clone.style.cursor = 'default';
    el.appendChild(clone);
    return el;
  }
  function ringsShot() {
    const src = document.querySelector('.rings-wrap');
    const el = frame();
    el.classList.add('share-rings');
    el.appendChild(remapIds(src.querySelector('.rings-box').cloneNode(true)));
    el.appendChild(remapIds(src.querySelector('.legend').cloneNode(true)));
    return el;
  }
  async function shareOrSave(blob, filename) {
    if (!blob) throw new Error('empty image');
    const file = new File([blob], filename, {type: 'image/png'});
    if (navigator.canShare) {
      try {
        if (navigator.canShare({files: [file]})) {
          await navigator.share({files: [file], title: 'MyTesla'});
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Saved');
  }
  function writeImage(blobPromise, filename) {
    const fallback = () => blobPromise.then(b => shareOrSave(b, filename));
    if (navigator.clipboard && typeof ClipboardItem === 'function' && navigator.clipboard.write) {
      try {
        if (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports('image/png')) return fallback();
        // ClipboardItem must be constructed synchronously in the user gesture (iOS Safari).
        const item = new ClipboardItem({'image/png': blobPromise});
        return navigator.clipboard.write([item]).then(() => { showToast('Copied'); }).catch(() => fallback());
      } catch (e) { return fallback(); }
    }
    return fallback();
  }
  function copyFrom(makeShot, filename) {
    if (busy || typeof htmlToImage === 'undefined' || !htmlToImage.toBlob) return;
    busy = true;
    const shot = makeShot();
    const blobPromise = Promise.resolve()
      .then(() => document.fonts && document.fonts.ready)
      .then(() => htmlToImage.toBlob(shot, shotOptions()))
      .then(b => { if (!b) throw new Error('empty image'); return b; })
      .finally(() => { if (shot && shot.parentNode) shot.remove(); });
    Promise.resolve(writeImage(blobPromise, filename)).catch(() => {}).finally(() => { busy = false; });
  }
  function onCard(e) {
    if (e.target.closest(INTERACTIVE)) return;
    const card = e.currentTarget;
    copyFrom(() => cardShot(card), 'mytesla-' + (card.id || 'card') + '.png');
  }
  function onRings(e) {
    if (e.target.closest(INTERACTIVE)) return;
    copyFrom(ringsShot, 'mytesla-rings.png');
  }
  document.querySelectorAll('.card').forEach(card => {
    card.title = 'Copy as image';
    card.addEventListener('click', onCard);
  });
  const rings = document.querySelector('.rings-wrap');
  if (rings) {
    rings.title = 'Copy as image';
    rings.addEventListener('click', onRings);
  }
})();
