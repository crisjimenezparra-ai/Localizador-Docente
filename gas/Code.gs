/**
 * ==============================================================================
 * LOCALIZADOR DOCENTE - BACKEND GOOGLE APPS SCRIPT & GOOGLE SHEETS
 * Centro: CEIP Antonio Gala
 * ==============================================================================
 * Este script proporciona la base de datos centralizada (Google Sheets) y el
 * servicio de autenticación/recuperación para el rol ADMIN multidispositivo.
 *
 * INSTRUCCIONES DE INSTALACIÓN RÁPIDA:
 * 1. Crea una hoja de cálculo en Google Drive (ej: "Localizador Docente - Datos").
 * 2. En la hoja de cálculo, ve a: Extensiones > Apps Script.
 * 3. Borra todo el código que haya y pega el contenido de este archivo (Code.gs).
 * 4. Pulsa en "Guardar" (icono de disquete).
 * 5. Pulsa en "Implementar" (botón azul arriba a la derecha) > "Nueva implementación".
 * 6. Tipo: "Aplicación web".
 *    - Descripción: "Localizador Docente API"
 *    - Ejecutar como: "Yo" (tu cuenta de Google Workspace o personal)
 *    - Quién tiene acceso: "Cualquier persona" (Any) [Permite que la app del centro consulte horarios]
 * 7. Pulsa "Implementar", concede los permisos de Google que te solicite.
 * 8. Copia la "URL de la aplicación web" (termina en /exec) y pégala en el panel
 *    de Administración de la app > "Conexión Google Sheets".
 * ==============================================================================
 */

// Nombres de las hojas de cálculo
var SHEETS = {
  HORARIOS: 'Horarios',
  DOCENTES: 'Docentes',
  UBICACIONES: 'Ubicaciones',
  TIPOS: 'Tipos',
  CONFIG: 'Configuracion'
};

var SCRIPT_PROP_KEYS = {
  ADMIN_HASH: 'ADMIN_PWD_HASH',
  ADMIN_SALT: 'ADMIN_PWD_SALT',
  ADMIN_EMAIL: 'ADMIN_EMAIL',
  RESET_CODE: 'ADMIN_RESET_CODE',
  RESET_EXPIRY: 'ADMIN_RESET_EXPIRY'
};

var DEFAULT_SALT = 'ceip_antonio_gala_localizador_2026_salt_';
var DEFAULT_INITIAL_PWD = '1234';

/**
 * Entrada principal GET (Web App o API)
 */
function doGet(e) {
  e = e || { parameter: {} };
  var action = e.parameter.action;

  // Si no se especifica acción o es 'app', se sirve la interfaz web o se redirige a la app
  if (!action || action === 'app') {
    try {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('Localizador Docente - CEIP Antonio Gala')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      // Redirección automática y directa a la aplicación web
      var appUrl = 'https://ais-pre-bpglhu6s3mivgewpe7qd7d-427301777664.europe-west2.run.app';
      var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<title>Cargando Localizador Docente...</title>'
        + '<style>'
        + '  body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }'
        + '  .card { text-align: center; padding: 2rem; border-radius: 1rem; background: #1e293b; border: 1px solid #334155; max-width: 420px; }'
        + '  .btn { display: inline-block; margin-top: 1.25rem; padding: 0.75rem 1.5rem; background: #059669; color: white; text-decoration: none; border-radius: 0.75rem; font-weight: bold; }'
        + '</style>'
        + '<script>'
        + '  window.top.location.href = "' + appUrl + '";'
        + '</script>'
        + '</head><body>'
        + '<div class="card">'
        + '  <h2 style="margin:0 0 0.5rem 0;">Localizador Docente</h2>'
        + '  <p style="color:#94a3b8; font-size: 0.9rem; margin:0;">Abriendo la aplicación del CEIP Antonio Gala...</p>'
        + '  <a class="btn" href="' + appUrl + '" target="_top">Entrar a la aplicación</a>'
        + '</div>'
        + '</body></html>';
      return HtmlService.createHtmlOutput(html)
        .setTitle('Localizador Docente - CEIP Antonio Gala')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  // Manejo de acciones API vía GET
  return jsonResponse(handleApiRequest(action, e.parameter));
}

/**
 * Entrada principal POST (API con cuerpo JSON)
 */
function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var body = {};

  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
      if (!action && body.action) {
        action = body.action;
      }
    } catch (err) {
      return jsonResponse({ success: false, error: 'Error al interpretar JSON de la petición: ' + err.toString() });
    }
  }

  return jsonResponse(handleApiRequest(action, body));
}

