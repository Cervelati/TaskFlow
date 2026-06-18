'use strict';

const API = 'http://localhost:5000/api';

let state = {
    workspaces: [],
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

    const { theme, mode } = loadTheme();
    updateModeBtns(mode);
    updateThemeBtns(theme);

    loadUserInfo();
    refreshUrgentBadges();

    await loadWorkspaces();
})();

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
   LOAD
══════════════════════════════════════════════════ */
async function loadWorkspaces() {
    show('ws-loading'); hide('ws-grid'); hide('ws-empty');
    try {
        const res = await apiFetch('/workspaces');
        if (!res) return;
        if (!res.ok) throw new Error();
        state.workspaces = await res.json();
        renderWorkspaces();
    } catch { toast('Erro ao carregar workspaces', 'error'); hide('ws-loading'); }
}

/* ══════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════ */
function renderWorkspaces() {
    hide('ws-loading');
    const grid = document.getElementById('ws-grid');
    if (state.workspaces.length === 0) { show('ws-empty'); hide('ws-grid'); renderLimitBar(0); return; }
    hide('ws-empty'); show('ws-grid');
    const ownedCount = state.workspaces.filter(w => w.userRole === 'Owner').length;
    renderLimitBar(ownedCount);
    grid.innerHTML = '';
    state.workspaces.forEach(ws => grid.appendChild(buildCard(ws)));
}

function renderLimitBar(ownedCount) {
    const old = document.getElementById('ws-limit-bar');
    if (old) old.remove();
    const bar = document.createElement('div');
    bar.id = 'ws-limit-bar'; bar.className = 'ws-limit-bar';
    const dots = [1, 2, 3].map(i => `<div class="ws-dot ${i <= ownedCount ? 'active' : ''}"></div>`).join('');
    bar.innerHTML = `<span>Workspaces criados: <strong>${ownedCount}/3</strong> no plano gratuito</span><div class="ws-limit-dots">${dots}</div>`;
    document.querySelector('.topbar').insertAdjacentElement('afterend', bar);
    const btnNew = document.getElementById('btn-new-workspace');
    if (ownedCount >= 3) { btnNew.disabled = true; btnNew.style.opacity = '0.5'; btnNew.style.cursor = 'not-allowed'; }
    else { btnNew.disabled = false; btnNew.style.opacity = ''; btnNew.style.cursor = ''; }
}

function buildCard(ws) {
    const card = document.createElement('div');
    card.className = 'ws-card';
    card.dataset.id = ws.id;

    const roleClass = { Owner: 'role-owner', Admin: 'role-admin', Member: 'role-member' }[ws.userRole] || 'role-member';
    const desc = ws.description || '';
    const isOwnerOrAdmin = ws.userRole === 'Owner' || ws.userRole === 'Admin';
    const isOwner = ws.userRole === 'Owner';
    const modeLabel = ws.completionMode === 'checkbox' ? 'Checkbox' : 'Coluna';

    const stripeColors = { Owner: '#0052CC', Admin: '#6554C0', Member: '#36B37E' };
    const stripeColor = stripeColors[ws.userRole] || '#0052CC';

    card.innerHTML = `
        <div class="ws-card-stripe" style="background:${stripeColor}"></div>

        <div class="ws-card-header">
            <div class="ws-card-info">
                <div class="ws-card-name">${escHtml(ws.name)}</div>
                <div class="ws-card-desc">${desc ? escHtml(desc) : '<span style="color:#B3BAC5;font-style:italic">Sem descrição</span>'}</div>
            </div>
            <span class="ws-card-role ${roleClass}">${ws.userRole}</span>
        </div>

        <div class="ws-card-stats">
            <div class="ws-stat">
                <svg class="ws-stat-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
                </svg>
                <span>${ws.memberCount} ${ws.memberCount === 1 ? 'membro' : 'membros'}</span>
            </div>
            <div class="ws-stat">
                <svg class="ws-stat-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M5 5h6M5 11h4"/>
                </svg>
                <span>${formatDate(ws.createdAt)}</span>
            </div>
            <span class="ws-mode-badge">${modeLabel}</span>
        </div>

        <div class="ws-card-footer">
            <button class="ws-btn ws-btn-primary" onclick="location.href='workspaceBoard.html?id=${ws.id}'">Abrir board</button>
            <button class="ws-btn ws-btn-ghost" onclick="openMembersModal(${ws.id})">Membros</button>
            <button class="ws-btn ws-btn-ghost" onclick="openInviteModalDirect(${ws.id})">Convidar</button>
            ${isOwnerOrAdmin ? `<button class="ws-btn ws-btn-ghost" onclick="openEditModal(${ws.id})">Editar</button>` : ''}
            <div class="ws-btn-spacer"></div>
            ${isOwner
                ? `<button class="ws-btn ws-btn-danger" onclick="openDeleteModal(${ws.id})">Remover</button>`
                : `<button class="ws-btn ws-btn-ghost" onclick="leaveWorkspace(${ws.id})">Sair</button>`}
        </div>`;

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

    const modeInput = document.getElementById('ws-completion-mode');
    if (modeInput) modeInput.value = 'column';
    document.querySelectorAll('.completion-option').forEach(o => o.classList.remove('active'));
    document.getElementById('opt-column')?.classList.add('active');

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

    const modeInput = document.getElementById('ws-completion-mode');
    if (modeInput) modeInput.value = ws.completionMode || 'column';
    document.querySelectorAll('.completion-option').forEach(o => o.classList.remove('active'));
    const activeOpt = ws.completionMode === 'checkbox' ? 'opt-checkbox' : 'opt-column';
    document.getElementById(activeOpt)?.classList.add('active');

    openModal('modal-workspace');
    document.getElementById('ws-name').focus();
}

