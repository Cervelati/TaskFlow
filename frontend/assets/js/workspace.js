'use strict';

/* ─── CONFIG ─── */
const API = 'http://localhost:5000/api';

/* ─── THEME (reusa lógica do dashboard) ─── */
const THEME_BG = {
    blue: '#0052CC', teal: '#007A94', green: '#0B6E4F',
    purple: '#403294', slate: '#2C3E50', crimson: '#8B1A2B', midnight: '#1A1A2E',
};

/* ─── STATE ─── */
let state = {
    workspaces: [],
    theme: 'blue',
    mode: 'dark',
    editingId: null,
    deletingId: null,
    invitingWorkspaceId: null,
    viewingMembersId: null,
};

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
(async function init() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    // Carrega usuário
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
        try {
            const user = JSON.parse(rawUser);
            if (user.name) {
                document.getElementById('user-name').textContent = user.name;
                document.getElementById('user-avatar').textContent = user.name
                    .split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
            }
        } catch (_) {}
    }

    // Restaura tema
    const saved = loadTheme();
    if (saved) { state.theme = saved.theme; state.mode = saved.mode; }
    applyTheme(state.theme, state.mode, false);
    updateModeBtns();
    updateThemeBtns();

    await loadWorkspaces();
})();

/* ══════════════════════════════════════════════════
   API HELPERS
   ══════════════════════════════════════════════════ */
function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
        ...opts,
        headers: { ...authHeaders(), ...(opts.headers || {}) }
    });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return res;
}

/* ══════════════════════════════════════════════════
   LOAD WORKSPACES
   ══════════════════════════════════════════════════ */
async function loadWorkspaces() {
    show('ws-loading');
    hide('ws-grid');
    hide('ws-empty');

    try {
        const res = await apiFetch('/workspaces');
        if (!res) return;

        if (!res.ok) throw new Error('Erro ao carregar workspaces');

        state.workspaces = await res.json();
        renderWorkspaces();
    } catch (err) {
        toast('Erro ao carregar workspaces', 'error');
        hide('ws-loading');
    }
}

/* ══════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════ */
function renderWorkspaces() {
    hide('ws-loading');
    const grid = document.getElementById('ws-grid');

    if (state.workspaces.length === 0) {
        show('ws-empty');
        hide('ws-grid');
        renderLimitBar(0);
        return;
    }

    hide('ws-empty');
    show('ws-grid');

    const ownedCount = state.workspaces.filter(w => w.userRole === 'Owner').length;
    renderLimitBar(ownedCount);

    grid.innerHTML = '';
    state.workspaces.forEach(ws => grid.appendChild(buildCard(ws)));
}

function renderLimitBar(ownedCount) {
    // Remove barra anterior se existir
    const old = document.getElementById('ws-limit-bar');
    if (old) old.remove();

    const bar = document.createElement('div');
    bar.id = 'ws-limit-bar';
    bar.className = 'ws-limit-bar';

    const dots = [1, 2, 3].map(i =>
        `<div class="ws-dot ${i <= ownedCount ? 'active' : ''}"></div>`
    ).join('');

    bar.innerHTML = `
        <span>Workspaces criados: <strong>${ownedCount}/3</strong> no plano gratuito</span>
        <div class="ws-limit-dots">${dots}</div>
    `;

    const topbar = document.querySelector('.topbar');
    topbar.insertAdjacentElement('afterend', bar);

    // Desabilita botão se atingiu o limite
    const btnNew = document.getElementById('btn-new-workspace');
    if (ownedCount >= 3) {
        btnNew.disabled = true;
        btnNew.title = 'Limite de 3 workspaces atingido';
        btnNew.style.opacity = '0.5';
        btnNew.style.cursor = 'not-allowed';
    } else {
        btnNew.disabled = false;
        btnNew.title = '';
        btnNew.style.opacity = '';
        btnNew.style.cursor = '';
    }
}

function buildCard(ws) {
    const card = document.createElement('div');
    card.className = 'ws-card';
    card.dataset.id = ws.id;

    const roleClass = { Owner: 'role-owner', Admin: 'role-admin', Member: 'role-member' }[ws.userRole] || 'role-member';
    const desc = ws.description ? escHtml(ws.description) : '<em style="color:#97A0AF">Sem descrição</em>';

    const isOwnerOrAdmin = ws.userRole === 'Owner' || ws.userRole === 'Admin';
    const isOwner = ws.userRole === 'Owner';

    card.innerHTML = `
        <div class="ws-card-header">
            <div class="ws-card-info">
                <div class="ws-card-name">${escHtml(ws.name)}</div>
                <div class="ws-card-desc">${desc}</div>
            </div>
            <span class="ws-card-role ${roleClass}">${ws.userRole}</span>
        </div>
        <div class="ws-card-body">
            <div class="ws-stat">
                <span class="ws-stat-icon">👥</span>
                <span>${ws.memberCount} ${ws.memberCount === 1 ? 'membro' : 'membros'}</span>
            </div>
            <div class="ws-stat">
                <span class="ws-stat-icon">📅</span>
                <span>${formatDate(ws.createdAt)}</span>
            </div>
        </div>
        <div class="ws-card-footer">
            <button class="ws-btn ws-btn-primary" onclick="openMembersModal(${ws.id})">👥 Membros</button>
            ${isOwnerOrAdmin ? `<button class="ws-btn ws-btn-secondary" onclick="openEditModal(${ws.id})">✏ Editar</button>` : ''}
            ${isOwner ? `<button class="ws-btn ws-btn-danger" onclick="openDeleteModal(${ws.id})">🗑 Deletar</button>` : ''}
            ${!isOwner ? `<button class="ws-btn ws-btn-secondary" onclick="leaveWorkspace(${ws.id})">↩ Sair</button>` : ''}
        </div>
    `;

    return card;
}