/**
 * Enrutador de peticiones API
 * NOTA CRÍTICA: Retorna un objeto JavaScript nativo.
 * doGet y doPost lo envuelven con jsonResponse(ContentService),
 * mientras que google.script.run lo devuelve directamente al cliente sin fallos de serialización.
 */
function handleApiRequest(action, params) {
  try {
    switch (action) {
      case 'test':
      case 'testConnection':
        return {
          success: true,
          message: 'Conexión establecida correctamente con Google Apps Script y Google Sheets.',
          timestamp: new Date().toISOString()
        };

      case 'getData':
        return getCenterData();

      case 'saveData':
        return saveCenterData(params);

      case 'login':
        return verifyAdminLogin(params.password);

      case 'changePassword':
        return changeAdminPassword(params.currentPassword, params.newPassword);

      case 'requestReset':
        return requestPasswordReset(params.email);

      case 'verifyReset':
        return verifyAndResetPassword(params.code, params.newPassword);

      case 'setupSheets':
        initSpreadsheetStructure();
        return { success: true, message: 'Estructura de pestañas verificada e inicializada.' };

      default:
        return { success: false, error: 'Acción desconocida: ' + action };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Error interno en Google Apps Script: ' + error.toString()
    };
  }
}

/**
 * Devuelve una respuesta HTTP JSON formateada (para peticiones externas /exec)
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// GESTIÓN DE BASE DE DATOS (GOOGLE SHEETS)
// ==============================================================================

/**
 * Obtiene la hoja de cálculo activa o vinculada
 */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // Si no está vinculada como contenedor, busca por propiedad
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (id) {
      return SpreadsheetApp.openById(id);
    }
    throw new Error('No se ha detectado ninguna hoja de cálculo vinculada. Abre el script desde Extensiones > Apps Script en tu Google Sheets.');
  }
}

/**
 * Inicializa las pestañas requeridas con sus encabezados si no existen
 */
function initSpreadsheetStructure() {
  var ss = getSpreadsheet();

  var definitions = [
    {
      name: SHEETS.HORARIOS,
      headers: [
        'id',
        'docente_id',
        'nombre_docente',
        'día',
        'hora_inicio',
        'hora_fin',
        'hora_inicio_real',
        'hora_fin_real',
        'actividad',
        'grupo',
        'ubicación',
        'tipo',
        'curso_escolar',
        'observaciones'
      ]
    },
    {
      name: SHEETS.DOCENTES,
      headers: [
        'docente_id',
        'nombre_docente',
        'especialidad',
        'tutoria',
        'email',
        'telefono',
        'observaciones',
        'activo'
      ]
    },
    {
      name: SHEETS.UBICACIONES,
      headers: ['codigo', 'nombre', 'planta', 'edificio', 'tipo', 'capacidad']
    },
    {
      name: SHEETS.TIPOS,
      headers: ['codigo', 'nombre', 'categoria', 'color', 'color_secundario']
    },
    {
      name: SHEETS.CONFIG,
      headers: ['clave', 'valor']
    }
  ];

  definitions.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      sheet.appendRow(def.headers);
      var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0e263e');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else {
      // Si la hoja ya existe pero está vacía, añadir los encabezados iniciales
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(def.headers);
        var hr = sheet.getRange(1, 1, 1, def.headers.length);
        hr.setFontWeight('bold');
        hr.setBackground('#0e263e');
        hr.setFontColor('#ffffff');
        sheet.setFrozenRows(1);
      }
    }
  });
}

/**
 * Normaliza cualquier valor de hora a formato "HH:MM" (24 horas)
 */
