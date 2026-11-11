/**
 * @fileoverview Configuración e Inicialización Centralizada de Firebase.
 * AgroSahagún - Sistema de monitoreo y persistencia en tiempo real.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyDvj6kt6Rtd1EtzrSWrVDtm5wIk4hIX89s",
  authDomain: "agrosahagun-d9bef.firebaseapp.com",
  databaseURL: "https://agrosahagun-d9bef-default-rtdb.firebaseio.com",
  projectId: "agrosahagun-d9bef",
  storageBucket: "agrosahagun-d9bef.firebasestorage.app",
  messagingSenderId: "303610277109",
  appId: "1:303610277109:web:671758b2767a045c3ee9bc",
  measurementId: "G-89YELBTXVL"
};

// Rutas raíz en Firebase Realtime Database
export const DB_PATHS = {
  ROOT: 'agrosahagun_db',
  CROPS: 'agrosahagun_db/crops',
  LOGS: 'agrosahagun_db/logs',
  USERS: 'agrosahagun_db/users',
  CONNECTED: '.info/connected'
};

/**
 * Inicializa y valida la instancia de Firebase Realtime Database
 * @returns {object|null} Instancia de Firebase Database
 */
export function initializeFirebase() {
  if (typeof window === 'undefined' || !window.firebase) {
    console.error('[FirebaseConfig] El SDK de Firebase no está cargado en window.firebase.');
    return null;
  }

  try {
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
      console.info('[FirebaseConfig] Firebase inicializado exitosamente.');
    }
    return window.firebase.database();
  } catch (error) {
    console.error('[FirebaseConfig] Error al inicializar Firebase:', error);
    return null;
  }
}
