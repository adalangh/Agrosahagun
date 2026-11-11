/**
 * @fileoverview Servicio de Persistencia en Firebase Realtime Database.
 * Provee operaciones granulares (CRUD), sincronización bidireccional,
 * resolución de conflictos offline y detección nativa de conectividad.
 */

import { initializeFirebase, DB_PATHS } from './config.firebase-config.js';
import { storageService } from './services.storage-service.js';

export class FirebaseService {
  constructor() {
    this.db = initializeFirebase();
    this.isActuallyConnected = false;
    this.isSimulatedOffline = storageService.getSimulatedOffline();
    this.onDataChangeCallback = null;
    this.onConnectionChangeCallback = null;
    this.isSyncing = false;

    this.setupConnectionListeners();
  }

  /**
   * Configura detectores de conectividad (Firebase .info/connected y eventos de ventana)
   * @private
   */
  setupConnectionListeners() {
    if (this.db) {
      const connectedRef = this.db.ref(DB_PATHS.CONNECTED);
      connectedRef.on('value', (snap) => {
        this.isActuallyConnected = snap.val() === true;
        this.notifyConnectionState();

        // Si se restablece la conexión real y no está en modo simulado, sincronizar pendientes
        if (this.isOnline() && storageService.getPendingCount() > 0) {
          console.info('[FirebaseService] Conexión detectada. Sincronizando cola offline...');
          this.syncOfflineQueue().catch(err => {
            console.error('[FirebaseService] Error en auto-sincronización:', err);
          });
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.info('[FirebaseService] Evento de navegador: En línea.');
        if (!this.isSimulatedOffline && this.db) {
          this.db.goOnline();
        }
        this.notifyConnectionState();
      });

      window.addEventListener('offline', () => {
        console.warn('[FirebaseService] Evento de navegador: Sin conexión.');
        this.notifyConnectionState();
      });
    }
  }

  /**
   * Determina si la aplicación está operando en línea (conexión real y no simulada)
   * @returns {boolean}
   */
  isOnline() {
    return this.isActuallyConnected && !this.isSimulatedOffline;
  }

  /**
   * Retorna el estado descriptivo de conectividad
   * @returns {{isOnline: boolean, isSimulated: boolean, text: string, cssClass: string}}
   */
  getConnectionStatus() {
    if (this.isSimulatedOffline) {
      return {
        isOnline: false,
        isSimulated: true,
        text: 'Modo Offline (Simulado)',
        cssClass: 'status off'
      };
    }

    if (!this.isActuallyConnected) {
      return {
        isOnline: false,
        isSimulated: false,
        text: 'Sin señal de red (Local)',
        cssClass: 'status off'
      };
    }

    return {
      isOnline: true,
      isSimulated: false,
      text: 'Firebase Cloud (En línea)',
      cssClass: 'status'
    };
  }

  /**
   * Notifica a los observadores sobre cambios de conectividad
   * @private
   */
  notifyConnectionState() {
    if (typeof this.onConnectionChangeCallback === 'function') {
      this.onConnectionChangeCallback(this.getConnectionStatus());
    }
  }

  /**
   * Cambia el modo de simulación de desconexión
   * @param {boolean} simulateOffline
   */
  setSimulatedOffline(simulateOffline) {
    this.isSimulatedOffline = Boolean(simulateOffline);
    storageService.setSimulatedOffline(this.isSimulatedOffline);

    if (this.db) {
      if (this.isSimulatedOffline) {
        this.db.goOffline();
      } else {
        this.db.goOnline();
      }
    }

    this.notifyConnectionState();

    if (!this.isSimulatedOffline && this.isOnline() && storageService.getPendingCount() > 0) {
      this.syncOfflineQueue().catch(err => {
        console.error('[FirebaseService] Error al sincronizar tras reanudar:', err);
      });
    }
  }

  /**
   * Normaliza una colección de Firebase que puede venir como Array u Objeto llave-valor
   * @param {any} data
   * @returns {Array<object>}
   */
  normalizeCollection(data) {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data
        .filter(item => item !== null && item !== undefined)
        .map(item => ({
          ...item,
          id: String(item.id || Date.now())
        }));
    }

    if (typeof data === 'object') {
      return Object.entries(data)
        .filter(([_, val]) => val !== null && val !== undefined)
        .map(([key, val]) => ({
          ...val,
          id: String(val.id || key)
        }));
    }

    return [];
  }

