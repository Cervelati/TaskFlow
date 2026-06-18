'use strict';

const STORAGE_KEY = 'taskflow_data';
const API = 'http://localhost:5000/api';

const COVER_COLORS = [
    '#0065FF', '#6554C0', '#36B37E', '#FF5630', '#00B8D9',
    '#FF991F', '#403294', '#006644', '#BF2600', '#172B4D',
    '#1D7AFC', '#E56910', '#943D73', '#5E4DB2', '#216E4E',
    '#0B6E4F', '#8B1A2B', '#007A94', '#2C3E50', '#1A1A2E',
];

let state = {
    tasks:          [],
    columns:        [],
    completionMode: 'column',
    editingId:      null,
    targetColId:    null,
    colMeta:        {},
    taskComments:   {},
    taskChecklists: {},
};

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
(async function init() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    const saved = loadState();
    if (saved?.tasks)          state.tasks          = saved.tasks;
    if (saved?.completionMode) state.completionMode = saved.completionMode;
    if (saved?.colMeta)        state.colMeta        = saved.colMeta;
    if (saved?.taskComments)   state.taskComments   = saved.taskComments;
    if (saved?.taskChecklists) state.taskChecklists = saved.taskChecklists;

    const { theme, mode } = loadTheme();
    updateModeBtns(mode);
    updateThemeBtns(theme);

    loadUserInfo();
    refreshUrgentBadges();

    await loadColumns();
    injectColEditPanel();
    injectTaskModal();
})();

/* ══════════════════════════════════════════════════
   APPEARANCE
══════════════════════════════════════════════════ */
function toggleAppearance() {
    const trigger = document.getElementById('appearance-trigger');
    const panel   = document.getElementById('appearance-panel');
    const isOpen  = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    trigger.setAttribute('aria-expanded', String(!isOpen));
}

const _setTheme = setTheme;
window.setTheme = function (token, el) { _setTheme(token, el); saveState(); };
const _setMode = setMode;
window.setMode = function (modeStr) { _setMode(modeStr); saveState(); };

/* ══════════════════════════════════════════════════
   PERSISTENCE
══════════════════════════════════════════════════ */
function saveState() {
    const { theme, mode } = loadTheme();
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            tasks: state.tasks, completionMode: state.completionMode,
            colMeta: state.colMeta, taskComments: state.taskComments,
            taskChecklists: state.taskChecklists, theme, mode,
        }));
    } catch (_) { }
}

function loadState() {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
}

/* ══════════════════════════════════════════════════
   NORMALIZAÇÃO DE ID
   IDs da API são number; IDs locais são string ('local-1').
   Normaliza para o tipo correto em todos os pontos de entrada.
══════════════════════════════════════════════════ */
function normalizeColId(id) {
    if (id === null || id === undefined) return null;
    // IDs locais como 'local-1' permanecem string
    if (typeof id === 'string' && id.startsWith('local-')) return id;
    const n = Number(id);
    return isNaN(n) ? id : n;
}

function colIdEq(a, b) {
    return normalizeColId(a) === normalizeColId(b);
}

/* ══════════════════════════════════════════════════
   MIGRAÇÃO: col (nome) → colId (ID normalizado)
══════════════════════════════════════════════════ */
function migrateTasks() {
    let changed = false;
    state.tasks = state.tasks.map(t => {
        // Já tem colId correto
        if (t.colId !== undefined && t.colId !== null) {
            const normalized = normalizeColId(t.colId);
            if (normalized !== t.colId) { changed = true; return { ...t, colId: normalized }; }
            return t;
        }
        // Migra de col (nome) para colId
        const col = state.columns.find(c => c.name === t.col);
        changed = true;
        const colId = normalizeColId(col?.id ?? state.columns[0]?.id ?? null);
        const { col: _col, ...rest } = t; // remove campo 'col' antigo
        return { ...rest, colId };
    });
    if (changed) saveState();
}

function getColMeta(colId) {
    const key = String(colId);
    if (!state.colMeta[key]) state.colMeta[key] = { tags: [] };
    return state.colMeta[key];
}

function getTaskComments(taskId) {
    if (!state.taskComments[taskId]) state.taskComments[taskId] = [];
    return state.taskComments[taskId];
}

function getTaskChecklist(taskId) {
    if (!state.taskChecklists[taskId]) state.taskChecklists[taskId] = [];
    return state.taskChecklists[taskId];
}

