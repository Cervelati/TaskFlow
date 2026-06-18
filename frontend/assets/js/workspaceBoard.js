'use strict';

const API = 'http://localhost:5000/api';

const params      = new URLSearchParams(window.location.search);
const workspaceId = parseInt(params.get('id'));

const COVER_COLORS = [
    '#0065FF','#6554C0','#36B37E','#FF5630','#00B8D9',
    '#FF991F','#403294','#006644','#BF2600','#172B4D',
    '#1D7AFC','#E56910','#943D73','#5E4DB2','#216E4E',
];

let state = {
    tasks:          [],
    columns:        [],
    workspace:      null,
    myRole:         null,
    completionMode: 'column',
    editingId:      null,
    targetColId:    null,
    deletingTaskId: null,
    colMeta:        {},
    taskChecklists: {},
};

/* ══════════════════════════════════════════════════
   PERSISTÊNCIA LOCAL
══════════════════════════════════════════════════ */
function loadLocal() {
    try { const cm = localStorage.getItem(`tf_colmeta_${workspaceId}`);    if (cm) state.colMeta        = JSON.parse(cm); } catch (_) {}
    try { const tc = localStorage.getItem(`tf_checklists_${workspaceId}`); if (tc) state.taskChecklists = JSON.parse(tc); } catch (_) {}
}
function saveColMeta()    { localStorage.setItem(`tf_colmeta_${workspaceId}`,    JSON.stringify(state.colMeta)); }
function saveChecklists() { localStorage.setItem(`tf_checklists_${workspaceId}`, JSON.stringify(state.taskChecklists)); }
function getColMeta(colId)      { if (!state.colMeta[colId])        state.colMeta[colId]        = { tags: [] }; return state.colMeta[colId]; }
function getTaskChecklist(tid)  { if (!state.taskChecklists[tid])   state.taskChecklists[tid]   = [];           return state.taskChecklists[tid]; }

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
(async function init() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }
    if (!workspaceId) { window.location.href = 'workspace.html'; return; }

    loadLocal();

    const { theme, mode } = loadTheme();
    updateModeBtns(mode);
    updateThemeBtns(theme);

    loadUserInfo();
    refreshUrgentBadges();

    await Promise.all([loadWorkspace(), loadColumns()]);
    injectColEditPanel();
})();
/* ══════════════════════════════════════════════════
   API
══════════════════════════════════════════════════ */
function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}
async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers||{}) } });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return res;
}

/* ══════════════════════════════════════════════════
   WORKSPACE
══════════════════════════════════════════════════ */
async function loadWorkspace() {
    try {
        const res = await apiFetch(`/workspaces/${workspaceId}`);
        if (!res || !res.ok) { window.location.href = 'workspace.html'; return; }
        state.workspace      = await res.json();
        state.myRole         = state.workspace.userRole;
        state.completionMode = state.workspace.completionMode || 'column';

        document.getElementById('board-title').textContent = `🏢 ${state.workspace.name}`;
        document.title = `TaskFlow – ${state.workspace.name}`;

        const badge = document.getElementById('board-role-badge');
        badge.textContent = state.myRole;
        badge.classList.remove('hidden');

        const roleEl = document.getElementById('user-role');
        if (roleEl) roleEl.textContent = state.myRole;

        loadMembers();
    } catch (e) { console.error(e); }
}

async function loadMembers() {
    try {
        const res = await apiFetch(`/workspaces/${workspaceId}/members`);
        if (!res || !res.ok) return;
        const members   = await res.json();
        const container = document.getElementById('board-members');
        container.innerHTML = '';
        const colors = ['#0052CC','#6554C0','#36B37E','#FF5630','#00B8D9','#403294'];
        members.slice(0,4).forEach((m,i) => {
            const av = document.createElement('div');
            av.className       = 'board-avatar';
            av.style.background = colors[i % colors.length];
            av.title           = m.userName;
            av.textContent     = m.userName.split(' ').slice(0,2).map(w=>w[0].toUpperCase()).join('');
            container.appendChild(av);
        });
        if (members.length > 4) {
            const more = document.createElement('div');
            more.className   = 'board-avatar-more';
            more.textContent = `+${members.length-4}`;
            container.appendChild(more);
        }
    } catch (_) {}
}

