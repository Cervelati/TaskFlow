/* ══════════════════════════════════════════════════
   TaskFlow – notifications.js
   Integrado com Spring Boot /api/notifications
   ══════════════════════════════════════════════════ */

'use strict';

const API_URL   = 'http://localhost:5000';
const POLL_INTERVAL = 30000; // atualiza a cada 30s

/* ─── STATE ─── */
let allNotifications = [];
let currentFilter    = 'all';
let currentUser      = null;
let pollTimer        = null;

/* ─── THEME (compartilhado com dashboard) ─── */
const THEME_BG = {
  blue: '#0052CC', teal: '#007A94', green: '#0B6E4F',
  purple: '#403294', slate: '#2C3E50', crimson: '#8B1A2B', midnight: '#1A1A2E',
};

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
(function init() {
  // Auth guard
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = 'login.html'; return; }

  // Carrega usuário
  try {
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (currentUser?.name) {
      const nameEl   = document.getElementById('user-name');
      const avatarEl = document.getElementById('user-avatar');
      if (nameEl)   nameEl.textContent   = currentUser.name;
      if (avatarEl) avatarEl.textContent = currentUser.name
        .split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
    }
  } catch (_) {}

  // Aplica tema salvo
  const saved = JSON.parse(localStorage.getItem('taskflow_data') || '{}');
  if (saved.theme || saved.mode) {
    applyTheme(saved.theme || 'blue', saved.mode || 'dark', false);
    updateModeBtns(saved.mode || 'dark');
    updateThemeBtns(saved.theme || 'blue');
  }

  // Carrega notificações
  loadNotifications();

  // Polling a cada 30s
  pollTimer = setInterval(loadNotifications, POLL_INTERVAL);
})();