let _pendingMode = null;
let _pendingEl   = null;

function selectCompletionMode(mode, el) {
    const modeInput     = document.getElementById('ws-completion-mode');
    const currentMode   = modeInput?.value;

    if (state.editingId !== null && mode !== currentMode) {
        const ws = state.workspaces.find(w => w.id === state.editingId);
        _pendingMode = mode;
        _pendingEl   = el;
        openModal('modal-mode-confirm');
        return;
    }

    _applyMode(mode, el);
}

function _applyMode(mode, el) {
    document.querySelectorAll('.completion-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    const modeInput = document.getElementById('ws-completion-mode');
    if (modeInput) modeInput.value = mode;
}

function confirmModeChange() {
    if (_pendingMode && _pendingEl) {
        _applyMode(_pendingMode, _pendingEl);
        _pendingMode = null;
        _pendingEl   = null;
    }
    closeModal('modal-mode-confirm');
}

function cancelModeChange() {
    _pendingMode = null;
    _pendingEl   = null;
    closeModal('modal-mode-confirm');
}

async function saveWorkspace() {
    const name = document.getElementById('ws-name').value.trim();
    const desc = document.getElementById('ws-desc').value.trim();
    const err = document.getElementById('error-ws');
    if (!name) { err.classList.add('visible'); return; }
    err.classList.remove('visible');

    setLoading('btn-save-ws', 'save-ws-label', 'save-ws-spinner', state.editingId ? 'Salvando...' : 'Criando...');
    try {
        const body = JSON.stringify({
            name, description: desc,
            completionMode: document.getElementById('ws-completion-mode')?.value || 'column'
        });
        const res = state.editingId
            ? await apiFetch(`/workspaces/${state.editingId}`, { method: 'PUT', body })
            : await apiFetch('/workspaces', { method: 'POST', body });
        if (!res) return;
        if (res.ok || res.status === 201) {
            closeModal('modal-workspace');
            toast(state.editingId ? 'Workspace atualizado.' : 'Workspace criado.', 'success');
            await loadWorkspaces();
        } else {
            const data = await res.json().catch(() => ({}));
            err.textContent = '  ' + (data.message || 'Erro ao salvar.');
            err.classList.add('visible');
        }
    } catch {
        err.textContent = '  Erro de conexão.';
        err.classList.add('visible');
    } finally {
        resetLoading('btn-save-ws', 'save-ws-label', 'save-ws-spinner',
            state.editingId ? 'Salvar alterações' : 'Criar workspace');
    }
}

/* ══════════════════════════════════════════════════
   DELETE / LEAVE
══════════════════════════════════════════════════ */
function openDeleteModal(id) { state.deletingId = id; openModal('modal-delete'); }

async function confirmDelete() {
    if (!state.deletingId) return;
    setLoading('btn-confirm-delete', 'delete-label', 'delete-spinner', 'Removendo...');
    try {
        const res = await apiFetch(`/workspaces/${state.deletingId}`, { method: 'DELETE' });
        if (!res) return;
        if (res.ok) { closeModal('modal-delete'); toast('Workspace removido.', 'success'); await loadWorkspaces(); }
        else toast('Erro ao remover workspace.', 'error');
    } catch { toast('Erro de conexão.', 'error'); }
    finally { resetLoading('btn-confirm-delete', 'delete-label', 'delete-spinner', 'Remover'); state.deletingId = null; }
}

async function leaveWorkspace(id) {
    if (!confirm('Tem certeza que deseja sair deste workspace?')) return;
    try {
        const res = await apiFetch(`/workspaces/${id}/leave`, { method: 'POST' });
        if (!res) return;
        if (res.ok) { toast('Você saiu do workspace.', 'success'); await loadWorkspaces(); }
        else { const data = await res.json().catch(() => ({})); toast(data.message || 'Erro ao sair.', 'error'); }
    } catch { toast('Erro de conexão.', 'error'); }
}

/* ══════════════════════════════════════════════════
   MEMBROS
══════════════════════════════════════════════════ */
async function openMembersModal(workspaceId) {
    state.viewingMembersId = workspaceId;
    const ws = state.workspaces.find(w => w.id === workspaceId);
    document.getElementById('modal-members-title').textContent = ws?.name || 'Membros';
    document.getElementById('members-list').innerHTML = '<div class="members-empty">Carregando...</div>';
    openModal('modal-members');
    try {
        const res = await apiFetch(`/workspaces/${workspaceId}/members`);
        if (!res || !res.ok) throw new Error();
        renderMembers(await res.json());
    } catch { document.getElementById('members-list').innerHTML = '<div class="members-empty">Erro ao carregar membros.</div>'; }
}

function renderMembers(members) {
    const list = document.getElementById('members-list');
    if (!members.length) { list.innerHTML = '<div class="members-empty">Nenhum membro encontrado.</div>'; return; }
    list.innerHTML = members.map(m => {
        const roleClass = { Owner: 'role-owner', Admin: 'role-admin', Member: 'role-member' }[m.role] || 'role-member';
        const initials = m.userName.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
        return `<div class="member-row">
            <div class="member-avatar">${initials}</div>
            <div class="member-info">
                <div class="member-name">${escHtml(m.userName)}</div>
                <div class="member-email">${escHtml(m.email)}</div>
            </div>
            <span class="member-role-badge ${roleClass}">${m.role}</span>
        </div>`;
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

function openInviteModalDirect(wsId) {
    state.invitingWorkspaceId = wsId;
    state.viewingMembersId = wsId;
    document.getElementById('invite-email').value = '';
    document.getElementById('error-invite').classList.remove('visible');
    openModal('modal-invite');
    document.getElementById('invite-email').focus();
}

async function sendInvite() {
    const email = document.getElementById('invite-email').value.trim();
    const err = document.getElementById('error-invite');
    if (!email || !email.includes('@')) { err.classList.add('visible'); return; }
    err.classList.remove('visible');
    setLoading('btn-send-invite', 'invite-label', 'invite-spinner', 'Enviando...');
    try {
        const res = await apiFetch(`/workspaces/${state.invitingWorkspaceId}/invites`, {
            method: 'POST', body: JSON.stringify({ email })
        });
        if (!res) return;
        if (res.ok) { closeModal('modal-invite'); toast('Convite enviado.', 'success'); }
        else { const data = await res.json().catch(() => ({})); err.textContent = '  ' + (data.message || 'Erro ao enviar convite.'); err.classList.add('visible'); }
    } catch { err.textContent = '  Erro de conexão.'; err.classList.add('visible'); }
    finally { resetLoading('btn-send-invite', 'invite-label', 'invite-spinner', 'Enviar convite'); }
}

/* ══════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════ */
function handleLogout() { document.getElementById('logout-overlay').classList.remove('hidden'); }
function closeLogout() { document.getElementById('logout-overlay').classList.add('hidden'); }
function confirmLogout() {
    const btn = document.querySelector('.btn-logout-confirm');
    const label = document.getElementById('logout-label');
    const spinner = document.getElementById('logout-spinner');
    btn.disabled = true; label.textContent = 'Saindo...'; spinner.classList.remove('hidden');
    setTimeout(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'index.html'; }, 900);
}

/* ══════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════ */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function handleOverlayClick(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        ['modal-workspace', 'modal-invite', 'modal-members', 'modal-delete', 'logout-overlay'].forEach(id => closeModal(id));
});

/* ══════════════════════════════════════════════════
   UI HELPERS
══════════════════════════════════════════════════ */
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function setLoading(btnId, labelId, spinnerId, text) {
    const btn = document.getElementById(btnId); if (btn) btn.disabled = true;
    const label = document.getElementById(labelId); if (label) label.textContent = text;
    document.getElementById(spinnerId)?.classList.remove('hidden');
}
function resetLoading(btnId, labelId, spinnerId, text) {
    const btn = document.getElementById(btnId); if (btn) btn.disabled = false;
    const label = document.getElementById(labelId); if (label) label.textContent = text;
    document.getElementById(spinnerId)?.classList.add('hidden');
}

function toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}