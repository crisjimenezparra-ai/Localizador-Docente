import * as XLSX from 'xlsx';
import {
  DiaSemana,
  Docente,
  ExcelValidationResult,
  HorarioTramo,
  RefuerzoCentro,
  TipoDef,
  Ubicacion,
} from '../types';
import { normalizeDia, timeToMinutes, areTeacherNamesEquivalent } from '../utils/timeUtils';

export const REQUIRED_SHEETS = ['DOCENTES', 'HORARIOS', 'UBICACIONES', 'TIPOS', 'REFUERZOS_CENTRO', 'INSTRUCCIONES'];
export const MANDATORY_HORARIOS_FIELDS = ['docente_id', 'nombre_docente', 'día', 'hora_inicio', 'hora_fin', 'actividad', 'tipo'];

/**
 * Normalizes header keys to lowercase trimmed string, removing accents
 */
function normalizeKey(key: string): string {
  return String(key || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Formats time cell from Excel (handles numeric decimals like 0.4375 or strings like "10:30")
 */
function formatExcelTime(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    // Excel time fraction of day: 1 = 24h
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  // e.g. "9:30" -> "09:30"
  if (str.includes(':')) {
    const parts = str.split(':');
    const h = String(parseInt(parts[0], 10)).padStart(2, '0');
    const m = String(parseInt(parts[1], 10)).padStart(2, '0');
    return `${h}:${m}`;
  }
  return str;
}

/**
 * Parses and validates an Excel ArrayBuffer
 */
export async function parseAndValidateExcel(fileData: ArrayBuffer): Promise<ExcelValidationResult> {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  const missingSheets = REQUIRED_SHEETS.filter(
    (req) => !sheetNames.some((s) => s.trim().toUpperCase() === req)
  );

  const sheetsFound = sheetNames.filter((s) =>
    REQUIRED_SHEETS.some((req) => req === s.trim().toUpperCase())
  );

  // Read DOCENTES sheet
  const docentesList: Docente[] = [];
  const docentesSheetName = sheetNames.find((s) => s.trim().toUpperCase() === 'DOCENTES');
  if (docentesSheetName) {
    const sheet = workbook.Sheets[docentesSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
    for (const row of rawRows) {
      const normalizedRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        normalizedRow[normalizeKey(k)] = v;
      }
      let id = String(normalizedRow['docente_id'] || normalizedRow['id'] || normalizedRow['codigo'] || '').trim();
      const nombre = String(
        normalizedRow['nombre_docente'] ||
        normalizedRow['nombre'] ||
        normalizedRow['profesor'] ||
        normalizedRow['profesora'] ||
        normalizedRow['docente'] ||
        normalizedRow['maestro'] ||
        normalizedRow['maestra'] ||
        ''
      ).trim();

      if (!id && nombre) {
        id = `D_${nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25)}`;
      }

      if (id && (nombre || id)) {
        docentesList.push({
          docente_id: id,
          nombre_docente: nombre || id,
          especialidad: normalizedRow['especialidad'] ? String(normalizedRow['especialidad']).trim() : undefined,
          email: normalizedRow['email'] ? String(normalizedRow['email']).trim() : undefined,
          telefono: normalizedRow['telefono'] ? String(normalizedRow['telefono']).trim() : undefined,
          observaciones: normalizedRow['observaciones'] ? String(normalizedRow['observaciones']).trim() : undefined,
        });
      }
    }
  }

  // Read UBICACIONES sheet
  const ubicacionesList: Ubicacion[] = [];
  const ubicSheetName = sheetNames.find((s) => s.trim().toUpperCase() === 'UBICACIONES');
  if (ubicSheetName) {
    const sheet = workbook.Sheets[ubicSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
    for (const row of rawRows) {
      const normalizedRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        normalizedRow[normalizeKey(k)] = v;
      }
      const codigo = String(normalizedRow['codigo'] || normalizedRow['ubicacion'] || '').trim();
      const nombre = String(normalizedRow['nombre'] || codigo).trim();
      if (codigo) {
        ubicacionesList.push({
          codigo,
          nombre,
          planta: normalizedRow['planta'] ? String(normalizedRow['planta']).trim() : undefined,
          edificio: normalizedRow['edificio'] ? String(normalizedRow['edificio']).trim() : undefined,
        });
      }
    }
  }

  // Read TIPOS sheet
  const tiposList: TipoDef[] = [];
  const tiposSheetName = sheetNames.find((s) => s.trim().toUpperCase() === 'TIPOS');
  if (tiposSheetName) {
    const sheet = workbook.Sheets[tiposSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
    for (const row of rawRows) {
      const normalizedRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        normalizedRow[normalizeKey(k)] = v;
      }
      const codigo = String(normalizedRow['codigo'] || normalizedRow['tipo'] || '').trim().toUpperCase();
      const nombre = String(normalizedRow['nombre'] || codigo).trim();
      if (codigo) {
        tiposList.push({
          codigo,
          nombre,
          categoria: (normalizedRow['categoria'] || 'DOCENCIA').toUpperCase(),
          color: String(normalizedRow['color'] || '#3b82f6').trim(),
        });
      }
    }
  }

  // Read REFUERZOS_CENTRO sheet
  const refuerzosList: RefuerzoCentro[] = [];
  const refuerzosSheetName = sheetNames.find((s) => s.trim().toUpperCase() === 'REFUERZOS_CENTRO');
  if (refuerzosSheetName) {
    const sheet = workbook.Sheets[refuerzosSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const normalizedRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        normalizedRow[normalizeKey(k)] = v;
      }
      const diaNorm = normalizeDia(normalizedRow['dia'] || normalizedRow['dia_semana']);
      if (diaNorm) {
        refuerzosList.push({
          id: `ref-${i + 1}`,
          dia: diaNorm,
          hora_inicio: formatExcelTime(normalizedRow['hora_inicio']),
          hora_fin: formatExcelTime(normalizedRow['hora_fin']),
          grupo_apoyado: String(normalizedRow['grupo_apoyado'] || normalizedRow['grupo'] || '').trim(),
          docente_refuerzo: String(normalizedRow['docente_refuerzo'] || normalizedRow['nombre_docente'] || '').trim(),
          materia: String(normalizedRow['materia'] || normalizedRow['actividad'] || '').trim(),
          observaciones: normalizedRow['observaciones'] ? String(normalizedRow['observaciones']).trim() : undefined,
        });
      }
    }
  }

  // Read HORARIOS sheet
  const validRows: HorarioTramo[] = [];
  const errorRows: { rowNumber: number; data: any; reason: string }[] = [];
  const warningRows: { rowNumber: number; data: any; reason: string }[] = [];
  let cursoDetectado = '2026/2027';

  const horariosSheetName = sheetNames.find((s) => s.trim().toUpperCase() === 'HORARIOS');
  if (!horariosSheetName) {
    return {
      isValid: false,
      sheetsFound,
      missingSheets,
      totalRowsHorarios: 0,
      totalRowsDocentes: docentesList.length,
      validRows: [],
      errorRows: [{ rowNumber: 0, data: null, reason: 'Falta la hoja principal obligatoria "HORARIOS".' }],
      warningRows: [],
      docentesList,
      ubicacionesList,
      tiposList,
      refuerzosList,
      cursoDetectado,
    };
  }

  const horariosSheet = workbook.Sheets[horariosSheetName];
  const rawHorarios = XLSX.utils.sheet_to_json<Record<string, any>>(horariosSheet);

  // Map for duplicate checking (preserves prior row info for clear conflict diagnostics)
  const seenSlots = new Map<
    string,
    {
      rowNumber: number;
      docenteId: string;
      nombreDocente: string;
      dia: string;
      horaInicio: string;
      horaFin: string;
      actividad: string;
      grupo?: string;
      ubicacion?: string;
    }
  >();

  rawHorarios.forEach((row, index) => {
    const rowNumber = index + 2; // +2 considering 1-based index and header row
    const normalizedRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      normalizedRow[normalizeKey(k)] = v;
    }

    let docenteId = String(
      normalizedRow['docente_id'] ||
      normalizedRow['id_docente'] ||
      normalizedRow['id'] ||
      normalizedRow['codigo_docente'] ||
      normalizedRow['codigo'] ||
      ''
    ).trim();

    let nombreDocente = String(
      normalizedRow['nombre_docente'] ||
      normalizedRow['nombre'] ||
      normalizedRow['profesor'] ||
      normalizedRow['profesora'] ||
      normalizedRow['maestro'] ||
      normalizedRow['maestra'] ||
      ''
    ).trim();

    // If teacher name or ID is in a generic 'docente' column
    if (!docenteId && !nombreDocente && normalizedRow['docente']) {
      const val = String(normalizedRow['docente']).trim();
      // Check if it matches an existing teacher
      const matched = docentesList.find(
        (d) =>
          d.docente_id.toLowerCase() === val.toLowerCase() ||
          d.nombre_docente.toLowerCase() === val.toLowerCase() ||
          areTeacherNamesEquivalent(d.nombre_docente, val)
      );
      if (matched) {
        docenteId = matched.docente_id;
        nombreDocente = matched.nombre_docente;
      } else {
        nombreDocente = val;
        docenteId = `D_${val.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25)}`;
      }
    } else {
      // Cross-resolve if one of them is missing
      if (!nombreDocente && docenteId) {
        const matched = docentesList.find(
          (d) =>
            d.docente_id.toLowerCase() === docenteId.toLowerCase() ||
            d.nombre_docente.toLowerCase() === docenteId.toLowerCase() ||
            areTeacherNamesEquivalent(d.nombre_docente, docenteId)
        );
        nombreDocente = matched ? matched.nombre_docente : docenteId;
      }
      if (!docenteId && nombreDocente) {
        const matched = docentesList.find(
          (d) =>
            d.nombre_docente.toLowerCase() === nombreDocente.toLowerCase() ||
            areTeacherNamesEquivalent(d.nombre_docente, nombreDocente)
        );
        docenteId = matched
          ? matched.docente_id
          : `D_${nombreDocente.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25)}`;
      }
    }

    const diaRaw = String(normalizedRow['dia'] || normalizedRow['dia_semana'] || '').trim();
    const dia = normalizeDia(diaRaw);

    let horaInicio = formatExcelTime(
      normalizedRow['hora_inicio'] || normalizedRow['inicio'] || normalizedRow['desde']
    );
    let horaFin = formatExcelTime(
      normalizedRow['hora_fin'] || normalizedRow['fin'] || normalizedRow['hasta']
    );

    // If hours are in a combined slot column e.g. "09:00 - 10:00"
    if ((!horaInicio || !horaFin) && (normalizedRow['tramo'] || normalizedRow['horario'] || normalizedRow['hora'])) {
      const tramoRaw = String(normalizedRow['tramo'] || normalizedRow['horario'] || normalizedRow['hora']).trim();
      const parts = tramoRaw.split(/[-–—aA]/);
      if (parts.length >= 2) {
        horaInicio = formatExcelTime(parts[0].trim());
        horaFin = formatExcelTime(parts[1].trim());
      }
    }

    const actividad = String(
      normalizedRow['actividad'] ||
      normalizedRow['materia'] ||
      normalizedRow['asignatura'] ||
      normalizedRow['tarea'] ||
      ''
    ).trim();

    const grupo = String(
      normalizedRow['grupo'] ||
      normalizedRow['curso'] ||
      normalizedRow['nivel'] ||
      normalizedRow['clase'] ||
      ''
    ).trim();

    const ubicacionRaw =
      normalizedRow['ubicacion'] !== undefined
        ? String(normalizedRow['ubicacion']).trim()
        : normalizedRow['aula'] !== undefined
        ? String(normalizedRow['aula']).trim()
        : normalizedRow['espacio'] !== undefined
        ? String(normalizedRow['espacio']).trim()
        : '';

    const tipo = String(normalizedRow['tipo'] || 'DOCENCIA').trim().toUpperCase();
    const cursoEscolar = String(normalizedRow['curso_escolar'] || normalizedRow['curso'] || '2026/2027').trim();
    const observaciones = normalizedRow['observaciones'] ? String(normalizedRow['observaciones']).trim() : undefined;
    const estadoRevision = normalizedRow['estado_revision'] ? String(normalizedRow['estado_revision']).trim() : 'OK';

    if (cursoEscolar && cursoEscolar !== '2026/2027') {
      cursoDetectado = cursoEscolar;
    }

    // Preserve normalized row data so diagnostic UI can display full details
    const rowPayload = {
      ...row,
      docenteId,
      nombreDocente,
      dia: dia || diaRaw,
      horaInicio,
      horaFin,
      actividad,
      grupo,
      ubicacion: ubicacionRaw,
      tipo,
      cursoEscolar,
    };

    // Required fields verification
    const missingFields: string[] = [];
    if (!docenteId) missingFields.push('docente_id');
    if (!nombreDocente) missingFields.push('nombre_docente');
    if (!dia) missingFields.push('día (debe ser Lunes-Viernes)');
    if (!horaInicio) missingFields.push('hora_inicio');
    if (!horaFin) missingFields.push('hora_fin');
    if (!actividad) missingFields.push('actividad');

    if (missingFields.length > 0) {
      errorRows.push({
        rowNumber,
        data: rowPayload,
        reason: `Campos obligatorios faltantes o inválidos: ${missingFields.join(', ')}`,
      });
      return;
    }

    // Validate time format and logic
    const startMin = timeToMinutes(horaInicio);
    const endMin = timeToMinutes(horaFin);

    if (isNaN(startMin) || isNaN(endMin) || startMin >= endMin) {
      errorRows.push({
        rowNumber,
        data: rowPayload,
        reason: `Rango de horas inválido: ${horaInicio} a ${horaFin} (inicio debe ser anterior a fin)`,
      });
      return;
    }

    // Duplicate check
    const slotKey = `${docenteId.toLowerCase()}_${dia}_${horaInicio}_${horaFin}`;
    if (seenSlots.has(slotKey)) {
      const conflicting = seenSlots.get(slotKey);
      errorRows.push({
        rowNumber,
        data: {
          ...rowPayload,
          conflictingWith: conflicting,
        },
        reason: `Tramo duplicado detectado para docente "${nombreDocente || docenteId}" el ${dia} de ${horaInicio} a ${horaFin}${
          conflicting ? ` (en conflicto con la fila ${conflicting.rowNumber})` : ''
        }`,
      });
      return;
    }
    seenSlots.set(slotKey, {
      rowNumber,
      docenteId,
      nombreDocente,
      dia: dia || diaRaw,
      horaInicio,
      horaFin,
      actividad,
      grupo,
      ubicacion: ubicacionRaw,
    });

    // Warnings for empty location or group
    if (!ubicacionRaw) {
      warningRows.push({
        rowNumber,
        data: rowPayload,
        reason: `Ubicación no especificada. La aplicación mostrará "Ubicación no especificada" respetando las directrices.`,
      });
    }

    // Valid row
    validRows.push({
      id: `slot-${index + 1}`,
      docente_id: docenteId,
      nombre_docente: nombreDocente,
      día: dia as DiaSemana,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      actividad,
      grupo: grupo || 'Sin grupo',
      ubicación: ubicacionRaw || 'Ubicación no especificada',
      tipo,
      curso_escolar: cursoEscolar,
      observaciones,
      estado_revision: estadoRevision,
    });

    // Populate docentesList if teacher wasn't explicitly in DOCENTES sheet
    if (!docentesList.some((d) => d.docente_id.toLowerCase() === docenteId.toLowerCase())) {
      docentesList.push({
        docente_id: docenteId,
        nombre_docente: nombreDocente,
      });
    }
  });

  return {
    isValid: errorRows.length === 0 && validRows.length > 0,
    sheetsFound,
    missingSheets,
    totalRowsHorarios: rawHorarios.length,
    totalRowsDocentes: docentesList.length,
    validRows,
    errorRows,
    warningRows,
    errors: errorRows,
    warnings: warningRows,
    docentesList,
    ubicacionesList,
    tiposList,
    refuerzosList,
    cursoDetectado,
  };
}