/* ══════════════════════════════════════════════════
   COLUMNS
══════════════════════════════════════════════════ */
async function loadColumns() {
    try {
        const res = await apiFetch(`/columns?workspaceId=${workspaceId}`);
        if (!res || !res.ok) throw new Error();
        state.columns = await res.json();
        await loadTasks();
    } catch {
        state.columns = [
            { id: 1, name: 'A fazer',      color: '#DFE1E6', position: 0, isFinished: false },
            { id: 2, name: 'Em andamento', color: '#0065FF', position: 1, isFinished: false },
            { id: 3, name: 'Concluído',    color: '#36B37E', position: 2, isFinished: true  },
        ];
        await loadTasks();
    }
}

async function addColumn() {
    if (state.myRole !== 'Owner' && state.myRole !== 'Admin') return;
    try {
        const res = await apiFetch('/columns', {
            method: 'POST',
            body: JSON.stringify({ name: 'Nova coluna', color: '#DFE1E6', workspaceId, isFinished: false })
        });
        if (!res || !res.ok) return;
        state.columns.push(await res.json());
        updateColSelect();
        render();
    } catch {}
}

async function saveColumnFull(colId, name, color, isFinished) {
    const col = state.columns.find(c => c.id === colId);
    if (!col) return;

    if (isFinished) state.columns.forEach(c => { c.isFinished = false; });
    col.name       = name;
    col.color      = color;
    col.isFinished = isFinished;

    try {
        if (isFinished) {
            // atualiza todas para garantir que só uma fique como finished
            await Promise.all(state.columns.map(c =>
                apiFetch(`/columns/${c.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name: c.name, color: c.color, position: c.position, isFinished: c.isFinished })
                })
            ));
        } else {
            await apiFetch(`/columns/${colId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, color, position: col.position, isFinished })
            });
        }
    } catch {}

    updateColSelect();
    render();
}

