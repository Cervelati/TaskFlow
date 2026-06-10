/* ══════════════════════════════════════════════════
   TaskFlow – dashboard.js
   Kanban board with theme/mode system + full CRUD
   ══════════════════════════════════════════════════ */

'use strict';

/* ─── STORAGE KEY ─── */
const STORAGE_KEY = 'taskflow_data';

/* ─── COLOUR MAP (board background per theme) ─── */
const THEME_BG = {
  blue:    '#0052CC',
  teal:    '#007A94',
  green:   '#0B6E4F',
  purple:  '#403294',
  slate:   '#2C3E50',
  crimson: '#8B1A2B',
  midnight:'#1A1A2E',
};

/* ─── DEFAULT SEED DATA ─── */
const DEFAULT_TASKS = [
  { id: uid(), title: 'Criar tela de dashboard Kanban', tag: 'frontend', date: '2025-06-10', col: 'todo' },
  { id: uid(), title: 'Implementar filtros de tarefa',  tag: 'backend',  date: '2025-06-12', col: 'todo' },
  { id: uid(), title: 'Configurar envio de e-mail',     tag: 'urgente',  date: formatDate(new Date()), col: 'todo' },
  { id: uid(), title: 'Integrar backend com notification-service', tag: 'backend', date: '2025-06-08', col: 'progress' },
  { id: uid(), title: 'Criar tela de login e cadastro', tag: 'frontend', date: '2025-06-09', col: 'progress' },
];

/* ─── STATE ─── */
let state = {
  tasks:     [],
  theme:     'blue',    // colour token
  mode:      'dark',    // 'dark' | 'light'
  editingId: null,
  targetCol: 'todo',
};

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
(function init() {
  // ── Auth guard: redireciona para login se não estiver autenticado
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // ── Carrega dados do usuário salvo no login
  const rawUser = localStorage.getItem('user');
  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      if (user.name) {
        // Exibe nome e iniciais
        const nameEl   = document.getElementById('user-name');
        const avatarEl = document.getElementById('user-avatar');
        if (nameEl)   nameEl.textContent   = user.name;
        if (avatarEl) avatarEl.textContent = user.name
          .split(' ')
          .slice(0, 2)
          .map(w => w[0].toUpperCase())
          .join('');
      }
    } catch (_) {}
  }

  const saved = loadState();
  if (saved) {
    state = { ...state, ...saved };
  } else {
    state.tasks = DEFAULT_TASKS;
  }
  applyTheme(state.theme, state.mode, false);
  render();
  updateModeBtns();
  updateThemeBtns();
})();

/* ══════════════════════════════════════════════════
   THEME / MODE
   ══════════════════════════════════════════════════ */

/** Called from HTML – colour swatch click */
function setTheme(token, btn) {
  state.theme = token;
  applyTheme(state.theme, state.mode);
  updateThemeBtns();
  saveState();
}

/** Called from HTML – mode button click */
function setMode(modeStr) {
  // modeStr: 'dark-mode' | 'light-mode'
  state.mode = modeStr === 'light-mode' ? 'light' : 'dark';
  applyTheme(state.theme, state.mode);
  updateModeBtns();
  saveState();
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
    else if (db) db.style.background = '';
  }

  if (!transition) {
    // Force reflow then restore transitions
    void body.offsetHeight;
    body.style.transition = '';
  }
}

function updateModeBtns() {
  const btnDark  = document.getElementById('btn-dark-mode');
  const btnLight = document.getElementById('btn-light-mode');
  if (!btnDark || !btnLight) return;
  btnDark.classList.toggle('active',  state.mode === 'dark');
  btnLight.classList.toggle('active', state.mode === 'light');
}

function updateThemeBtns() {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === state.theme);
  });
}

/* ══════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════ */
function render() {
  const cols = ['todo', 'progress', 'done'];
  cols.forEach(col => {
    const list  = document.getElementById(`list-${col}`);
    const count = document.getElementById(`count-${col}`);
    if (!list || !count) return;

    const colTasks = state.tasks.filter(t => t.col === col);
    count.textContent = colTasks.length;

    list.innerHTML = '';
    if (colTasks.length === 0) {
      list.innerHTML = `<div class="empty-state">Nenhuma tarefa aqui.</div>`;
      return;
    }

    colTasks.forEach(task => {
      list.appendChild(buildCard(task));
    });
  });
}

