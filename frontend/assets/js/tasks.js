'use strict';

const API = 'http://localhost:5000/api';

let allTasks     = [];
let workspaces   = [];
let columns      = [];
let currentFilter = 'all';

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
(async function init() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    loadUserInfo();
    const { theme, mode } = loadTheme();
    updateModeBtns(mode);
    updateThemeBtns(theme);

    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'urgent') currentFilter = 'urgent';

    await loadAll();
    await refreshUrgentBadges();
})();

/* ══════════════════════════════════════════════════
   LOAD
══════════════════════════════════════════════════ */
async function loadAll() {
    show('tasks-loading'); hide('tasks-list'); hide('tasks-empty');

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        };

        const [personalRes, wsRes] = await Promise.all([
            fetch(`${API}/tasks`, { headers }),
            fetch(`${API}/workspaces`, { headers })
        ]);

        const personalTasks = personalRes.ok ? await personalRes.json() : [];
        workspaces = wsRes.ok ? await wsRes.json() : [];

        const wsTasksAll = await Promise.all(
            workspaces.map(ws =>
                fetch(`${API}/tasks?workspaceId=${ws.id}`, { headers })
                    .then(r => r.ok ? r.json() : [])
                    .then(tasks => tasks.map(t => ({ ...t, _wsName: ws.name, _wsId: ws.id })))
            )
        );

        const wsColsAll = await Promise.all(
            workspaces.map(ws =>
                fetch(`${API}/columns?workspaceId=${ws.id}`, { headers })
                    .then(r => r.ok ? r.json() : [])
            )
        );
        columns = wsColsAll.flat();

        const personalColsRes = await fetch(`${API}/columns`, { headers });
        const personalCols = personalColsRes.ok ? await personalColsRes.json() : [];
        columns = [...personalCols, ...columns];

        // Tarefas da API (pessoais + workspaces)
        const apiTasks = [
            ...personalTasks.map(t => ({ ...t, _wsName: 'Pessoal', _wsId: null, _source: 'api' })),
            ...wsTasksAll.flat().map(t => ({ ...t, _source: 'api' }))
        ];

        // Tarefas do dashboard (localStorage)
        const dashboardTasks = loadDashboardTasks();

        // Merge: API primeiro, dashboard depois (grupo separado)
        allTasks = [...apiTasks, ...dashboardTasks];

        populateWsSelect();
        updateSummary();
        applyFilters();

        if (currentFilter !== 'all') {
            const btn = document.querySelector(`[data-filter="${currentFilter}"]`);
            if (btn) {
                document.querySelectorAll('.tasks-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        }

    } catch(e) {
        console.error(e);
        hide('tasks-loading');
        show('tasks-empty');
    }
}

/* ══════════════════════════════════════════════════
   DASHBOARD LOCAL TASKS
══════════════════════════════════════════════════ */
function loadDashboardTasks() {
    try {
        const raw = localStorage.getItem('taskflow_data');
        if (!raw) return [];
        const data = JSON.parse(raw);
        const tasks = data?.tasks || [];
        return tasks.map(t => ({
            id:          t.id,
            title:       t.title,
            description: t.desc || '',
            isCompleted: t.completed || false,
            dueDate:     t.date || null,
            status:      t.col || '',
            columnId:    null,
            _wsName:     'Meu Board',
            _wsId:       null,
            _source:     'dashboard'
        }));
    } catch (_) { return []; }
}

function populateWsSelect() {
    const sel = document.getElementById('filter-workspace');
    if (!sel) return;
    while (sel.options.length > 2) sel.remove(2);

    // Opção para o dashboard se houver tarefas
    const hasDashboard = allTasks.some(t => t._source === 'dashboard');
    if (hasDashboard) {
        const opt = document.createElement('option');
        opt.value = 'dashboard';
        opt.textContent = 'Meu Board';
        sel.appendChild(opt);
    }

    workspaces.forEach(ws => {
        const opt = document.createElement('option');
        opt.value = ws.id;
        opt.textContent = ws.name;
        sel.appendChild(opt);
    });
}

/* ══════════════════════════════════════════════════
   FILTROS
══════════════════════════════════════════════════ */
function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.tasks-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
}