async function saveColumnName(colId, newName) {
    const col = state.columns.find(c => c.id === colId);
    if (!col) return;
    try {
        await apiFetch(`/columns/${colId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: newName, color: col.color, position: col.position, isFinished: col.isFinished })
        });
        col.name = newName;
        updateColSelect();
        render();
    } catch {}
}

async function deleteColumn(colId) {
    if (state.myRole !== 'Owner' && state.myRole !== 'Admin') return;
    try {
        const res = await apiFetch(`/columns/${colId}`, { method: 'DELETE' });
        if (!res || !res.ok) return;
        state.columns    = state.columns.filter(c => c.id !== colId);
        state.tasks      = state.tasks.filter(t => t.columnId !== colId);
        delete state.colMeta[colId];
        saveColMeta();
        updateColSelect();
        render();
    } catch {}
}

function updateColSelect() {
    const colSel = document.getElementById('task-col');
    if (!colSel) return;
    colSel.innerHTML = state.columns
        .map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`)
        .join('');
}

/* ══════════════════════════════════════════════════
   PAINEL DE EDIÇÃO DE COLUNA
══════════════════════════════════════════════════ */
let editingColId = null;

function injectColEditPanel() {
    if (document.getElementById('col-edit-overlay')) return;

    const swatches = COVER_COLORS.map(c =>
        `<div class="col-edit-color-swatch" style="background:${c}" data-color="${c}" onclick="colEditPickColor('${c}')"></div>`
    ).join('');

    document.body.insertAdjacentHTML('beforeend', `
    <div class="col-edit-overlay hidden" id="col-edit-overlay" onclick="handleColEditOverlay(event)">
        <div class="col-edit-panel">
            <div class="col-edit-header">
                <h3>Editar coluna</h3>
                <button class="col-edit-close" onclick="closeColEditPanel()">✕</button>
            </div>
            <div class="col-edit-body">
                <div class="col-edit-cover-preview" id="col-edit-preview"></div>
                <div>
                    <div class="col-edit-section-label">Título</div>
                    <input class="col-edit-name-input" id="col-edit-name" type="text" maxlength="40" placeholder="Nome da coluna" />
                </div>
                <div>
                    <div class="col-edit-section-label">Cor da capa</div>
                    <div class="col-edit-colors">
                        ${swatches}
                        <div class="col-edit-color-custom" title="Cor personalizada">
                            🎨
                            <input type="color" id="col-edit-custom-color" oninput="colEditPickColor(this.value)" />
                        </div>
                    </div>
                </div>
                <div>
                    <div class="col-edit-section-label">Etiquetas da coluna</div>
                    <div class="col-edit-tags-list" id="col-edit-tags-list"></div>
                    <div class="col-edit-tag-add">
                        <input class="col-edit-tag-input" id="col-edit-tag-input" type="text"
                            maxlength="24" placeholder="Nova etiqueta..."
                            onkeydown="if(event.key==='Enter') addTagToCol()" />
                        <div class="col-edit-tag-color" id="col-edit-tag-color-wrap" style="background:#0052CC">
                            <input type="color" id="col-edit-tag-color" value="#0052CC"
                                oninput="document.getElementById('col-edit-tag-color-wrap').style.background=this.value" />
                        </div>
                        <button class="col-edit-tag-btn" onclick="addTagToCol()">+ Adicionar</button>
                    </div>
                </div>
                <div class="col-edit-finish-row" onclick="colEditToggleFinish()">
                    <span class="col-edit-finish-row-label">✔ Coluna de conclusão</span>
                    <div class="col-edit-finish-toggle" id="col-edit-finish-toggle"></div>
                </div>
            </div>
            <div class="col-edit-footer">
                <button class="col-edit-delete-btn" onclick="colEditDelete()">🗑 Remover coluna</button>
                <button class="col-edit-save-btn" onclick="colEditSave()">Salvar</button>
            </div>
        </div>
    </div>`);
}

function openColEditPanel(colId) {
    const col = state.columns.find(c => c.id === colId);
    if (!col) return;
    editingColId = colId;

    document.getElementById('col-edit-preview').style.background = col.color;
    document.querySelectorAll('.col-edit-color-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.color === col.color));
    document.getElementById('col-edit-name').value = col.name;
    document.getElementById('col-edit-finish-toggle').classList.toggle('on', !!col.isFinished);

    renderColEditTags(colId);
    document.getElementById('col-edit-overlay').classList.remove('hidden');
    document.getElementById('col-edit-name').focus();
}

function closeColEditPanel() {
    document.getElementById('col-edit-overlay').classList.add('hidden');
    editingColId = null;
}

function handleColEditOverlay(e) {
    if (e.target === document.getElementById('col-edit-overlay')) closeColEditPanel();
}

function colEditPickColor(hex) {
    document.getElementById('col-edit-preview').style.background = hex;
    document.querySelectorAll('.col-edit-color-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.color === hex));
}

function colEditToggleFinish() {
    document.getElementById('col-edit-finish-toggle').classList.toggle('on');
}

function renderColEditTags(colId) {
    const meta = getColMeta(colId);
    const list = document.getElementById('col-edit-tags-list');
    list.innerHTML = meta.tags.length === 0
        ? `<span style="font-size:11px;color:#97A0AF">Nenhuma etiqueta ainda</span>`
        : meta.tags.map((tag, i) => `
            <span class="col-tag-pill" style="background:${tag.bg};color:${tag.text}">
                ${escHtml(tag.label)}
                <button class="col-tag-pill-remove" onclick="removeTagFromCol(${i})">✕</button>
            </span>`).join('');
}

function addTagToCol() {
    if (!editingColId) return;
    const input = document.getElementById('col-edit-tag-input');
    const label = input.value.trim();
    if (!label) return;
    const hex  = document.getElementById('col-edit-tag-color').value;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    getColMeta(editingColId).tags.push({ label, bg: `rgba(${r},${g},${b},0.18)`, text: hex });
    saveColMeta();
    input.value = '';
    renderColEditTags(editingColId);
}

function removeTagFromCol(index) {
    if (!editingColId) return;
    getColMeta(editingColId).tags.splice(index, 1);
    saveColMeta();
    renderColEditTags(editingColId);
}

async function colEditSave() {
    if (!editingColId) return;
    const name     = document.getElementById('col-edit-name').value.trim() || 'Sem nome';
    const color    = document.getElementById('col-edit-preview').style.background;
    const finished = document.getElementById('col-edit-finish-toggle').classList.contains('on');
    await saveColumnFull(editingColId, name, color, finished);
    closeColEditPanel();
}

let _deletingColId = null;

function colEditDelete() {
    if (!editingColId) return;
    _deletingColId = editingColId;

    const col      = state.columns.find(c => c.id === editingColId);
    const colTasks = state.tasks.filter(t => t.columnId === editingColId).length;

    const descEl   = document.getElementById('modal-delete-col-desc');
    const confirmBtn = document.getElementById('btn-confirm-delete-col');

    if (colTasks > 0) {
        descEl.textContent = `A coluna "${col?.name}" tem ${colTasks} tarefa(s). Mova ou remova as tarefas antes de deletar.`;
        confirmBtn.style.display = 'none';
    } else {
        descEl.textContent = `Tem certeza que deseja remover a coluna "${col?.name}"? Esta ação é irreversível.`;
        confirmBtn.style.display = '';
    }

    closeColEditPanel();
    document.getElementById('modal-delete-col').classList.remove('hidden');
}

async function confirmColDelete() {
    if (!_deletingColId) return;

    const btn    = document.getElementById('btn-confirm-delete-col');
    const label  = document.getElementById('delete-col-label');
    const spinner = document.getElementById('delete-col-spinner');
    btn.disabled = true;
    label.textContent = 'Removendo...';
    spinner.classList.remove('hidden');

    const res = await apiFetch(`/columns/${_deletingColId}`, { method: 'DELETE' });

    if (res?.status === 409) {
        document.getElementById('modal-delete-col').classList.add('hidden');
        toast('Mova ou remova as tarefas antes de deletar esta coluna.', 'error');
    } else if (res?.ok) {
        state.columns = state.columns.filter(c => c.id !== _deletingColId);
        state.tasks   = state.tasks.filter(t => t.columnId !== _deletingColId);
        delete state.colMeta[_deletingColId];
        saveColMeta();
        updateColSelect();
        render();
        document.getElementById('modal-delete-col').classList.add('hidden');
    } else {
        toast('Erro ao remover coluna.', 'error');
    }

    btn.disabled = false;
    label.textContent = 'Remover';
    spinner.classList.add('hidden');
    _deletingColId = null;
}
/* ══════════════════════════════════════════════════
   TASKS
══════════════════════════════════════════════════ */
async function loadTasks() {
    try {
        const res = await apiFetch(`/tasks?workspaceId=${workspaceId}`);
        if (!res || !res.ok) throw new Error();
        state.tasks = await res.json();
        document.getElementById('board-loading').classList.add('hidden');
        document.getElementById('kanban-board').classList.remove('hidden');
        updateColSelect();
        render();
    } catch {
        document.getElementById('board-loading').innerHTML =
            '<div style="text-align:center;color:var(--text-secondary)">⚠ Erro ao carregar tarefas.</div>';
    }
}

/* ══════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════ */
function render() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';
    const canEdit = state.myRole === 'Owner' || state.myRole === 'Admin';

    state.columns.forEach(col => {
        // ← FILTRO POR ID, não por nome — resolve a duplicação
        const colTasks = state.tasks.filter(t => t.columnId === col.id);
        board.appendChild(buildColumn(col, colTasks, canEdit));
    });

    if (canEdit) {
        const addBtn = document.createElement('div');
        addBtn.className = 'add-column-btn';
        addBtn.innerHTML = `<button onclick="addColumn()">+ Adicionar coluna</button>`;
        board.appendChild(addBtn);
    }
}

function buildColumn(col, tasks, canEdit) {
    const wrap = document.createElement('div');
    wrap.className = 'column';
    if (col.isFinished && state.completionMode === 'column') wrap.classList.add('col-finished');
    wrap.dataset.colId = col.id;

    // Capa clicável
    const cover = document.createElement('div');
    cover.className        = 'col-cover';
    cover.style.background = col.color;
    cover.innerHTML        = `<div class="col-cover-edit-hint">✏ Editar coluna</div>`;
    if (canEdit) cover.addEventListener('click', () => openColEditPanel(col.id));
    wrap.appendChild(cover);

    // Header
    const header = document.createElement('div');
    header.className = 'col-header';

    const left = document.createElement('div');
    left.className = 'col-header-left';

    const nameEl = canEdit
        ? (() => {
            const inp = document.createElement('input');
            inp.className = 'col-name-input';
            inp.value = col.name;
            inp.addEventListener('blur',    () => saveColumnName(col.id, inp.value));
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
            return inp;
          })()
        : (() => {
            const span = document.createElement('span');
            span.className   = 'col-title';
            span.textContent = col.name;
            return span;
          })();

    const count = document.createElement('span');
    count.className   = 'col-count';
    count.textContent = tasks.length;

    left.appendChild(nameEl);
    left.appendChild(count);
    header.appendChild(left);
    wrap.appendChild(header);

    // Badge de conclusão
    if (col.isFinished && state.completionMode === 'column') {
        const bw = document.createElement('div');
        bw.className = 'col-finished-badge-wrap';
        bw.innerHTML = `<span class="col-finished-badge">✔ Conclusão</span>`;
        wrap.appendChild(bw);
    }

    // Cards
    const cardsList = document.createElement('div');
    cardsList.className = 'cards-list';
    if (tasks.length === 0) {
        cardsList.innerHTML = `<div class="empty-state">Nenhuma tarefa aqui.</div>`;
    } else {
        tasks.forEach(task => cardsList.appendChild(buildCard(task, col)));
    }
    wrap.appendChild(cardsList);

    // Add card
    const addBtn = document.createElement('button');
    addBtn.className   = 'add-card-btn';
    addBtn.textContent = '+ Adicionar tarefa';
    addBtn.addEventListener('click', () => openModal(col.id));
    wrap.appendChild(addBtn);

    return wrap;
}

function buildCard(task, col) {
    const card = document.createElement('div');
    card.className = 'card';
    if (task.isCompleted) card.classList.add('card-completed');
    card.dataset.id = task.id;

    const canDelete = state.myRole === 'Owner' || state.myRole === 'Admin';
    const meta      = getColMeta(col.id);

    const tagsHtml = meta.tags.length > 0
        ? `<div class="card-tags">${meta.tags.map(t =>
            `<span class="card-tag-pill" style="background:${t.bg};color:${t.text}">${escHtml(t.label)}</span>`
          ).join('')}</div>`
        : '';

    const dateStr = task.dueDate
        ? `<div class="card-date">📅 ${formatDisplay(task.dueDate)} ${deadlineBadge(task.dueDate)}</div>`
        : '';

    const otherCols    = state.columns.filter(c => c.id !== col.id);
    const moveDropdown = otherCols.length > 0 ? `
        <div class="card-move-wrap">
            <button class="card-btn btn-move" onclick="event.stopPropagation(); toggleMoveMenu(this)">↔ Mover</button>
            <div class="move-menu hidden">
                ${otherCols.map(c => `
                    <div class="move-menu-item"
                        onclick="event.stopPropagation(); moveTask(${task.id}, ${c.id}); closeMoveMenus()">
                        ${c.isFinished && state.completionMode==='column' ? '✔ ' : ''}${escHtml(c.name)}
                    </div>`).join('')}
            </div>
        </div>` : '';

    const deleteBtn = canDelete
        ? `<button class="card-btn btn-delete" onclick="event.stopPropagation(); openDeleteModal(${task.id})">✕ Remover</button>`
        : '';

    card.innerHTML = `
        ${tagsHtml}
        <div class="card-title ${task.isCompleted ? 'card-title-done' : ''}">${escHtml(task.title)}</div>
        ${task.description ? `<div class="card-desc">${escHtml(task.description)}</div>` : ''}
        ${dateStr}
        <div class="card-actions">${moveDropdown}${deleteBtn}</div>`;

    if (state.completionMode === 'checkbox') {
        card.appendChild(buildChecklist(task));
    }

    card.querySelector('.card-title').addEventListener('click', () => openModal(col.id, task.id));
    return card;
}

/* ══════════════════════════════════════════════════
   CHECKLIST
══════════════════════════════════════════════════ */
function buildChecklist(task) {
    const items   = getTaskChecklist(task.id);
    const total   = items.length;
    const done    = items.filter(i => i.checked).length;
    const pct     = total > 0 ? Math.round((done/total)*100) : 0;
    const allDone = total > 0 && done === total;

    const wrap = document.createElement('div');
    wrap.className = 'card-checklist';

    wrap.innerHTML = `
        <div class="card-checklist-header">
            <span class="card-checklist-title">☑ Checklist</span>
            <span class="card-checklist-count ${allDone?'done':''}">${done}/${total}</span>
        </div>
        ${total > 0 ? `<div class="checklist-progress-bar">
            <div class="checklist-progress-fill ${allDone?'complete':''}" style="width:${pct}%"></div>
        </div>` : ''}`;

    const list = document.createElement('div');
    list.className = 'checklist-items';
    items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = `checklist-item ${item.checked ? 'checked' : ''}`;
        row.innerHTML = `
            <div class="checklist-item-check"><span class="checklist-item-check-icon">✓</span></div>
            <span class="checklist-item-label">${escHtml(item.label)}</span>`;
        row.addEventListener('click', e => { e.stopPropagation(); toggleChecklistItem(task.id, idx); });
        list.appendChild(row);
    });
    wrap.appendChild(list);

    const addRow = document.createElement('div');
    addRow.className = 'checklist-add-row';
    addRow.innerHTML = `
        <input class="checklist-add-input" placeholder="Adicionar item..." maxlength="80"
            onclick="event.stopPropagation()"
            onkeydown="if(event.key==='Enter'){event.stopPropagation();addChecklistItem(${task.id},this)}" />
        <button class="checklist-add-btn"
            onclick="event.stopPropagation();addChecklistItem(${task.id},this.previousElementSibling)">+</button>`;
    wrap.appendChild(addRow);
    return wrap;
}