function formatGasTime(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    var h = val.getHours();
    var m = val.getMinutes();
    return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
  }
  if (typeof val === 'number') {
    if (val > 0 && val <= 1) {
      var totalMins = Math.round(val * 24 * 60);
      var hh = Math.floor(totalMins / 60) % 24;
      var mm = totalMins % 60;
      return (hh < 10 ? '0' + hh : '' + hh) + ':' + (mm < 10 ? '0' + mm : '' + mm);
    }
    if (val > 1 && val < 1440) {
      var h2 = Math.floor(val / 60) % 24;
      var m2 = Math.floor(val % 60);
      return (h2 < 10 ? '0' + h2 : '' + h2) + ':' + (m2 < 10 ? '0' + m2 : '' + m2);
    }
  }
  var str = String(val).trim();
  var match = str.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (match) {
    var hour = parseInt(match[1], 10);
    var min = parseInt(match[2], 10);
    return (hour < 10 ? '0' + hour : '' + hour) + ':' + (min < 10 ? '0' + min : '' + min);
  }
  return str;
}

/**
 * Normaliza nombres de días a formato estándar "Lunes", "Martes", etc.
 */
function normalizeGasDia(val) {
  if (!val) return '';
  var s = String(val).trim().toLowerCase();
  s = s.replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u');
  if (s.indexOf('lun') === 0) return 'Lunes';
  if (s.indexOf('mar') === 0) return 'Martes';
  if (s.indexOf('mie') === 0) return 'Miércoles';
  if (s.indexOf('jue') === 0) return 'Jueves';
  if (s.indexOf('vie') === 0) return 'Viernes';
  return String(val).trim();
}

function isGasDia(val) {
  if (!val) return false;
  var s = String(val).trim().toLowerCase();
  s = s.replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u');
  return s.indexOf('lun') === 0 || s.indexOf('mar') === 0 || s.indexOf('mie') === 0 || s.indexOf('jue') === 0 || s.indexOf('vie') === 0;
}

/**
 * Lee todos los datos del centro desde Google Sheets con normalización
 */
