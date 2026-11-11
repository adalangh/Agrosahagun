/**
 * @fileoverview Catálogo Agronómico de Cultivos de la Región (Sahagún, Córdoba).
 * Provee factores Kc base (FAO-56), frecuencias de riego y metadatos.
 */

export const CROP_CATALOG = {
  'Frijol': {
    name: 'Frijol',
    icon: '🫘',
    kcBase: 1.05,
    freq: 'Riego cada 4-5 días',
    moistureMin: 40,
    moistureMax: 70,
    description: 'Leguminosa de ciclo corto, alta susceptibilidad a anegamiento y estrés hídrico en floración.'
  },
  'Ají dulce': {
    name: 'Ají dulce',
    icon: '🌶️',
    kcBase: 0.95,
    freq: 'Riego cada 3-4 días',
    moistureMin: 45,
    moistureMax: 75,
    description: 'Solanácea de alta demanda en desarrollo de frutos; requiere humedad constante y drenaje.'
  },
  'Berenjena': {
    name: 'Berenjena',
    icon: '🍆',
    kcBase: 1.05,
    freq: 'Riego cada 2-3 días',
    moistureMin: 50,
    moistureMax: 75,
    description: 'Cultivo de rápido crecimiento con alta transpiración foliar en clima cálido.'
  },
  'Pepino verde': {
    name: 'Pepino verde',
    icon: '🥒',
    kcBase: 1.10,
    freq: 'Riego cada 2 días',
    moistureMin: 55,
    moistureMax: 80,
    description: 'Cucurbitácea con alto contenido de agua; exige riegos frecuentes y ligeros.'
  },
  'Maíz': {
    name: 'Maíz',
    icon: '🌽',
    kcBase: 1.20,
    freq: 'Riego cada 3-4 días',
    moistureMin: 45,
    moistureMax: 75,
    description: 'Gramínea con demanda hídrica crítica durante la floración (aparición de estigmas) y llenado de grano.'
  },
  'Yuca': {
    name: 'Yuca',
    icon: '🥔',
    kcBase: 0.80,
    freq: 'Riego cada 10-15 días',
    moistureMin: 30,
    moistureMax: 65,
    description: 'Alta rusticidad y tolerancia a sequía periódica; vulnerable a pudrición radicular por exceso.'
  },
  'Ñame': {
    name: 'Ñame',
    icon: '🍠',
    kcBase: 1.00,
    freq: 'Riego semanal',
    moistureMin: 40,
    moistureMax: 70,
    description: 'Tubérculo tradicional de la sabana cordobesa; demanda humedad regular en fase de tuberización.'
  },
  'Plátano': {
    name: 'Plátano',
    icon: '🍌',
    kcBase: 1.10,
    freq: 'Riego cada 4-6 días',
    moistureMin: 50,
    moistureMax: 80,
    description: 'Demanda continua de lámina hídrica para mantener emisión foliar y peso del racimo.'
  },
  'Tomate': {
    name: 'Tomate',
    icon: '🍅',
    kcBase: 1.15,
    freq: 'Riego cada 2-3 días',
    moistureMin: 50,
    moistureMax: 75,
    description: 'Sensible al agrietamiento por fluctuaciones bruscas de humedad en el suelo.'
  }
};

export const CROP_STAGES = [
  'Preparación / Siembra',
  'Desarrollo vegetativo',
  'Floración / Fructificación',
  'Cosecha'
];

export const FIELD_LABOR_TYPES = [
  'Humedad del suelo',
  'Riego manual',
  'Fertilización',
  'Poda',
  'Manejo Fitosanitario',
  'Cosecha'
];

/**
 * Obtiene la información agronómica de un cultivo o retorna un valor seguro por defecto.
 * @param {string} cropName Nombre del cultivo
 * @returns {object} Metadatos agronómicos
 */
export function getCropInfo(cropName) {
  if (cropName && CROP_CATALOG[cropName]) {
    return CROP_CATALOG[cropName];
  }
  return {
    name: cropName || 'Desconocido',
    icon: '🌱',
    kcBase: 1.0,
    freq: 'Riego según requerimiento',
    moistureMin: 40,
    moistureMax: 70,
    description: 'Cultivo agrícola general'
  };
}
