'use strict';

const API = 'http://localhost:5000/api';

let currentUser = null;

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
(function init() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser?.name) {
            document.getElementById('user-name').textContent = currentUser.name;
            document.getElementById('user-avatar').textContent = initials(currentUser.name);
            document.getElementById('profile-avatar').textContent = initials(currentUser.name);
            document.getElementById('profile-avatar-name').textContent = currentUser.name;
            document.getElementById('profile-avatar-email').textContent = currentUser.email || '';
            document.getElementById('profile-name').value  = currentUser.name;
            document.getElementById('profile-email').value = currentUser.email || '';
            document.getElementById('dev-name').textContent    = currentUser.name;
            document.getElementById('dev-avatar').textContent  = initials(currentUser.name);
        }
    } catch (_) {}

    const { theme, mode } = loadTheme();
    updateModeBtns(mode);
    updateThemeBtns(theme);

    loadNotifPrefs();
    loadAbout();

    // Preenche o role atual no select
    document.getElementById('dev-role-input').value = getUserRole();

    loadUserInfo();
    refreshUrgentBadges();
})();

/* ══════════════════════════════════════════════════
   SEÇÕES
   ══════════════════════════════════════════════════ */
function showSection(id, el) {
    document.querySelectorAll('.settings-section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    const section = document.getElementById(`section-${id}`);
    section.classList.remove('hidden');
    section.classList.add('active');
    el.classList.add('active');
}

/* ══════════════════════════════════════════════════
   PERFIL
   ══════════════════════════════════════════════════ */
async function saveProfile() {
    const name  = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const err   = document.getElementById('error-profile');
    const suc   = document.getElementById('success-profile');

    err.classList.remove('visible');
    suc.classList.remove('visible');

    if (!name || !email) {
        err.textContent = '⚠ Nome e e-mail são obrigatórios.';
        err.classList.add('visible');
        return;
    }

    setLoading('btn-save-profile', 'label-profile', 'spinner-profile', 'Salvando...');

    try {
        const res = await apiFetch('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({ name, email })
        });

        if (!res) return;

        if (res.ok) {
            const data = await res.json();
            // Atualiza localStorage
            const user = { ...currentUser, name: data.name, email: data.email, token: data.token };
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', data.token);
            currentUser = user;

            // Atualiza UI
            document.getElementById('user-name').textContent = data.name;
            document.getElementById('user-avatar').textContent = initials(data.name);
            document.getElementById('profile-avatar').textContent = initials(data.name);
            document.getElementById('profile-avatar-name').textContent = data.name;
            document.getElementById('profile-avatar-email').textContent = data.email;

            suc.classList.add('visible');
            setTimeout(() => suc.classList.remove('visible'), 3000);
        } else {
            const d = await res.json().catch(() => ({}));
            err.textContent = '⚠ ' + (d.message || 'Erro ao atualizar perfil.');
            err.classList.add('visible');
        }
    } catch {
        err.textContent = '⚠ Erro de conexão.';
        err.classList.add('visible');
    } finally {
        resetLoading('btn-save-profile', 'label-profile', 'spinner-profile', 'Salvar alterações');
    }
}

/* ══════════════════════════════════════════════════
   SENHA
   ══════════════════════════════════════════════════ */
async function changePassword() {
    const current = document.getElementById('current-password').value;
    const newPwd  = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    const err     = document.getElementById('error-password');
    const suc     = document.getElementById('success-password');

    err.classList.remove('visible');
    suc.classList.remove('visible');

    if (!current || !newPwd || !confirm) {
        err.textContent = '⚠ Preencha todos os campos.';
        err.classList.add('visible'); return;
    }

    if (newPwd.length < 6) {
        err.textContent = '⚠ A nova senha deve ter pelo menos 6 caracteres.';
        err.classList.add('visible'); return;
    }

    if (newPwd !== confirm) {
        err.textContent = '⚠ As senhas não coincidem.';
        err.classList.add('visible'); return;
    }

    setLoading('btn-save-password', 'label-password', 'spinner-password', 'Alterando...');

    try {
        const res = await apiFetch('/auth/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword: current, newPassword: newPwd })
        });

        if (!res) return;

        if (res.ok) {
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value     = '';
            document.getElementById('confirm-password').value = '';
            suc.classList.add('visible');
            setTimeout(() => suc.classList.remove('visible'), 3000);
        } else {
            const d = await res.json().catch(() => ({}));
            err.textContent = '⚠ ' + (d.message || 'Erro ao alterar senha.');
            err.classList.add('visible');
        }
    } catch {
        err.textContent = '⚠ Erro de conexão.';
        err.classList.add('visible');
    } finally {
        resetLoading('btn-save-password', 'label-password', 'spinner-password', 'Alterar senha');
    }
}