/* ══════════════════════════════════════════════════
   COLUMNS
══════════════════════════════════════════════════ */
async function loadColumns() {
    try {
        const res = await apiFetch('/columns');
        if (!res || !res.ok) throw new Error();
        const raw = await res.json();
        // Garante que IDs da API são number
        state.columns = raw.map(c => ({ ...c, id: normalizeColId(c.id) }));
        migrateTasks();
        updateColSelect();
        render();
    } catch {
        state.columns = [
            { id: 'local-1', name: 'A fazer',      color: '#DFE1E6', position: 0, isFinished: false },
            { id: 'local-2', name: 'Em andamento', color: '#0065FF', position: 1, isFinished: false },
            { id: 'local-3', name: 'Concluído',    color: '#36B37E', position: 2, isFinished: true  },
        ];
        if (state.tasks.length === 0) {
            state.tasks = [
                { id: uid(), title: 'Criar tela de dashboard Kanban', tag: 'frontend', date: '2025-06-10', colId: 'local-1', completed: false },
                { id: uid(), title: 'Implementar filtros de tarefa',  tag: 'backend',  date: '2025-06-12', colId: 'local-1', completed: false },
                { id: uid(), title: 'Configurar envio de e-mail',     tag: 'urgente',  date: formatDate(new Date()), colId: 'local-1', completed: false },
                { id: uid(), title: 'Integrar backend com notification-service', tag: 'backend', date: '2025-06-08', colId: 'local-2', completed: false },
                { id: uid(), title: 'Criar tela de login e cadastro', tag: 'frontend', date: '2025-06-09', colId: 'local-2', completed: false },
            ];
        } else {
            migrateTasks();
        }
        updateColSelect();
        render();
    }
}

function updateColSelect() {
    const colSel = document.getElementById('task-col');
    if (!colSel) return;
    colSel.innerHTML = state.columns
        .map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`)
        .join('');
}

async function addColumn() {
    try {
        const res = await apiFetch('/columns', {
            method: 'POST',
            body: JSON.stringify({ name: 'Nova coluna', color: '#DFE1E6', workspaceId: null, isFinished: false })
        });
        if (!res || !res.ok) return;
        const col = await res.json();
        state.columns.push({ ...col, id: normalizeColId(col.id) });
        updateColSelect();
        render();
    } catch { }
}

async function saveColumnFull(colId, name, color, isFinished) {
    const col = state.columns.find(c => colIdEq(c.id, colId));
    if (!col) return;
    if (isFinished) state.columns.forEach(c => { c.isFinished = false; });
    col.name = name; col.color = color; col.isFinished = isFinished;
    try {
        if (isFinished) {
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
    } catch { }
    saveState(); updateColSelect(); render();
}

async function saveColumnName(colId, newName) {
    const col = state.columns.find(c => colIdEq(c.id, colId));
    if (!col) return;
    try {
        await apiFetch(`/columns/${colId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: newName, color: col.color, position: col.position, isFinished: col.isFinished })
        });
        col.name = newName;
    } catch { }
    updateColSelect(); render();
}

async function deleteColumn(colId) {
    try {
        const res = await apiFetch(`/columns/${colId}`, { method: 'DELETE' });
        if (!res || !res.ok) return;
        state.columns = state.columns.filter(c => !colIdEq(c.id, colId));
        state.tasks   = state.tasks.filter(t => !colIdEq(t.colId, colId));
        delete state.colMeta[String(colId)];
        updateColSelect(); saveState(); render();
    } catch { }
}

/* ══════════════════════════════════════════════════
   COMPLETION MODE
══════════════════════════════════════════════════ */
function setCompletionMode(newMode) {
    if (newMode === state.completionMode) return;
    if (newMode === 'checkbox') {
        showModeConfirm(
            'Mudar para Checklist?',
            'As descrições das tarefas serão apagadas.',
            'Mudar para Checklist',
            () => { state.tasks.forEach(t => { t.desc = ''; }); state.completionMode = 'checkbox'; saveState(); render(); }
        );
    } else {
        showModeConfirm(
            'Mudar para Coluna de conclusão?',
            'Os checklists das tarefas serão removidos.',
            'Mudar para Coluna',
            () => { state.taskChecklists = {}; state.completionMode = 'column'; saveState(); render(); }
        );
    }
}

function showModeConfirm(title, desc, confirmLabel, onConfirm) {
    const overlay = document.getElementById('modal-mode-confirm');
    if (!overlay) return;
    overlay.querySelector('.mode-confirm-title').textContent = title;
    overlay.querySelector('.mode-confirm-desc').textContent  = desc;
    const btn = overlay.querySelector('.mode-confirm-btn');
    btn.textContent = confirmLabel;
    btn.onclick = () => { overlay.classList.add('hidden'); onConfirm(); };
    overlay.classList.remove('hidden');
}

