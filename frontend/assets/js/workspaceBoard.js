'use strict';

const API = 'http://localhost:5000/api';

const THEME_BG = {
    blue: '#0052CC', teal: '#007A94', green: '#0B6E4F',
    purple: '#403294', slate: '#2C3E50', crimson: '#8B1A2B', midnight: '#1A1A2E',
};

// Pega workspaceId da URL
const params      = new URLSearchParams(window.location.search);
const workspaceId = parseInt(params.get('id'));

let state = {
    tasks: [],
    workspace: null,
    myRole: null,
    theme: 'blue',
    mode: 'dark',
    editingId: null,
    targetCol: 'Todo',
};

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
(async function init() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    if (!workspaceId) { window.location.href = 'workspace.html'; return; }

    // Usuário
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

    // Tema
    const saved = loadTheme();
    if (saved) { state.theme = saved.theme; state.mode = saved.mode; }
    applyTheme(state.theme, state.mode, false);
    updateModeBtns();
    updateThemeBtns();

    await Promise.all([loadWorkspace(), loadTasks()]);
})();

/* ══════════════════════════════════════════════════
   API
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
   LOAD WORKSPACE INFO
   ══════════════════════════════════════════════════ */
async function loadWorkspace() {
    try {
        const res = await apiFetch(`/workspaces/${workspaceId}`);
        if (!res || !res.ok) { window.location.href = 'workspace.html'; return; }

        state.workspace = await res.json();
        state.myRole    = state.workspace.userRole;

        // Atualiza topbar
        document.getElementById('board-title').textContent = `🏢 ${state.workspace.name}`;
        document.title = `TaskFlow – ${state.workspace.name}`;

        // Badge de role
        const badge = document.getElementById('board-role-badge');
        badge.textContent = state.myRole;
        badge.classList.remove('hidden');

        // Role na sidebar
        document.getElementById('user-role').textContent = state.myRole;

        // Carrega membros
        loadMembers();
    } catch (err) {
        console.error('Erro ao carregar workspace:', err);
    }
}

async function loadMembers() {
    try {
        const res = await apiFetch(`/workspaces/${workspaceId}/members`);
        if (!res || !res.ok) return;

        const members = await res.json();
        const container = document.getElementById('board-members');
        container.innerHTML = '';

        const colors = ['#0052CC','#6554C0','#36B37E','#FF5630','#00B8D9','#403294'];
        const visible = members.slice(0, 4);
        const extra   = members.length - visible.length;

        visible.forEach((m, i) => {
            const av = document.createElement('div');
            av.className = 'board-avatar';
            av.style.background = colors[i % colors.length];
            av.title = m.userName;
            av.textContent = m.userName.split(' ').slice(0,2).map(w => w[0].toUpperCase()).join('');
            container.appendChild(av);
        });

        if (extra > 0) {
            const more = document.createElement('div');
            more.className = 'board-avatar-more';
            more.textContent = `+${extra}`;
            container.appendChild(more);
        }
    } catch (_) {}
}

/* ══════════════════════════════════════════════════
   LOAD TASKS
   ══════════════════════════════════════════════════ */
async function loadTasks() {
    try {
        const res = await apiFetch(`/tasks?workspaceId=${workspaceId}`);
        if (!res || !res.ok) throw new Error();

        state.tasks = await res.json();
        document.getElementById('board-loading').classList.add('hidden');
        document.getElementById('kanban-board').classList.remove('hidden');
        render();
    } catch (err) {
        document.getElementById('board-loading').innerHTML =
            '<div style="text-align:center;color:var(--text-secondary)">⚠ Erro ao carregar tarefas.</div>';
    }
}

/* ══════════════════════════════════════════════════
   RENDER KANBAN
   ══════════════════════════════════════════════════ */
function render() {
    const cols = {
        'Todo':       { list: 'list-todo',     count: 'count-todo'     },
        'InProgress': { list: 'list-progress', count: 'count-progress' },
        'Done':       { list: 'list-done',     count: 'count-done'     },
    };

    Object.entries(cols).forEach(([colKey, ids]) => {
        const list  = document.getElementById(ids.list);
        const count = document.getElementById(ids.count);
        if (!list || !count) return;

        const colTasks = state.tasks.filter(t => t.status === colKey);
        count.textContent = colTasks.length;

        list.innerHTML = '';
        if (colTasks.length === 0) {
            list.innerHTML = `<div class="empty-state">Nenhuma tarefa aqui.</div>`;
            return;
        }

        colTasks.forEach(task => list.appendChild(buildCard(task)));
    });
}

function buildCard(task) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = task.id;

    const canDelete = state.myRole === 'Owner' || state.myRole === 'Admin';

    const dateStr = task.dueDate
        ? `<div class="card-date">📅 ${formatDisplay(task.dueDate)}</div>`
        : '';

    let actions = '';
    if (task.status === 'Todo') {
        actions = `
            <div class="card-actions">
                <button class="card-btn btn-progress" onclick="moveTask(${task.id},'InProgress')">▶ Andamento</button>
                ${canDelete ? `<button class="card-btn btn-delete" onclick="deleteTask(${task.id})">✕ Remover</button>` : ''}
            </div>`;
    } else if (task.status === 'InProgress') {
        actions = `
            <div class="card-actions">
                <button class="card-btn btn-done" onclick="moveTask(${task.id},'Done')">✔ Concluir</button>
                ${canDelete ? `<button class="card-btn btn-delete" onclick="deleteTask(${task.id})">✕ Remover</button>` : ''}
            </div>`;
    } else {
        actions = `
            <div class="card-actions">
                <button class="card-btn btn-progress" onclick="moveTask(${task.id},'Todo')">↩ Reabrir</button>
                ${canDelete ? `<button class="card-btn btn-delete" onclick="deleteTask(${task.id})">✕ Remover</button>` : ''}
            </div>`;
    }

    card.innerHTML = `
        <div class="card-title">${escHtml(task.title)}</div>
        ${task.description ? `<div class="card-desc">${escHtml(task.description)}</div>` : ''}
        ${dateStr}
        ${actions}
    `;

    card.querySelector('.card-title').addEventListener('click', () => openModal(task.status, task.id));
    return card;
}

