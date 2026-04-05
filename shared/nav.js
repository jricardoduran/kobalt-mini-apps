/* ═══════════════════════════════════════════════════════════════
   KOBALT · shared/nav.js
   Inyecta el nav compartido y gestiona el toggle dark/light
   ═══════════════════════════════════════════════════════════════

   Uso en cada página:
     <script src="../../shared/nav.js"></script>   (ajusta la ruta)
     El script detecta automáticamente su profundidad relativa.

   La página puede definir window.KB_NAV_ACTIVE = 'marketplace'
   para resaltar el enlace activo.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  /* ── rutas relativas ── */
  const script   = document.currentScript;
  const scriptSrc = script ? script.src : '';
  // Detecta cuántos niveles de profundidad tiene la página actual
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  const root  = depth <= 1 ? './' : depth === 2 ? '../' : '../../';

  /* ── logo SVG Kobalt ── */
  const logoSVG = `<svg width="28" height="28" viewBox="0 0 40 40" fill="none">
    <defs><linearGradient id="kgn" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f72585"/>
      <stop offset="45%" stop-color="#4361ee"/>
      <stop offset="100%" stop-color="#4cc9f0"/>
    </linearGradient></defs>
    <path d="M8 6L8 34M8 20L24 6M8 20L26 34" stroke="url(#kgn)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  /* ── apps del ecosistema ── */
  const apps = [
    { id: 'marketplace', label: 'Marketplace',  href: `${root}apps/marketplace/` },
    { id: 'negocio',     label: 'Negocio',       href: `${root}apps/negocio/` },
    { id: 'curso',       label: 'Curso IA',      href: `${root}apps/curso/` },
    { id: 'community',   label: 'Community',     href: `${root}apps/community/` },
    { id: 'open-claw',   label: 'Open-Claw',     href: `${root}apps/open-claw/` },
    { id: 'mercado',     label: 'Mercado',        href: `${root}apps/mercado/` },
    { id: 'ecosistema',  label: 'Ecosistema',    href: `${root}apps/ecosistema/` },
  ];

  const active = window.KB_NAV_ACTIVE || '';

  const linksHTML = apps.map(a =>
    `<li><a href="${a.href}" class="${active === a.id ? 'active' : ''}">${a.label}</a></li>`
  ).join('');

  /* ── HTML del nav ── */
  const navHTML = `
<nav id="kb-nav">
  <a class="nlogo" href="${root}index.html">
    ${logoSVG}
    <span class="gf">Kobalt</span>
  </a>

  <ul class="nlinks">
    <li><a href="${root}index.html" class="${!active ? 'active' : ''}">Inicio</a></li>
    ${linksHTML}
  </ul>

  <div class="nright">
    <div class="twrap">
      <span>🌙</span>
      <div class="ttog" id="kb-theme-toggle"></div>
      <span>☀️</span>
    </div>
    <a class="btn btn-p" href="${root}apps/ecosistema/" style="padding:9px 18px;font-size:.8rem;">Ver ecosistema ✦</a>
  </div>
</nav>`;

  /* ── inyectar en el DOM ── */
  document.body.insertAdjacentHTML('afterbegin', navHTML);

  /* ── scroll shadow ── */
  window.addEventListener('scroll', function () {
    const nav = document.getElementById('kb-nav');
    if (!nav) return;
    if (window.scrollY > 10) {
      nav.style.boxShadow = '0 2px 20px rgba(0,0,0,.2)';
    } else {
      nav.style.boxShadow = 'none';
    }
  });

  /* ── tema ── */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kb-theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Exponer globalmente para uso en línea si se necesita
  window.toggleTheme = toggleTheme;

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'kb-theme-toggle') {
      toggleTheme();
    }
  });

  // Aplicar tema guardado
  const saved = localStorage.getItem('kb-theme') || 'dark';
  applyTheme(saved);

  /* ── smooth scroll para anclas internas ── */
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });

})();

/* ── helper s2: scroll a sección por id ── */
function s2(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
