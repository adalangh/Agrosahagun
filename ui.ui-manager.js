/**
 * @fileoverview Gestor de Interfaz de Usuario (UI Manager).
 * Centraliza la manipulación del DOM, navegación por pestañas, modales, toasts
 * y renderizado reactivo de tablas, métricas, gráficas y alertas.
 */

import {
  getCropInfo, CROP_CATALOG, FIELD_LABOR_TYPES, DEPARTAMENTOS, MUNICIPIOS_CORDOBA,
  DEFAULT_LOCATION, IRRIGATION_SUGGESTIONS, getCropIrrigation, formatLocation
} from './data.crop-catalog.js';
import { agronomyService, ET0_SAHAGUN } from './services.agronomy-service.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UIManager {
  constructor() {
    this.toastTimer = null;
    this.activeModalId = null;
    this.setupGlobalModalListeners();
  }

  /**
   * Muestra una notificación emergente tipo Toast
   * @param {string} message
   * @param {'success'|'error'|'warn'|'info'} [type='success']
   * @param {number} [duration=3500]
   */
  showToast(message, type = 'success', duration = 3500) {
    const toastEl = document.getElementById('toast');
    const toastMsgEl = document.getElementById('toastMsg');
    const toastIconEl = document.getElementById('toastIcon');

    if (!toastEl || !toastMsgEl) return;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    const icons = {
      success: '✓',
      error: '✕',
      warn: '⚠️',
      info: 'ℹ️'
    };

    if (toastIconEl) {
      toastIconEl.innerText = icons[type] || '✓';
    }

    toastMsgEl.innerText = message;
    toastEl.className = `toast show toast-${type}`;

    this.toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  /**
   * Abre un modal por ID
   * @param {string} modalId
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      this.activeModalId = modalId;
      const firstInput = modal.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }
  }

  /**
   * Cierra un modal por ID
   * @param {string} modalId
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      if (this.activeModalId === modalId) {
        this.activeModalId = null;
      }
    }
  }

  /**
   * Configura eventos de escape y clic fuera para cerrar modales
   * @private
   */
  setupGlobalModalListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModalId) {
        this.closeModal(this.activeModalId);
      }
    });

    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModal(e.target.id);
      }
    });
  }

  /**
   * Configura la navegación por hash y botones del menú superior
   * @param {(pageId: string) => void} [onPageChange]
   */
  setupNavigation(onPageChange) {
    const nav = document.getElementById('nav');
    if (!nav) return;

    const navigateTo = (pageId) => {
      let targetId = pageId || 'inicio';
      let btn = document.querySelector(`nav button[data-page="${targetId}"]`);

      if (!btn) {
        targetId = 'inicio';
        btn = document.querySelector(`nav button[data-page="inicio"]`);
      }

      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

      if (btn) btn.classList.add('active');
      const pageEl = document.getElementById(targetId);
      if (pageEl) pageEl.classList.add('active');

      const titleEl = document.getElementById('pageTitle');
      if (titleEl && btn) {
        titleEl.innerText = btn.dataset.title || 'Panel general';
      }

      if (typeof onPageChange === 'function') {
        onPageChange(targetId);
      }
    };

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const pageId = btn.dataset.page;
      window.location.hash = pageId;
      navigateTo(pageId);
    });

    window.addEventListener('hashchange', () => {
      const currentHash = window.location.hash.substring(1) || 'inicio';
      navigateTo(currentHash);
    });

    const initialHash = window.location.hash.substring(1) || 'inicio';
    navigateTo(initialHash);
  }

  /**
   * Renderiza el estado de conexión en la barra superior y en el gestor de red
   * @param {{isOnline: boolean, isSimulated: boolean, text: string, cssClass: string}} status
   * @param {number} pendingCount
   */
  renderConnectionState(status, pendingCount) {
    const connEl = document.getElementById('connection');
    const syncLabelEl = document.getElementById('syncLabel');
    const connectTextEl = document.getElementById('connectText');
    const queueCountEl = document.getElementById('queueCount');
    const statPendingEl = document.getElementById('statPending');

    if (connEl) {
      connEl.innerText = `● ${status.text}`;
      connEl.className = status.cssClass;
    }

    if (syncLabelEl) {
      syncLabelEl.innerText = pendingCount > 0 ? `${pendingCount} en cola` : 'Sincronizado';
      syncLabelEl.style.color = pendingCount > 0 ? 'var(--orange)' : 'var(--muted)';
    }

    if (connectTextEl) {
      if (status.isSimulated) {
        connectTextEl.innerText = '⚠️ Modo simulador: Desconectado deliberadamente de la red celular.';
      } else if (!status.isOnline) {
        connectTextEl.innerText = '📡 Sin conexión real con Firebase. Guardando en memoria local.';
      } else {
        connectTextEl.innerText = '✓ Conexión en vivo con Firebase Realtime Database.';
      }
    }

    if (queueCountEl) {
      queueCountEl.innerText = pendingCount;
    }

    if (statPendingEl) {
      statPendingEl.innerText = pendingCount;
    }
  }

  /**
   * Renderiza las estadísticas globales en tarjetas
   * @param {object} stats
   */
  renderStats(stats) {
    const elCrops = document.getElementById('statCrops');
    const elLogs = document.getElementById('statLogs');
    const elMoist = document.getElementById('statMoisture');
    const elPending = document.getElementById('statPending');
    const elArea = document.getElementById('statArea');

    if (elCrops) elCrops.innerText = stats.totalCrops;
    if (elLogs) elLogs.innerText = stats.totalLogs;
    if (elMoist) elMoist.innerText = stats.avgMoisture;
    if (elPending) elPending.innerText = stats.pendingLogs;
    if (elArea) elArea.innerText = `${stats.totalArea} ha`;
  }

  /**
   * Renderiza la tabla de cultivos
   * @param {Array} crops
   * @param {(cropId: string) => void} onDeleteCrop
   * @param {(cropId: string) => void} [onEditCrop]
   */
  renderCropsTable(crops = [], onDeleteCrop, onEditCrop) {
    const container = document.getElementById('cropTable');
    if (!container) return;

    if (crops.length === 0) {
      container.innerHTML = '<div class="empty">No hay cultivos registrados en el sistema. Registra el primero para comenzar.</div>';
      return;
    }

    const rows = crops.map(c => {
      const info = getCropInfo(c.name);
      return `
        <tr>
          <td>
            <b style="font-size:14px; white-space:nowrap; display:flex; align-items:center; gap:6px;">
              <span>${info.icon}</span> <span>${esc(c.name)}</span>
            </b>
          </td>
          <td><b>${c.area}</b> ha</td>
          <td><span class="tag">${esc(c.stage)}</span></td>
          <td><small style="color:var(--muted)">${esc(getCropIrrigation(c))}</small>${c.irrigation ? ' <span class="tag" title="Riego definido manualmente">✎</span>' : ''}</td>
          <td class="loc-cell">${formatLocation(c.location)
            ? `<b>${esc(c.location.vereda || '—')}</b><br><small>${esc([c.location.ciudad, c.location.departamento].filter(Boolean).join(', '))}</small>`
            : '<small>Sin ubicación</small>'}</td>
          <td>
            <div class="row-actions">
              <button class="btn secondary btn-sm" data-edit-crop="${esc(c.id)}" title="Editar cultivo">Editar</button>
              <button class="btn danger btn-sm" data-delete-crop="${esc(c.id)}" title="Eliminar cultivo">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Especie</th>
            <th>Área</th>
            <th>Etapa de Desarrollo</th>
            <th>Riego Sugerido</th>
            <th>Ubicación</th>
            <th style="text-align:right">Acción</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    container.querySelectorAll('[data-delete-crop]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cropId = btn.dataset.deleteCrop;
        if (typeof onDeleteCrop === 'function') {
          onDeleteCrop(cropId);
        }
      });
    });

    container.querySelectorAll('[data-edit-crop]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof onEditCrop === 'function') onEditCrop(btn.dataset.editCrop);
      });
    });
  }

  /**
   * Prepara las listas y eventos del formulario de cultivo (se ejecuta una sola vez).
   */
  setupCropForm() {
    if (this.cropFormReady) return;
    const depSel = document.getElementById('cropDepartamento');
    const nameSel = document.getElementById('cropName');
    if (!depSel || !nameSel) return;
    this.cropFormReady = true;

    // defaultSelected hace que form.reset() vuelva a la finca por defecto
    depSel.innerHTML = DEPARTAMENTOS.map(d =>
      `<option value="${esc(d)}"${d === DEFAULT_LOCATION.departamento ? ' selected' : ''}>${esc(d)}</option>`
    ).join('');

    const irr = document.getElementById('irrigationList');
    if (irr) irr.innerHTML = IRRIGATION_SUGGESTIONS.map(s => `<option value="${esc(s)}"></option>`).join('');

    depSel.addEventListener('change', () => this.updateCityList());
    nameSel.addEventListener('change', () => this.updateIrrigationPlaceholder());
    this.updateCityList();
    this.updateIrrigationPlaceholder();
  }

  /** Sugiere los municipios de Córdoba solo cuando ese es el departamento elegido. */
  updateCityList() {
    const list = document.getElementById('ciudadList');
    const dep = document.getElementById('cropDepartamento');
    if (!list || !dep) return;
    list.innerHTML = dep.value === 'Córdoba'
      ? MUNICIPIOS_CORDOBA.map(m => `<option value="${esc(m)}"></option>`).join('')
      : '';
  }

  /** El placeholder del riego muestra la recomendación automática de la especie elegida. */
  updateIrrigationPlaceholder() {
    const input = document.getElementById('cropIrrigation');
    const name = document.getElementById('cropName');
    if (input && name) input.placeholder = `Automático: ${getCropInfo(name.value).freq}`;
  }

  /**
   * Deja el modal de cultivo en modo "registrar" (crop = null) o "editar" (crop = objeto).
   * @param {object|null} crop
   */
  prepareCropModal(crop = null) {
    this.setupCropForm();
    const form = document.getElementById('cropForm');
    if (!form) return;
    form.reset();

    const $ = (id) => document.getElementById(id);
    $('cropModalTitle').textContent = crop ? 'Editar cultivo' : 'Registrar nuevo cultivo';
    $('cropSubmitBtn').textContent = crop ? 'Guardar cambios' : 'Guardar en Firebase';

    if (crop) {
      const loc = crop.location || {};
      // Si la especie ya no está en el catálogo, se agrega para no perderla al editar
      const nameSel = $('cropName');
      if (![...nameSel.options].some(o => o.value === crop.name)) {
        nameSel.add(new Option(crop.name, crop.name));
      }
      nameSel.value = crop.name;
      $('cropArea').value = crop.area;
      $('cropStage').value = crop.stage;
      $('cropIrrigation').value = crop.irrigation || '';
      $('cropDepartamento').value = loc.departamento || DEFAULT_LOCATION.departamento;
      $('cropCiudad').value = loc.ciudad || '';
      $('cropVereda').value = loc.vereda || '';
    }
    this.updateCityList();
    this.updateIrrigationPlaceholder();
  }

  /**
   * Renderiza el selector de cultivos en el formulario de registros
   * @param {Array} crops
   */
  renderCropSelectOptions(crops = []) {
    const select = document.getElementById('logCrop');
    if (!select) return;

    if (crops.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No hay cultivos disponibles (Registre uno)</option>';
      return;
    }

    select.innerHTML = crops.map(c => {
      const info = getCropInfo(c.name);
      return `<option value="${c.id}">${info.icon} ${esc(c.name)} (${c.area} ha)</option>`;
    }).join('');
  }

  /**
   * Renderiza la tabla de bitácora de campo
   * @param {Array} logs
   * @param {Array} crops
   * @param {(logId: string) => void} onDeleteLog
   */
  renderLogsTable(logs = [], crops = [], onDeleteLog) {
    const container = document.getElementById('logTable');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = '<div class="empty">No hay registros de campo ingresados aún. Usa el formulario para registrar labores.</div>';
      return;
    }

    const cropMap = new Map(crops.map(c => [c.id, c]));

    const rows = logs.slice().reverse().map(l => {
      const crop = cropMap.get(l.cropId);
      const cName = crop ? crop.name : 'Cultivo eliminado';
      const info = getCropInfo(cName);
      const dateObj = l.timestamp ? new Date(l.timestamp) : new Date();
      const dateStr = dateObj.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
      const timeStr = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

      const syncBadge = l.synced
        ? '<span class="tag">✓ Firebase</span>'
        : '<span class="tag warn">⟳ Local</span>';

      return `
        <tr>
          <td style="color:var(--muted); font-size:11px; white-space:nowrap;">
            ${dateStr} <br><small>${timeStr}</small>
          </td>
          <td style="white-space:nowrap;">
            <b>${info.icon} ${esc(cName)}</b>
          </td>
          <td><b>${esc(l.type)}</b></td>
          <td>${l.value}</td>
          <td>${syncBadge}</td>
          <td style="text-align:right">
            <button class="btn ghost btn-sm" data-delete-log="${l.id}" title="Eliminar registro">
              ✕
            </button>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cultivo</th>
            <th>Labor</th>
            <th>Valor</th>
            <th>Estado</th>
            <th style="text-align:right"></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    container.querySelectorAll('[data-delete-log]').forEach(btn => {
      btn.addEventListener('click', () => {
        const logId = btn.dataset.deleteLog;
        if (typeof onDeleteLog === 'function') {
          onDeleteLog(logId);
        }
      });
    });
  }

  /**
   * Renderiza el bloque de análisis hídrico regional
   * @param {Array} crops
   */
  renderWaterAnalysis(crops = []) {
    const container = document.getElementById('analisisHidrico');
    if (!container) return;

    if (crops.length === 0) {
      container.innerHTML = '<div class="empty">Registra cultivos para ver el cálculo dinámico de evapotranspiración (ETc).</div>';
      return;
    }

    container.innerHTML = crops.map(c => {
      const req = agronomyService.calculateWaterRequirements(c, ET0_SAHAGUN);
      const info = getCropInfo(c.name);

      return `
        <div class="notice" style="background:white; border:1px solid var(--line); border-left: 4px solid var(--green2); margin-bottom:14px;">
          <h4 style="margin:0 0 10px; color:var(--ink); display:flex; justify-content:space-between; align-items:center;">
            <span>${info.icon} ${esc(c.name)} <small style="font-size:12px; font-weight:normal; color:var(--muted)">(${esc(c.stage)})</small></span>
            <span class="pill">${c.area} ha</span>
          </h4>
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; text-align:center; padding-top:8px; border-top:1px dashed var(--line);">
            <div>
              <small style="color:var(--muted)">Factor Kc</small><br>
              <b style="font-size:16px">${req.kc}</b>
            </div>
            <div>
              <small style="color:var(--muted)">ETc Diario</small><br>
              <b style="color:var(--orange); font-size:16px">${req.etc} mm</b>
            </div>
            <div>
              <small style="color:var(--muted)">Lámina / ha</small><br>
              <b style="color:#2a75d3; font-size:16px">${req.volumenHa} m³</b>
            </div>
            <div>
              <small style="color:var(--muted)">Demanda Lote</small><br>
              <b style="color:var(--green); font-size:16px">${req.volumenTotalLote} m³</b>
            </div>
          </div>
          <div style="margin-top:8px; padding-top:6px; font-size:11px; color:var(--muted); border-top:1px dotted var(--line);">
            💧 <b>Recomendación agronómica:</b> ${req.freqRecomendada}.
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza el gráfico de barras de actividades de campo
   * @param {Array} logs
   */
  renderLogChart(logs = []) {
    const chartEl = document.getElementById('logChart');
    if (!chartEl) return;

    if (logs.length === 0) {
      chartEl.innerHTML = '<div class="empty" style="width:100%">Sin registros aún para graficar la distribución de labores.</div>';
      return;
    }

    const types = FIELD_LABOR_TYPES.slice(0, 5);
    const counts = types.map(t => logs.filter(l => l.type === t).length);
    const max = Math.max(1, ...counts);

    chartEl.innerHTML = types.map((t, idx) => {
      const count = counts[idx];
      const heightPx = Math.max(8, Math.round((count / max) * 150));

      return `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:8px; min-width:65px;">
          <div style="width:min(44px, 100%); background:linear-gradient(180deg, var(--green2), var(--green)); border-radius:6px 6px 0 0; height:${heightPx}px; transition:height 0.4s ease;"></div>
          <b style="color:var(--ink); font-size:14px">${count}</b>
          <small style="font-size:10px; color:var(--muted); text-align:center; line-height:1.2;">
            ${t.split(' ')[0]}
          </small>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza las tarjetas de telemetría de sensores en vivo
   * @param {Array} cardsData
   * @param {Array} alerts
   */
  renderSensorsGrid(cardsData = [], alerts = []) {
    const grid = document.getElementById('liveGrid');
    const alertsEl = document.getElementById('homeAlerts');

    if (grid) {
      if (cardsData.length === 0) {
        grid.innerHTML = '<div class="empty" style="grid-column: 1/-1">No hay cultivos activos para monitorear. Registra un cultivo para activar la telemetría.</div>';
      } else {
        grid.innerHTML = cardsData.map(c => `
          <div class="mon-card" style="border-left: 5px solid ${c.isCritical ? 'var(--red)' : 'var(--green2)'}">
            <div class="mon-top">
              <div>
                <b style="font-size:16px">${c.info.icon} ${esc(c.crop.name)}</b>
                <div style="font-size:11px; color:var(--muted); margin-top:2px">${esc(c.crop.stage)}</div>
              </div>
              <span class="${c.statusBadge.cssClass}">${c.statusBadge.label}</span>
            </div>
            <div class="mon-val" style="${c.isCritical ? 'color:var(--red)' : ''}">
              ${c.currentMoisture}<small style="${c.isCritical ? 'color:var(--red)' : ''}">% humedad</small>
            </div>
            ${c.sparklineSvg}
            <div class="mon-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
              <div>🌡️ Temp: <b style="color:var(--ink)">${c.temp} °C</b></div>
              <div>💨 H. Aire: <b style="color:var(--ink)">${c.airHum} %</b></div>
              <div style="grid-column: 1/-1; padding: 6px 8px; background: rgba(35, 133, 87, 0.08); border-radius: 6px; color:var(--green); font-weight: 600; text-align:center; font-size:11px">
                💧 ${c.info.freq}
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    if (alertsEl) {
      if (alerts.length === 0) {
        alertsEl.innerHTML = '<div class="notice">Monitoreo inactivo.</div>';
      } else {
        alertsEl.innerHTML = alerts.map(a => `
          <div class="notice ${a.type === 'danger' ? 'danger-notice' : (a.type === 'warn' ? 'warn' : '')}">
            ${a.message}
          </div>
        `).join('');
      }
    }
  }
}

export const uiManager = new UIManager();
