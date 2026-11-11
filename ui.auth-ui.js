/**
 * @fileoverview Interfaz de login, caja de sesión y panel de usuarios (solo admin).
 */

import { authService, ROLES, MIN_PASSWORD, mapAuthError } from './services.auth-service.js';
import { uiManager } from './ui.ui-manager.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function bindLoginForm() {
  const form = $('loginForm');
  const setError = (msg) => { $('loginError').textContent = msg || ''; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; setError('');
    try {
      const id = $('loginEmail').value.trim();
      await authService.login(id.includes('@') ? id : `${id}@agrosahagun.app`, $('loginPass').value);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      btn.disabled = false;
    }
  });

  $('btnReset').addEventListener('click', async () => {
    const id = $('loginEmail').value.trim();
    const email = id.includes('@') ? id : `${id}@agrosahagun.app`;
    if (!id) return setError('Escribe tu correo y vuelve a pulsar el enlace.');
    try {
      await authService.resetPassword(email);
      setError('');
      uiManager.showToast('Si el correo existe, recibirás un enlace para restablecer la contraseña.', 'info', 6000);
    } catch (err) {
      setError(mapAuthError(err));
    }
  });

  $('btnLogout').addEventListener('click', () => authService.logout());
}

export function showLogin(message) {
  document.body.dataset.auth = 'out';
  $('loginError').textContent = message || '';
  $('loginPass').value = '';
}

export function showApp(profile) {
  document.body.dataset.auth = 'in';
  $('sessionName').textContent = profile.name || profile.email;
  $('sessionRole').textContent = ROLES[profile.role] || profile.role;

  if (profile.role === 'admin') {
    startUsersPanel(profile);
  } else {
    document.querySelector('[data-page="usuarios"]')?.remove();
    $('usuarios')?.remove();
  }
}

function startUsersPanel(me) {
  let users = [];
  const render = () => {
    const box = $('userTable');
    if (!users.length) { box.innerHTML = '<div class="empty">Aún no hay usuarios.</div>'; return; }
    box.innerHTML = `<table><thead><tr>
        <th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th style="text-align:right">Acciones</th>
      </tr></thead><tbody>${users.map((u) => {
        const self = u.uid === me.uid;
        const actions = self ? '<small style="color:var(--muted)">Tu cuenta</small>' : `
          <button class="btn ghost btn-sm" data-act="role" data-uid="${esc(u.uid)}">${u.role === 'admin' ? 'Pasar a operario' : 'Hacer admin'}</button>
          <button class="btn ghost btn-sm" data-act="reset" data-uid="${esc(u.uid)}">Reiniciar clave</button>
          <button class="btn ${u.active ? 'danger' : 'secondary'} btn-sm" data-act="toggle" data-uid="${esc(u.uid)}">${u.active ? 'Desactivar' : 'Activar'}</button>`;
        return `<tr>
          <td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td>
          <td><span class="tag ${u.role === 'admin' ? 'warn' : ''}">${esc(ROLES[u.role] || u.role)}</span></td>
          <td>${u.active ? '<span class="tag">Activo</span>' : '<span class="tag danger">Inactivo</span>'}</td>
          <td style="text-align:right;white-space:nowrap">${actions}</td></tr>`;
      }).join('')}</tbody></table>`;
  };

  authService.watchUsers((list) => { users = list; render(); },
    (err) => uiManager.showToast(mapAuthError(err), 'error'));

  $('userTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    const user = btn && users.find((u) => u.uid === btn.dataset.uid);
    if (!user) return;
    try {
      if (btn.dataset.act === 'toggle') {
        if (user.active && !confirm(`¿Desactivar a ${user.name}? Ya no podrá ingresar.`)) return;
        await authService.updateUser(user.uid, { active: !user.active });
      } else if (btn.dataset.act === 'role') {
        await authService.updateUser(user.uid, { role: user.role === 'admin' ? 'operario' : 'admin' });
      } else if (btn.dataset.act === 'reset') {
        await authService.resetPassword(user.email);
        uiManager.showToast(`Enlace de restablecimiento enviado a ${user.email}.`, 'info', 5000);
      }
    } catch (err) {
      uiManager.showToast(mapAuthError(err), 'error');
    }
  });

  $('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('userName').value.trim();
    const email = $('userEmail').value.trim();
    const password = $('userPass').value;
    if (password.length < MIN_PASSWORD) {
      return uiManager.showToast(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, 'error');
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await authService.createUser({ name, email, password, role: $('userRole').value });
      uiManager.showToast(`Usuario ${name} creado. Entrégale la contraseña inicial.`, 'success');
      e.target.reset();
      uiManager.closeModal('userModal');
    } catch (err) {
      uiManager.showToast(mapAuthError(err), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}
