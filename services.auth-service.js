/**
 * @fileoverview Autenticación (Firebase Auth) y gestión de usuarios.
 * El perfil de cada usuario vive en RTDB: agrosahagun_db/users/{uid}
 *   { name, email, role: 'admin' | 'operario', active, createdAt, createdBy }
 * Las reglas (database.rules.json) son las que realmente protegen los datos.
 */

import { firebaseConfig, DB_PATHS, initializeFirebase } from './config.firebase-config.js';

export const ROLES = { admin: 'Administrador', operario: 'Operario' };
export const MIN_PASSWORD = 8;

const ERRORS = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Verifica tu internet.',
  'auth/email-already-in-use': 'Ya existe un usuario con ese correo.',
  'auth/weak-password': `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
  PERMISSION_DENIED: 'No tienes permisos para esta acción.'
};

export function mapAuthError(err) {
  const key = err?.code || (String(err?.message || '').includes('PERMISSION_DENIED') ? 'PERMISSION_DENIED' : '');
  return ERRORS[key] || err?.message || 'Ocurrió un error inesperado.';
}

class AuthService {
  constructor() {
    this.profile = null;
  }

  get auth() { initializeFirebase(); return window.firebase.auth(); }
  get db() { return initializeFirebase(); }
  get isAdmin() { return this.profile?.role === 'admin'; }

  /** Escucha la sesión. cb(perfil) si hay acceso, cb(null, mensaje?) si no. */
  onSessionChange(cb) {
    this.auth.onAuthStateChanged(async (user) => {
      if (!user) { this.profile = null; return cb(null); }
      try {
        const snap = await this.db.ref(`${DB_PATHS.USERS}/${user.uid}`).once('value');
        const data = snap.val();
        if (!data || data.active !== true) {
          await this.auth.signOut();
          return cb(null, 'Tu cuenta no tiene acceso activo. Contacta al administrador.');
        }
        this.profile = { uid: user.uid, ...data };
        cb(this.profile);
      } catch (err) {
        await this.auth.signOut();
        cb(null, mapAuthError(err));
      }
    });
  }

  login(email, password) { return this.auth.signInWithEmailAndPassword(email, password); }
  logout() { return this.auth.signOut(); }
  resetPassword(email) { return this.auth.sendPasswordResetEmail(email); }

  /**
   * Crea un usuario sin cerrar la sesión del admin: usa una app secundaria de
   * Firebase para que el alta no reemplace la sesión actual.
   */
  async createUser({ name, email, password, role }) {
    if (!this.isAdmin) throw new Error('Solo un administrador puede crear usuarios.');
    const fb = window.firebase;
    const second = fb.apps.find((a) => a.name === 'creator') || fb.initializeApp(firebaseConfig, 'creator');
    const cred = await second.auth().createUserWithEmailAndPassword(email, password);
    try {
      await this.db.ref(`${DB_PATHS.USERS}/${cred.user.uid}`).set({
        name, email, role, active: true, createdAt: Date.now(), createdBy: this.profile.uid
      });
    } finally {
      await second.auth().signOut();
    }
    return cred.user.uid;
  }

  /** Lista en vivo; devuelve la función para dejar de escuchar. */
  watchUsers(cb, onError) {
    const ref = this.db.ref(DB_PATHS.USERS);
    ref.on('value', (snap) => {
      const val = snap.val() || {};
      cb(Object.entries(val).map(([uid, u]) => ({ uid, ...u })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }, onError);
    return () => ref.off('value');
  }

  updateUser(uid, patch) {
    if (!this.isAdmin) throw new Error('Solo un administrador puede modificar usuarios.');
    return this.db.ref(`${DB_PATHS.USERS}/${uid}`).update(patch);
  }
}

export const authService = new AuthService();
