'use strict';

const STORAGE_KEY = 'taskflow_data';

const DEFAULT_TASKS = [
  { id: uid(), title: 'Criar tela de dashboard Kanban',           tag: 'frontend', date: '2025-06-10', col: 'todo' },
  { id: uid(), title: 'Implementar filtros de tarefa',             tag: 'backend',  date: '2025-06-12', col: 'todo' },
  { id: uid(), title: 'Configurar envio de e-mail',                tag: 'urgente',  date: formatDate(new Date()), col: 'todo' },
  { id: uid(), title: 'Integrar backend com notification-service', tag: 'backend',  date: '2025-06-08', col: 'progress' },
  { id: uid(), title: 'Criar tela de login e cadastro',            tag: 'frontend', date: '2025-06-09', col: 'progress' },
];

let state = {
  tasks:     [],
  editingId: null,
  targetCol: 'todo',
};

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
(function init() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = 'login.html'; return; }

  const rawUser = localStorage.getItem('user');
  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      if (user.name) {
        const nameEl   = document.getElementById('user-name');
        const avatarEl = document.getElementById('user-avatar');
        if (nameEl)   nameEl.textContent  = user.name;
        if (avatarEl) avatarEl.textContent = user.name
          .split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
      }
    } catch (_) {}
  }

  const saved = loadState();
  if (saved) {
    state = { ...state, ...saved };
  } else {
    state.tasks = DEFAULT_TASKS;
  }

  // theme.js já aplicou o tema — só atualiza os controles da sidebar
  const { theme, mode } = loadTheme();
  updateModeBtns(mode);
  updateThemeBtns(theme);

  render();
})();

/* ══════════════════════════════════════════════════
   APPEARANCE ACCORDION
   ══════════════════════════════════════════════════ */
function toggleAppearance() {
  const trigger = document.getElementById('appearance-trigger');
  const panel   = document.getElementById('appearance-panel');
  const isOpen  = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  trigger.setAttribute('aria-expanded', String(!isOpen));
}

/* ══════════════════════════════════════════════════
   THEME — delegado ao theme.js, só salva state local
   ══════════════════════════════════════════════════ */
// setTheme e setMode já estão definidos em theme.js
// Sobrescrevemos apenas para também salvar o state local

const _setTheme = setTheme;
window.setTheme = function(token, el) {
  _setTheme(token, el);
  saveState();
};

const _setMode = setMode;
window.setMode = function(modeStr) {
  _setMode(modeStr);
  saveState();
};

/* ══════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════ */
function render() {
  ['todo', 'progress', 'done'].forEach(col => {
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

    colTasks.forEach(task => list.appendChild(buildCard(task)));
  });
}

function buildCard(task) {
  const card = document.createElement('div');
  card.className  = 'card';
  card.dataset.id = task.id;

  const tagClass = tagStyle(task.tag);
  const dateStr  = task.date ? `<div class="card-date">📅 ${formatDisplay(task.date)}</div>` : '';

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
    ${task.desc ? `<div class="card-desc">${escHtml(task.desc)}</div>` : ''}
    <div class="card-footer">
      <span class="card-tag ${tagClass}">${capitalise(task.tag)}</span>
    </div>
    ${dateStr}
    ${actions}
  `;

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
  const desc    = document.getElementById('task-desc');
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
    desc.value    = task.desc || '';
    tagSel.value  = task.tag;
    dateSel.value = task.date || '';
    colSel.value  = task.col;
  } else {
    title.textContent = 'Nova tarefa';
    inp.value = desc.value = '';
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
  btn.disabled = true;
  label.textContent = 'Salvando…';
  spinner.classList.remove('hidden');

  setTimeout(() => {
    if (state.editingId) {
      const task = state.tasks.find(t => t.id === state.editingId);
      if (task) {
        task.title = titleVal;
        task.desc  = desc.value.trim();
        task.tag   = tagSel.value;
        task.date  = dateSel.value;
        task.col   = colSel.value;
      }
    } else {
      state.tasks.push({
        id: uid(), title: titleVal,
        desc: desc.value.trim(),
        tag: tagSel.value, date: dateSel.value, col: colSel.value,
      });
    }

    saveState(); render(); closeModal();
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
   PERSISTENCE
   ══════════════════════════════════════════════════ */
function saveState() {
  const { theme, mode } = loadTheme();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: state.tasks, theme, mode,
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
  if (iso === formatDate(new Date())) return 'hoje';
  return `${day}/${m}`;
}

function tagStyle(tag) {
  const map = { frontend:'tag-blue', backend:'tag-green', urgente:'tag-orange', design:'tag-blue', devops:'tag-green' };
  return map[tag] || 'tag-blue';
}