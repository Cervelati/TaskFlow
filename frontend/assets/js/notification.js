'use strict';

const API_URL = 'http://localhost:8080';
const POLL_INTERVAL = 30000;

let allNotifications = [];
let currentFilter = 'all';
let currentUser = null;
let pollTimer = null;

(function init() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } catch (_) {}

    const { theme, mode } = loadTheme();
    updateModeBtns(mode);
    updateThemeBtns(theme);

    loadUserInfo();
    refreshUrgentBadges();

    loadNotifications();
    pollTimer = setInterval(() => loadNotifications(true), POLL_INTERVAL);
})();

async function loadNotifications(isPolling = false) {
  if (!currentUser?.id) { showErrorState('Usuário não identificado. Faça login novamente.'); return; }

  if (!isPolling) showLoading(true);

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/notifications/${currentUser.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const newNotifications = await res.json();

    const changed = JSON.stringify(newNotifications) !== JSON.stringify(allNotifications);
    if (changed) {
      allNotifications = newNotifications;
      renderNotifications();
      updateCounts();
    }

    if (!isPolling) showLoading(false);

  } catch (err) {
    if (!isPolling) {
      showLoading(false);
      showErrorState(`Não foi possível conectar ao servidor. (${err.message})`);
    }
  }
}

async function markAsRead(id) {
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` }
    });
    const notif = allNotifications.find(n => n.id === id);
    if (notif) { notif.read = true; notif.readAt = new Date().toISOString(); }
    renderNotifications(); updateCounts();
  } catch (err) { console.error('Erro ao marcar como lida:', err); }
}

async function markAllAsRead() {
  if (!currentUser?.id) return;
  const btn = document.getElementById('btn-mark-all');
  btn.disabled = true;
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/notifications/${currentUser.id}/read-all`, {
      method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` }
    });
    allNotifications.forEach(n => { n.read = true; n.readAt = new Date().toISOString(); });
    renderNotifications(); updateCounts();
  } catch (err) { console.error('Erro ao marcar todas:', err); }
  finally { btn.disabled = false; }
}

async function deleteNotif(id) {
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    allNotifications = allNotifications.filter(n => n.id !== id);
    renderNotifications();
    updateCounts();
  } catch (err) { console.error('Erro ao excluir notificação:', err); }
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const emptyEl = document.getElementById('notif-empty');
  const filtered = allNotifications.filter(n => {
    if (currentFilter === 'unread') return !n.read;
    if (currentFilter === 'read') return n.read;
    return true;
  });
  if (filtered.length === 0) { list.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  list.innerHTML = '';
  filtered.forEach((notif, i) => list.appendChild(buildNotifItem(notif, i)));
}

function buildNotifItem(notif, index) {
  const el = document.createElement('div');
  el.className = `notif-item ${notif.read ? 'read' : 'unread'}`;
  el.style.animationDelay = `${index * 40}ms`;
  const { icon, iconClass, badgeClass, badgeLabel } = typeConfig(notif.type);

  const actionBtn = !notif.read
    ? `<button class="btn-read" onclick="event.stopPropagation(); markAsRead(${notif.id})">Marcar lida</button>`
    : `<button class="btn-read btn-delete-notif" onclick="event.stopPropagation(); deleteNotif(${notif.id})">🗑 Excluir</button>`;

  const unreadDot = !notif.read ? `<div class="unread-dot"></div>` : '';

  el.innerHTML = `
    <div class="notif-icon ${iconClass}">${icon}</div>
    <div class="notif-content">
      <div class="notif-header"><span class="notif-type-badge ${badgeClass}">${badgeLabel}</span>${actionBtn}</div>
      <div class="notif-message">${escHtml(notif.message)}</div>
      <div class="notif-meta">
        <span>${formatDate(notif.createdAt)}</span>
        ${notif.taskId ? `<div class="notif-dot"></div><span>Tarefa #${notif.taskId}</span>` : ''}
        ${notif.sent ? `<div class="notif-dot"></div><span>📧 E-mail enviado</span>` : ''}
      </div>
    </div>${unreadDot}`;

  if (!notif.read) el.addEventListener('click', () => markAsRead(notif.id));
  return el;
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotifications();
}

function updateCounts() {
  const unread = allNotifications.filter(n => !n.read).length;
  const badge = document.getElementById('nav-badge');
  if (badge) { badge.textContent = unread; badge.classList.toggle('hidden', unread === 0); }
  const countEl = document.getElementById('filter-unread-count');
  if (countEl) countEl.textContent = unread;
  const markAllBtn = document.getElementById('btn-mark-all');
  if (markAllBtn) markAllBtn.disabled = unread === 0;
}

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

function handleLogout() { document.getElementById('logout-overlay').classList.remove('hidden'); }
function closeLogout() { document.getElementById('logout-overlay').classList.add('hidden'); }
function confirmLogout() {
  const btn = document.querySelector('.btn-logout-confirm');
  const label = document.getElementById('logout-label');
  const spinner = document.getElementById('logout-spinner');
  btn.disabled = true; label.textContent = 'Saindo…'; spinner.classList.remove('hidden');
  clearInterval(pollTimer);
  setTimeout(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'index.html'; }, 900);
}

function typeConfig(type) {
  const map = {
    TASK_CREATED: { icon: '✨', iconClass: 'icon-created', badgeClass: 'badge-created', badgeLabel: 'Nova tarefa' },
    TASK_UPDATED: { icon: '✏️', iconClass: 'icon-updated', badgeClass: 'badge-updated', badgeLabel: 'Atualizada' },
    TASK_DONE: { icon: '✅', iconClass: 'icon-done', badgeClass: 'badge-done', badgeLabel: 'Concluída' },
    TASK_DEADLINE: { icon: '⏰', iconClass: 'icon-deadline', badgeClass: 'badge-deadline', badgeLabel: 'Prazo!' },
  };
  return map[type] || { icon: '🔔', iconClass: 'icon-default', badgeClass: 'badge-default', badgeLabel: type };
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'ontem';
  if (days < 7) return `${days} dias atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}