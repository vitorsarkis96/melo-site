/* Vinheta "Prancheta" · só roda se o <head> marcou html.intro-on */
(() => {
  const root = document.documentElement;
  const el = document.getElementById('meloIntro');
  if (!el) return;
  if (!root.classList.contains('intro-on')) { el.remove(); return; }

  let done = false;
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  function cleanup() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    root.classList.remove('intro-on', 'intro-wait');
    root.style.overflow = '';
    el.remove();
  }

  try {
    root.style.overflow = 'hidden';
    const WORDS = JSON.parse(el.dataset.words || '[]');
    const W = innerWidth, H = innerHeight, mobile = W < 760;
    const COLS = mobile ? 4 : 12;
    const M = mobile ? 20 : Math.round(Math.min(W * 0.08, 140));
    const CW = (W - 2 * M) / COLS;
    const d = new Date();
    const dateEl = el.querySelector('.bp-date');
    if (dateEl) dateEl.textContent = String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();

    const line = (cls, css) => { const n = document.createElement('div'); n.className = cls; Object.assign(n.style, css); el.prepend(n); };
    for (let i = 0; i <= COLS; i++) line('bp-v', { left: (M + i * CW) + 'px', transitionDelay: (i * 45) + 'ms' });
    const ROWS = 8;
    for (let j = 1; j < ROWS; j++) line('bp-h', { top: (j * H / ROWS) + 'px', transitionDelay: (200 + j * 70) + 'ms' });

    // [coluna inicial, nº de colunas, topo %, altura %]
    const layout = mobile
      ? WORDS.map((_, i) => [0, 4, 13 + i * 15.5, 10])
      : [[1, 4, 14, 16], [6, 5, 22, 24], [0, 4, 46, 20], [4, 3, 58, 13], [8, 4, 66, 17]];

    const skipBtn = el.querySelector('.bp-skip');
    const boxes = WORDS.map((word, i) => {
      const [c, span, t, h] = layout[i % layout.length];
      const left = M + c * CW, top = H * t / 100, width = span * CW, height = H * h / 100;
      const b = document.createElement('div');
      b.className = 'bp-box';
      Object.assign(b.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
      b.innerHTML = '<div class="bp-frame"></div><div class="bp-reg"></div>' +
        '<div class="bp-meta">0' + (i + 1) + ' &nbsp; X ' + Math.round(left) + ' &nbsp; Y ' + Math.round(top) + '</div>' +
        '<div class="bp-word"></div>' +
        '<div class="bp-dim"><span>' + Math.round(width) + ' PX</span></div>';
      b.querySelector('.bp-word').textContent = word;
      el.insertBefore(b, skipBtn);
      return b;
    });

    // A prancheta vira o site: cada caixa pousa num elemento real do hero
    function morph() {
      const targets = [...document.querySelectorAll('[data-blueprint]')]
        .map(n => n.getBoundingClientRect())
        .filter(r => r.width && r.height && r.bottom > 0 && r.top < H);
      if (!targets.length) return;
      const n = boxes.length;
      boxes.forEach((b, i) => {
        const r = targets[Math.min(targets.length - 1, Math.round(i * (targets.length - 1) / Math.max(1, n - 1)))];
        Object.assign(b.style, { left: (r.left - 8) + 'px', top: (r.top - 8) + 'px', width: (r.width + 16) + 'px', height: (r.height + 16) + 'px' });
      });
    }
    function reveal() {
      el.classList.add('is-out');
      root.classList.remove('intro-wait'); // hero dispara a própria entrada
      root.style.overflow = '';
      at(1400, cleanup);
    }

    at(60, () => el.classList.add('is-grid'));
    boxes.forEach((b, i) => at(1100 + i * 340, () => b.classList.add('is-on')));
    at(4000, () => el.classList.add('is-morph'));
    at(4250, morph);
    at(5350, reveal);
    at(9000, cleanup); // trava de segurança

    skipBtn.addEventListener('click', () => { timers.forEach(clearTimeout); reveal(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !done) { timers.forEach(clearTimeout); reveal(); } });
  } catch (err) {
    cleanup();
  }
})();
