'use strict';

/* ══════════════════════════════════════════════════
   TaskFlow – theme.js  (compartilhado entre páginas)
   ══════════════════════════════════════════════════ */

const THEME_CONFIG = {
    blue:     { bg: '#0052CC', accent: '#0052CC', accentLight: '#E6F0FF', accentHover: '#003D99' },
    teal:     { bg: '#007A94', accent: '#007A94', accentLight: '#E0F5FA', accentHover: '#005F72' },
    green:    { bg: '#0B6E4F', accent: '#0B6E4F', accentLight: '#E3FCEF', accentHover: '#084F38' },
    purple:   { bg: '#403294', accent: '#403294', accentLight: '#EAE6FF', accentHover: '#2D2069' },
    slate:    { bg: '#2C3E50', accent: '#2C3E50', accentLight: '#EDF0F2', accentHover: '#1A252F' },
    crimson:  { bg: '#8B1A2B', accent: '#8B1A2B', accentLight: '#FFEBE6', accentHover: '#6B1220' },
    midnight: { bg: '#1A1A2E', accent: '#1A1A2E', accentLight: '#EBEBF5', accentHover: '#0D0D1A' },
};

function applyTheme(token, mode, transition = true) {
    const body   = document.body;
    const db     = document.querySelector('.db');
    const config = THEME_CONFIG[token] || THEME_CONFIG.blue;

    if (!transition) body.style.transition = 'none';

    if (mode === 'light') {
        body.setAttribute('data-theme', 'light');
        if (db) db.style.background = '';
    } else {
        body.setAttribute('data-theme', token);
        if (db) db.style.background = config.bg;
    }

    // Injeta variáveis CSS dinâmicas para botões dos cards
    document.documentElement.style.setProperty('--theme-accent',       config.accent);
    document.documentElement.style.setProperty('--theme-accent-light', config.accentLight);
    document.documentElement.style.setProperty('--theme-accent-hover', config.accentHover);

    if (!transition) { void body.offsetHeight; body.style.transition = ''; }
}

function loadTheme() {
    try {
        const saved = JSON.parse(localStorage.getItem('taskflow_theme'));
        return saved || { theme: 'blue', mode: 'dark' };
    } catch (_) {
        return { theme: 'blue', mode: 'dark' };
    }
}

function saveTheme(theme, mode) {
    try { localStorage.setItem('taskflow_theme', JSON.stringify({ theme, mode })); }
    catch (_) {}
}

function setTheme(token, el) {
    const { mode } = loadTheme();
    saveTheme(token, mode);
    applyTheme(token, mode);
    updateThemeBtns(token);
}

function setMode(modeStr) {
    const mode = modeStr === 'light-mode' ? 'light' : 'dark';
    const { theme } = loadTheme();
    saveTheme(theme, mode);
    applyTheme(theme, mode);
    updateModeBtns(mode);
}

function updateModeBtns(mode) {
    document.getElementById('btn-dark-mode')?.classList.toggle('active',  mode === 'dark');
    document.getElementById('btn-light-mode')?.classList.toggle('active', mode === 'light');
}

function updateThemeBtns(token) {
    // Suporte ao accordion do dashboard (color-row)
    document.querySelectorAll('.color-row').forEach(row => {
        row.classList.toggle('active', row.dataset.theme === token);
    });
    // Suporte aos botões circulares das outras páginas (theme-btn)
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === token);
    });
}

function initTheme() {
    const { theme, mode } = loadTheme();
    applyTheme(theme, mode, false);
    updateModeBtns(mode);
    updateThemeBtns(theme);
}

// Aplica imediatamente ao carregar
initTheme();