function closeModeConfirm() {
    document.getElementById('modal-mode-confirm')?.classList.add('hidden');
}

/* ══════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════ */
function render() {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';
    state.columns.forEach(col => {
        const colTasks = state.tasks.filter(t => colIdEq(t.colId, col.id));
        board.appendChild(buildColumn(col, colTasks));
    });
    const addBtn = document.createElement('div');
    addBtn.className = 'add-column-btn';
    addBtn.innerHTML = `<button onclick="addColumn()">+ Adicionar coluna</button>`;
    board.appendChild(addBtn);
}

function buildColumn(col, tasks) {
    const wrap = document.createElement('div');
    wrap.className = 'column';
    if (col.isFinished && state.completionMode === 'column') wrap.classList.add('col-finished');
    wrap.dataset.colId = col.id;

    const cover = document.createElement('div');
    cover.className        = 'col-cover';
    cover.style.background = col.color;
    cover.innerHTML        = `<div class="col-cover-edit-hint">✏ Editar coluna</div>`;
    cover.addEventListener('click', () => openColEditPanel(col.id));
    wrap.appendChild(cover);

    const header = document.createElement('div');
    header.className = 'col-header';
    const left = document.createElement('div');
    left.className = 'col-header-left';

    const inp = document.createElement('input');
    inp.className = 'col-name-input';
    inp.value = col.name;
    inp.addEventListener('blur',    () => saveColumnName(col.id, inp.value));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });

    const count = document.createElement('span');
    count.className   = 'col-count';
    count.textContent = tasks.length;

    left.appendChild(inp);
    left.appendChild(count);
    header.appendChild(left);
    wrap.appendChild(header);

    if (col.isFinished && state.completionMode === 'column') {
        const bw = document.createElement('div');
        bw.className = 'col-finished-badge-wrap';
        bw.innerHTML = `<span class="col-finished-badge">✔ Conclusão</span>`;
        wrap.appendChild(bw);
    }

    const meta = getColMeta(col.id);

    const cardsList = document.createElement('div');
    cardsList.className = 'cards-list';
    if (tasks.length === 0) {
        cardsList.innerHTML = `<div class="empty-state">Nenhuma tarefa aqui.</div>`;
    } else {
        tasks.forEach(task => cardsList.appendChild(buildCard(task, col, meta)));
    }
    wrap.appendChild(cardsList);

    const addBtn = document.createElement('button');
    addBtn.className   = 'add-card-btn';
    addBtn.textContent = '+ Adicionar tarefa';
    addBtn.addEventListener('click', () => openModal(col.id));
    wrap.appendChild(addBtn);

    return wrap;
}

