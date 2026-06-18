/* =============================================
   AJIGS CONNECT — main.js
   Public Website JavaScript
   ============================================= */

'use strict';

// ---- NAVBAR SCROLL ----
(function () {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });
})();

// ---- MOBILE MENU ----
(function () {
  const btn  = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    // Animate hamburger to X
    const spans = btn.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
    }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
    }
  });
})();

// ---- COUNTER ANIMATION ----
(function () {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const animateCount = (el) => {
    const target = parseInt(el.dataset.count, 10);
    let current  = 0;
    const step   = Math.ceil(target / 60);
    const timer  = setInterval(() => {
      current += step;
      if (current >= target) {
        el.textContent = target + '+';
        clearInterval(timer);
      } else {
        el.textContent = current;
      }
    }, 20);
  };

  // Only animate when visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
})();

// ---- CONTACT FORM ----
function submitContactForm() {
  const name     = (document.getElementById('cf-name')     || {}).value || '';
  const phone    = (document.getElementById('cf-phone')    || {}).value || '';
  const service  = (document.getElementById('cf-service')  || {}).value || '';
  const location = (document.getElementById('cf-location') || {}).value || '';

  const alertEl = document.getElementById('form-alert');
  const errorEl = document.getElementById('form-error');
  if (alertEl) alertEl.classList.add('d-none');
  if (errorEl) errorEl.classList.add('d-none');

  if (!name.trim() || !phone.trim() || !service || !location.trim()) {
    if (errorEl) errorEl.classList.remove('d-none');
    return;
  }

  // Build WhatsApp message as fallback / notification
  const msg = encodeURIComponent(
    `Hello AJIGS CONNECT,\n\nName: ${name.trim()}\nPhone: ${phone.trim()}\nService: ${service}\nLocation: ${location.trim()}\n\nPlease send me a quote.`
  );

  // Open WhatsApp with pre-filled message
  // In production: also send via EmailJS — add your EmailJS keys
  // emailjs.send('SERVICE_ID', 'TEMPLATE_ID', { name, phone, service, location, message })
  window.open(`https://wa.me/2347032053004?text=${msg}`, '_blank');

  if (alertEl) alertEl.classList.remove('d-none');

  // Clear form
  ['cf-name','cf-phone','cf-email','cf-service','cf-property','cf-location','cf-message']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// ---- SMOOTH SCROLL for anchor links ----
(function () {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
