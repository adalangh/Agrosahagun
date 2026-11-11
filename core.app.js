/**
 * @fileoverview Orquestador Principal de la Aplicación (App Controller).
 * Coordina el ciclo de vida, eventos de usuario, sincronización de datos
 * y reactividad entre módulos.
 */

import { firebaseService } from './services.firebase-service.js';
import { storageService } from './services.storage-service.js';
import { agronomyService } from './services.agronomy-service.js';
import { sensorsSimulator } from './modules.sensors-simulator.js';
import { exportService } from './modules.export-service.js';
import { uiManager } from './ui.ui-manager.js';
import { authService } from './services.auth-service.js';
import { bindLoginForm, showLogin, showApp } from './ui.auth-ui.js';

class AppController {
  constructor() {
    this.state = {
      crops: [],
      logs: []
    };
    this.latestTelemetry = {
      globalMoistures: []
    };
    this.started = false;
  }

  /** Punto de entrada: la app solo arranca con una sesión válida. */
  init() {
    bindLoginForm();
    if (!window.firebase) {
      showLogin('No se pudo cargar Firebase. Revisa tu conexión o desactiva el bloqueador de anuncios y recarga.');
      return;
    }
    try {
    authService.onSessionChange((profile, message) => {
      if (!profile) {
        if (this.started) { window.location.reload(); return; } // cierre de sesión: limpia listeners
        showLogin(message);
        return;
      }
      showApp(profile);
      if (!this.started) { this.started = true; this.startSession(); }
    });
    } catch (err) {
      console.error(err);
      showLogin('Error al iniciar la sesión: ' + (err.message || err));
    }
  }

  /**
   * Inicializa la aplicación completa
   */
  async startSession() {
    console.info('[AgroSahagún] Sesión iniciada. Cargando datos...');

    // 1. Cargar caché local inmediato para render inicial ultra-rápido
    this.state = storageService.loadState();

    // 2. Configurar UI y navegación
    uiManager.setupNavigation(() => {
      this.refreshUI();
    });

    // 3. Configurar escuchas de eventos en el DOM
    this.bindEvents();

    // 4. Suscribirse a Firebase Realtime Database
    firebaseService.subscribeToDatabase((newState) => {
      console.info('[AgroSahagún] Actualización recibida de Firebase o caché local.');
      this.state = newState;
      this.refreshUI();
    });

    // 5. Suscribirse a cambios de estado de conectividad
    firebaseService.onConnectionChangeCallback = (status) => {
      uiManager.renderConnectionState(status, storageService.getPendingCount());
    };

    // 6. Iniciar telemetría de sensores IoT en vivo
    sensorsSimulator.start(
      () => this.state.crops,
      (telemetry) => {
        this.latestTelemetry = telemetry;
        uiManager.renderSensorsGrid(telemetry.cardsData, telemetry.alerts);

        const stats = agronomyService.calculateDashboardStats(
          this.state.crops,
          this.state.logs,
          telemetry.globalMoistures
        );
        uiManager.renderStats(stats);
      },
      3000
    );

    // 7. Render inicial
    this.refreshUI();

    // Notificar bandera de arranque
    if (typeof window !== 'undefined') {
      window.__AGRO_APP_INITIALIZED__ = true;
    }
  }

  /**
   * Refresca todas las vistas con el estado actual
   */
  refreshUI() {
    const stats = agronomyService.calculateDashboardStats(
      this.state.crops,
      this.state.logs,
      this.latestTelemetry.globalMoistures
    );

    const connectionStatus = firebaseService.getConnectionStatus();
    const pendingCount = storageService.getPendingCount();

    uiManager.renderStats(stats);
    uiManager.renderConnectionState(connectionStatus, pendingCount);
    uiManager.renderCropsTable(this.state.crops, (cropId) => this.handleDeleteCrop(cropId));
    uiManager.renderCropSelectOptions(this.state.crops);
    uiManager.renderLogsTable(this.state.logs, this.state.crops, (logId) => this.handleDeleteLog(logId));
    uiManager.renderWaterAnalysis(this.state.crops);
    uiManager.renderLogChart(this.state.logs);
  }

