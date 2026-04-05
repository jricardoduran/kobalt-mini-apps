/* ═══════════════════════════════════════════════════════════════
   KOBALT · shared/theme.js
   Tokens de color en JS — para canvas, SVG dinámico o lógica JS
   ═══════════════════════════════════════════════════════════════ */

const KB = {
  colors: {
    pink:   '#f72585',
    violet: '#7209b7',
    blue:   '#4361ee',
    cyan:   '#4cc9f0',
    gold:   '#f8b500',
  },

  dark: {
    bg:      '#06040f',
    bg2:     '#08051a',
    card:    '#0d0a1e',
    card2:   '#100d22',
    text:    '#e8e6f0',
    muted:   '#9490b0',
  },

  light: {
    bg:      '#f3f2f9',
    bg2:     '#eae8f4',
    card:    '#ffffff',
    card2:   '#f8f7fd',
    text:    '#0e0c1c',
    muted:   '#5b5679',
  },

  /* Devuelve los tokens del tema activo */
  get theme() {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    return t === 'light' ? this.light : this.dark;
  },

  /* Gradientes CSS útiles */
  grad: {
    full:    'linear-gradient(90deg,#f72585,#7209b7,#4361ee,#4cc9f0)',
    pink:    'linear-gradient(90deg,#f72585,#7209b7)',
    blue:    'linear-gradient(90deg,#4361ee,#4cc9f0)',
    gold:    'linear-gradient(90deg,#f8b500,#f72585)',
    violet:  'linear-gradient(90deg,#7209b7,#4361ee)',
    rainbow: 'linear-gradient(135deg,#f72585,#b5179e,#7209b7,#4361ee,#4cc9f0,#f8b500,#f72585)',
  },
};

/* Escucha cambios de tema y dispara evento personalizado */
const _themeObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (m) {
    if (m.attributeName === 'data-theme') {
      document.dispatchEvent(new CustomEvent('kb:theme-change', {
        detail: { theme: document.documentElement.getAttribute('data-theme') }
      }));
    }
  });
});
_themeObserver.observe(document.documentElement, { attributes: true });