/* ══════════════════════════════════════════════════
   NOTIFICAÇÕES
   ══════════════════════════════════════════════════ */
function loadNotifPrefs() {
    try {
        const prefs = JSON.parse(localStorage.getItem('taskflow_notif_prefs') || '{}');
        if (prefs.taskCreated  !== undefined) document.getElementById('notif-task-created').checked = prefs.taskCreated;
        if (prefs.invite       !== undefined) document.getElementById('notif-invite').checked       = prefs.invite;
        if (prefs.deadline     !== undefined) document.getElementById('notif-deadline').checked     = prefs.deadline;
    } catch (_) {}
}

function saveNotifPrefs() {
    const prefs = {
        taskCreated: document.getElementById('notif-task-created').checked,
        invite:      document.getElementById('notif-invite').checked,
        deadline:    document.getElementById('notif-deadline').checked,
    };
    localStorage.setItem('taskflow_notif_prefs', JSON.stringify(prefs));
    showToast('Preferências salvas!', 'success');
}

/* ══════════════════════════════════════════════════
   EXCLUIR CONTA
   ══════════════════════════════════════════════════ */
function openDeleteModal() {
    const pwd = document.getElementById('delete-password').value;
    const err = document.getElementById('error-delete');
    err.classList.remove('visible');

    if (!pwd) {
        err.textContent = '⚠ Digite sua senha para continuar.';
        err.classList.add('visible'); return;
    }

    document.getElementById('modal-delete-account').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('modal-delete-account').classList.add('hidden');
}

async function confirmDeleteAccount() {
    const pwd = document.getElementById('delete-password').value;
    const err = document.getElementById('error-delete');

    setLoading('btn-confirm-delete', 'label-delete', 'spinner-delete', 'Excluindo...');

    try {
        const res = await apiFetch('/auth/account', {
            method: 'DELETE',
            body: JSON.stringify({ password: pwd })
        });

        if (!res) return;

        if (res.ok) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('taskflow_theme');
            localStorage.removeItem('taskflow_data');
            window.location.href = 'index.html';
        } else {
            closeDeleteModal();
            const d = await res.json().catch(() => ({}));
            err.textContent = '⚠ ' + (d.message || 'Senha incorreta.');
            err.classList.add('visible');
        }
    } catch {
        closeDeleteModal();
        err.textContent = '⚠ Erro de conexão.';
        err.classList.add('visible');
    } finally {
        resetLoading('btn-confirm-delete', 'label-delete', 'spinner-delete', 'Excluir conta');
    }
}

/* ══════════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════════ */
function handleLogout() { document.getElementById('logout-overlay').classList.remove('hidden'); }
function closeLogout()   { document.getElementById('logout-overlay').classList.add('hidden'); }
function confirmLogout() {
    const btn = document.querySelector('.btn-logout-confirm');
    const label = document.getElementById('logout-label');
    const spinner = document.getElementById('logout-spinner');
    btn.disabled = true; label.textContent = 'Saindo…'; spinner.classList.remove('hidden');
    setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }, 900);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeDeleteModal();
        closeLogout();
    }
});