function buildCard(task, col, meta) {
    const card = document.createElement('div');
    card.className = 'card';
    if (task.completed) card.classList.add('card-completed');
    card.dataset.id = task.id;

    const tagsHtml = meta?.tags?.length > 0
        ? `<div class="card-tags">${meta.tags.map(t =>
            `<span class="card-tag-pill" style="background:${t.bg};color:${t.text}">${escHtml(t.label)}</span>`
        ).join('')}</div>`
        : '';

    const tagClass = tagStyle(task.tag);
    const dateStr  = task.date
        ? `<div class="card-date">📅 ${formatDisplay(task.date)} ${deadlineBadge(task.date)}</div>`
        : '';

    const otherCols = state.columns.filter(c => !colIdEq(c.id, col.id));
    const moveDropdown = otherCols.length > 0 ? `
        <div class="card-move-wrap">
            <button class="card-btn btn-move" onclick="event.stopPropagation(); toggleMoveMenu(this)">↔ Mover</button>
            <div class="move-menu hidden">
                ${otherCols.map(c => `
                    <div class="move-menu-item" onclick="event.stopPropagation(); moveTask('${task.id}', ${JSON.stringify(c.id)}); closeMoveMenus()">
                        ${c.isFinished && state.completionMode === 'column' ? '✔ ' : ''}${escHtml(c.name)}
                    </div>`).join('')}
            </div>
        </div>` : '';

    card.innerHTML = `
        ${tagsHtml}
        <div class="card-title ${task.completed ? 'card-title-done' : ''}">${escHtml(task.title)}</div>
        ${task.desc ? `<div class="card-desc">${escHtml(task.desc)}</div>` : ''}
        <div class="card-footer"><span class="card-tag ${tagClass}">${capitalise(task.tag)}</span></div>
        ${dateStr}
        <div class="card-actions">
            ${moveDropdown}
            <button class="card-btn btn-delete" onclick="event.stopPropagation(); deleteTask('${task.id}')">✕ Remover</button>
        </div>`;

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
    const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
    const allDone = total > 0 && done === total;

    const wrap = document.createElement('div');
    wrap.className = 'card-checklist';
    wrap.innerHTML = `
        <div class="card-checklist-header">
            <span class="card-checklist-title">☑ Checklist</span>
            <span class="card-checklist-count ${allDone ? 'done' : ''}">${done}/${total}</span>
        </div>
        ${total > 0 ? `<div class="checklist-progress-bar">
            <div class="checklist-progress-fill ${allDone ? 'complete' : ''}" style="width:${pct}%"></div>
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
            onkeydown="if(event.key==='Enter'){event.stopPropagation();addChecklistItem('${task.id}',this)}" />
        <button class="checklist-add-btn"
            onclick="event.stopPropagation();addChecklistItem('${task.id}',this.previousElementSibling)">+</button>`;
    wrap.appendChild(addRow);
    return wrap;
}

function toggleChecklistItem(taskId, idx) {
    const items = getTaskChecklist(taskId);
    if (!items[idx]) return;
    items[idx].checked = !items[idx].checked;
    const task = state.tasks.find(t => t.id === taskId);
    if (task) task.completed = items.length > 0 && items.every(i => i.checked);
    saveState(); render();
}

function addChecklistItem(taskId, input) {
    const label = input.value.trim();
    if (!label) return;
    getTaskChecklist(taskId).push({ id: Date.now(), label, checked: false });
    input.value = '';
    saveState(); render();
}

/* ══════════════════════════════════════════════════
   PAINEL EDIÇÃO DE COLUNA
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
                    <input class="col-edit-name-input" id="col-edit-name" type="text" maxlength="40" />
                </div>
                <div>
                    <div class="col-edit-section-label">Cor da capa</div>
                    <div class="col-edit-colors">
                        ${swatches}
                        <div class="col-edit-color-custom" title="Cor personalizada">🎨
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
                <div class="col-edit-finish-row" id="col-edit-finish-row" onclick="colEditToggleFinish()">
                    <span class="col-edit-finish-row-label">✔ Coluna de conclusão</span>
                    <div class="col-edit-finish-toggle" id="col-edit-finish-toggle"></div>
                </div>
                <div>
                    <div class="col-edit-section-label">Modo de conclusão</div>
                    <div class="col-edit-mode-row">
                        <button class="col-edit-mode-btn ${state.completionMode === 'column' ? 'active' : ''}"
                            onclick="setCompletionMode('column'); syncFinishRowState()">Coluna</button>
                        <button class="col-edit-mode-btn ${state.completionMode === 'checkbox' ? 'active' : ''}"
                            onclick="setCompletionMode('checkbox'); syncFinishRowState()">Checklist</button>
                    </div>
                </div>
            </div>
            <div class="col-edit-footer">
                <button class="col-edit-delete-btn" onclick="colEditDelete()">🗑 Remover coluna</button>
                <button class="col-edit-save-btn" onclick="colEditSave()">Salvar</button>
            </div>
        </div>
    </div>
    <div class="modal-overlay hidden" id="modal-mode-confirm">
        <div class="modal logout-modal">
            <div class="logout-body" style="padding-top:28px">
                <h3 class="logout-title mode-confirm-title"></h3>
                <p class="logout-desc mode-confirm-desc"></p>
            </div>
            <div class="logout-footer">
                <button class="btn-cancel" onclick="closeModeConfirm()">Cancelar</button>
                <button class="btn-logout-confirm mode-confirm-btn"></button>
            </div>
        </div>
    </div>
    <div class="modal-overlay hidden" id="modal-delete-col-dash">
        <div class="modal logout-modal">
            <div class="logout-icon-wrap">
                <div class="logout-icon" style="background:#FFEBE6;color:#BF2600;">🗑</div>
            </div>
            <div class="logout-body">
                <h3 class="logout-title">Remover coluna?</h3>
                <p class="logout-desc" id="modal-delete-col-dash-desc">Esta ação é irreversível.</p>
            </div>
            <div class="logout-footer">
                <button class="btn-cancel" onclick="closeDeleteColDash()">Cancelar</button>
                <button class="btn-logout-confirm" id="btn-confirm-delete-col-dash" onclick="confirmColDeleteDash()">Remover</button>
            </div>
        </div>
    </div>`);
}

