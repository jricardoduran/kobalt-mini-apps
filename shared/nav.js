/* ═══════════════════════════════════════════════════════════════
   KOBALT RED · shared/nav.js v2
   Tab navigation — each app has its own identity color
   ═══════════════════════════════════════════════════════════════
   Usage: set window.KB_APP = 'marketplace' before loading this script
   ═══════════════════════════════════════════════════════════════ */
(function () {

  /* ── Tab definitions ─────────────────────────────────────────── */
  const TABS = [
    { id: 'home',        label: 'Inicio',       icon: '⬡',  href: './index.html',      color: '#4361ee' },
    { id: 'marketplace', label: 'Marketplace',  icon: '🛒', href: './marketplace.html', color: '#4361ee' },
    { id: 'negocio',     label: 'Negocio',      icon: '🏗️', href: './negocio.html',     color: '#f72585' },
    { id: 'curso',       label: 'Curso IA',     icon: '🎓', href: './curso.html',       color: '#f8b500' },
    { id: 'community',   label: 'Community',    icon: '📱', href: './community.html',   color: '#4cc9f0' },
    { id: 'open-claw',   label: 'Open-Claw',    icon: '🔍', href: './open-claw.html',   color: '#7209b7' },
    { id: 'mercado',     label: 'Mercado',      icon: '🧭', href: './mercado.html',     color: '#06d6a0' },
    { id: 'ecosistema',  label: 'Ecosistema',   icon: '🗺', href: './ecosistema.html',  color: '#f72585' },
  ];

  const active = window.KB_APP || 'home';

  /* ── Kobalt logo SVG ─────────────────────────────────────────── */
  const LOGO = `<svg width="26" height="26" viewBox="0 0 40 40" fill="none">
    <defs><linearGradient id="kgnav" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#f72585"/>
      <stop offset="45%"  stop-color="#4361ee"/>
      <stop offset="100%" stop-color="#4cc9f0"/>
    </linearGradient></defs>
    <path d="M8 6L8 34M8 20L24 6M8 20L26 34"
      stroke="url(#kgnav)" stroke-width="3.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  /* ── Build tabs HTML ─────────────────────────────────────────── */
  const tabsHTML = TABS.map(t => {
    const isActive = t.id === active;
    return `<a
      class="nav-tab${isActive ? ' active' : ''}"
      href="${t.href}"
      data-app="${t.id}"
      style="--tab-color:${t.color};"
      aria-current="${isActive ? 'page' : 'false'}"
    >
      <span class="tab-dot"></span>
      <span class="tab-icon">${t.icon}</span>
      <span class="tab-label">${t.label}</span>
    </a>`;
  }).join('');

  /* ── Full nav HTML ───────────────────────────────────────────── */
  const navHTML = `<nav id="kb-nav" role="navigation" aria-label="Navegación principal">
  <div class="nav-inner">

    <a class="nav-logo" href="./index.html" aria-label="Kobalt Red — Inicio">
      ${LOGO}
      <span class="g-full nav-label">Kobalt</span>
    </a>

    <div class="nav-tabs" role="tablist">
      ${tabsHTML}
    </div>

    <div class="nav-right">
      <div class="twrap" title="Cambiar tema">
        <span aria-hidden="true">🌙</span>
        <button class="ttog" id="kb-ttog" aria-label="Cambiar tema claro/oscuro" type="button"></button>
        <span aria-hidden="true">☀️</span>
      </div>
      <a class="btn btn-app btn-sm" href="./ecosistema.html" style="display:none;" id="nav-cta">
        Ver ecosistema ✦
      </a>
    </div>

  </div>
</nav>`;

  /* ── Inject nav ──────────────────────────────────────────────── */
  document.body.insertAdjacentHTML('afterbegin', navHTML);

  /* Show CTA button on wider screens */
  function updateCTA() {
    const cta = document.getElementById('nav-cta');
    if (cta) cta.style.display = window.innerWidth >= 900 ? 'inline-flex' : 'none';
  }
  updateCTA();
  window.addEventListener('resize', updateCTA);

  /* ── Scroll shadow ───────────────────────────────────────────── */
  const nav = document.getElementById('kb-nav');
  window.addEventListener('scroll', function () {
    nav.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  /* ── Theme system ────────────────────────────────────────────── */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('kb-theme', t);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  window.toggleTheme = toggleTheme;

  document.getElementById('kb-ttog').addEventListener('click', toggleTheme);

  /* Apply saved or system theme */
  const saved = localStorage.getItem('kb-theme');
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  /* ── Apply app data attribute ────────────────────────────────── */
  document.documentElement.setAttribute('data-app', active);

  /* ── Smooth scroll for in-page anchors ──────────────────────── */
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const el = document.querySelector(a.getAttribute('href'));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });

  /* ── Active tab indicator follows current URL ────────────────── */
  // Highlight tabs on popstate (soft navigation)
  window.addEventListener('popstate', function () {
    document.querySelectorAll('.nav-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('href') === location.pathname.split('/').pop());
    });
  });

})();

/* ── Global helpers ──────────────────────────────────────────── */
function s2(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