  /**
   * Conecta los escuchadores de eventos del DOM
   */
  bindEvents() {
    // Formulario de nuevo cultivo
    const cropForm = document.getElementById('cropForm');
    if (cropForm) {
      cropForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateCrop();
      });
    }

    // Formulario de bitácora de campo
    const logForm = document.getElementById('logForm');
    if (logForm) {
      logForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateLog();
      });
    }

    // Botones de simulación de conectividad
    const btnSimOffline = document.getElementById('btnSimOffline');
    if (btnSimOffline) {
      btnSimOffline.addEventListener('click', () => {
        firebaseService.setSimulatedOffline(true);
        uiManager.showToast('Simulación: Red celular desactivada (Modo Local).', 'warn');
        this.refreshUI();
      });
    }

    const btnSimOnline = document.getElementById('btnSimOnline');
    if (btnSimOnline) {
      btnSimOnline.addEventListener('click', () => {
        firebaseService.setSimulatedOffline(false);
        uiManager.showToast('Simulación: Conexión a Firebase restablecida.', 'success');
        this.refreshUI();
      });
    }

    // Botón de sincronización manual
    const btnSyncNow = document.getElementById('btnSyncNow');
    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', async () => {
        await this.handleManualSync();
      });
    }

    // Botón de exportación CSV
    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => {
        try {
          exportService.exportLogsToCSV(this.state.logs, this.state.crops);
          uiManager.showToast('Reporte CSV descargado con éxito.', 'success');
        } catch (error) {
          uiManager.showToast(error.message, 'warn');
        }
      });
    }

    // Botón de respaldo JSON
    const btnExportJSON = document.getElementById('btnExportJSON');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', () => {
        exportService.exportStateBackupJSON(this.state);
        uiManager.showToast('Copia de respaldo JSON descargada.', 'success');
      });
    }

    // Botones para abrir modales
    document.querySelectorAll('[data-open-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.openModal;
        uiManager.openModal(modalId);
      });
    });

    // Botones para cerrar modales
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.closeModal;
        uiManager.closeModal(modalId);
      });
    });
  }

  /**
   * Manejador de creación de cultivo
   */
  async handleCreateCrop() {
    const cropNameEl = document.getElementById('cropName');
    const cropAreaEl = document.getElementById('cropArea');
    const cropStageEl = document.getElementById('cropStage');

    if (!cropNameEl || !cropAreaEl || !cropStageEl) return;

    const area = parseFloat(cropAreaEl.value);
    if (isNaN(area) || area <= 0) {
      uiManager.showToast('Ingresa un área sembrada válida (mayor a 0).', 'error');
      return;
    }

    const newCrop = {
      id: Date.now().toString(),
      name: cropNameEl.value.trim(),
      area: area,
      stage: cropStageEl.value
    };

    const res = await firebaseService.saveCrop(newCrop);

    if (res.offline) {
      uiManager.showToast('Cultivo guardado en caché local (Pendiente de sincronizar).', 'warn');
    } else {
      uiManager.showToast(`Cultivo "${newCrop.name}" guardado en Firebase Cloud.`, 'success');
    }

    uiManager.closeModal('cropModal');
    document.getElementById('cropForm').reset();
    this.refreshUI();
  }

  /**
   * Manejador de eliminación de cultivo
   * @param {string} cropId
   */
  async handleDeleteCrop(cropId) {
    const crop = this.state.crops.find(c => c.id === cropId);
    const cropName = crop ? crop.name : 'este cultivo';

    if (!confirm(`¿Estás seguro de eliminar el cultivo "${cropName}"? Se actualizará la nube y se recalcularán los riegos.`)) {
      return;
    }

    sensorsSimulator.removeCropHistory(cropId);
    const res = await firebaseService.deleteCrop(cropId);

    if (res.offline) {
      uiManager.showToast(`Cultivo eliminado localmente (sincronizará al reconectar).`, 'warn');
    } else {
      uiManager.showToast(`Cultivo "${cropName}" eliminado de Firebase Cloud.`, 'info');
    }

    this.refreshUI();
  }

  /**
   * Manejador de creación de registro de campo
   */
  async handleCreateLog() {
    const cropSelect = document.getElementById('logCrop');
    const typeSelect = document.getElementById('logType');
    const valueInput = document.getElementById('logValue');
    const notesInput = document.getElementById('logNotes');

    if (!cropSelect || !typeSelect || !valueInput) return;

    if (!cropSelect.value) {
      uiManager.showToast('Debes seleccionar o registrar un cultivo primero.', 'error');
      return;
    }

    const value = parseFloat(valueInput.value);
    if (isNaN(value)) {
      uiManager.showToast('Por favor introduce un valor numérico válido.', 'error');
      return;
    }

    const newLog = {
      id: Date.now().toString(),
      cropId: cropSelect.value,
      type: typeSelect.value,
      value: value,
      notes: notesInput ? notesInput.value.trim() : '',
      timestamp: Date.now()
    };

    const res = await firebaseService.saveLog(newLog);

    if (res.offline) {
      uiManager.showToast('Labor guardada en caché local (Sin señal).', 'warn');
    } else {
      uiManager.showToast('Labor registrada exitosamente en Firebase Cloud.', 'success');
    }

    document.getElementById('logForm').reset();
    this.refreshUI();
  }

  /**
   * Manejador de eliminación de registro
   * @param {string} logId
   */
  async handleDeleteLog(logId) {
    const res = await firebaseService.deleteLog(logId);

    if (res.offline) {
      uiManager.showToast('Registro eliminado localmente.', 'warn');
    } else {
      uiManager.showToast('Registro eliminado de Firebase Cloud.', 'info');
    }

    this.refreshUI();
  }

  /**
   * Manejador de sincronización manual
   */
  async handleManualSync() {
    const pendingCount = storageService.getPendingCount();

    if (!firebaseService.isOnline()) {
      uiManager.showToast('No se puede sincronizar: Conexión desactivada.', 'error');
      return;
    }

    if (pendingCount === 0) {
      uiManager.showToast('No hay operaciones pendientes. Todo está sincronizado.', 'info');
      return;
    }

    uiManager.showToast('Sincronizando registros con Firebase...', 'info', 2000);
    const result = await firebaseService.syncOfflineQueue();

    if (result.success) {
      uiManager.showToast(`✓ ¡Éxito! ${result.syncedCount} cambios sincronizados con la nube.`, 'success');
      this.refreshUI();
    } else {
      uiManager.showToast(`Error al sincronizar: ${result.error}`, 'error');
    }
  }
}

// Arranque de la aplicación
const app = new AppController();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

export { app };