function openColEditPanel(colId) {
    const col = state.columns.find(c => colIdEq(c.id, colId));
    if (!col) return;
    editingColId = col.id;
    document.getElementById('col-edit-preview').style.background = col.color;
    document.querySelectorAll('.col-edit-color-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.color === col.color));
    document.getElementById('col-edit-name').value = col.name;
    document.getElementById('col-edit-finish-toggle').classList.toggle('on', !!col.isFinished);
    document.querySelectorAll('.col-edit-mode-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === (state.completionMode === 'column' ? 0 : 1));
    });
    syncFinishRowState();
    renderColEditTags(col.id);
    document.getElementById('col-edit-overlay').classList.remove('hidden');
    document.getElementById('col-edit-name').focus();
}

function syncFinishRowState() {
    const row    = document.getElementById('col-edit-finish-row');
    const toggle = document.getElementById('col-edit-finish-toggle');
    if (!row || !toggle) return;
    const isCheckbox = state.completionMode === 'checkbox';
    row.style.opacity       = isCheckbox ? '0.4' : '1';
    row.style.cursor        = isCheckbox ? 'not-allowed' : 'pointer';
    row.style.pointerEvents = isCheckbox ? 'none' : 'auto';
    if (isCheckbox) toggle.classList.remove('on');
    document.querySelectorAll('.col-edit-mode-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === (state.completionMode === 'column' ? 0 : 1));
    });
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
    if (editingColId === null) return;
    const input = document.getElementById('col-edit-tag-input');
    const label = input.value.trim();
    if (!label) return;
    const hex = document.getElementById('col-edit-tag-color').value;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    getColMeta(editingColId).tags.push({ label, bg: `rgba(${r},${g},${b},0.18)`, text: hex });
    input.value = '';
    saveState();
    renderColEditTags(editingColId);
}

function removeTagFromCol(index) {
    if (editingColId === null) return;
    getColMeta(editingColId).tags.splice(index, 1);
    saveState();
    renderColEditTags(editingColId);
}

async function colEditSave() {
    if (editingColId === null) return;
    const name     = document.getElementById('col-edit-name').value.trim() || 'Sem nome';
    const color    = document.getElementById('col-edit-preview').style.background;
    const finished = document.getElementById('col-edit-finish-toggle').classList.contains('on');
    await saveColumnFull(editingColId, name, color, finished);
    closeColEditPanel();
}

let _deletingColIdDash = null;

function colEditDelete() {
    if (editingColId === null) return;
    _deletingColIdDash = editingColId;

    const col        = state.columns.find(c => colIdEq(c.id, editingColId));
    const colTasks   = state.tasks.filter(t => colIdEq(t.colId, editingColId)).length;
    const descEl     = document.getElementById('modal-delete-col-dash-desc');
    const confirmBtn = document.getElementById('btn-confirm-delete-col-dash');

    if (colTasks > 0) {
        descEl.textContent       = `A coluna "${col?.name}" tem ${colTasks} tarefa(s). Mova ou remova as tarefas antes de deletar.`;
        confirmBtn.style.display = 'none';
    } else {
        descEl.textContent       = `Tem certeza que deseja remover a coluna "${col?.name}"? Esta ação é irreversível.`;
        confirmBtn.style.display = '';
    }

    closeColEditPanel();
    document.getElementById('modal-delete-col-dash').classList.remove('hidden');
}

function closeDeleteColDash() {
    document.getElementById('modal-delete-col-dash').classList.add('hidden');
    _deletingColIdDash = null;
}

async function confirmColDeleteDash() {
    if (_deletingColIdDash === null) return;
    const id = _deletingColIdDash;
    closeDeleteColDash();
    await deleteColumn(id);
}