/* ══════════════════════════════════════════════════
   MODAL CRIAR / EDITAR
   ══════════════════════════════════════════════════ */
function openCreateModal() {
    state.editingId = null;
    document.getElementById('modal-ws-title').textContent = 'Novo workspace';
    document.getElementById('ws-name').value = '';
    document.getElementById('ws-desc').value = '';
    document.getElementById('save-ws-label').textContent = 'Criar workspace';
    document.getElementById('error-ws').classList.remove('visible');
    openModal('modal-workspace');
    document.getElementById('ws-name').focus();
}

function openEditModal(id) {
    const ws = state.workspaces.find(w => w.id === id);
    if (!ws) return;
    state.editingId = id;
    document.getElementById('modal-ws-title').textContent = 'Editar workspace';
    document.getElementById('ws-name').value = ws.name;
    document.getElementById('ws-desc').value = ws.description || '';
    document.getElementById('save-ws-label').textContent = 'Salvar alterações';
    document.getElementById('error-ws').classList.remove('visible');
    openModal('modal-workspace');
    document.getElementById('ws-name').focus();
}

async function saveWorkspace() {
    const name = document.getElementById('ws-name').value.trim();
    const desc = document.getElementById('ws-desc').value.trim();
    const err  = document.getElementById('error-ws');

    if (!name) { err.classList.add('visible'); return; }
    err.classList.remove('visible');

    setLoading('btn-save-ws', 'save-ws-label', 'save-ws-spinner',
        state.editingId ? 'Salvando...' : 'Criando...');

    try {
        const body = JSON.stringify({ name, description: desc });

        const res = state.editingId
            ? await apiFetch(`/workspaces/${state.editingId}`, { method: 'PUT', body })
            : await apiFetch('/workspaces', { method: 'POST', body });

        if (!res) return;

        if (res.ok || res.status === 201) {
            closeModal('modal-workspace');
            toast(state.editingId ? 'Workspace atualizado!' : 'Workspace criado!', 'success');
            await loadWorkspaces();
        } else {
            const data = await res.json().catch(() => ({}));
            err.textContent = '⚠ ' + (data.message || 'Erro ao salvar.');
            err.classList.add('visible');
        }
    } catch {
        err.textContent = '⚠ Erro de conexão.';
        err.classList.add('visible');
    } finally {
        resetLoading('btn-save-ws', 'save-ws-label', 'save-ws-spinner',
            state.editingId ? 'Salvar alterações' : 'Criar workspace');
    }
}

/* ══════════════════════════════════════════════════
   DELETAR WORKSPACE
   ══════════════════════════════════════════════════ */
function openDeleteModal(id) {
    state.deletingId = id;
    openModal('modal-delete');
}

async function confirmDelete() {
    if (!state.deletingId) return;
    setLoading('btn-confirm-delete', 'delete-label', 'delete-spinner', 'Deletando...');

    try {
        const res = await apiFetch(`/workspaces/${state.deletingId}`, { method: 'DELETE' });
        if (!res) return;

        if (res.ok) {
            closeModal('modal-delete');
            toast('Workspace deletado.', 'success');
            await loadWorkspaces();
        } else {
            toast('Erro ao deletar workspace.', 'error');
        }
    } catch {
        toast('Erro de conexão.', 'error');
    } finally {
        resetLoading('btn-confirm-delete', 'delete-label', 'delete-spinner', 'Deletar');
        state.deletingId = null;
    }
}

/* ══════════════════════════════════════════════════
   SAIR DO WORKSPACE
   ══════════════════════════════════════════════════ */
async function leaveWorkspace(id) {
    if (!confirm('Tem certeza que deseja sair deste workspace?')) return;
    try {
        const res = await apiFetch(`/workspaces/${id}/leave`, { method: 'POST' });
        if (!res) return;
        if (res.ok) {
            toast('Você saiu do workspace.', 'success');
            await loadWorkspaces();
        } else {
            const data = await res.json().catch(() => ({}));
            toast(data.message || 'Erro ao sair do workspace.', 'error');
        }
    } catch {
        toast('Erro de conexão.', 'error');
    }
}

