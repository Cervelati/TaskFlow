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
    document.querySelectorAll('.color-row').forEach(row => {
        row.classList.toggle('active', row.dataset.theme === token);
    });
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

initTheme();

/* ══════════════════════════════════════════════════
   USER INFO GLOBAL
══════════════════════════════════════════════════ */
function loadUserInfo() {
    try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (!u) return;

        const nameEl   = document.getElementById('user-name');
        const avatarEl = document.getElementById('user-avatar');
        if (nameEl && u.name)   nameEl.textContent   = u.name;
        if (avatarEl && u.name) avatarEl.textContent = u.name.split(' ').slice(0,2).map(w => w[0].toUpperCase()).join('');

        const roleEl = document.getElementById('user-role');
        if (roleEl) roleEl.textContent = getUserRole();

        const planBadge = document.getElementById('plan-badge');
        if (planBadge && u.plan) {
            const labels = { free:'Free', standard:'Standard', premium:'Premium', enterprise:'Enterprise' };
            planBadge.textContent = labels[u.plan] || 'Free';
            planBadge.className   = `plan-badge ${u.plan}`;
        }
    } catch(_) {}
}

function getUserRole() {
    try {
        const prefs = JSON.parse(localStorage.getItem('taskflow_prefs')) || {};
        return prefs.role || 'Developer';
    } catch(_) { return 'Developer'; }
}

function setUserRole(role) {
    try {
        const prefs = JSON.parse(localStorage.getItem('taskflow_prefs')) || {};
        prefs.role = role;
        localStorage.setItem('taskflow_prefs', JSON.stringify(prefs));
        const roleEl = document.getElementById('user-role');
        if (roleEl) roleEl.textContent = role;
    } catch(_) {}
}

/* ══════════════════════════════════════════════════
   BADGES DE URGÊNCIA
══════════════════════════════════════════════════ */
async function refreshUrgentBadges() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('http://localhost:5000/api/tasks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const tasks = await res.json();

        const today = new Date(); today.setHours(0,0,0,0);
        const count = tasks.filter(t => {
            if (!t.dueDate || t.isCompleted) return false;
            const diff = Math.floor((new Date(t.dueDate) - today) / 86400000);
            return diff >= 0 && diff <= 2;
        }).length;

        const badge = document.getElementById('nav-tasks-badge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    } catch(_) {}
}

/* ══════════════════════════════════════════════════
   BADGE CSS
══════════════════════════════════════════════════ */
(function injectBadgeStyle() {
    if (document.getElementById('tf-badge-style')) return;
    const s = document.createElement('style');
    s.id = 'tf-badge-style';
    s.textContent = `
        .nav-badge {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 16px; height: 16px;
            background: #FF5630; color: white;
            font-size: 9px; font-weight: 700;
            border-radius: 100px; padding: 0 4px;
            margin-left: auto;
        }
        .nav-badge.hidden { display: none !important; }
    `;
    document.head.appendChild(s);
})();