/* ══════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════ */
async function loadNotifications() {
  if (!currentUser?.id) {
    showError('Usuário não identificado. Faça login novamente.');
    return;
  }

  showLoading(true);

  try {
    const token = localStorage.getItem('token');
    const res   = await fetch(`${API_URL}/api/notifications/${currentUser.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    allNotifications = await res.json();
    renderNotifications();
    updateCounts();
    showLoading(false);

  } catch (err) {
    showLoading(false);
    showErrorState(`Não foi possível conectar ao servidor. (${err.message})`);
    console.error('Erro ao carregar notificações:', err);
  }
}

async function markAsRead(id) {
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Atualiza local imediatamente (sem esperar poll)
    const notif = allNotifications.find(n => n.id === id);
    if (notif) { notif.read = true; notif.readAt = new Date().toISOString(); }
    renderNotifications();
    updateCounts();

  } catch (err) {
    console.error('Erro ao marcar como lida:', err);
  }
}

async function markAllAsRead() {
  if (!currentUser?.id) return;

  const btn = document.getElementById('btn-mark-all');
  btn.disabled = true;

  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/notifications/${currentUser.id}/read-all`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    allNotifications.forEach(n => { n.read = true; n.readAt = new Date().toISOString(); });
    renderNotifications();
    updateCounts();

  } catch (err) {
    console.error('Erro ao marcar todas:', err);
  } finally {
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════ */
function renderNotifications() {
  const list = document.getElementById('notif-list');
  const emptyEl = document.getElementById('notif-empty');

  // Filtra
  const filtered = allNotifications.filter(n => {
    if (currentFilter === 'unread') return !n.read;
    if (currentFilter === 'read')   return  n.read;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  list.innerHTML = '';

  filtered.forEach((notif, i) => {
    const el = buildNotifItem(notif, i);
    list.appendChild(el);
  });
}

function buildNotifItem(notif, index) {
  const el = document.createElement('div');
  el.className = `notif-item ${notif.read ? 'read' : 'unread'}`;
  el.style.animationDelay = `${index * 40}ms`;

  const { icon, iconClass, badgeClass, badgeLabel } = typeConfig(notif.type);

  const readBtn = !notif.read
    ? `<button class="btn-read" onclick="event.stopPropagation(); markAsRead(${notif.id})">Marcar lida</button>`
    : '';

  const unreadDot = !notif.read
    ? `<div class="unread-dot"></div>`
    : '';

  el.innerHTML = `
    <div class="notif-icon ${iconClass}">${icon}</div>
    <div class="notif-content">
      <div class="notif-header">
        <span class="notif-type-badge ${badgeClass}">${badgeLabel}</span>
        ${readBtn}
      </div>
      <div class="notif-message">${escHtml(notif.message)}</div>
      <div class="notif-meta">
        <span>${formatDate(notif.createdAt)}</span>
        ${notif.taskId ? `<div class="notif-dot"></div><span>Tarefa #${notif.taskId}</span>` : ''}
        ${notif.sent ? `<div class="notif-dot"></div><span>📧 E-mail enviado</span>` : ''}
      </div>
    </div>
    ${unreadDot}
  `;

  // Clique no item também marca como lida
  if (!notif.read) {
    el.addEventListener('click', () => markAsRead(notif.id));
  }

  return el;
}

/* ══════════════════════════════════════════════════
   FILTER
   ══════════════════════════════════════════════════ */
function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotifications();
}

function updateCounts() {
  const unread = allNotifications.filter(n => !n.read).length;

  // Badge na nav
  const badge = document.getElementById('nav-badge');
  if (badge) {
    badge.textContent = unread;
    badge.classList.toggle('hidden', unread === 0);
  }

  // Contador no filtro "Não lidas"
  const countEl = document.getElementById('filter-unread-count');
  if (countEl) countEl.textContent = unread;

  // Desabilita "Marcar todas" se não houver não lidas
  const markAllBtn = document.getElementById('btn-mark-all');
  if (markAllBtn) markAllBtn.disabled = unread === 0;
}

/* ══════════════════════════════════════════════════
   UI STATES
   ══════════════════════════════════════════════════ */
function showLoading(show) {
  document.getElementById('notif-loading').classList.toggle('hidden', !show);
  document.getElementById('notif-list').classList.toggle('hidden', show);
  document.getElementById('notif-error').classList.add('hidden');
}

function showErrorState(msg) {
  document.getElementById('notif-loading').classList.add('hidden');
  document.getElementById('notif-list').classList.add('hidden');
  document.getElementById('notif-empty').classList.add('hidden');
  document.getElementById('notif-error').classList.remove('hidden');
  document.getElementById('error-detail').textContent = msg;
}

/* ══════════════════════════════════════════════════
   THEME (mesmo padrão do dashboard.js)
   ══════════════════════════════════════════════════ */
function setTheme(token, btn) {
  applyTheme(token, getCurrentMode());
  updateThemeBtns(token);
  saveTheme(token, getCurrentMode());
}

function setMode(modeStr) {
  const mode = modeStr === 'light-mode' ? 'light' : 'dark';
  applyTheme(getCurrentTheme(), mode);
  updateModeBtns(mode);
  saveTheme(getCurrentTheme(), mode);
}

function applyTheme(token, mode, transition = true) {
  const body = document.body;
  const db   = document.querySelector('.db');
  if (!transition) body.style.transition = 'none';
  if (mode === 'light') {
    body.setAttribute('data-theme', 'light');
    if (db) db.style.background = '';
  } else {
    body.setAttribute('data-theme', token);
    if (db && THEME_BG[token]) db.style.background = THEME_BG[token];
  }
  if (!transition) { void body.offsetHeight; body.style.transition = ''; }
}

function getCurrentTheme() {
  return document.querySelector('.theme-btn.active')?.dataset.theme || 'blue';
}

function getCurrentMode() {
  return document.getElementById('btn-light-mode')?.classList.contains('active') ? 'light' : 'dark';
}

function updateModeBtns(mode) {
  document.getElementById('btn-dark-mode')?.classList.toggle('active', mode === 'dark');
  document.getElementById('btn-light-mode')?.classList.toggle('active', mode === 'light');
}

function updateThemeBtns(token) {
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === token);
  });
}

function saveTheme(token, mode) {
  try {
    const existing = JSON.parse(localStorage.getItem('taskflow_data') || '{}');
    localStorage.setItem('taskflow_data', JSON.stringify({ ...existing, theme: token, mode }));
  } catch (_) {}
}

/* ══════════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════════ */
function handleLogout() {
  document.getElementById('logout-overlay').classList.remove('hidden');
}
function closeLogout() {
  document.getElementById('logout-overlay').classList.add('hidden');
}
function confirmLogout() {
  const btn     = document.querySelector('.btn-logout-confirm');
  const label   = document.getElementById('logout-label');
  const spinner = document.getElementById('logout-spinner');
  btn.disabled = true;
  label.textContent = 'Saindo…';
  spinner.classList.remove('hidden');
  clearInterval(pollTimer);
  setTimeout(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }, 900);
}

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
function typeConfig(type) {
  const map = {
    TASK_CREATED:  { icon: '✨', iconClass: 'icon-created',  badgeClass: 'badge-created',  badgeLabel: 'Nova tarefa'  },
    TASK_UPDATED:  { icon: '✏️', iconClass: 'icon-updated',  badgeClass: 'badge-updated',  badgeLabel: 'Atualizada'  },
    TASK_DONE:     { icon: '✅', iconClass: 'icon-done',     badgeClass: 'badge-done',     badgeLabel: 'Concluída'   },
    TASK_DEADLINE: { icon: '⏰', iconClass: 'icon-deadline', badgeClass: 'badge-deadline', badgeLabel: 'Prazo!'      },
  };
  return map[type] || { icon: '🔔', iconClass: 'icon-default', badgeClass: 'badge-default', badgeLabel: type };
}

function formatDate(iso) {
  if (!iso) return '';
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000); // seconds

  if (diff < 60)   return 'agora mesmo';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;

  const days = Math.floor(diff / 86400);
  if (days === 1) return 'ontem';
  if (days < 7)  return `${days} dias atrás`;

  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}