  /**
   * Inicializa la escucha reactiva de datos en Firebase RTDB
   * @param {Function} onDataChange
   */
  subscribeToDatabase(onDataChange) {
    this.onDataChangeCallback = onDataChange;

    if (!this.db) {
      console.warn('[FirebaseService] Base de datos no inicializada. Usando sólo caché local.');
      onDataChange?.(storageService.loadState());
      return;
    }

    // Se escuchan crops y logs por separado: /users solo lo puede leer un admin.
    const remote = { crops: null, logs: null };
    const merge = () => {
      if (remote.crops === null || remote.logs === null) return;
      const localState = storageService.loadState();

      // Conservar lo local aún no sincronizado para que un snapshot no lo borre
      const remoteLogIds = new Set(remote.logs.map(l => l.id));
      const unsyncedLogs = (localState.logs || []).filter(l => !l.synced && !remoteLogIds.has(l.id));

      const remoteCropIds = new Set(remote.crops.map(c => c.id));
      const pendingCrops = storageService.getOfflineQueue()
        .filter(q => q.action === 'SAVE_CROP')
        .map(q => q.payload)
        .filter(c => !remoteCropIds.has(c.id));

      const newState = { crops: [...remote.crops, ...pendingCrops], logs: [...remote.logs, ...unsyncedLogs] };
      storageService.saveState(newState);
      this.onDataChangeCallback?.(newState);
    };
    const onError = (error) => console.error('[FirebaseService] Error en listener de Firebase:', error);

    this.db.ref(DB_PATHS.CROPS).on('value', (snap) => { remote.crops = this.normalizeCollection(snap.val()); merge(); }, onError);
    this.db.ref(DB_PATHS.LOGS).on('value', (snap) => { remote.logs = this.normalizeCollection(snap.val()); merge(); }, onError);
  }

  /**
   * Guarda o actualiza un cultivo de forma granular
   * @param {object} crop
   * @returns {Promise<{success: boolean, offline: boolean}>}
   */
  async saveCrop(crop) {
    const currentState = storageService.loadState();
    const existingIndex = currentState.crops.findIndex(c => c.id === crop.id);

    if (existingIndex >= 0) {
      currentState.crops[existingIndex] = crop;
    } else {
      currentState.crops.push(crop);
    }
    storageService.saveState(currentState);

    if (this.isOnline() && this.db) {
      try {
        await this.db.ref(`${DB_PATHS.CROPS}/${crop.id}`).set(crop);
        return { success: true, offline: false };
      } catch (error) {
        console.warn('[FirebaseService] Falló escritura remota de cultivo, encolando offline:', error);
        storageService.enqueueAction('SAVE_CROP', 'crops', crop);
        return { success: true, offline: true };
      }
    } else {
      storageService.enqueueAction('SAVE_CROP', 'crops', crop);
      return { success: true, offline: true };
    }
  }

  /**
   * Elimina un cultivo de forma granular
   * @param {string} cropId
   * @returns {Promise<{success: boolean, offline: boolean}>}
   */
  async deleteCrop(cropId) {
    const currentState = storageService.loadState();
    currentState.crops = currentState.crops.filter(c => c.id !== cropId);
    storageService.saveState(currentState);

    if (this.isOnline() && this.db) {
      try {
        await this.db.ref(`${DB_PATHS.CROPS}/${cropId}`).remove();
        return { success: true, offline: false };
      } catch (error) {
        console.warn('[FirebaseService] Falló eliminación remota de cultivo, encolando offline:', error);
        storageService.enqueueAction('DELETE_CROP', 'crops', cropId);
        return { success: true, offline: true };
      }
    } else {
      storageService.enqueueAction('DELETE_CROP', 'crops', cropId);
      return { success: true, offline: true };
    }
  }