function toggleChecklistItem(taskId, idx) {
    const items = getTaskChecklist(taskId);
    if (!items[idx]) return;
    items[idx].checked = !items[idx].checked;
    saveChecklists();
    const task = state.tasks.find(t => t.id === taskId);
    if (task) task.isCompleted = items.length > 0 && items.every(i => i.checked);
    render();
}

function addChecklistItem(taskId, input) {
    const label = input.value.trim();
    if (!label) return;
    getTaskChecklist(taskId).push({ id: Date.now(), label, checked: false });
    saveChecklists();
    input.value = '';
    render();
}

/* ══════════════════════════════════════════════════
   MOVER TASK
══════════════════════════════════════════════════ */
async function moveTask(taskId, destColId) {
    const task    = state.tasks.find(t => t.id === taskId);
    const destCol = state.columns.find(c => c.id === destColId);
    if (!task || !destCol) return;

    const isFinished = destCol.isFinished === true && state.completionMode === 'column';

    try {
        const res = await apiFetch(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({
                title:       task.title,
                description: task.description || '',
                isCompleted: isFinished,
                dueDate:     task.dueDate || null,
                status:      destCol.name,
                columnId:    destColId        // ← id direto
            })
        });
        if (!res || !res.ok) return;
        task.columnId    = destColId;
        task.status      = destCol.name;
        task.isCompleted = isFinished;
        render();
    } catch (e) { console.error(e); }
}