/* ══════════════════════════════════════════════════
   MEMBROS
   ══════════════════════════════════════════════════ */
async function openMembersModal(workspaceId) {
    state.viewingMembersId = workspaceId;
    const ws = state.workspaces.find(w => w.id === workspaceId);
    document.getElementById('modal-members-title').textContent = `👥 ${ws?.name || 'Membros'}`;
    document.getElementById('members-list').innerHTML = '<div class="members-empty">Carregando...</div>';
    openModal('modal-members');

    try {
        const res = await apiFetch(`/workspaces/${workspaceId}/members`);
        if (!res || !res.ok) throw new Error();

        const members = await res.json();
        renderMembers(members, ws?.userRole);
    } catch {
        document.getElementById('members-list').innerHTML =
            '<div class="members-empty">Erro ao carregar membros.</div>';
    }
}

function renderMembers(members, myRole) {
    const list = document.getElementById('members-list');
    if (!members.length) {
        list.innerHTML = '<div class="members-empty">Nenhum membro encontrado.</div>';
        return;
    }

    list.innerHTML = members.map(m => {
        const roleClass = { Owner: 'role-owner', Admin: 'role-admin', Member: 'role-member' }[m.role] || 'role-member';
        const initials = m.userName.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
        return `
            <div class="member-row">
                <div class="member-avatar">${initials}</div>
                <div class="member-info">
                    <div class="member-name">${escHtml(m.userName)}</div>
                    <div class="member-email">${escHtml(m.email)}</div>
                </div>
                <span class="member-role-badge ${roleClass}">${m.role}</span>
            </div>
        `;
    }).join('');
}

/* ══════════════════════════════════════════════════
   CONVITE
   ══════════════════════════════════════════════════ */
function openInviteModal() {
    state.invitingWorkspaceId = state.viewingMembersId;
    document.getElementById('invite-email').value = '';
    document.getElementById('error-invite').classList.remove('visible');
    closeModal('modal-members');
    openModal('modal-invite');
    document.getElementById('invite-email').focus();
}

async function sendInvite() {
    const email = document.getElementById('invite-email').value.trim();
    const err   = document.getElementById('error-invite');

    if (!email || !email.includes('@')) {
        err.classList.add('visible');
        return;
    }
    err.classList.remove('visible');

    setLoading('btn-send-invite', 'invite-label', 'invite-spinner', 'Enviando...');

    try {
        const res = await apiFetch(
            `/workspaces/${state.invitingWorkspaceId}/invites`,
            { method: 'POST', body: JSON.stringify({ email }) }
        );
        if (!res) return;

        if (res.ok) {
            closeModal('modal-invite');
            toast('Convite enviado com sucesso!', 'success');
        } else {
            const data = await res.json().catch(() => ({}));
            err.textContent = '⚠ ' + (data.message || 'Erro ao enviar convite.');
            err.classList.add('visible');
        }
    } catch {
        err.textContent = '⚠ Erro de conexão.';
        err.classList.add('visible');
    } finally {
        resetLoading('btn-send-invite', 'invite-label', 'invite-spinner', 'Enviar convite');
    }
}

/* ══════════════════════════════════════════════════
   TEMA (igual ao dashboard)
   ══════════════════════════════════════════════════ */
function setTheme(token, btn) {
    state.theme = token;
    applyTheme(state.theme, state.mode);
    updateThemeBtns();
    saveTheme();
}

function setMode(modeStr) {
    state.mode = modeStr === 'light-mode' ? 'light' : 'dark';
    applyTheme(state.theme, state.mode);
    updateModeBtns();
    saveTheme();
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

function updateModeBtns() {
    document.getElementById('btn-dark-mode')?.classList.toggle('active',  state.mode === 'dark');
    document.getElementById('btn-light-mode')?.classList.toggle('active', state.mode === 'light');
}

function updateThemeBtns() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === state.theme);
    });
}

function saveTheme() {
    try { localStorage.setItem('taskflow_theme', JSON.stringify({ theme: state.theme, mode: state.mode })); }
    catch (_) {}
}

function loadTheme() {
    try { const r = localStorage.getItem('taskflow_theme'); return r ? JSON.parse(r) : null; }
    catch (_) { return null; }
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
    const label   = document.getElementById('logout-label');
    const spinner = document.getElementById('logout-spinner');
    const btn     = document.querySelector('.btn-logout-confirm');
    btn.disabled = true;
    label.textContent = 'Saindo…';
    spinner.classList.remove('hidden');
    setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }, 900);
}

/* ══════════════════════════════════════════════════
   MODAL HELPERS
   ══════════════════════════════════════════════════ */
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function handleOverlayClick(e, id) {
    if (e.target === document.getElementById(id)) closeModal(id);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        ['modal-workspace','modal-invite','modal-members','modal-delete','logout-overlay']
            .forEach(id => closeModal(id));
    }
});

/* ══════════════════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════════════════ */
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

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

function toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}