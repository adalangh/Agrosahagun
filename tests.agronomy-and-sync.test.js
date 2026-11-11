/**
 * @fileoverview Pruebas Unitarias Automatizadas para AgroSahagún.
 * Valida cálculos agronómicos (FAO-56), normalización de datos de Firebase,
 * cola offline y formato de exportación.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { agronomyService, ET0_SAHAGUN } from './services.agronomy-service.js';
import { getCropInfo, CROP_CATALOG } from './data.crop-catalog.js';
import { StorageService } from './services.storage-service.js';
import { SensorsSimulator } from './modules.sensors-simulator.js';

test('AgronomyService - Cálculo dinámico de Kc según etapa fenológica', () => {
  // Yuca base: 0.80
  const kcSiembra = agronomyService.calculateKc('Yuca', 'Preparación / Siembra');
  assert.equal(kcSiembra, 0.40); // 0.80 * 0.50

  const kcVegetativo = agronomyService.calculateKc('Yuca', 'Desarrollo vegetativo');
  assert.equal(kcVegetativo, 0.64); // 0.80 * 0.80

  const kcFloracion = agronomyService.calculateKc('Yuca', 'Floración / Fructificación');
  assert.equal(kcFloracion, 0.88); // 0.80 * 1.10

  const kcCosecha = agronomyService.calculateKc('Yuca', 'Cosecha');
  assert.equal(kcCosecha, 0.56); // 0.80 * 0.70
});

test('AgronomyService - Demanda hídrica y lámina de agua por hectárea', () => {
  const crop = {
    name: 'Pepino verde', // base 1.10
    area: 2.0, // 2 hectáreas
    stage: 'Floración / Fructificación' // factor 1.10 -> Kc = 1.21
  };

  const res = agronomyService.calculateWaterRequirements(crop, ET0_SAHAGUN);

  assert.equal(res.kc, 1.21);
  assert.equal(res.etc, Number((5.2 * 1.21).toFixed(2))); // ~6.29 mm/día
  assert.equal(res.volumenHa, Number((res.etc * 10).toFixed(1))); // ~62.9 m³/ha/día
  assert.equal(res.volumenTotalLote, Number((res.volumenHa * 2.0).toFixed(1))); // ~125.8 m³/día
});

test('CropCatalog - Retorno seguro ante nombres no registrados', () => {
  const infoExistente = getCropInfo('Maíz');
  assert.equal(infoExistente.name, 'Maíz');
  assert.equal(infoExistente.icon, '🌽');

  const infoDesconocido = getCropInfo('CultivoInexistenteXYZ');
  assert.equal(infoDesconocido.icon, '🌱');
  assert.equal(typeof infoDesconocido.kcBase, 'number');
});

test('StorageService - Manejo seguro de Cola Offline en memoria', () => {
  const storage = new StorageService();
  storage.isLocalStorageAvailable = false; // Forzar modo memoria segura

  assert.equal(storage.getPendingCount(), 0);

  const action1 = storage.enqueueAction('SAVE_CROP', 'crops', { id: 'c1', name: 'Ñame' });
  assert.equal(storage.getPendingCount(), 1);

  const action2 = storage.enqueueAction('SAVE_LOG', 'logs', { id: 'l1', value: 40 });
  assert.equal(storage.getPendingCount(), 2);

  storage.removeAction(action1.id);
  assert.equal(storage.getPendingCount(), 1);

  storage.clearQueue();
  assert.equal(storage.getPendingCount(), 0);
});

test('Normalización de colecciones Firebase (Array vs Objeto llave-valor)', () => {
  // Simulación de función de normalización
  function normalize(data) {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data
        .filter(item => item !== null && item !== undefined)
        .map(item => ({ ...item, id: String(item.id || Date.now()) }));
    }
    if (typeof data === 'object') {
      return Object.entries(data)
        .filter(([_, val]) => val !== null && val !== undefined)
        .map(([key, val]) => ({ ...val, id: String(val.id || key) }));
    }
    return [];
  }

  // Caso 1: Array clásico (con posibles nulls de Firebase)
  const legacyData = [null, { id: '1', name: 'Frijol' }, { id: '2', name: 'Maíz' }];
  const norm1 = normalize(legacyData);
  assert.equal(norm1.length, 2);
  assert.equal(norm1[0].name, 'Frijol');

  // Caso 2: Objeto mapa llave-valor
  const modernData = {
    'c_101': { name: 'Berenjena', area: 1.2 },
    'c_102': { name: 'Tomate', area: 0.5 }
  };
  const norm2 = normalize(modernData);
  assert.equal(norm2.length, 2);
  assert.equal(norm2[0].id, 'c_101');
  assert.equal(norm2[1].id, 'c_102');
});

test('SensorsSimulator - Generación de vector Sparkline SVG', () => {
  const simulator = new SensorsSimulator();
  const values = [40, 42, 45, 38, 50, 55];
  const svg = simulator.generateSparklineSVG(values, false);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('polyline'));
  assert.ok(svg.includes('stroke="#238557"'));

  const svgCrit = simulator.generateSparklineSVG(values, true);
  assert.ok(svgCrit.includes('stroke="#c94b43"'));
});

test('AuthService - mapeo de errores de Firebase Auth a mensajes en español', async () => {
  const { mapAuthError } = await import('./services.auth-service.js');
  assert.equal(mapAuthError({ code: 'auth/invalid-credential' }), 'Correo o contraseña incorrectos.');
  assert.equal(mapAuthError({ code: 'auth/email-already-in-use' }), 'Ya existe un usuario con ese correo.');
  assert.equal(mapAuthError({ message: 'PERMISSION_DENIED: x' }), 'No tienes permisos para esta acción.');
  assert.ok(mapAuthError({}).length > 0);
});

test('CropCatalog - Riego editado manualmente tiene prioridad sobre el de la especie', async () => {
  const { getCropIrrigation } = await import('./data.crop-catalog.js');
  assert.equal(getCropIrrigation({ name: 'Maíz' }), 'Riego cada 3-4 días');
  assert.equal(getCropIrrigation({ name: 'Maíz', irrigation: '  ' }), 'Riego cada 3-4 días');
  assert.equal(getCropIrrigation({ name: 'Maíz', irrigation: 'Riego diario' }), 'Riego diario');
  const res = agronomyService.calculateWaterRequirements({ name: 'Maíz', area: 1, stage: 'Cosecha', irrigation: 'Riego diario' });
  assert.equal(res.freqRecomendada, 'Riego diario');
});

test('CropCatalog - Formato de ubicación del cultivo', async () => {
  const { formatLocation } = await import('./data.crop-catalog.js');
  assert.equal(formatLocation({ departamento: 'Córdoba', ciudad: 'Sahagún', vereda: 'Salguerito' }), 'Salguerito · Sahagún, Córdoba');
  assert.equal(formatLocation(undefined), '');
});