function toggleMoveMenu(btn) {
    const menu   = btn.nextElementSibling;
    const isOpen = !menu.classList.contains('hidden');
    closeMoveMenus();
    if (!isOpen) menu.classList.remove('hidden');
}
function closeMoveMenus() {
    document.querySelectorAll('.move-menu').forEach(m => m.classList.add('hidden'));
}
document.addEventListener('click', closeMoveMenus);

/* ══════════════════════════════════════════════════
   DEADLINE
══════════════════════════════════════════════════ */
function deadlineBadge(iso) {
    if (!iso) return '';
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(iso);
    const diff  = Math.floor((due - today) / 86400000);
    if (diff < 0)   return `<span class="deadline-badge overdue">🔴 Em atraso</span>`;
    if (diff === 0) return `<span class="deadline-badge today">🟡 Vence hoje</span>`;
    if (diff === 1) return `<span class="deadline-badge soon">🟡 Vence amanhã</span>`;
    if (diff <= 3)  return `<span class="deadline-badge soon">🟠 ${diff} dias</span>`;
    return `<span class="deadline-badge ok">🟢 No prazo</span>`;
}

/* ══════════════════════════════════════════════════
   MODAL TASK
══════════════════════════════════════════════════ */
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
        delete state.taskChecklists[id];
        saveChecklists();
        render();
    } catch (e) { console.error(e); }
}