/* ══════════════════════════════════════════════════
   MODAL TAREFA
══════════════════════════════════════════════════ */
function injectTaskModal() {
    if (document.getElementById('modal-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay hidden" id="modal-overlay" onclick="handleOverlayClick(event)">
        <div class="modal modal-task-wide">
            <div class="modal-task-stripe" id="modal-task-stripe"></div>
            <div class="modal-task-header">
                <div class="modal-task-header-left">
                    <div class="modal-task-col-label" id="modal-task-col-label"></div>
                    <h2 class="modal-task-title-display" id="modal-task-title-display"></h2>
                </div>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-task-body">
                <div class="modal-task-main">
                    <div class="modal-task-section">
                        <div class="modal-task-section-label">Título</div>
                        <input class="modal-task-input" type="text" id="task-title" placeholder="Título da tarefa..." maxlength="120" />
                    </div>
                    <div class="modal-task-section">
                        <div class="modal-task-section-label">Descrição</div>
                        <textarea class="modal-task-textarea" id="task-desc" rows="4" placeholder="Adicione uma descrição..."></textarea>
                    </div>
                    <div class="modal-task-row">
                        <div class="modal-task-section" style="flex:1">
                            <div class="modal-task-section-label">Tag</div>
                            <select class="modal-task-input" id="task-tag">
                                <option value="frontend">Frontend</option>
                                <option value="backend">Backend</option>
                                <option value="design">Design</option>
                                <option value="urgente">Urgente</option>
                                <option value="devops">DevOps</option>
                            </select>
                        </div>
                        <div class="modal-task-section" style="flex:1">
                            <div class="modal-task-section-label">Data limite</div>
                            <input class="modal-task-input" type="date" id="task-date" />
                        </div>
                        <div class="modal-task-section" style="flex:1">
                            <div class="modal-task-section-label">Coluna</div>
                            <select class="modal-task-input" id="task-col"></select>
                        </div>
                    </div>
                    <div class="error-msg" id="error-msg">O título é obrigatório.</div>
                    <div id="template-row" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:4px;border-top:1px solid #F0F1F4">
                        <span style="font-size:11px;font-weight:700;color:#6B778C">Template:</span>
                        <button class="tpl-btn" onclick="applyTemplate('bug')">Bug</button>
                        <button class="tpl-btn" onclick="applyTemplate('feature')">Feature</button>
                        <button class="tpl-btn" onclick="applyTemplate('reuniao')">Reunião</button>
                        <button class="tpl-btn" onclick="applyTemplate('melhoria')">Melhoria</button>
                        <button class="tpl-btn" onclick="applyTemplate('docs')">Docs</button>
                    </div>
                    <div class="modal-task-actions">
                        <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
                        <button class="btn-save" id="btn-save" onclick="saveTask()">
                            <span id="save-label">Salvar tarefa</span>
                            <span class="spinner hidden" id="save-spinner"></span>
                        </button>
                    </div>
                </div>
                <div class="modal-task-sidebar">
                    <div class="modal-task-section-label" style="margin-bottom:12px">Comentários</div>
                    <div class="task-comments-list" id="task-comments-list">
                        <div class="task-comment-empty">Nenhum comentário ainda.</div>
                    </div>
                    <div class="task-comment-input-wrap">
                        <div class="task-comment-avatar" id="task-comment-avatar">L</div>
                        <div class="task-comment-input-area">
                            <textarea class="task-comment-input" id="task-comment-input"
                                placeholder="Escreva um comentário..." rows="2"
                                onkeydown="handleCommentKey(event)"></textarea>
                            <div class="task-comment-input-footer">
                                <span class="task-comment-hint">Enter para enviar · Shift+Enter nova linha</span>
                                <button class="task-comment-send" onclick="submitTaskComment()">Enviar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`);
}

/* ══════════════════════════════════════════════════
   MODAL LOGIC
══════════════════════════════════════════════════ */
function openModal(colId = null, editId = null) {
    state.targetColId = normalizeColId(colId ?? state.columns[0]?.id ?? null);
    state.editingId   = editId;

    const inp     = document.getElementById('task-title');
    const desc    = document.getElementById('task-desc');
    const tagSel  = document.getElementById('task-tag');
    const dateSel = document.getElementById('task-date');
    const colSel  = document.getElementById('task-col');
    const err     = document.getElementById('error-msg');
    const tplRow  = document.getElementById('template-row');

    err.classList.remove('visible');
    if (tplRow) tplRow.style.display = editId ? 'none' : 'flex';
    document.querySelectorAll('.tpl-btn').forEach(b => b.classList.remove('active'));

    const currentColId = editId
        ? normalizeColId(state.tasks.find(t => t.id === editId)?.colId ?? state.targetColId)
        : state.targetColId;
    const currentCol = state.columns.find(c => colIdEq(c.id, currentColId));

    const stripe   = document.getElementById('modal-task-stripe');
    const colLabel = document.getElementById('modal-task-col-label');
    if (stripe)   stripe.style.background = currentCol?.color || '#0065FF';
    if (colLabel) colLabel.textContent     = currentCol?.name || '';

    if (editId) {
        const task = state.tasks.find(t => t.id === editId);
        if (!task) return;
        inp.value     = task.title;
        desc.value    = task.desc || '';
        tagSel.value  = task.tag;
        dateSel.value = task.date || '';
        // Seleciona a option pelo value (que é c.id como string no DOM)
        colSel.value  = String(task.colId);
        document.getElementById('save-label').textContent               = 'Salvar alterações';
        document.getElementById('modal-task-title-display').textContent = task.title;
    } else {
        inp.value = desc.value = dateSel.value = '';
        tagSel.value = 'frontend';
        colSel.value = String(state.targetColId);
        document.getElementById('save-label').textContent               = 'Salvar tarefa';
        document.getElementById('modal-task-title-display').textContent = 'Nova tarefa';
    }

    inp.oninput = () => {
        document.getElementById('modal-task-title-display').textContent = inp.value || (editId ? '' : 'Nova tarefa');
    };
    colSel.onchange = () => {
        const sel = state.columns.find(c => colIdEq(c.id, colSel.value));
        if (stripe && sel)   stripe.style.background = sel.color;
        if (colLabel && sel) colLabel.textContent     = sel.name;
    };

    try {
        const u  = JSON.parse(localStorage.getItem('user'));
        const av = document.getElementById('task-comment-avatar');
        if (av && u?.name) av.textContent = u.name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
    } catch (_) { }

    renderTaskComments(editId);
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

function saveTask() {
    const inp     = document.getElementById('task-title');
    const desc    = document.getElementById('task-desc');
    const tagSel  = document.getElementById('task-tag');
    const dateSel = document.getElementById('task-date');
    const colSel  = document.getElementById('task-col');
    const err     = document.getElementById('error-msg');
    const btn     = document.getElementById('btn-save');
    const label   = document.getElementById('save-label');
    const spinner = document.getElementById('save-spinner');

    const titleVal = inp.value.trim();
    if (!titleVal) { err.classList.add('visible'); inp.focus(); return; }
    err.classList.remove('visible');
    btn.disabled = true; label.textContent = 'Salvando…'; spinner.classList.remove('hidden');

    setTimeout(() => {
        const selectedColId = normalizeColId(colSel.value);
        const destCol       = state.columns.find(c => colIdEq(c.id, selectedColId));
        const isFinished    = destCol?.isFinished === true && state.completionMode === 'column';

        if (state.editingId) {
            const task = state.tasks.find(t => t.id === state.editingId);
            if (task) {
                task.title     = titleVal;
                task.desc      = desc.value.trim();
                task.tag       = tagSel.value;
                task.date      = dateSel.value;
                task.colId     = selectedColId;
                task.completed = isFinished;
            }
        } else {
            state.tasks.push({
                id: uid(), title: titleVal, desc: desc.value.trim(),
                tag: tagSel.value, date: dateSel.value,
                colId: selectedColId, completed: isFinished,
            });
        }
        saveState(); render(); closeModal();
        btn.disabled = false; label.textContent = 'Salvar tarefa'; spinner.classList.add('hidden');
    }, 300);
}

/* ══════════════════════════════════════════════════
   COMENTÁRIOS
══════════════════════════════════════════════════ */
function renderTaskComments(taskId) {
    const list = document.getElementById('task-comments-list');
    if (!list) return;
    if (!taskId) { list.innerHTML = `<div class="task-comment-empty">Salve a tarefa para comentar.</div>`; return; }
    const comments = getTaskComments(taskId);
    if (comments.length === 0) { list.innerHTML = `<div class="task-comment-empty">Nenhum comentário ainda.</div>`; return; }
    list.innerHTML = comments.map(c => `
        <div class="task-comment-item">
            <div class="task-comment-item-avatar" style="background:${c.color || '#0052CC'}">${c.initials}</div>
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
    let name = 'Você', color = '#0052CC';
    try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (u?.name) name = u.name;
        const colors = ['#0052CC', '#6554C0', '#36B37E', '#FF5630', '#00B8D9', '#403294'];
        color = colors[name.length % colors.length];
    } catch (_) { }
    const initials = name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
    getTaskComments(taskId).push({
        author: name, initials, color, text,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    saveState();
    input.value = '';
    renderTaskComments(taskId);
}

function handleCommentKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTaskComment(); }
}

/* ══════════════════════════════════════════════════
   TASK ACTIONS
══════════════════════════════════════════════════ */
function moveTask(id, newColId) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const normalizedId = normalizeColId(newColId);
    const destCol      = state.columns.find(c => colIdEq(c.id, normalizedId));
    const isFinished   = destCol?.isFinished === true && state.completionMode === 'column';
    task.colId     = normalizedId;
    task.completed = isFinished;
    saveState(); render();
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState(); render();
}