function getCenterData() {
  initSpreadsheetStructure();
  var ss = getSpreadsheet();

  var rawDocentes = readSheetAsObjects(ss.getSheetByName(SHEETS.DOCENTES));
  var rawHorarios = readSheetAsObjects(ss.getSheetByName(SHEETS.HORARIOS));
  var ubicaciones = readSheetAsObjects(ss.getSheetByName(SHEETS.UBICACIONES));
  var tipos = readSheetAsObjects(ss.getSheetByName(SHEETS.TIPOS));
  var configList = readSheetAsObjects(ss.getSheetByName(SHEETS.CONFIG));

  var config = {};
  configList.forEach(function(item) {
    if (item.clave) {
      config[item.clave] = item.valor;
    }
  });

  // Normalización robusta de docentes (soporta tanto columnas nuevas como antiguas)
  var docentes = rawDocentes.map(function(d) {
    var docId = String(d.docente_id || d.id || d.codigo || '').trim();
    var docNombre = String(d.nombre_docente || d.nombre || d.profesor || d.maestro || docId).trim();
    return {
      docente_id: docId || docNombre,
      nombre_docente: docNombre || docId,
      especialidad: d.especialidad || '',
      tutoria: d.tutoria || '',
      email: d.email || '',
      telefono: d.telefono || '',
      observaciones: d.observaciones || '',
      activo: d.activo !== false && String(d.activo).toLowerCase() !== 'false'
    };
  });

  // Mapa rápido de docentes para resolver nombres ausentes en horarios
  var docMap = {};
  docentes.forEach(function(d) {
    if (d.docente_id) {
      docMap[d.docente_id.toLowerCase()] = d.nombre_docente;
    }
  });

  // Normalización robusta de horarios con detección inteligente de columnas
  var horarios = rawHorarios.map(function(h, idx) {
    var rawId = String(h.id || '').trim();
    var rawDocId = String(h.docente_id || h.id_docente || h.codigo || '').trim();
    var rawDocNombre = String(h.nombre_docente || h.nombre || h.profesor || h.profesora || h.maestro || h.docente || '').trim();
    var rawDia = String(h['día'] || h.dia || h.dia_semana || '').trim();
    var rawInicio = formatGasTime(h.hora_inicio || h.inicio || h.desde || '');
    var rawFin = formatGasTime(h.hora_fin || h.fin || h.hasta || '');
    var rawActividad = String(h.actividad || h.materia || h.asignatura || h.tarea || '').trim();
    var rawGrupo = String(h.grupo || h.curso || h.clase || h.nivel || '').trim();
    var rawUbicacion = String(h['ubicación'] || h.ubicacion || h.aula || h.espacio || '').trim();

    // Auto-recuperación si la fila tiene columnas desplazadas (p.ej. Columna 1 contiene el Día)
    if (isGasDia(rawId) && (rawDocId.indexOf(':') !== -1 || formatGasTime(rawDocId) !== '')) {
      rawDia = rawId;
      rawInicio = formatGasTime(rawDocId);
      rawFin = formatGasTime(rawDocNombre);
      rawDocNombre = h['día'] || h.dia || '';
      rawActividad = h.hora_inicio || '';
      rawGrupo = h.hora_fin || '';
      rawUbicacion = h.actividad || '';
      rawDocId = '';
    } else if (isGasDia(rawDocId) && (rawDocNombre.indexOf(':') !== -1 || formatGasTime(rawDocNombre) !== '')) {
      rawDia = rawDocId;
      rawInicio = formatGasTime(rawDocNombre);
      rawFin = formatGasTime(h['día'] || h.dia || '');
      rawDocNombre = rawId;
      rawActividad = h.hora_inicio || '';
      rawGrupo = h.hora_fin || '';
      rawUbicacion = h.actividad || '';
      rawDocId = '';
    }

    // Resolver nombre e id de docente
    var docId = rawDocId;
    var docNombre = rawDocNombre;
    if (!docNombre && docId && docMap[docId.toLowerCase()]) {
      docNombre = docMap[docId.toLowerCase()];
    }
    if (!docId && docNombre) {
      docId = docNombre;
    }
    if (!docNombre && docId) {
      docNombre = docId;
    }

    // Detección de tramo combinado si inicio o fin faltan (p.ej. "09:00 - 10:00")
    if ((!rawInicio || !rawFin) && (h.tramo || h.horario || h.hora)) {
      var tramoStr = String(h.tramo || h.horario || h.hora);
      var parts = tramoStr.split(/[-–—]/);
      if (parts.length >= 2) {
        rawInicio = formatGasTime(parts[0]);
        rawFin = formatGasTime(parts[1]);
      }
    }

    return {
      id: rawId || ('horario-' + idx),
      docente_id: docId,
      nombre_docente: docNombre || docId,
      'día': normalizeGasDia(rawDia) || 'Lunes',
      hora_inicio: rawInicio || '09:00',
      hora_fin: rawFin || '10:00',
      hora_inicio_real: rawInicio || '09:00',
      hora_fin_real: rawFin || '10:00',
      actividad: rawActividad,
      grupo: rawGrupo,
      'ubicación': rawUbicacion || 'Ubicación no especificada',
      tipo: h.tipo || 'DOCENCIA',
      curso_escolar: h.curso_escolar || config.curso_escolar || '2026/2027',
      observaciones: h.observaciones || ''
    };
  });

  // Si no había docentes explícitos pero sí hay docentes en los horarios, generarlos
  if (docentes.length === 0 && horarios.length > 0) {
    var seen = {};
    horarios.forEach(function(h) {
      if (h.docente_id && !seen[h.docente_id.toLowerCase()]) {
        seen[h.docente_id.toLowerCase()] = true;
        docentes.push({
          docente_id: h.docente_id,
          nombre_docente: h.nombre_docente || h.docente_id,
          activo: true
        });
      }
    });
  }

  return {
    success: true,
    data: {
      docentes: docentes,
      horarios: horarios,
      ubicaciones: ubicaciones,
      tipos: tipos,
      cursoEscolar: config.curso_escolar || '2026/2027',
      isDemoData: config.is_demo === 'true',
      lastUpdated: config.last_updated || new Date().toISOString()
    }
  };
}

/**
 * Guarda los datos del centro en Google Sheets
 */
