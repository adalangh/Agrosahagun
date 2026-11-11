/**
 * @fileoverview Servicio de Exportación y Descarga de Datos (CSV y JSON).
 * Soporta codificación UTF-8 con BOM para visualización perfecta en Microsoft Excel.
 */

function escapeCsvField(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export class ExportService {
  /**
   * Exporta la bitácora de campo a un archivo CSV estructurado
   * @param {Array} logs
   * @param {Array} crops
   */
  exportLogsToCSV(logs = [], crops = []) {
    if (!logs || logs.length === 0) {
      throw new Error('No existen registros de campo para exportar.');
    }

    const cropMap = new Map(crops.map(c => [c.id, c.name]));

    const headers = [
      'ID Registro',
      'Fecha',
      'Hora',
      'ID Cultivo',
      'Nombre Cultivo',
      'Labor Realizada',
      'Valor Registrado',
      'Notas / Observaciones',
      'Sincronizado en Nube'
    ];

    const rows = logs.map(l => {
      const dateObj = l.timestamp ? new Date(l.timestamp) : new Date();
      const dateStr = dateObj.toLocaleDateString('es-CO');
      const timeStr = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      const cropName = cropMap.get(l.cropId) || 'No asignado';
      const isSynced = l.synced ? 'SI (Firebase)' : 'NO (Pendiente)';

      return [
        l.id,
        dateStr,
        timeStr,
        l.cropId || '',
        cropName,
        l.type || '',
        l.value || '',
        l.notes || '',
        isSynced
      ].map(escapeCsvField).join(',');
    });

    // Añadir UTF-8 BOM (\uFEFF) para compatibilidad con Excel
    const csvContent = '\uFEFF' + [headers.map(escapeCsvField).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AgroSahagun_Historial_Campo_${now}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exporta todo el estado del sistema a formato JSON para copias de seguridad
   * @param {object} state
   */
  exportStateBackupJSON(state) {
    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AgroSahagun_Backup_${now}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
