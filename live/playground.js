/* "Try it": runs the real loop-autopsy 0.4.0 (from PyPI) in the browser with Pyodide, in a Web Worker.
   Python starts when the section comes near the screen, or on the first Run. */
(() => {
  const root = document.getElementById('try');
  if (!root) return;
  const code = document.getElementById('pg-code');
  const run = document.getElementById('pg-run');
  const out = document.getElementById('pg-out');
  const status = document.getElementById('pg-status');
  const EXAMPLES = {
    stuck: 'count = 1\nwhile count <= 5:\n    print(count)',
    jump: 'x = 0\nwhile x != 10:\n    x += 3',
    grow: 'nums = [1, 2]\nfor n in nums:\n    nums.append(n)',
    wrong: 'i = 10\nwhile i > 0:\n    i += 1',
    recursion: 'def f(n):\n    return f(n)\n\nf(3)',
    correct: 'total = 0\nfor i in range(1_000_000):\n    total += i\nprint("done", total)',
  };
  const LIMIT = 10000;
  let worker = null, ready = false, busy = false, timer = null, pending = null, n = 0;

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const say = (t) => { status.textContent = t; };

  function render(text, ok, ms) {
    const lines = esc(text.replace(/\s+$/, '')).split('\n');
    const at = lines.findIndex((l) => l.startsWith('Loop autopsy —'));
    let html;
    if (at >= 0) {
      const before = lines.slice(0, at).join('\n');
      const rep = lines.slice(at).map((l, i) => i === 0 ? `<span class="t">${l}</span>` : l.startsWith('Hint:') ? `<span class="h">${l}</span>` : l).join('\n');
      html = (before ? `<div class="pg__print">${before}</div>` : '') + `<div class="rep__box pg__rep">${rep}</div>`;
    } else {
      html = `<div class="pg__print ${ok ? '' : 'pg__err'}">${lines.join('\n') || '(no output)'}</div>`;
    }
    out.innerHTML = html;
    out.dataset.state = at >= 0 ? 'stopped' : ok ? 'ok' : 'error';
    if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const box = out.querySelector('.pg__rep');
      if (box) gsap.fromTo(box, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: `steps(${Math.max(8, lines.length)})` });
      else gsap.from(out.firstElementChild, { opacity: 0, y: 6, duration: 0.3 });
    }
    say(at >= 0 ? `Stopped by loop-autopsy in ${ms} ms` : ok ? `Finished in ${ms} ms` : 'The cell raised an error');
  }

  function start() {
    if (worker) return;
    ready = false;
    say('Starting Python in your browser (about 15 MB the first time)…');
    run.disabled = true;
    worker = new Worker('live/py-worker.js');
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'status') say(m.text);
      else if (m.type === 'ready') {
        ready = true; run.disabled = false; say('Ready. loop-autopsy 0.4.0 is watching your loops.');
        if (pending) { const c = pending; pending = null; send(c); }
      } else if (m.type === 'result') {
        clearTimeout(timer); busy = false; run.disabled = false; run.textContent = 'Run cell';
        render(m.text, m.ok, m.ms);
      } else if (m.type === 'error') {
        say('Python could not start here. Check the internet connection and reload.'); run.disabled = false;
      }
    };
  }

  function send(c) {
    busy = true; run.disabled = true; run.textContent = 'Running…';
    out.dataset.state = 'running';
    out.innerHTML = '<div class="pg__print pg__wait">Running…</div>';
    say('Running…');
    worker.postMessage({ id: ++n, code: c });
    timer = setTimeout(() => {               // nothing in the browser can interrupt Python, so the page ends it
      worker.terminate(); worker = null; busy = false; run.textContent = 'Run cell';
      out.dataset.state = 'error';
      out.innerHTML = `<div class="pg__print pg__err">Stopped by this page after ${LIMIT / 1000} s. loop-autopsy found no proof that this loop is endless, so in a real notebook its time limit would stop it (60 s by default).</div>`;
      start();
    }, LIMIT);
  }

  run.addEventListener('click', () => {
    if (busy) return;
    const c = code.value;
    if (!worker) start();
    if (!ready) { pending = c; say('Starting Python first, then running your cell…'); return; }
    send(c);
  });
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); run.click(); }
    if (e.key === 'Tab') { e.preventDefault(); const s = code.selectionStart; code.setRangeText('    ', s, code.selectionEnd, 'end'); }
  });
  root.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-example]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    code.value = EXAMPLES[b.dataset.example];
    out.dataset.state = ''; out.innerHTML = '<div class="pg__print pg__wait">Press Run cell to run it.</div>';
  }));
  code.value = EXAMPLES.stuck;

  const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { start(); io.disconnect(); } }, { rootMargin: '100% 0px' });
  io.observe(root);
})();