function saveCenterData(payload) {
  initSpreadsheetStructure();
  var ss = getSpreadsheet();

  if (payload.horarios && Array.isArray(payload.horarios)) {
    var cleanHorarios = payload.horarios.map(function(h) {
      return {
        id: h.id || '',
        docente_id: h.docente_id || '',
        nombre_docente: h.nombre_docente || '',
        'día': h['día'] || h.dia || '',
        hora_inicio: h.hora_inicio || '',
        hora_fin: h.hora_fin || '',
        hora_inicio_real: h.hora_inicio_real || h.hora_inicio || '',
        hora_fin_real: h.hora_fin_real || h.hora_fin || '',
        actividad: h.actividad || '',
        grupo: h.grupo || '',
        'ubicación': h['ubicación'] || h.ubicacion || '',
        tipo: h.tipo || 'DOCENCIA',
        curso_escolar: h.curso_escolar || payload.cursoEscolar || '2026/2027',
        observaciones: h.observaciones || ''
      };
    });

    writeObjectsToSheet(
      ss.getSheetByName(SHEETS.HORARIOS),
      [
        'id',
        'docente_id',
        'nombre_docente',
        'día',
        'hora_inicio',
        'hora_fin',
        'hora_inicio_real',
        'hora_fin_real',
        'actividad',
        'grupo',
        'ubicación',
        'tipo',
        'curso_escolar',
        'observaciones'
      ],
      cleanHorarios
    );
  }

  if (payload.docentes && Array.isArray(payload.docentes)) {
    var cleanDocentes = payload.docentes.map(function(d) {
      return {
        docente_id: d.docente_id || d.id || '',
        nombre_docente: d.nombre_docente || d.nombre || d.docente_id || d.id || '',
        especialidad: d.especialidad || '',
        tutoria: d.tutoria || '',
        email: d.email || '',
        telefono: d.telefono || '',
        observaciones: d.observaciones || '',
        activo: d.activo !== false && String(d.activo).toLowerCase() !== 'false'
      };
    });

    writeObjectsToSheet(
      ss.getSheetByName(SHEETS.DOCENTES),
      ['docente_id', 'nombre_docente', 'especialidad', 'tutoria', 'email', 'telefono', 'observaciones', 'activo'],
      cleanDocentes
    );
  }

  if (payload.ubicaciones && Array.isArray(payload.ubicaciones)) {
    writeObjectsToSheet(
      ss.getSheetByName(SHEETS.UBICACIONES),
      ['codigo', 'nombre', 'planta', 'edificio', 'tipo', 'capacidad'],
      payload.ubicaciones
    );
  }

  if (payload.tipos && Array.isArray(payload.tipos)) {
    writeObjectsToSheet(
      ss.getSheetByName(SHEETS.TIPOS),
      ['codigo', 'nombre', 'categoria', 'color', 'color_secundario'],
      payload.tipos
    );
  }

  // Actualizar configuración
  var configSheet = ss.getSheetByName(SHEETS.CONFIG);
  var configRows = [
    { clave: 'curso_escolar', valor: payload.cursoEscolar || '2026/2027' },
    { clave: 'is_demo', valor: payload.isDemoData ? 'true' : 'false' },
    { clave: 'last_updated', valor: new Date().toISOString() }
  ];
  writeObjectsToSheet(configSheet, ['clave', 'valor'], configRows);

  return {
    success: true,
    message: 'Datos del centro actualizados y sincronizados con éxito en Google Sheets.',
    timestamp: new Date().toISOString()
  };
}

/**
 * Lee una hoja de cálculo y la convierte en un array de objetos según los encabezados
 * Utiliza getValues() y getDisplayValues() para garantizar que fechas y horas se extraigan perfectamente.
 */
function readSheetAsObjects(sheet) {
  if (!sheet) return [];
  var range = sheet.getDataRange();
  var data = range.getValues();
  var displayData = range.getDisplayValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var displayRow = displayData[i] || [];
    var isEmpty = row.every(function(cell) { return cell === '' || cell === null; });
    if (isEmpty) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = String(headers[j]).trim();
      var cleanKey = header.toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/[\s\-]+/g, '_');

      var val = row[j];
      var dispVal = displayRow[j] !== undefined && displayRow[j] !== null ? String(displayRow[j]).trim() : '';

      if (val !== undefined && val !== null) {
        var finalVal;
        if (cleanKey === 'activo') {
          finalVal = val === true || String(val).toLowerCase() === 'true' || val === 1 || val === '1';
        } else if (cleanKey === 'capacidad') {
          finalVal = val ? Number(val) : undefined;
        } else if (cleanKey.indexOf('hora') !== -1 || cleanKey === 'inicio' || cleanKey === 'fin' || cleanKey === 'desde' || cleanKey === 'hasta') {
          finalVal = formatGasTime(dispVal || val);
        } else if (cleanKey === 'dia' || cleanKey === 'dia_semana') {
          finalVal = normalizeGasDia(dispVal || val);
        } else {
          finalVal = dispVal || String(val);
        }

        // Guardar bajo encabezado original y clave limpia
        obj[header] = finalVal;
        if (cleanKey && cleanKey !== header) {
          obj[cleanKey] = finalVal;
        }
      }
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Escribe un array de objetos en una hoja asegurando encabezados limpios
 */