function openModal(colId = null, editId = null) {
    state.targetColId = colId ?? state.columns[0]?.id ?? null;
    state.editingId   = editId;

    const inp     = document.getElementById('task-title');
    const desc    = document.getElementById('task-desc');
    const dateSel = document.getElementById('task-date');
    const colSel  = document.getElementById('task-col');
    const err     = document.getElementById('error-msg');

    err.classList.remove('visible');

    // Determina a coluna atual para a faixa de cor e label
    const currentColId = editId
        ? (state.tasks.find(t => t.id === editId)?.columnId ?? state.targetColId)
        : state.targetColId;
    const currentCol = state.columns.find(c => c.id === currentColId);

    // Stripe de cor
    const stripe = document.getElementById('modal-task-stripe');
    if (stripe) stripe.style.background = currentCol?.color || '#0065FF';

    // Label da coluna no header
    const colLabel = document.getElementById('modal-task-col-label');
    if (colLabel) colLabel.textContent = currentCol?.name || '';

    if (editId) {
        const task = state.tasks.find(t => t.id === editId);
        if (!task) return;
        inp.value     = task.title;
        desc.value    = task.description || '';
        dateSel.value = task.dueDate ? task.dueDate.split('T')[0] : '';
        colSel.value  = task.columnId ?? state.targetColId;
        document.getElementById('save-label').textContent = 'Salvar alterações';
        // Título display no header
        const titleDisplay = document.getElementById('modal-task-title-display');
        if (titleDisplay) titleDisplay.textContent = task.title;
    } else {
        inp.value = desc.value = dateSel.value = '';
        colSel.value = state.targetColId;
        document.getElementById('save-label').textContent = 'Salvar tarefa';
        const titleDisplay = document.getElementById('modal-task-title-display');
        if (titleDisplay) titleDisplay.textContent = 'Nova tarefa';
    }

    // Atualiza avatar do comentário
    const avatarEl = document.getElementById('task-comment-avatar');
    if (avatarEl) {
        try {
            const u = JSON.parse(localStorage.getItem('user'));
            avatarEl.textContent = u?.name
                ? u.name.split(' ').slice(0,2).map(w => w[0].toUpperCase()).join('')
                : 'EU';
        } catch (_) { avatarEl.textContent = 'EU'; }
    }

    // Carrega comentários da tarefa
    renderTaskComments(editId);

    // Atualiza title display dinamicamente ao digitar
    inp.oninput = () => {
        const td = document.getElementById('modal-task-title-display');
        if (td) td.textContent = inp.value || (editId ? '' : 'Nova tarefa');
    };

    // Atualiza stripe ao mudar coluna
    colSel.onchange = () => {
        const sel = state.columns.find(c => c.id === parseInt(colSel.value));
        if (stripe && sel) stripe.style.background = sel.color;
        const cl = document.getElementById('modal-task-col-label');
        if (cl && sel) cl.textContent = sel.name;
    };

    document.getElementById('modal-overlay').classList.remove('hidden');
    inp.focus();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    state.editingId = null;
}