/* ══════════════════════════════════════════════════
   MOVE MENU
══════════════════════════════════════════════════ */
function toggleColMenu(btn) {
    const menu = btn.nextElementSibling;
    const isOpen = !menu.classList.contains('hidden');
    closeColMenus(); if (!isOpen) menu.classList.remove('hidden');
}
function closeColMenus()  { document.querySelectorAll('.col-options-menu').forEach(m => m.classList.add('hidden')); }
function toggleMoveMenu(btn) {
    const menu = btn.nextElementSibling;
    const isOpen = !menu.classList.contains('hidden');
    closeMoveMenus(); if (!isOpen) menu.classList.remove('hidden');
}
function closeMoveMenus() { document.querySelectorAll('.move-menu').forEach(m => m.classList.add('hidden')); }
document.addEventListener('click', () => { closeColMenus(); closeMoveMenus(); });

/* ══════════════════════════════════════════════════
   TEMPLATES
══════════════════════════════════════════════════ */
const TEMPLATES = {
    bug:      { title: '[Bug] ',      desc: 'Passos para reproduzir:\n1. \n\nComportamento esperado:\n\nComportamento atual:\n', tag: 'urgente' },
    feature:  { title: '[Feature] ',  desc: 'Descrição da funcionalidade:\n\nCritérios de aceite:\n- [ ] \n', tag: 'frontend' },
    reuniao:  { title: '[Reunião] ',  desc: 'Pauta:\n- \n\nParticipantes:\n- \n\nDecisões:\n- ', tag: 'design' },
    melhoria: { title: '[Melhoria] ', desc: 'O que melhorar:\n\nMotivação:\n\nImpacto esperado:\n', tag: 'backend' },
    docs:     { title: '[Docs] ',     desc: 'O que documentar:\n\nAudiência:\n\nFormato: ', tag: 'devops' },
};

