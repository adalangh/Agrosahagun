/**
 * @fileoverview Simulador de Telemetría IoT en Tiempo Real para Cultivos.
 * Genera variaciones realistas de humedad de suelo, temperatura ambiente y humedad relativa,
 * renderiza gráficos vectoriales SVG sparklines y emite alertas agronómicas automáticas.
 */

import { getCropInfo } from './data.crop-catalog.js';

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export class SensorsSimulator {
  constructor() {
    this.history = {};
    this.timerId = null;
    this.onTelemetryUpdate = null;
  }

  /**
   * Genera el SVG vectorial de la gráfica de tendencia (sparkline)
   * @param {number[]} values
   * @param {boolean} isCritical
   * @returns {string} SVG en formato string
   */
  generateSparklineSVG(values, isCritical) {
    if (!values || values.length < 2) return '';

    const width = 260;
    const height = 44;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;

    const points = values.map((val, idx) => {
      const x = ((idx / (values.length - 1)) * width).toFixed(1);
      const y = (height - 4 - ((val - min) / range) * (height - 8)).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    const strokeColor = isCritical ? '#c94b43' : '#238557';

    return `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="spark" aria-label="Gráfica de tendencia">
        <polyline points="${points}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
    `;
  }

  /**
   * Ejecuta un ciclo de muestreo para todos los cultivos activos
   * @param {Array} crops
   * @returns {{
   *   cardsData: Array,
   *   alerts: Array<{type: string, message: string}>,
   *   globalMoistures: number[]
   * }}
   */
  tick(crops = []) {
    const cardsData = [];
    const alerts = [];
    const globalMoistures = [];

    if (!crops || crops.length === 0) {
      return { cardsData: [], alerts: [], globalMoistures: [] };
    }

    for (const crop of crops) {
      if (!this.history[crop.id]) {
        this.history[crop.id] = {
          moist: Array.from({ length: 15 }, () => randomRange(35, 65)),
          temp: randomRange(28, 34),
          airHum: randomRange(60, 80)
        };
      }

      const h = this.history[crop.id];
      const lastMoist = h.moist[h.moist.length - 1];

      // Variación aleatoria suave con tendencia hacia zona operativa
      const deltaMoist = randomRange(-2.5, 2.2);
      const newMoist = Math.max(12, Math.min(88, lastMoist + deltaMoist));
      h.moist.push(newMoist);
      h.moist.shift();

      h.temp = Math.max(20, Math.min(42, h.temp + randomRange(-0.4, 0.4)));
      h.airHum = Math.max(30, Math.min(95, h.airHum + randomRange(-1.2, 1.2)));

      const currentMoisture = Number(newMoist.toFixed(1));
      globalMoistures.push(currentMoisture);

      const info = getCropInfo(crop.name);
      const isCritical = currentMoisture < 28;
      const isLow = currentMoisture >= 28 && currentMoisture < (info.moistureMin || 40);
      const isSaturated = currentMoisture > 75;

      let statusBadge = { label: 'Óptimo', cssClass: 'tag' };
      if (isCritical) {
        statusBadge = { label: 'Estrés Severo', cssClass: 'tag danger' };
        alerts.push({
          type: 'danger',
          message: `<b>Alerta Crítica:</b> El lote de ${info.icon} ${crop.name} registra estrés hídrico severo (${currentMoisture}%). Requiere riego urgente.`
        });
      } else if (isLow) {
        statusBadge = { label: 'Humedad Baja', cssClass: 'tag warn' };
        alerts.push({
          type: 'warn',
          message: `<b>Aviso:</b> El lote de ${info.icon} ${crop.name} presenta humedad reducida (${currentMoisture}%). Programar riego.`
        });
      } else if (isSaturated) {
        statusBadge = { label: 'Suelo Saturado', cssClass: 'tag warn' };
        alerts.push({
          type: 'warn',
          message: `<b>Atención:</b> El lote de ${info.icon} ${crop.name} presenta saturación de humedad (${currentMoisture}%). Revisar drenaje.`
        });
      }

      cardsData.push({
        crop,
        info,
        currentMoisture,
        temp: Number(h.temp.toFixed(1)),
        airHum: Number(h.airHum.toFixed(1)),
        isCritical,
        statusBadge,
        sparklineSvg: this.generateSparklineSVG(h.moist, isCritical)
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        type: 'success',
        message: '<b>✓ Condiciones estables:</b> Todos los sensores de los lotes reportan humedad en rangos agronómicos adecuados.'
      });
    }

    return { cardsData, alerts, globalMoistures };
  }

  /**
   * Inicia el ciclo automático de telemetría cada N milisegundos
   * @param {() => Array} getCropsCallback
   * @param {(data: object) => void} onUpdate
   * @param {number} [intervalMs=3500]
   */
  start(getCropsCallback, onUpdate, intervalMs = 3500) {
    this.stop();
    this.onTelemetryUpdate = onUpdate;

    const run = () => {
      const crops = typeof getCropsCallback === 'function' ? getCropsCallback() : [];
      const result = this.tick(crops);
      if (typeof this.onTelemetryUpdate === 'function') {
        this.onTelemetryUpdate(result);
      }
    };

    run();
    this.timerId = setInterval(run, intervalMs);
  }

  /**
   * Detiene el simulador
   */
  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Limpia el historial de un cultivo eliminado
   * @param {string} cropId
   */
  removeCropHistory(cropId) {
    if (this.history[cropId]) {
      delete this.history[cropId];
    }
  }
}

export const sensorsSimulator = new SensorsSimulator();