/* ══════════════════════════════════════════════════
   TASK ACTIONS
   ══════════════════════════════════════════════════ */
async function moveTask(id, newStatus) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    try {
        const res = await apiFetch(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: task.title,
                description: task.description || '',
                isCompleted: newStatus === 'Done',
                dueDate: task.dueDate || null,
                status: newStatus
            })
        });
        if (!res || !res.ok) return;

        task.status      = newStatus;
        task.isCompleted = newStatus === 'Done';
        render();
    } catch (err) {
        console.error('Erro ao mover tarefa:', err);
    }
}

async function deleteTask(id) {
    // Remove o confirm() nativo e usa modal próprio
    openDeleteModal(id);
}

function openDeleteModal(id) {
    state.deletingTaskId = id;
    document.getElementById('modal-delete-task').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('modal-delete-task').classList.add('hidden');
    state.deletingTaskId = null;
}

async function confirmDeleteTask() {
    if (!state.deletingTaskId) return;
    const id = state.deletingTaskId;
    closeDeleteModal();

    try {
        const res = await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
        if (!res || !res.ok) return;
        state.tasks = state.tasks.filter(t => t.id !== id);
        render();
    } catch (err) {
        console.error('Erro ao deletar tarefa:', err);
    }
}

/* ══════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════ */
function openModal(col = 'Todo', editId = null) {
    state.targetCol = col;
    state.editingId = editId;

    const overlay = document.getElementById('modal-overlay');
    const title   = document.getElementById('modal-title');
    const inp     = document.getElementById('task-title');
    const desc    = document.getElementById('task-desc');
    const dateSel = document.getElementById('task-date');
    const colSel  = document.getElementById('task-col');
    const err     = document.getElementById('error-msg');

    err.classList.remove('visible');

    if (editId) {
        const task = state.tasks.find(t => t.id === editId);
        if (!task) return;
        title.textContent = 'Editar tarefa';
        inp.value     = task.title;
        desc.value    = task.description || '';
        dateSel.value = task.dueDate ? task.dueDate.split('T')[0] : '';
        colSel.value  = task.status;
        document.getElementById('save-label').textContent = 'Salvar alterações';
    } else {
        title.textContent = 'Nova tarefa';
        inp.value     = '';
        desc.value    = '';
        dateSel.value = '';
        colSel.value  = col;
        document.getElementById('save-label').textContent = 'Salvar tarefa';
    }

    overlay.classList.remove('hidden');
    inp.focus();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    state.editingId = null;
}

function handleOverlayClick(e) {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
}

async function saveTask() {
    const inp     = document.getElementById('task-title');
    const desc    = document.getElementById('task-desc');
    const dateSel = document.getElementById('task-date');
    const colSel  = document.getElementById('task-col');
    const err     = document.getElementById('error-msg');
    const btn     = document.getElementById('btn-save');
    const label   = document.getElementById('save-label');
    const spinner = document.getElementById('save-spinner');

    const titleVal = inp.value.trim();
    if (!titleVal) { err.classList.add('visible'); inp.focus(); return; }
    err.classList.remove('visible');

    btn.disabled = true;
    label.textContent = 'Salvando…';
    spinner.classList.remove('hidden');

    try {
        if (state.editingId) {
            // Editar
            const task = state.tasks.find(t => t.id === state.editingId);
            const res  = await apiFetch(`/tasks/${state.editingId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title:       titleVal,
                    description: desc.value.trim(),
                    isCompleted: colSel.value === 'Done',
                    dueDate:     dateSel.value || null,
                    status:      colSel.value
                })
            });
            if (res && res.ok) {
                const updated = await res.json();
                Object.assign(task, updated);
            }
        } else {
            // Criar
            const res = await apiFetch('/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title:       titleVal,
                    description: desc.value.trim(),
                    dueDate:     dateSel.value || null,
                    status:      colSel.value,
                    workspaceId: workspaceId
                })
            });
            if (res && res.ok) {
                const created = await res.json();
                state.tasks.push(created);
            }
        }

        render();
        closeModal();
    } catch (err) {
        console.error('Erro ao salvar tarefa:', err);
    } finally {
        btn.disabled = false;
        label.textContent = state.editingId ? 'Salvar alterações' : 'Salvar tarefa';
        spinner.classList.add('hidden');
    }
}

/* ══════════════════════════════════════════════════
   TEMA
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
    const btn     = document.querySelector('.btn-logout-confirm');
    const label   = document.getElementById('logout-label');
    const spinner = document.getElementById('logout-spinner');
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
   KEYBOARD
   ══════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!document.getElementById('modal-overlay').classList.contains('hidden')) saveTask();
    }
});

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDisplay(iso) {
    if (!iso) return '';
    const d     = new Date(iso);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff  = Math.floor((d - today) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'amanhã';
    if (diff === -1) return 'ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}