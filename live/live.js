/* loop-autopsy demo page: motion with GSAP 3 + ScrollTrigger and Lenis.
   Purpose: show the tool working (loops run, get stopped, get explained) and give a one-minute demo some life.
   Everything starts from its finished state in the HTML; this script only animates towards it, so the page
   reads whole without JavaScript and under prefers-reduced-motion. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!gsap || reduce) return;
  gsap.registerPlugin(ScrollTrigger);
  const EASE = 'expo.out';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- smooth scroll (Lenis) driven by GSAP's ticker ---------- */
  let lenis = null;
  if (Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.2, easing: (x) => 1 - Math.pow(1 - x, 4) });
    });
  }

  /* ---------- hero entrance ---------- */
  const h1 = $('#hero-h');
  if (h1) {
    h1.innerHTML = h1.textContent.trim().split(/\s+/).map((w) => `<span class="lv-w"><span>${w}</span></span>`).join(' ');
    const words = $$('.lv-w > span', h1);
    const intro = gsap.timeline({ defaults: { ease: EASE } });
    intro.from(words, { yPercent: 110, duration: 1.1, stagger: 0.06 })
      .from(['.hero__lead', '.hero__text .btn-row', '.hero__proof'], { y: 16, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.35)
      .from('.hero__art', { y: 28, opacity: 0, scale: 0.985, duration: 1.2 }, 0.2);
  }

  /* ---------- hero notebook: each cell runs, then is stopped or finishes ---------- */
  const rows = $$('.hero__art .d-row');
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const finals = rows.map((r) => {
    const chip = $('.d-chip', r), num = $('.num', r);
    return { r, chip, num, text: chip.textContent, cls: chip.className, value: parseInt(num.textContent.replace(/,/g, ''), 10) || 0, raw: num.textContent };
  });
  let run = null;
  const playNotebook = () => {
    if (run) run.kill();
    finals.forEach((f) => { f.chip.className = 'd-chip lv-run'; f.chip.textContent = 'Running'; f.num.textContent = '0'; f.r.classList.remove('lv-hot'); });
    run = gsap.timeline({ delay: 0.15 });
    finals.forEach((f, i) => {
      const at = 0.9 + i * 0.55;
      const c = { v: 0 };
      run.to(c, { v: f.value, duration: 0.5, ease: 'power1.out', onUpdate: () => { f.num.textContent = fmt(c.v); } }, at)
        .add(() => {
          f.num.textContent = f.raw;
          f.chip.className = f.cls; f.chip.textContent = f.text;
          if (f.cls.includes('out')) f.r.classList.add('lv-hot');
        }, at + 0.5)
        .fromTo(f.chip, { scale: 0.9 }, { scale: 1, duration: 0.35, ease: EASE }, at + 0.5)
        .add(() => f.r.classList.remove('lv-hot'), at + 1.6);
    });
  };
  if (rows.length) {
    playNotebook();
    const art = $('.hero__art');
    art.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && run && !run.isActive()) playNotebook(); });
  }

  /* ---------- report: the list slides in, the report types out ---------- */
  const app = $('#report .app');
  if (app) {
    const box = $('.rep__box', app);
    const tl = gsap.timeline({ scrollTrigger: { trigger: app, start: 'top 75%', once: true } });
    tl.from($$('.ui-win__row', app), { x: -16, opacity: 0, duration: 0.6, stagger: 0.05, ease: EASE })
      .from($$('.rep__in, .rep__out', app).slice(0, 2), { opacity: 0, y: 8, duration: 0.4, stagger: 0.1, ease: EASE }, 0.1);
    if (box) {
      const lines = Math.max(8, Math.round(box.offsetHeight / 20));
      tl.add(() => box.classList.add('lv-typing'), 0.4)
        .fromTo(box, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.8, ease: `steps(${lines})` }, 0.4)
        .add(() => box.classList.remove('lv-typing'))
        .from('.rep__chip', { scale: 0.85, opacity: 0, duration: 0.4, ease: EASE }, 0.3);
    }
  }

  /* ---------- the band: drifts on its own and leans into the scroll speed ---------- */
  const track = $('.lv-band__track');
  if (track) {
    const set = $('.lv-band__set', track);
    let x = 0, dir = -1, boost = 0;
    gsap.ticker.add((t, dt) => {
      const w = set.offsetWidth;
      x += dir * (0.06 + boost) * dt;
      if (x <= -w) x += w; if (x > 0) x -= w;
      gsap.set(track, { x });
      boost *= 0.92;
    });
    ScrollTrigger.create({ trigger: '.lv-band', start: 'top bottom', end: 'bottom top', onUpdate: (s) => {
      const v = s.getVelocity();
      dir = v < 0 ? 1 : -1;
      boost = Math.min(1.4, Math.abs(v) / 1500);
    } });
  }

  /* ---------- checks: cards rise once, a light follows the pointer ---------- */
  ScrollTrigger.batch('#checks .card', { start: 'top 85%', once: true,
    onEnter: (els) => gsap.from(els, { y: 32, opacity: 0, duration: 0.9, stagger: 0.08, ease: EASE }) });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('#checks .card').forEach((c) => c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));
  }

  /* ---------- install: the test count counts up ---------- */
  $$('#install .rows__value').forEach((el) => {
    const m = el.textContent.match(/^(\d+)(.*)$/);
    if (!m) return;
    const c = { v: 0 }, end = +m[1], rest = m[2];
    gsap.to(c, { v: end, duration: 1.4, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => { el.textContent = Math.round(c.v) + rest; } });
  });
  gsap.from('#install .frame--split', { y: 40, opacity: 0, duration: 1, ease: EASE, scrollTrigger: { trigger: '#install', start: 'top 70%', once: true } });

  /* ---------- demo video: the frame settles in as it arrives ---------- */
  gsap.fromTo('#demo figure', { scale: 0.94, opacity: 0.4 }, { scale: 1, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: '#demo', start: 'top 90%', end: 'top 20%', scrub: 0.6 } });

  /* ---------- team: rows arrive one by one ---------- */
  gsap.from('#team .rows li', { x: -20, opacity: 0, duration: 0.7, stagger: 0.07, ease: EASE, scrollTrigger: { trigger: '#team', start: 'top 70%', once: true } });

  /* ---------- footer wordmark: letters rise with the scroll ---------- */
  const word = $('.close__word');
  if (word) {
    word.innerHTML = [...word.textContent].map((ch) => `<span class="lv-l">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    gsap.from($$('.lv-l', word), { yPercent: 105, opacity: 0, stagger: 0.04, ease: 'none',
      scrollTrigger: { trigger: word, start: 'top 98%', end: 'top 55%', scrub: 0.8 } });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
})();