function applyFilters() {
    const wsFilter   = document.getElementById('filter-workspace')?.value || 'all';
    const sortFilter = document.getElementById('filter-sort')?.value || 'date-asc';

    const today = new Date(); today.setHours(0,0,0,0);

    let filtered = allTasks.filter(t => {
        // Filtro de workspace
        if (wsFilter === 'personal' && (t._wsId !== null || t._source === 'dashboard')) return false;
        if (wsFilter === 'dashboard' && t._source !== 'dashboard') return false;
        if (wsFilter !== 'all' && wsFilter !== 'personal' && wsFilter !== 'dashboard') {
            if (t._wsId !== parseInt(wsFilter)) return false;
        }

        // Filtro de status
        if (currentFilter === 'done')    return t.isCompleted;
        if (currentFilter === 'pending') return !t.isCompleted;
        if (currentFilter === 'today') {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate); due.setHours(0,0,0,0);
            return due.getTime() === today.getTime();
        }
        if (currentFilter === 'urgent') {
            if (t.isCompleted || !t.dueDate) return false;
            const due  = new Date(t.dueDate);
            const diff = Math.floor((due - today) / 86400000);
            return diff >= -1 && diff <= 2;
        }
        return true;
    });

    filtered.sort((a, b) => {
        if (sortFilter === 'date-asc') {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (sortFilter === 'date-desc') {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(b.dueDate) - new Date(a.dueDate);
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    renderTasks(filtered);
    updateUrgentBadge();
}

/* ══════════════════════════════════════════════════
   SUMMARY
══════════════════════════════════════════════════ */
function updateSummary() {
    const today = new Date(); today.setHours(0,0,0,0);
    const urgent = allTasks.filter(t => {
        if (t.isCompleted || !t.dueDate) return false;
        const diff = Math.floor((new Date(t.dueDate) - today) / 86400000);
        return diff >= 0 && diff <= 2;
    });

    document.getElementById('sum-total').textContent   = allTasks.length;
    document.getElementById('sum-urgent').textContent  = urgent.length;
    document.getElementById('sum-pending').textContent = allTasks.filter(t => !t.isCompleted).length;
    document.getElementById('sum-done').textContent    = allTasks.filter(t =>  t.isCompleted).length;
}

function updateUrgentBadge() {
    const today = new Date(); today.setHours(0,0,0,0);
    const count = allTasks.filter(t => {
        if (t.isCompleted || !t.dueDate) return false;
        const diff = Math.floor((new Date(t.dueDate) - today) / 86400000);
        return diff >= 0 && diff <= 2;
    }).length;

    const badge = document.getElementById('urgent-badge');
    if (badge) { badge.textContent = count; badge.classList.toggle('hidden', count === 0); }

    const navBadge = document.getElementById('nav-tasks-badge');
    if (navBadge) { navBadge.textContent = count; navBadge.classList.toggle('hidden', count === 0); }
}

/* ══════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════ */
function renderTasks(tasks) {
    hide('tasks-loading');
    const list = document.getElementById('tasks-list');

    if (tasks.length === 0) {
        hide('tasks-list'); show('tasks-empty'); return;
    }
    hide('tasks-empty'); show('tasks-list');
    list.innerHTML = '';

    const groups = {};
    tasks.forEach(t => {
        const key = t._source === 'dashboard' ? 'dashboard' : (t._wsId ?? 'personal');
        if (!groups[key]) groups[key] = { name: t._wsName, tasks: [], id: key };
        groups[key].tasks.push(t);
    });

    const wsColors = ['#0052CC','#6554C0','#36B37E','#FF5630','#00B8D9','#403294','#E56910'];

    Object.values(groups).forEach((group, gi) => {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tasks-group-header';
        const dotColor = group.id === 'personal'
            ? '#6554C0'
            : group.id === 'dashboard'
                ? '#FF991F'
                : wsColors[gi % wsColors.length];
        groupHeader.innerHTML = `
            <div class="tasks-group-dot" style="background:${dotColor}"></div>
            <span class="tasks-group-name">${escHtml(group.name)}</span>
            <span class="tasks-group-count">${group.tasks.length}</span>`;
        list.appendChild(groupHeader);

        group.tasks.forEach(task => list.appendChild(buildTaskItem(task, dotColor)));
    });
}

function buildTaskItem(task, groupColor) {
    const item = document.createElement('div');
    item.className = `task-item ${task.isCompleted ? 'completed' : ''}`;

    const today = new Date(); today.setHours(0,0,0,0);
    let urgencyClass = 'ok';
    let dateText = '';
    let deadlinePill = '';

    if (task.isCompleted) {
        urgencyClass = 'done';
    } else if (task.dueDate) {
        const due  = new Date(task.dueDate);
        const diff = Math.floor((due - today) / 86400000);
        if (diff < 0)        { urgencyClass = 'overdue'; dateText = 'Em atraso'; deadlinePill = `<span class="task-deadline-pill overdue">Em atraso</span>`; }
        else if (diff === 0) { urgencyClass = 'today';   dateText = 'Vence hoje'; deadlinePill = `<span class="task-deadline-pill today">Hoje</span>`; }
        else if (diff <= 2)  { urgencyClass = 'soon';    dateText = `${diff}d`; deadlinePill = `<span class="task-deadline-pill soon">${diff === 1 ? 'Amanhã' : diff + ' dias'}</span>`; }
        else {
            urgencyClass = 'ok';
            dateText = new Date(task.dueDate).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
        }
    }

    const col = columns.find(c => c.id === task.columnId);
    const colDot  = col ? `<div class="task-item-col-dot" style="background:${col.color}"></div>` : '';
    const colName = col ? escHtml(col.name) : (task.status || '');

    const wsBadgeClass = (task._wsId || task._source === 'dashboard') ? '' : 'personal';
    const wsLabel      = escHtml(task._wsName);

    item.innerHTML = `
        <div class="task-item-urgency ${urgencyClass}"></div>
        <div class="task-item-check">
            <span class="task-item-check-icon">✓</span>
        </div>
        <div class="task-item-body">
            <div class="task-item-title">${escHtml(task.title)}</div>
            <div class="task-item-meta">
                <span class="task-item-workspace ${wsBadgeClass}">${wsLabel}</span>
                ${colName ? `<span class="task-item-col">${colDot}${colName}</span>` : ''}
            </div>
        </div>
        <div class="task-item-date">
            ${dateText ? `<span class="task-item-date-text ${urgencyClass}">${dateText}</span>` : ''}
            ${deadlinePill}
        </div>`;

    item.addEventListener('click', () => {
        if (task._source === 'dashboard') {
            location.href = 'dashboard.html';
        } else if (task._wsId) {
            location.href = `workspaceBoard.html?id=${task._wsId}`;
        } else {
            location.href = 'dashboard.html';
        }
    });

    return item;
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
    btn.disabled = true; label.textContent = 'Saindo...'; spinner.classList.remove('hidden');
    setTimeout(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'index.html'; }, 900);
}

/* ── HELPERS ── */
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
