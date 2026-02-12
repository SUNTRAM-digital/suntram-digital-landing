/* SUNTRAM Digital landing — vanilla JS
   - Mobile nav
   - Scroll reveal
   - Animated counters
   - Contact form -> mailto
   - Service drawer modal
*/

(function () {
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Mobile nav
  const btn = document.querySelector('[data-nav-toggle]');
  const links = document.querySelector('[data-nav-links]');

  function closeNav() {
    if (!btn || !links) return;
    links.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  if (btn && links) {
    btn.addEventListener('click', () => {
      const isOpen = links.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });

    links.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', closeNav));

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t) return;
      const inside = links.contains(t) || btn.contains(t);
      if (!inside) closeNav();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNav();
    });
  }

  // Scroll reveal
  const revealEls = Array.from(document.querySelectorAll('[data-reveal]'));
  revealEls.forEach(el => el.classList.add('reveal'));

  const ioReveal = new IntersectionObserver((entries) => {
    for (const ent of entries) {
      if (ent.isIntersecting) {
        ent.target.classList.add('reveal--in');
        ioReveal.unobserve(ent.target);
      }
    }
  }, { threshold: 0.12 });

  revealEls.forEach(el => ioReveal.observe(el));

  // Counters
  const counterEls = Array.from(document.querySelectorAll('[data-count-to]'));

  function animateCount(el) {
    const to = Number(el.getAttribute('data-count-to') || '0');
    const from = 0;
    const dur = 900 + Math.min(1400, to * 6);
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const val = Math.round(from + (to - from) * eased);
      el.textContent = String(val);
      if (t < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const ioCount = new IntersectionObserver((entries) => {
    for (const ent of entries) {
      if (ent.isIntersecting) {
        animateCount(ent.target);
        ioCount.unobserve(ent.target);
      }
    }
  }, { threshold: 0.35 });

  counterEls.forEach(el => ioCount.observe(el));

  // Contact form -> mailto
  const form = document.querySelector('[data-contact-form]');
  const status = document.querySelector('[data-form-status]');

  function setStatus(msg, isError) {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle('form__status--error', Boolean(isError));
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const company = String(data.get('company') || '').trim();
      const email = String(data.get('email') || '').trim();
      const phone = String(data.get('phone') || '').trim();
      const need = String(data.get('need') || '').trim();
      const message = String(data.get('message') || '').trim();

      if (!name || !email || !message) {
        setStatus('Faltan campos requeridos (nombre, email, mensaje).', true);
        return;
      }

      const subject = encodeURIComponent(`[SUNTRAM Digital] Solicitud — ${need}`);
      const lines = [
        `Nombre: ${name}`,
        `Empresa: ${company || '-'}`,
        `Email: ${email}`,
        `Tel/WhatsApp: ${phone || '-'}`,
        `Necesidad: ${need}`,
        '',
        message,
      ];

      const to = 'contacto@suntram.digital';
      const body = encodeURIComponent(lines.join('\n'));

      setStatus('Abriendo tu cliente de correo…');
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }

  // Service drawer modal
  const modal = document.querySelector('[data-modal]');
  const modalTitle = document.querySelector('[data-modal-title]');
  const modalKicker = document.querySelector('[data-modal-kicker]');
  const modalBody = document.querySelector('[data-modal-body]');

  let lastFocus = null;

  const serviceTitles = {
    web: 'Web & Landing Pages',
    apps: 'Apps móviles',
    systems: 'Sistemas empresariales',
    design: 'Diseño & Branding',
    print: 'Impresión, eventos y stands',
    mkt: 'Marketing digital',
  };

  function openModal(serviceKey) {
    if (!modal || !modalBody || !modalTitle) return;
    const src = document.querySelector(`[data-service-detail="${serviceKey}"]`);
    if (!src) return;

    lastFocus = document.activeElement;

    modalKicker.textContent = 'Servicio';
    modalTitle.textContent = serviceTitles[serviceKey] || 'Detalle';
    modalBody.innerHTML = '';
    modalBody.appendChild(src.cloneNode(true));

    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';

    const closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  document.querySelectorAll('[data-open-service]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.getAttribute('data-open-service');
      if (key) openModal(key);
    });
  });

  document.querySelectorAll('[data-modal-close]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });
})();