function writeObjectsToSheet(sheet, headers, objects) {
  if (!sheet) return;

  // Actualizar fila 1 con los encabezados
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0e263e');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // Limpiar contenido previo (excepto fila de encabezados)
  var lastRow = sheet.getLastRow();
  var maxCols = Math.max(sheet.getLastColumn(), headers.length);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, maxCols).clearContent();
  }

  if (!objects || objects.length === 0) return;

  var rows = objects.map(function(obj) {
    return headers.map(function(h) {
      var val = obj[h];
      return val !== undefined && val !== null ? val : '';
    });
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

// ==============================================================================
// GESTIÓN DE SEGURIDAD Y AUTENTICACIÓN ADMIN (MULTIDISPOSITIVO)
// ==============================================================================

/**
 * Calcula un hash SHA-256 con sal para una cadena
 */
function computeSha256(text, salt) {
  salt = salt || DEFAULT_SALT;
  var input = salt + ':' + text;
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < rawHash.length; i++) {
    var b = rawHash[i];
    if (b < 0) b += 256;
    var byteString = b.toString(16);
    if (byteString.length == 1) byteString = '0' + byteString;
    hex += byteString;
  }
  return hex;
}

/**
 * Comprueba si la contraseña introducida coincide con la guardada
 */
function verifyAdminLogin(enteredPassword) {
  if (!enteredPassword) {
    return { success: false, error: 'Por favor, introduce una contraseña.' };
  }

  var props = PropertiesService.getScriptProperties();
  var storedHash = props.getProperty(SCRIPT_PROP_KEYS.ADMIN_HASH);
  var salt = props.getProperty(SCRIPT_PROP_KEYS.ADMIN_SALT) || DEFAULT_SALT;

  var enteredHash = computeSha256(enteredPassword, salt);

  // Si aún no se ha guardado contraseña, verificar contra la inicial '1234'
  if (!storedHash) {
    var initialHash = computeSha256(DEFAULT_INITIAL_PWD, DEFAULT_SALT);
    if (enteredHash === initialHash) {
      return { success: true, isDefaultPassword: true };
    }
    return { success: false, error: 'Contraseña de administrador incorrecta.' };
  }

  if (enteredHash === storedHash) {
    return { success: true };
  }

  return { success: false, error: 'Contraseña de administrador incorrecta.' };
}

/**
 * Cambia la contraseña de administrador
 */
function changeAdminPassword(currentPassword, newPassword) {
  var loginCheck = verifyAdminLogin(currentPassword);
  if (!loginCheck.success) {
    return { success: false, error: 'La contraseña actual no es correcta.' };
  }

  if (!newPassword || newPassword.toString().trim().length < 4) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
  }

  var props = PropertiesService.getScriptProperties();
  var salt = DEFAULT_SALT;
  var newHash = computeSha256(newPassword, salt);

  props.setProperty(SCRIPT_PROP_KEYS.ADMIN_HASH, newHash);
  props.setProperty(SCRIPT_PROP_KEYS.ADMIN_SALT, salt);

  return { success: true, message: 'Contraseña actualizada correctamente.' };
}

/**
 * Solicita restablecimiento de contraseña: genera código y lo envía por correo
 */
