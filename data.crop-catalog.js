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

/** Departamentos de Colombia (para registrar la ubicación del cultivo). */
export const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre',
  'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'
];

/** Municipios de Córdoba: se sugieren al escribir la ciudad (el campo sigue siendo libre). */
export const MUNICIPIOS_CORDOBA = [
  'Ayapel', 'Buenavista', 'Canalete', 'Cereté', 'Chimá', 'Chinú', 'Ciénaga de Oro', 'Cotorra',
  'La Apartada', 'Lorica', 'Los Córdobas', 'Momil', 'Montelíbano', 'Montería', 'Moñitos',
  'Planeta Rica', 'Pueblo Nuevo', 'Puerto Escondido', 'Puerto Libertador', 'Purísima de la Concepción',
  'Sahagún', 'San Andrés de Sotavento', 'San Antero', 'San Bernardo del Viento', 'San Carlos',
  'San José de Uré', 'San Pelayo', 'Tierralta', 'Tuchín', 'Valencia'
];

/** Valores por defecto del formulario (la finca de la app). Se pueden cambiar al registrar. */
export const DEFAULT_LOCATION = {
  departamento: 'Córdoba',
  ciudad: 'Sahagún',
  vereda: 'Salguerito'
};

/** Sugerencias para el campo "Riego sugerido". Vacío = automático según la especie. */
export const IRRIGATION_SUGGESTIONS = [
  'Riego diario',
  'Riego cada 2 días',
  'Riego cada 2-3 días',
  'Riego cada 3-4 días',
  'Riego cada 4-5 días',
  'Riego cada 4-6 días',
  'Riego semanal',
  'Riego cada 10-15 días'
];

/**
 * Riego sugerido de un cultivo: el valor que el usuario editó o, si no hay,
 * el del catálogo según la especie.
 * @param {{name?: string, irrigation?: string}} crop
 * @returns {string}
 */
export function getCropIrrigation(crop) {
  const custom = typeof crop?.irrigation === 'string' ? crop.irrigation.trim() : '';
  return custom || getCropInfo(crop?.name).freq;
}

/**
 * Texto legible de la ubicación: "Vereda · Ciudad, Departamento".
 * @param {{departamento?: string, ciudad?: string, vereda?: string}} [loc]
 * @returns {string} Cadena vacía si el cultivo no tiene ubicación.
 */
export function formatLocation(loc) {
  if (!loc) return '';
  const place = [loc.ciudad, loc.departamento].filter(Boolean).join(', ');
  return [loc.vereda, place].filter(Boolean).join(' · ');
}
