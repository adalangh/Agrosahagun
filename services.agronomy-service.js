/**
 * @fileoverview Motor Analítico Agronómico basado en la metodología FAO-56.
 * Realiza cálculos de evapotranspiración de cultivo (ETc = Kc * ET0),
 * cálculo de lámina de agua por hectárea y volumen total según superficie sembrada.
 */

import { getCropInfo, getCropIrrigation } from './data.crop-catalog.js';

// Evapotranspiración de referencia representativa para Sahagún, Córdoba (mm/día)
export const ET0_SAHAGUN = 5.2;

// Factores de ajuste según etapa fenológica (Metodología FAO-56)
export const STAGE_KC_FACTORS = {
  'Preparación / Siembra': 0.50,
  'Desarrollo vegetativo': 0.80,
  'Floración / Fructificación': 1.10,
  'Cosecha': 0.70
};

export class AgronomyService {
  /**
   * Calcula el coeficiente Kc ajustado a la etapa fenológica
   * @param {string} cropName
   * @param {string} stage
   * @returns {number}
   */
  calculateKc(cropName, stage) {
    const info = getCropInfo(cropName);
    const baseKc = info.kcBase || 1.0;

    let stageFactor = 1.0;
    if (stage && STAGE_KC_FACTORS[stage] !== undefined) {
      stageFactor = STAGE_KC_FACTORS[stage];
    } else if (stage) {
      if (stage.includes('Siembra') || stage.includes('Preparación')) stageFactor = 0.50;
      else if (stage.includes('vegetativo')) stageFactor = 0.80;
      else if (stage.includes('Floración') || stage.includes('Fructificación')) stageFactor = 1.10;
      else if (stage.includes('Cosecha')) stageFactor = 0.70;
    }

    return Number((baseKc * stageFactor).toFixed(2));
  }

  /**
   * Realiza el análisis hídrico completo para un cultivo
   * @param {object} crop { name, area, stage }
   * @param {number} [et0=ET0_SAHAGUN]
   * @returns {{
   *   kc: number,
   *   etc: number,
   *   volumenHa: number,
   *   volumenTotalLote: number,
   *   freqRecomendada: string,
   *   areaNum: number
   * }}
   */
  calculateWaterRequirements(crop, et0 = ET0_SAHAGUN) {
    const areaNum = parseFloat(crop.area) || 0;
    const kc = this.calculateKc(crop.name, crop.stage);
    const etc = Number((et0 * kc).toFixed(2)); // mm/día

    // 1 mm de lámina = 10 m³ de agua por hectárea
    const volumenHa = Number((etc * 10).toFixed(1)); // m³/ha/día
    const volumenTotalLote = Number((volumenHa * areaNum).toFixed(1)); // m³/día para el lote completo

    return {
      kc,
      etc,
      volumenHa,
      volumenTotalLote,
      freqRecomendada: getCropIrrigation(crop),
      areaNum
    };
  }

  /**
   * Calcula estadísticas resumidas de los cultivos y registros
   * @param {Array} crops
   * @param {Array} logs
   * @param {Array} [currentMoistures=[]]
   * @returns {object}
   */
  calculateDashboardStats(crops = [], logs = [], currentMoistures = []) {
    const totalArea = crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0);
    const pendingLogs = logs.filter(l => !l.synced).length;

    let avgMoisture = '—';
    if (currentMoistures.length > 0) {
      const sum = currentMoistures.reduce((a, b) => a + b, 0);
      avgMoisture = (sum / currentMoistures.length).toFixed(1) + '%';
    }

    return {
      totalCrops: crops.length,
      totalLogs: logs.length,
      totalArea: Number(totalArea.toFixed(2)),
      pendingLogs,
      avgMoisture
    };
  }
}

export const agronomyService = new AgronomyService();
