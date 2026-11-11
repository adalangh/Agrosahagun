/**
 * @fileoverview Servicio de Almacenamiento Local y Cola de Mutaciones Offline.
 * Garantiza persistencia local resiliente ante cortes de red o caídas de servidor.
 */

const STORAGE_KEYS = {
  STATE_CACHE: 'agrosahagun_cache_v2',
  OFFLINE_QUEUE: 'agrosahagun_offline_queue_v2',
  SIMULATION_FLAG: 'agrosahagun_is_simulated_offline'
};

export class StorageService {
  constructor() {
    this.memoryCache = {
      crops: [],
      logs: []
    };
    this.memoryQueue = [];
    this.isLocalStorageAvailable = this.checkStorageAvailability();
  }

  /**
   * Verifica la disponibilidad de localStorage
   * @private
   * @returns {boolean}
   */
  checkStorageAvailability() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = '__agro_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('[StorageService] localStorage no disponible. Usando memoria volátil:', e);
      return false;
    }
  }

  /**
   * Carga el estado almacenado en caché local
   * @returns {{crops: Array, logs: Array}}
   */
  loadState() {
    if (!this.isLocalStorageAvailable) {
      return this.memoryCache;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.STATE_CACHE);
      if (!raw) return { crops: [], logs: [] };

      const parsed = JSON.parse(raw);
      return {
        crops: Array.isArray(parsed.crops) ? parsed.crops : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : []
      };
    } catch (error) {
      console.error('[StorageService] Error al parsear caché local:', error);
      return { crops: [], logs: [] };
    }
  }

  /**
   * Guarda el estado actual en caché local
   * @param {{crops: Array, logs: Array}} state
   */
  saveState(state) {
    const safeState = {
      crops: Array.isArray(state?.crops) ? state.crops : [],
      logs: Array.isArray(state?.logs) ? state.logs : []
    };

    this.memoryCache = safeState;

    if (!this.isLocalStorageAvailable) return;

    try {
      window.localStorage.setItem(STORAGE_KEYS.STATE_CACHE, JSON.stringify(safeState));
    } catch (error) {
      console.error('[StorageService] Error al guardar estado en localStorage:', error);
    }
  }

  /**
   * Obtiene la cola de mutaciones offline pendientes
   * @returns {Array<{id: string, action: string, entity: string, payload: any, timestamp: number}>}
   */
  getOfflineQueue() {
    if (!this.isLocalStorageAvailable) {
      return [...this.memoryQueue];
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[StorageService] Error al leer cola offline:', error);
      return [];
    }
  }

  /**
   * Agrega una operación a la cola offline
   * @param {'SAVE_CROP'|'DELETE_CROP'|'SAVE_LOG'|'DELETE_LOG'} action
   * @param {'crops'|'logs'} entity
   * @param {any} payload
   * @returns {object} Objeto de la acción creada
   */
  enqueueAction(action, entity, payload) {
    const queueItem = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      entity,
      payload,
      timestamp: Date.now()
    };

    const currentQueue = this.getOfflineQueue();
    currentQueue.push(queueItem);

    this.persistQueue(currentQueue);
    return queueItem;
  }

  /**
   * Elimina una acción específica de la cola offline tras sincronizarse
   * @param {string} actionId
   */
  removeAction(actionId) {
    const currentQueue = this.getOfflineQueue().filter(item => item.id !== actionId);
    this.persistQueue(currentQueue);
  }

  /**
   * Vacía completamente la cola offline
   */
  clearQueue() {
    this.persistQueue([]);
  }

  /**
   * Guarda la cola en almacenamiento
   * @private
   * @param {Array} queue
   */
  persistQueue(queue) {
    this.memoryQueue = queue;
    if (!this.isLocalStorageAvailable) return;

    try {
      window.localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[StorageService] Error al persistir cola offline:', error);
    }
  }

  /**
   * Retorna el número de operaciones en cola pendientes
   * @returns {number}
   */
  getPendingCount() {
    return this.getOfflineQueue().length;
  }

  /**
   * Obtiene la preferencia de simulación offline persistida
   * @returns {boolean}
   */
  getSimulatedOffline() {
    if (!this.isLocalStorageAvailable) return false;
    return window.localStorage.getItem(STORAGE_KEYS.SIMULATION_FLAG) === 'true';
  }

  /**
   * Persiste la preferencia de simulación offline
   * @param {boolean} isSimulated
   */
  setSimulatedOffline(isSimulated) {
    if (!this.isLocalStorageAvailable) return;
    window.localStorage.setItem(STORAGE_KEYS.SIMULATION_FLAG, String(isSimulated));
  }
}

export const storageService = new StorageService();
