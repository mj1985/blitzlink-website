(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = (n, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function tween(from, to, ms, onStep, onDone) {
    if (reduce || ms <= 0) { onStep(to); if (onDone) onDone(); return () => {}; }
    let raf = 0, t0;
    const step = now => {
      if (t0 === undefined) t0 = now;
      const p = Math.min(1, (now - t0) / ms);
      onStep(from + (to - from) * easeOut(p));
      if (p < 1) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }

  function onVisible(els, cb, opts) {
    if (!('IntersectionObserver' in window)) { els.forEach(cb); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        cb(e.target);
      });
    }, opts || { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }

  const nav = $('.bl-nav');
  if (nav) {
    const update = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    const menu = $('#nav');
    $$('.nav-link, .btn', nav).forEach(a => a.addEventListener('click', () => {
      if (menu && menu.classList.contains('show') && window.bootstrap) {
        window.bootstrap.Collapse.getOrCreateInstance(menu).hide();
      }
    }));
  }

  onVisible($$('[data-reveal]'), el => el.classList.add('is-in'), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  onVisible($$('[data-count]'), el => {
    const to = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    tween(0, to, 1700, v => { el.textContent = fmt(v, decimals); });
  });

  onVisible($$('[data-battery]'), el => {
    el.classList.add('is-charging');
    tween(0, parseFloat(el.dataset.battery), 1700, v => el.style.setProperty('--level', v.toFixed(1)));
  });

  const cats = ['Privat', 'Dienstlich', 'Arbeitsweg'];
  $$('.bl-chip').forEach(chip => chip.addEventListener('click', () => {
    const next = (parseInt(chip.dataset.cat, 10) + 1) % cats.length;
    chip.dataset.cat = String(next);
    chip.textContent = cats[next];
    chip.classList.remove('is-flip');
    void chip.offsetWidth;
    chip.classList.add('is-flip');
  }));

  const range = $('#limitRange');
  if (range) {
    const batt = $('#limitBattery');
    const pct = $('#limitPct');
    const out = $('#limitOut');
    const status = $('#limitStatus');
    const notif = $('#limitNotif');
    const notifText = $('#limitNotifText');
    const mark = $('.bl-battery-mark', batt);
    const START = 35;
    let stop = () => {};
    let timer = 0;

    const setLevel = v => {
      batt.style.setProperty('--level', v.toFixed(1));
      pct.textContent = fmt(v);
    };
    const setLimit = () => {
      const v = Number(range.value);
      batt.style.setProperty('--limit', v);
      out.textContent = v + ' %';
      mark.dataset.label = 'Limit ' + v + ' %';
    };
    const setStatus = (text, cls) => {
      status.textContent = text;
      status.className = 'bl-label ' + cls;
    };
    const run = () => {
      stop();
      const target = Number(range.value);
      notif.classList.remove('is-shown');
      setLevel(START);
      setStatus('Lädt …', 'text-primary');
      batt.classList.add('is-charging');
      stop = tween(START, target, (target - START) * 45, setLevel, () => {
        batt.classList.remove('is-charging');
        setStatus('Pausiert', 'text-success');
        notifText.textContent = 'Laden pausiert – Ladelimit ' + target + ' % erreicht';
        notif.classList.add('is-shown');
      });
    };

    setLimit();
    setLevel(START);
    range.addEventListener('input', () => {
      setLimit();
      clearTimeout(timer);
      timer = setTimeout(run, 350);
    });
    onVisible([batt], run, { threshold: 0.6 });
  }

  const car = $('#carWidget');
  if (car) {
    const feedback = $('#widgetFeedback');
    const detail = $('#wDetail');
    const mini = $('.bl-mini--bat', car);
    const state = { lock: true, climate: false, charge: true };
    const delay = reduce ? 150 : 900;

    const say = (msg, ok) => {
      feedback.textContent = msg;
      feedback.classList.toggle('is-ok', !!ok);
    };
    const updateDetail = () => {
      const parts = [state.charge ? 'Lädt · fertig 06:40' : 'Ladepause'];
      if (state.climate) parts.push('Klima an');
      if (!state.lock) parts.push('offen');
      detail.textContent = parts.join(' · ');
    };
    const texts = {
      lock: on => on ? ['Verriegeln', 'verriegelt'] : ['Entriegeln', 'entriegelt'],
      climate: on => on ? ['Vorklimatisierung starten', 'Klimatisierung läuft'] : ['Vorklimatisierung stoppen', 'Klimatisierung aus'],
      charge: on => on ? ['Laden starten', 'lädt'] : ['Laden pausieren', 'Laden pausiert'],
    };

    $$('.bl-w-bar button', car).forEach(btn => btn.addEventListener('click', () => {
      if (btn.classList.contains('is-busy')) return;
      const act = btn.dataset.act;
      btn.classList.add('is-busy');

      if (act === 'light') {
        say('Lichtsignal gesendet …');
        setTimeout(() => {
          btn.classList.remove('is-busy');
          car.classList.remove('is-flashing');
          void car.offsetWidth;
          car.classList.add('is-flashing');
          say('✓ Auto meldet: Lichtsignal ausgeführt', true);
        }, delay);
        return;
      }

      const next = !state[act];
      const [command, result] = texts[act](next);
      say(command + ' gesendet …');
      setTimeout(() => {
        state[act] = next;
        btn.classList.remove('is-busy');
        btn.setAttribute('aria-pressed', String(next));
        if (act === 'lock') {
          btn.classList.toggle('is-warn', !next);
          $('use', btn).setAttribute('href', next ? '#i-lock' : '#i-lock-open');
        } else {
          btn.classList.toggle('is-active', next);
        }
        if (act === 'charge') mini.classList.toggle('is-charging', next);
        updateDetail();
        say('✓ Auto meldet: ' + result, true);
      }, delay);
    }));
  }

  const scroller = $('#shotScroller');
  $$('[data-scroll]').forEach(btn => btn.addEventListener('click', () => {
    if (!scroller) return;
    const card = $('.bl-shot', scroller);
    const step = card ? card.getBoundingClientRect().width + 24 : 280;
    scroller.scrollBy({ left: step * Number(btn.dataset.scroll), behavior: reduce ? 'auto' : 'smooth' });
  }));

  if (scroller) {
    let drag = null;
    let moved = false;
    let settleTimer = 0;

    const settle = () => {
      clearTimeout(settleTimer);
      const done = () => {
        scroller.removeEventListener('scrollend', done);
        clearTimeout(settleTimer);
        scroller.classList.remove('is-dragging');
      };
      scroller.addEventListener('scrollend', done);
      settleTimer = setTimeout(done, 700);
    };

    const snapTarget = velocity => {
      const cards = $$('.bl-shot', scroller);
      if (!cards.length) return scroller.scrollLeft;
      const base = scroller.getBoundingClientRect().left + parseFloat(getComputedStyle(scroller).paddingLeft);
      const offsets = cards.map(c => c.getBoundingClientRect().left - base + scroller.scrollLeft);
      const projected = scroller.scrollLeft - velocity * 180;
      let best = 0;
      offsets.forEach((o, i) => { if (Math.abs(o - projected) < Math.abs(offsets[best] - projected)) best = i; });
      return Math.max(0, Math.min(offsets[best], scroller.scrollWidth - scroller.clientWidth));
    };

    scroller.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      clearTimeout(settleTimer);
      drag = { id: e.pointerId, x: e.clientX, left: scroller.scrollLeft, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
      moved = false;
    });

    scroller.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) {
        moved = true;
        scroller.setPointerCapture(e.pointerId);
        scroller.classList.add('is-dragging');
      }
      const dt = e.timeStamp - drag.lastT;
      if (dt > 0) drag.v = 0.8 * ((e.clientX - drag.lastX) / dt) + 0.2 * drag.v;
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
      scroller.scrollLeft = drag.left - dx;
    });

    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const v = e.timeStamp - drag.lastT > 100 ? 0 : drag.v;
      drag = null;
      if (!moved) return;
      scroller.scrollTo({ left: snapTarget(v), behavior: reduce ? 'auto' : 'smooth' });
      settle();
    };
    scroller.addEventListener('pointerup', end);
    scroller.addEventListener('pointercancel', end);

    scroller.addEventListener('click', e => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }, true);
    scroller.addEventListener('dragstart', e => e.preventDefault());
  }

  const modalEl = $('#shotModal');
  if (modalEl && window.bootstrap) {
    const modal = new window.bootstrap.Modal(modalEl);
    const big = $('img', modalEl);
    const cap = $('.bl-modal-cap', modalEl);
    document.addEventListener('click', e => {
      const screen = e.target.closest('.bl-phone-screen.is-loaded');
      if (!screen) return;
      const img = $('img', screen);
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      cap.textContent = img.alt;
      modal.show();
    });
  }

  $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const input = $(btn.dataset.copy);
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (err) {
      input.select();
      document.execCommand('copy');
    }
    const label = btn.textContent;
    btn.textContent = 'Kopiert ✓';
    btn.classList.add('is-done');
    setTimeout(() => {
      btn.textContent = label;
      btn.classList.remove('is-done');
    }, 1600);
  }));
})();