function requestPasswordReset(email) {
  if (!email || email.indexOf('@') === -1) {
    return { success: false, error: 'Dirección de correo electrónico no válida.' };
  }

  email = email.trim().toLowerCase();
  var props = PropertiesService.getScriptProperties();
  var configuredEmail = props.getProperty(SCRIPT_PROP_KEYS.ADMIN_EMAIL);

  // Si no hay correo registrado todavía, registrar este primer correo como admin
  if (!configuredEmail) {
    props.setProperty(SCRIPT_PROP_KEYS.ADMIN_EMAIL, email);
    configuredEmail = email;
  } else if (configuredEmail.toLowerCase() !== email) {
    return {
      success: false,
      error: 'El correo introducido no coincide con el correo de administración configurado en el centro.'
    };
  }

  // Generar código numérico de 6 dígitos
  var code = Math.floor(100000 + Math.random() * 900000).toString();
  // Caducidad en 15 minutos
  var expiry = Date.now() + 15 * 60 * 1000;

  props.setProperty(SCRIPT_PROP_KEYS.RESET_CODE, code);
  props.setProperty(SCRIPT_PROP_KEYS.RESET_EXPIRY, expiry.toString());

  // Enviar correo con MailApp de Google Workspace
  try {
    var subject = 'Código de recuperación de acceso - Localizador Docente (CEIP Antonio Gala)';
    var htmlBody = ''
      + '<div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">'
      + '  <div style="text-align: center; margin-bottom: 20px;">'
      + '    <h2 style="color: #0e263e; margin: 0; font-size: 20px;">CEIP Antonio Gala</h2>'
      + '    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Localizador Docente · Recuperación de contraseña</p>'
      + '  </div>'
      + '  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">'
      + '    <p style="font-size: 13px; color: #475569; margin: 0 0 10px 0;">Tu código de seguridad temporal para restablecer la contraseña de Administrador es:</p>'
      + '    <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; font-family: monospace;">' + code + '</div>'
      + '    <p style="font-size: 11px; color: #94a3b8; margin: 10px 0 0 0;">Este código caducará en 15 minutos.</p>'
      + '  </div>'
      + '  <p style="font-size: 12px; color: #64748b; line-height: 1.5;">Si no has solicitado este restablecimiento, puedes ignorar este mensaje de forma segura. Tu contraseña actual no ha sido modificada.</p>'
      + '  <div style="border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 14px; text-align: center; font-size: 11px; color: #94a3b8;">'
      + '    Sistema de Gestión de Horarios Docentes · CEIP Antonio Gala'
      + '  </div>'
      + '</div>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });

    return {
      success: true,
      message: 'Código de recuperación enviado con éxito a ' + email + '. Revisa tu bandeja de entrada.'
    };
  } catch (err) {
    return {
      success: false,
      error: 'Error al enviar el correo con MailApp: ' + err.toString()
    };
  }
}

/**
 * Valida el código de recuperación y establece la nueva contraseña
 */
function verifyAndResetPassword(code, newPassword) {
  if (!code || !newPassword) {
    return { success: false, error: 'Debes proporcionar el código de seguridad y la nueva contraseña.' };
  }

  if (newPassword.toString().trim().length < 4) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
  }

  var props = PropertiesService.getScriptProperties();
  var savedCode = props.getProperty(SCRIPT_PROP_KEYS.RESET_CODE);
  var savedExpiry = parseInt(props.getProperty(SCRIPT_PROP_KEYS.RESET_EXPIRY) || '0', 10);

  if (!savedCode || savedCode !== code.toString().trim()) {
    return { success: false, error: 'El código de seguridad introducido es incorrecto.' };
  }

  if (Date.now() > savedExpiry) {
    return { success: false, error: 'El código de seguridad ha caducado. Solicita un nuevo código.' };
  }

  // Establecer nueva contraseña
  var salt = DEFAULT_SALT;
  var newHash = computeSha256(newPassword, salt);

  props.setProperty(SCRIPT_PROP_KEYS.ADMIN_HASH, newHash);
  props.setProperty(SCRIPT_PROP_KEYS.ADMIN_SALT, salt);

  // Limpiar código de recuperación usado
  props.deleteProperty(SCRIPT_PROP_KEYS.RESET_CODE);
  props.deleteProperty(SCRIPT_PROP_KEYS.RESET_EXPIRY);

  return {
    success: true,
    message: 'Contraseña restablecida correctamente. Ya puedes acceder con tu nueva clave.'
  };
}