function handleOverlayClick(e) {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
}

/* ── COMENTÁRIOS DA TAREFA ── */
function getTaskComments(taskId) {
    if (!taskId) return [];
    if (!state.taskChecklists.__comments) state.taskChecklists.__comments = {};
    if (!state.taskChecklists.__comments[taskId]) state.taskChecklists.__comments[taskId] = [];
    return state.taskChecklists.__comments[taskId];
}

function saveTaskComments() {
    saveChecklists();
}

function renderTaskComments(taskId) {
    const list = document.getElementById('task-comments-list');
    if (!list) return;
    if (!taskId) {
        list.innerHTML = `<div class="task-comment-empty">Salve a tarefa para adicionar comentários.</div>`;
        return;
    }
    const comments = getTaskComments(taskId);
    if (comments.length === 0) {
        list.innerHTML = `<div class="task-comment-empty">Nenhum comentário ainda.</div>`;
        return;
    }
    list.innerHTML = comments.map(c => `
        <div class="task-comment-item">
            <div class="task-comment-item-avatar" style="background:${c.color||'#0052CC'}">${c.initials}</div>
            <div class="task-comment-item-body">
                <div class="task-comment-item-meta">
                    <span class="task-comment-item-author">${escHtml(c.author)}</span>
                    <span class="task-comment-item-time">${c.time}</span>
                </div>
                <div class="task-comment-item-text">${escHtml(c.text)}</div>
            </div>
        </div>`).join('');
    list.scrollTop = list.scrollHeight;
}