function buildCard(task) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = task.id;

  const tagClass = tagStyle(task.tag);
  const dateStr  = task.date ? `<div class="card-date">📅 ${formatDisplay(task.date)}</div>` : '';

  // Action buttons depend on column
  let actions = '';
  if (task.col === 'todo') {
    actions = `
      <div class="card-actions">
        <button class="card-btn btn-progress" onclick="moveTask('${task.id}','progress')">▶ Andamento</button>
        <button class="card-btn btn-delete"   onclick="deleteTask('${task.id}')">✕ Remover</button>
      </div>`;
  } else if (task.col === 'progress') {
    actions = `
      <div class="card-actions">
        <button class="card-btn btn-done"   onclick="moveTask('${task.id}','done')">✔ Concluir</button>
        <button class="card-btn btn-delete" onclick="deleteTask('${task.id}')">✕ Remover</button>
      </div>`;
  } else {
    actions = `
      <div class="card-actions">
        <button class="card-btn btn-progress" onclick="moveTask('${task.id}','todo')">↩ Reabrir</button>
        <button class="card-btn btn-delete"   onclick="deleteTask('${task.id}')">✕ Remover</button>
      </div>`;
  }

  card.innerHTML = `
    <div class="card-title">${escHtml(task.title)}</div>
    <div class="card-footer">
      <span class="card-tag ${tagClass}">${capitalise(task.tag)}</span>
    </div>
    ${dateStr}
    ${actions}
  `;

  // Edit on title click
  card.querySelector('.card-title').addEventListener('click', () => openModal(task.col, task.id));

  return card;
}

/* ══════════════════════════════════════════════════
   TASK ACTIONS
   ══════════════════════════════════════════════════ */
function moveTask(id, newCol) {
  const task = state.tasks.find(t => t.id === id);
  if (task) { task.col = newCol; saveState(); render(); }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  render();
}

/* ══════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════ */
function openModal(col = 'todo', editId = null) {
  state.targetCol = col;
  state.editingId = editId;

  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const inp     = document.getElementById('task-title');
  const tagSel  = document.getElementById('task-tag');
  const dateSel = document.getElementById('task-date');
  const colSel  = document.getElementById('task-col');
  const err     = document.getElementById('error-msg');

  err.classList.remove('visible');

  if (editId) {
    const task = state.tasks.find(t => t.id === editId);
    if (!task) return;
    title.textContent = 'Editar tarefa';
    inp.value     = task.title;
    tagSel.value  = task.tag;
    dateSel.value = task.date || '';
    colSel.value  = task.col;
  } else {
    title.textContent = 'Nova tarefa';
    inp.value     = '';
    tagSel.value  = 'frontend';
    dateSel.value = '';
    colSel.value  = col;
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

function saveTask() {
  const inp    = document.getElementById('task-title');
  const tagSel = document.getElementById('task-tag');
  const dateSel= document.getElementById('task-date');
  const colSel = document.getElementById('task-col');
  const err    = document.getElementById('error-msg');
  const btn    = document.getElementById('btn-save');
  const label  = document.getElementById('save-label');
  const spinner= document.getElementById('save-spinner');

  const titleVal = inp.value.trim();
  if (!titleVal) { err.classList.add('visible'); inp.focus(); return; }

  err.classList.remove('visible');

  // Fake async save for UX polish
  btn.disabled = true;
  label.textContent = 'Salvando…';
  spinner.classList.remove('hidden');

  setTimeout(() => {
    if (state.editingId) {
      const task = state.tasks.find(t => t.id === state.editingId);
      if (task) {
        task.title = titleVal;
        task.tag   = tagSel.value;
        task.date  = dateSel.value;
        task.col   = colSel.value;
      }
    } else {
      state.tasks.push({
        id:    uid(),
        title: titleVal,
        tag:   tagSel.value,
        date:  dateSel.value,
        col:   colSel.value,
      });
    }

    saveState();
    render();
    closeModal();

    btn.disabled = false;
    label.textContent = 'Salvar tarefa';
    spinner.classList.add('hidden');
  }, 400);
}

/* ══════════════════════════════════════════════════
   NAV / LOGOUT
   ══════════════════════════════════════════════════ */
function setActiveNav(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
}

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

  btn.disabled      = true;
  label.textContent = 'Saindo…';
  spinner.classList.remove('hidden');

  setTimeout(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }, 900);
}

/* ══════════════════════════════════════════════════
   PERSISTENCE
   ══════════════════════════════════════════════════ */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: state.tasks,
      theme: state.theme,
      mode:  state.mode,
    }));
  } catch (_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/* ══════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ══════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay.classList.contains('hidden')) saveTask();
  }
});

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function formatDisplay(iso) {
  if (!iso) return '';
  const [y, m, day] = iso.split('-');
  const today = formatDate(new Date());
  if (iso === today) return 'hoje';
  return `${day}/${m}`;
}

function tagStyle(tag) {
  const map = {
    frontend: 'tag-blue',
    backend:  'tag-green',
    urgente:  'tag-orange',
    design:   'tag-blue',
    devops:   'tag-green',
  };
  return map[tag] || 'tag-blue';
}