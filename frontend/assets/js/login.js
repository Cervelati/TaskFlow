const API_URL = 'http://localhost:5000';

// ── Tab switching
function switchTab(tab) {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
  }

  clearErrors();
}

function clearErrors() {
  document.getElementById('login-error').classList.remove('visible');
  document.getElementById('register-error').classList.remove('visible');
}

function showError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.add('visible');
}

function setLoading(type, loading) {
  const btn = document.querySelector(`#form-${type} .btn-submit`);
  const text = document.getElementById(`${type}-btn-text`);
  const spinner = document.getElementById(`${type}-spinner`);

  btn.disabled = loading;
  if (loading) {
    text.textContent = type === 'login' ? 'Entrando...' : 'Criando conta...';
    spinner.classList.remove('hidden');
  } else {
    text.textContent = type === 'login' ? 'Entrar' : 'Criar conta grátis';
    spinner.classList.add('hidden');
  }
}

// ── Login
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showError('login-error', 'Preencha todos os campos.');
    return;
  }

  setLoading('login', true);

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showError('login-error', data.message || 'E-mail ou senha inválidos.');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({ id: data.id, name: data.name, email: data.email }));

    window.location.href = 'dashboard.html';

  } catch (err) {
    showError('login-error', 'Erro ao conectar com o servidor. Tente novamente.');
  } finally {
    setLoading('login', false);
  }
}

// ── Register
async function handleRegister() {
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (!name || !email || !password) {
    showError('register-error', 'Preencha todos os campos.');
    return;
  }

  if (password.length < 6) {
    showError('register-error', 'A senha deve ter no mínimo 6 caracteres.');
    return;
  }

  setLoading('register', true);

  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showError('register-error', data.message || 'Erro ao criar conta.');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({ id: data.id, name: data.name, email: data.email }));

    window.location.href = 'dashboard.html';

  } catch (err) {
    showError('register-error', 'Erro ao conectar com o servidor. Tente novamente.');
  } finally {
    setLoading('register', false);
  }
}

// ── Check if already logged in
if (localStorage.getItem('token')) {
  window.location.href = 'dashboard.html';
}

// ── Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const loginForm = document.getElementById('form-login');
    if (!loginForm.classList.contains('hidden')) {
      handleLogin();
    } else {
      handleRegister();
    }
  }
});