function applyTemplate(key) {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    document.getElementById('task-title').value = tpl.title;
    document.getElementById('task-desc').value  = tpl.desc;
    document.getElementById('task-tag').value   = tpl.tag;
    document.getElementById('modal-task-title-display').textContent = tpl.title;
    document.getElementById('task-title').focus();
    document.querySelectorAll('.tpl-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

/* ══════════════════════════════════════════════════
   DEADLINE
══════════════════════════════════════════════════ */
function deadlineBadge(dateStr) {
    if (!dateStr) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date(dateStr + 'T00:00:00');
    const diff  = Math.floor((due - today) / 86400000);
    if (diff < 0)   return `<span class="deadline-badge overdue">Em atraso</span>`;
    if (diff === 0) return `<span class="deadline-badge today">Vence hoje</span>`;
    if (diff === 1) return `<span class="deadline-badge soon">Vence amanhã</span>`;
    if (diff <= 3)  return `<span class="deadline-badge soon">${diff} dias</span>`;
    return `<span class="deadline-badge ok">No prazo</span>`;
}

/* ══════════════════════════════════════════════════
   NAV / LOGOUT
══════════════════════════════════════════════════ */
function setActiveNav(el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
}
function handleLogout() { document.getElementById('logout-overlay').classList.remove('hidden'); }
function closeLogout()   { document.getElementById('logout-overlay').classList.add('hidden'); }
function confirmLogout() {
    const label   = document.getElementById('logout-label');
    const spinner = document.getElementById('logout-spinner');
    const btn     = document.querySelector('.btn-logout-confirm');
    btn.disabled = true; label.textContent = 'Saindo…'; spinner.classList.remove('hidden');
    setTimeout(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'index.html'; }, 900);
}

/* ══════════════════════════════════════════════════
   API
══════════════════════════════════════════════════ */
async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
        ...opts, headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`, ...(opts.headers || {})
        }
    });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return res;
}

/* ══════════════════════════════════════════════════
   KEYBOARD
══════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeColEditPanel(); closeModeConfirm(); closeDeleteColDash(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!document.getElementById('modal-overlay')?.classList.contains('hidden')) saveTask();
    }
});

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
function uid()           { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function escHtml(str)    { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function capitalise(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
function formatDate(d)   { return d.toISOString().split('T')[0]; }
function formatDisplay(iso) {
    if (!iso) return '';
    const [y, m, day] = iso.split('-');
    if (iso === formatDate(new Date())) return 'hoje';
    return `${day}/${m}`;
}
function tagStyle(tag) {
    const map = { frontend: 'tag-blue', backend: 'tag-green', urgente: 'tag-orange', design: 'tag-blue', devops: 'tag-green' };
    return map[tag] || 'tag-blue';
}
function toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}