/* ══════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════ */
function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return res;
}

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
function initials(name) {
    return name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function setLoading(btnId, labelId, spinnerId, text) {
    const btn = document.getElementById(btnId);
    if (btn) btn.disabled = true;
    const label = document.getElementById(labelId);
    if (label) label.textContent = text;
    document.getElementById(spinnerId)?.classList.remove('hidden');
}

function resetLoading(btnId, labelId, spinnerId, text) {
    const btn = document.getElementById(btnId);
    if (btn) btn.disabled = false;
    const label = document.getElementById(labelId);
    if (label) label.textContent = text;
    document.getElementById(spinnerId)?.classList.add('hidden');
}

function showToast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

/* ══════════════════════════════════════════════════
   SOBRE
   ══════════════════════════════════════════════════ */
const DEFAULT_STACKS = [
    { icon: '⚙', name: 'ASP.NET Core 9',  desc: 'Backend API REST em C#' },
    { icon: '☕', name: 'Spring Boot 3.5', desc: 'Microserviço de notificações em Java 21' },
    { icon: '🐘', name: 'PostgreSQL 16',   desc: 'Banco de dados relacional' },
    { icon: '🐳', name: 'Docker Compose',  desc: 'Orquestração de containers' },
    { icon: '🔐', name: 'JWT Auth',        desc: 'Autenticação stateless com tokens' },
    { icon: '🌐', name: 'HTML/CSS/JS',     desc: 'Frontend vanilla sem frameworks' },
];

function loadAbout() {
    const about   = JSON.parse(localStorage.getItem('taskflow_about') || '{}');
    const appName = about.appName || 'TaskFlow';
    const version = about.version || 'Versão 1.0.0 — TCC 2026';
    const desc    = about.desc    || 'Plataforma de gerenciamento de tarefas e projetos inspirada no Trello, desenvolvida como Trabalho de Conclusão de Curso do curso de Análise e Desenvolvimento de Sistemas.';
    const stacks  = about.stacks  || DEFAULT_STACKS;
    const devName = about.devName || currentUser?.name || 'Luiz Henrique';
    const devRole = about.devRole || 'Full Stack Developer';

    // Preenche a view
    renderAboutView({ appName, version, desc, stacks, devName, devRole });

    // Preenche os campos de edição
    document.getElementById('about-app-name').value = appName;
    document.getElementById('about-version').value  = version;
    document.getElementById('about-desc').value     = desc;
    document.getElementById('dev-name-input').value = devName;
    document.getElementById('dev-role-input').value = devRole;
    renderStacks(stacks);
}

function renderAboutView({ appName, version, desc, stacks, devName, devRole }) {
    document.getElementById('view-app-name').textContent  = appName;
    document.getElementById('view-version').textContent   = version;
    document.getElementById('view-desc').textContent      = desc;
    document.getElementById('view-dev-name').textContent  = devName;
    document.getElementById('view-dev-role').textContent  = devRole;
    document.getElementById('view-dev-avatar').textContent = initials(devName);

    document.getElementById('view-stacks').innerHTML = stacks.map(s => `
        <div class="tech-item">
            <span class="tech-icon">${s.icon}</span>
            <div><div class="tech-name">${s.name}</div><div class="tech-desc">${s.desc}</div></div>
        </div>
    `).join('');
}

function toggleAboutEdit(open) {
    document.getElementById('about-view').classList.toggle('hidden', open);
    document.getElementById('about-edit').classList.toggle('hidden', !open);
}

function renderStacks(stacks) {
    document.getElementById('stacks-list').innerHTML = stacks.map((s, i) => `
        <div class="stack-row">
            <input type="text" class="stack-icon" value="${s.icon}" maxlength="4" placeholder="🔧" />
            <input type="text" class="stack-name" value="${s.name}" placeholder="Nome da tecnologia" />
            <input type="text" class="stack-desc" value="${s.desc}" placeholder="Descrição breve" />
            <button class="stack-remove" onclick="removeStack(${i})">✕</button>
        </div>
    `).join('');
}

function addStack() {
    const about  = JSON.parse(localStorage.getItem('taskflow_about') || '{}');
    const stacks = about.stacks || [...DEFAULT_STACKS];
    stacks.push({ icon: '🔧', name: '', desc: '' });
    about.stacks = stacks;
    localStorage.setItem('taskflow_about', JSON.stringify(about));
    renderStacks(stacks);
}

function removeStack(index) {
    const about  = JSON.parse(localStorage.getItem('taskflow_about') || '{}');
    const stacks = about.stacks || [...DEFAULT_STACKS];
    stacks.splice(index, 1);
    about.stacks = stacks;
    localStorage.setItem('taskflow_about', JSON.stringify(about));
    renderStacks(stacks);
}

function saveAllAbout() {
    setLoading('btn-save', 'label-about', 'spinner-about', 'Salvando...');

    const stacks = Array.from(document.querySelectorAll('.stack-row')).map(row => ({
        icon: row.querySelector('.stack-icon').value || '🔧',
        name: row.querySelector('.stack-name').value || '',
        desc: row.querySelector('.stack-desc').value || '',
    }));

    const about = {
        appName: document.getElementById('about-app-name').value.trim(),
        version: document.getElementById('about-version').value.trim(),
        desc:    document.getElementById('about-desc').value.trim(),
        devName: document.getElementById('dev-name-input').value.trim(),
        devRole: document.getElementById('dev-role-input').value,
        stacks,
    };

    localStorage.setItem('taskflow_about', JSON.stringify(about));
    renderAboutView(about);
    toggleAboutEdit(false);
    resetLoading('btn-save', 'label-about', 'spinner-about', 'Salvar tudo');
    showToast('Informações salvas!', 'success');
    setUserRole(document.getElementById('dev-role-input').value);
}