function submitTaskComment() {
    const taskId = state.editingId;
    if (!taskId) return;
    const input = document.getElementById('task-comment-input');
    const text  = input.value.trim();
    if (!text) return;

    let name = 'Você';
    let color = '#0052CC';
    try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (u?.name) { name = u.name; }
        const colors = ['#0052CC','#6554C0','#36B37E','#FF5630','#00B8D9','#403294'];
        color = colors[name.length % colors.length];
    } catch (_) {}

    const initials = name.split(' ').slice(0,2).map(w => w[0].toUpperCase()).join('');
    const comments = getTaskComments(taskId);
    comments.push({
        author: name, initials, color, text,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    saveTaskComments();
    input.value = '';
    renderTaskComments(taskId);
}

function handleCommentKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitTaskComment();
    }
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

    // colSel.value agora é o ID da coluna
    const selectedColId = parseInt(colSel.value);
    const destCol       = state.columns.find(c => c.id === selectedColId);
    const isFinished    = destCol?.isFinished === true && state.completionMode === 'column';

    try {
        if (state.editingId) {
            const task = state.tasks.find(t => t.id === state.editingId);
            const res  = await apiFetch(`/tasks/${state.editingId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title:       titleVal,
                    description: desc.value.trim(),
                    isCompleted: isFinished,
                    dueDate:     dateSel.value || null,
                    status:      destCol?.name || task.status,
                    columnId:    selectedColId
                })
            });
            if (res && res.ok) {
                const updated = await res.json();
                Object.assign(task, updated);
                task.columnId = selectedColId;
            }
        } else {
            const res = await apiFetch('/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title:       titleVal,
                    description: desc.value.trim(),
                    dueDate:     dateSel.value || null,
                    status:      destCol?.name || 'Todo',
                    columnId:    selectedColId,
                    workspaceId: workspaceId
                })
            });
            if (res && res.ok) {
                const newTask = await res.json();
                newTask.columnId = selectedColId;
                state.tasks.push(newTask);
            }
        }
        render();
        closeModal();
    } catch (e) { console.error(e); }
    finally {
        btn.disabled = false;
        label.textContent = state.editingId ? 'Salvar alterações' : 'Salvar tarefa';
        spinner.classList.add('hidden');
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
    setTimeout(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'index.html'; }, 900);
}

/* ══════════════════════════════════════════════════
   KEYBOARD
══════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); closeColEditPanel(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!document.getElementById('modal-overlay').classList.contains('hidden')) saveTask();
    }
});

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDisplay(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff  = Math.floor((d - today) / 86400000);
    if (diff === 0)  return 'hoje';
    if (diff === 1)  return 'amanhã';
    if (diff === -1) return 'ontem';
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
}
function toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}