/**
 * Generates and downloads a complete, valid Excel template workbook (.xlsx)
 * pre-populated with example data and all 6 required sheets.
 */
export function exportExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // 1. DOCENTES
  const docentesData = [
    { docente_id: 'ana_gallego', nombre_docente: 'Ana Belén Gallego Martínez', especialidad: 'Música', email: 'agallego@centro.es' },
    { docente_id: 'cristina_jimenez', nombre_docente: 'Cristina Jiménez Parra', especialidad: 'Inglés', email: 'cjimenez@centro.es' },
    { docente_id: 'manuel_lopez', nombre_docente: 'Manuel López Ruiz', especialidad: 'Primaria (Tutor 3º)', email: 'mlopez@centro.es' },
    { docente_id: 'maria_sanchez', nombre_docente: 'María Sánchez Fernández', especialidad: 'Educación Infantil', email: 'msanchez@centro.es' },
    { docente_id: 'carlos_navarro', nombre_docente: 'Carlos Navarro Vega', especialidad: 'Educación Física', email: 'cnavarro@centro.es' },
  ];
  const wsDocentes = XLSX.utils.json_to_sheet(docentesData);
  XLSX.utils.book_append_sheet(wb, wsDocentes, 'DOCENTES');

  // 2. HORARIOS
  const horariosData = [
    {
      docente_id: 'ana_gallego',
      nombre_docente: 'Ana Belén Gallego Martínez',
      día: 'Lunes',
      hora_inicio: '09:30',
      hora_fin: '10:30',
      actividad: 'Música',
      grupo: '2º',
      ubicación: 'Aula de Música',
      tipo: 'DOCENCIA',
      curso_escolar: '2026/2027',
      observaciones: 'Material de percusión preparado',
      estado_revision: 'OK',
    },
    {
      docente_id: 'cristina_jimenez',
      nombre_docente: 'Cristina Jiménez Parra',
      día: 'Lunes',
      hora_inicio: '10:30',
      hora_fin: '11:30',
      actividad: 'Inglés',
      grupo: '4º',
      ubicación: '4º',
      tipo: 'DOCENCIA',
      curso_escolar: '2026/2027',
      observaciones: '',
      estado_revision: 'OK',
    },
    {
      docente_id: 'manuel_lopez',
      nombre_docente: 'Manuel López Ruiz',
      día: 'Lunes',
      hora_inicio: '10:30',
      hora_fin: '11:30',
      actividad: 'Coordinación Ciclo',
      grupo: '',
      ubicación: 'Sala de Profesores',
      tipo: 'COORDINACIÓN',
      curso_escolar: '2026/2027',
      observaciones: 'Reunión de segundo ciclo',
      estado_revision: 'OK',
    },
    {
      docente_id: 'maria_sanchez',
      nombre_docente: 'María Sánchez Fernández',
      día: 'Lunes',
      hora_inicio: '11:30',
      hora_fin: '12:00',
      actividad: 'Vigilancia de Recreo',
      grupo: 'Patio Infantil',
      ubicación: 'Patio Infantil',
      tipo: 'RECREO',
      curso_escolar: '2026/2027',
      observaciones: 'Turno A',
      estado_revision: 'OK',
    },
  ];
  const wsHorarios = XLSX.utils.json_to_sheet(horariosData);
  XLSX.utils.book_append_sheet(wb, wsHorarios, 'HORARIOS');

  // 3. UBICACIONES
  const ubicacionesData = [
    { codigo: 'INF 3', nombre: 'Aula Infantil 3 años', planta: 'Baja', edificio: 'Principal' },
    { codigo: '1º', nombre: 'Aula 1º Primaria', planta: '1ª Planta', edificio: 'Principal' },
    { codigo: '2º', nombre: 'Aula 2º Primaria', planta: '1ª Planta', edificio: 'Principal' },
    { codigo: '3º', nombre: 'Aula 3º Primaria', planta: '1ª Planta', edificio: 'Principal' },
    { codigo: '4º', nombre: 'Aula 4º Primaria', planta: '2ª Planta', edificio: 'Principal' },
    { codigo: 'Aula de Música', nombre: 'Aula Específica de Música', planta: 'Baja', edificio: 'Anexo' },
    { codigo: 'Gimnasio', nombre: 'Gimnasio y Pista Polideportiva', planta: 'Exterior', edificio: 'Pabellón' },
    { codigo: 'Sala de Profesores', nombre: 'Sala de Profesores', planta: 'Baja', edificio: 'Principal' },
    { codigo: 'Despacho Dirección', nombre: 'Despacho de Dirección', planta: 'Baja', edificio: 'Principal' },
  ];
  const wsUbicaciones = XLSX.utils.json_to_sheet(ubicacionesData);
  XLSX.utils.book_append_sheet(wb, wsUbicaciones, 'UBICACIONES');

  // 4. TIPOS
  const tiposData = [
    { codigo: 'DOCENCIA', nombre: 'Docencia en Aula', categoria: 'DOCENCIA', color: '#2563eb' },
    { codigo: 'REFUERZO', nombre: 'Apoyo y Refuerzo Educativo', categoria: 'APOYO', color: '#059669' },
    { codigo: 'COORDINACIÓN', nombre: 'Coordinación Docente / Ciclo', categoria: 'GESTION', color: '#d97706' },
    { codigo: 'EQUIPO_DIRECTIVO', nombre: 'Equipo Directivo', categoria: 'GESTION', color: '#7c3aed' },
    { codigo: 'DIRECCIÓN', nombre: 'Dirección del Centro', categoria: 'GESTION', color: '#7c3aed' },
    { codigo: 'SECRETARÍA', nombre: 'Secretaría', categoria: 'GESTION', color: '#7c3aed' },
    { codigo: 'JEFATURA', nombre: 'Jefatura de Estudios', categoria: 'GESTION', color: '#7c3aed' },
    { codigo: 'TDE', nombre: 'Transformación Digital Educativa', categoria: 'GESTION', color: '#0891b2' },
    { codigo: 'BIBLIOTECA', nombre: 'Gestión de Biblioteca Escolar', categoria: 'APOYO', color: '#475569' },
    { codigo: 'PLAN_APERTURA', nombre: 'Plan de Apertura', categoria: 'APOYO', color: '#ea580c' },
    { codigo: 'STEAM', nombre: 'Proyectos STEAM / Robótica', categoria: 'DOCENCIA', color: '#0284c7' },
    { codigo: 'REDUCCIÓN', nombre: 'Reducción Horaria', categoria: 'OTRO', color: '#64748b' },
    { codigo: 'RECREO', nombre: 'Vigilancia de Recreo', categoria: 'DESCANSO', color: '#e11d48' },
    { codigo: 'ITINERANCIA', nombre: 'Itinerancia entre Sedes', categoria: 'OTRO', color: '#ca8a04' },
    { codigo: 'OTROS', nombre: 'Otras funciones asignadas', categoria: 'OTRO', color: '#6b7280' },
  ];
  const wsTipos = XLSX.utils.json_to_sheet(tiposData);
  XLSX.utils.book_append_sheet(wb, wsTipos, 'TIPOS');

  // 5. REFUERZOS_CENTRO
  const refuerzosData = [
    { dia: 'Lunes', hora_inicio: '09:30', hora_fin: '10:30', grupo_apoyado: '3º', docente_refuerzo: 'Manuel López Ruiz', materia: 'Matemáticas' },
    { dia: 'Miércoles', hora_inicio: '12:00', hora_fin: '13:00', grupo_apoyado: '2º', docente_refuerzo: 'Ana Belén Gallego Martínez', materia: 'Comprensión Lectora' },
  ];
  const wsRefuerzos = XLSX.utils.json_to_sheet(refuerzosData);
  XLSX.utils.book_append_sheet(wb, wsRefuerzos, 'REFUERZOS_CENTRO');

  // 6. INSTRUCCIONES
  const instruccionesData = [
    {
      Sección: 'General',
      Indicación: 'La hoja principal para alimentar el buscador y horarios es "HORARIOS". Asegúrese de mantener los nombres de las columnas exactamente como se muestran.',
    },
    {
      Sección: 'Campos obligatorios HORARIOS',
      Indicación: 'docente_id, nombre_docente, día (Lunes-Viernes), hora_inicio (HH:MM), hora_fin (HH:MM), actividad, tipo.',
    },
    {
      Sección: 'Ubicación',
      Indicación: 'Si no se indica ubicación en la celda correspondiente, el sistema mostrará "Ubicación no especificada" sin inventar datos.',
    },
    {
      Sección: 'Formatos Horarios',
      Indicación: 'Use formato 24 horas: 09:00, 09:30, 10:30, 11:30, 12:00, 13:00, 14:00.',
    },
  ];
  const wsInstrucciones = XLSX.utils.json_to_sheet(instruccionesData);
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'INSTRUCCIONES');

  // Trigger download
  XLSX.writeFile(wb, 'Plantilla_Horarios_Centro_Educativo.xlsx');
}