  /**
   * Guarda un registro de campo de forma granular
   * @param {object} log
   * @returns {Promise<{success: boolean, offline: boolean}>}
   */
  async saveLog(log) {
    const currentState = storageService.loadState();
    const isOnlineNow = this.isOnline() && this.db;

    const logWithMeta = {
      ...log,
      timestamp: log.timestamp || Date.now(),
      synced: Boolean(isOnlineNow)
    };

    currentState.logs.push(logWithMeta);
    storageService.saveState(currentState);

    if (isOnlineNow) {
      try {
        await this.db.ref(`${DB_PATHS.LOGS}/${logWithMeta.id}`).set(logWithMeta);
        return { success: true, offline: false };
      } catch (error) {
        console.warn('[FirebaseService] Falló escritura remota de registro, encolando offline:', error);
        logWithMeta.synced = false;
        storageService.saveState(currentState);
        storageService.enqueueAction('SAVE_LOG', 'logs', logWithMeta);
        return { success: true, offline: true };
      }
    } else {
      storageService.enqueueAction('SAVE_LOG', 'logs', logWithMeta);
      return { success: true, offline: true };
    }
  }

  /**
   * Elimina un registro de campo
   * @param {string} logId
   * @returns {Promise<{success: boolean, offline: boolean}>}
   */
  async deleteLog(logId) {
    const currentState = storageService.loadState();
    currentState.logs = currentState.logs.filter(l => l.id !== logId);
    storageService.saveState(currentState);

    if (this.isOnline() && this.db) {
      try {
        await this.db.ref(`${DB_PATHS.LOGS}/${logId}`).remove();
        return { success: true, offline: false };
      } catch (error) {
        console.warn('[FirebaseService] Falló eliminación remota de log, encolando offline:', error);
        storageService.enqueueAction('DELETE_LOG', 'logs', logId);
        return { success: true, offline: true };
      }
    } else {
      storageService.enqueueAction('DELETE_LOG', 'logs', logId);
      return { success: true, offline: true };
    }
  }

  /**
   * Procesa la cola offline y sincroniza atómicamente con Firebase
   * @returns {Promise<{success: boolean, syncedCount: number, error?: string}>}
   */
  async syncOfflineQueue() {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, error: 'Sincronización en curso.' };
    }

    if (!this.isOnline()) {
      return {
        success: false,
        syncedCount: 0,
        error: 'No se puede sincronizar: el sistema está en modo sin conexión.'
      };
    }

    const queue = storageService.getOfflineQueue();
    if (queue.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    this.isSyncing = true;
    let syncedCount = 0;

    try {
      const updates = {};
      const state = storageService.loadState();

      for (const item of queue) {
        if (item.action === 'SAVE_CROP') {
          updates[`${DB_PATHS.CROPS}/${item.payload.id}`] = item.payload;
        } else if (item.action === 'DELETE_CROP') {
          updates[`${DB_PATHS.CROPS}/${item.payload}`] = null;
        } else if (item.action === 'SAVE_LOG') {
          const logPayload = { ...item.payload, synced: true };
          updates[`${DB_PATHS.LOGS}/${item.payload.id}`] = logPayload;

          const localLog = state.logs.find(l => l.id === item.payload.id);
          if (localLog) localLog.synced = true;
        } else if (item.action === 'DELETE_LOG') {
          updates[`${DB_PATHS.LOGS}/${item.payload}`] = null;
        }
        syncedCount++;
      }

      // Ejecutar actualización multi-ruta atómica en Firebase
      await this.db.ref().update(updates);

      // Limpiar cola y marcar todos los registros locales como sincronizados
      storageService.clearQueue();
      state.logs.forEach(l => { l.synced = true; });
      storageService.saveState(state);

      if (typeof this.onDataChangeCallback === 'function') {
        this.onDataChangeCallback(state);
      }

      return { success: true, syncedCount };
    } catch (error) {
      console.error('[FirebaseService] Error durante sincronización por lotes:', error);
      return { success: false, syncedCount, error: error.message };
    } finally {
      this.isSyncing = false;
      this.notifyConnectionState();
    }
  }
}

export const firebaseService = new FirebaseService();
