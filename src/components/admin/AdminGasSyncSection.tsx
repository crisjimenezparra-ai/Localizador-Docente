import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../context/AppContext';
import {
  testGasConnection,
  fetchRemoteCenterData,
  saveRemoteCenterData,
  getGasWebAppUrl,
  setGasWebAppUrl,
  isGasConnected,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
} from '../../services/gasService';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  FileSpreadsheet,
  HelpCircle,
  Database,
  UploadCloud,
  DownloadCloud,
  KeyRound,
  Mail,
  ShieldCheck,
  QrCode,
  Smartphone,
  FileCode,
  Link2,
  Sparkles,
  Share2,
} from 'lucide-react';

export const AdminGasSyncSection: React.FC = () => {
  const {
    horarios,
    docentes,
    ubicaciones,
    tipos,
    cursoEscolar,
    isDemoData,
    syncWithSheets,
    pushToSheets,
    isSyncing,
    lastSyncTime,
  } = useApp();

  const [gasUrl, setGasUrl] = useState(() => getGasWebAppUrl());
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [autoSync, setAutoSync] = useState(() => isAutoSyncEnabled());
  const [copiedCode, setCopiedCode] = useState(false);
  const [copyingIndexHtml, setCopyingIndexHtml] = useState(false);
  const [copiedIndexHtml, setCopiedIndexHtml] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'status' | 'setup' | 'code' | 'exportHtml'>('status');
  const [showQrCode, setShowQrCode] = useState(true);

  const connected = isGasConnected();

  const handleCopyIndexHtml = async () => {
    setCopyingIndexHtml(true);
    try {
      const res = await fetch('/Index.html');
      if (!res.ok) throw new Error('No se pudo cargar Index.html');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedIndexHtml(true);
      setTimeout(() => setCopiedIndexHtml(false), 3000);
    } catch (err) {
      console.error('Error al copiar Index.html:', err);
      window.open('/Index.html', '_blank');
    } finally {
      setCopyingIndexHtml(false);
    }
  };

  const handleSaveAndTestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);
    setIsSavingUrl(true);

    const trimmed = gasUrl.trim();
    setGasWebAppUrl(trimmed);

    if (!trimmed) {
      setTestResult({
        type: 'info',
        message: 'Se ha borrado la URL de Google Apps Script. La aplicación utilizará almacenamiento local.',
      });
      setIsSavingUrl(false);
      return;
    }

    try {
      const result = await testGasConnection(trimmed);
      if (result.success) {
        setTestResult({
          type: 'success',
          message: '¡Conexión exitosa con Google Apps Script y Google Sheets! Los datos ya se pueden sincronizar en la nube.',
        });
      } else {
        setTestResult({
          type: 'error',
          message: result.message,
        });
      }
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: err?.message || 'Error al conectar con la URL proporcionada.',
      });
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleManualPull = async () => {
    setTestResult(null);
    const res = await syncWithSheets();
    if (res.success) {
      setTestResult({
        type: 'success',
        message: res.message || 'Datos descargados y actualizados correctamente desde Google Sheets.',
      });
    } else {
      setTestResult({
        type: 'error',
        message: res.error || 'Error al sincronizar con Google Sheets.',
      });
    }
  };

  const handleManualPush = async () => {
    setTestResult(null);
    const res = await pushToSheets();
    if (res.success) {
      setTestResult({
        type: 'success',
        message: res.message || 'Datos del centro subidos y guardados correctamente en Google Sheets.',
      });
    } else {
      setTestResult({
        type: 'error',
        message: res.error || 'Error al subir datos a Google Sheets.',
      });
    }
  };

  const handleToggleAutoSync = (val: boolean) => {
    setAutoSync(val);
    setAutoSyncEnabled(val);
  };

  const gasScriptCode = `/**
 * LOCALIZADOR DOCENTE - CEIP ANTONIO GALA
 * BACKEND GOOGLE APPS SCRIPT & GOOGLE SHEETS
 */
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

function doGet(e) {
  e = e || { parameter: {} };
  var action = e.parameter.action;
  if (!action || action === 'app') {
    try {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('Localizador Docente - CEIP Antonio Gala')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return jsonResponse({
        success: true,
        message: 'Servicio Google Apps Script activo.',
        endpoints: ['testConnection', 'getData', 'saveData', 'login', 'changePassword', 'requestReset', 'verifyReset']
      });
    }
  }
  return jsonResponse(handleApiRequest(action, e.parameter));
}

function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var body = {};
  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
      if (!action && body.action) action = body.action;
    } catch (err) {
      return jsonResponse({ success: false, error: 'Error parseando JSON: ' + err.toString() });
    }
  }
  return jsonResponse(handleApiRequest(action, body));
}

function handleApiRequest(action, params) {
  try {
    switch (action) {
      case 'test':
      case 'testConnection':
        return { success: true, message: 'Conexión exitosa con Google Apps Script y Google Sheets.' };
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
        return { success: true, message: 'Estructura de pestañas verificada.' };
      default:
        return { success: false, error: 'Acción desconocida: ' + action };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (id) return SpreadsheetApp.openById(id);
    throw new Error('Vincula el script a tu Google Sheets.');
  }
}

function initSpreadsheetStructure() {
  var ss = getSpreadsheet();
  var defs = [
    {
      name: SHEETS.HORARIOS,
      headers: [
        'id', 'docente_id', 'nombre_docente', 'día', 'hora_inicio', 'hora_fin',
        'hora_inicio_real', 'hora_fin_real', 'actividad', 'grupo', 'ubicación',
        'tipo', 'curso_escolar', 'observaciones'
      ]
    },
    {
      name: SHEETS.DOCENTES,
      headers: ['docente_id', 'nombre_docente', 'especialidad', 'tutoria', 'email', 'telefono', 'observaciones', 'activo']
    },
    { name: SHEETS.UBICACIONES, headers: ['codigo', 'nombre', 'planta', 'edificio', 'tipo', 'capacidad'] },
    { name: SHEETS.TIPOS, headers: ['codigo', 'nombre', 'categoria', 'color', 'color_secundario'] },
    { name: SHEETS.CONFIG, headers: ['clave', 'valor'] }
  ];
  defs.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      sheet.appendRow(def.headers);
      sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#0e263e').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(def.headers);
        sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#0e263e').setFontColor('#ffffff');
        sheet.setFrozenRows(1);
      }
    }
  });
}

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
  var match = str.match(/(?:T|\\s|^)(\\d{1,2}):(\\d{2})/);
  if (match) {
    var hour = parseInt(match[1], 10);
    var min = parseInt(match[2], 10);
    return (hour < 10 ? '0' + hour : '' + hour) + ':' + (min < 10 ? '0' + min : '' + min);
  }
  return str;
}

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

function getCenterData() {
  initSpreadsheetStructure();
  var ss = getSpreadsheet();
  var rawDocentes = readSheetAsObjects(ss.getSheetByName(SHEETS.DOCENTES));
  var rawHorarios = readSheetAsObjects(ss.getSheetByName(SHEETS.HORARIOS));
  var ubicaciones = readSheetAsObjects(ss.getSheetByName(SHEETS.UBICACIONES));
  var tipos = readSheetAsObjects(ss.getSheetByName(SHEETS.TIPOS));
  var configList = readSheetAsObjects(ss.getSheetByName(SHEETS.CONFIG));
  var config = {};
  configList.forEach(function(item) { if (item.clave) config[item.clave] = item.valor; });

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

  var docMap = {};
  docentes.forEach(function(d) { if (d.docente_id) docMap[d.docente_id.toLowerCase()] = d.nombre_docente; });

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

    var docId = rawDocId;
    var docNombre = rawDocNombre;
    if (!docNombre && docId && docMap[docId.toLowerCase()]) docNombre = docMap[docId.toLowerCase()];
    if (!docId && docNombre) docId = docNombre;
    if (!docNombre && docId) docNombre = docId;

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

  if (docentes.length === 0 && horarios.length > 0) {
    var seen = {};
    horarios.forEach(function(h) {
      if (h.docente_id && !seen[h.docente_id.toLowerCase()]) {
        seen[h.docente_id.toLowerCase()] = true;
        docentes.push({ docente_id: h.docente_id, nombre_docente: h.nombre_docente || h.docente_id, activo: true });
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
        'id', 'docente_id', 'nombre_docente', 'día', 'hora_inicio', 'hora_fin',
        'hora_inicio_real', 'hora_fin_real', 'actividad', 'grupo', 'ubicación',
        'tipo', 'curso_escolar', 'observaciones'
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

  var configSheet = ss.getSheetByName(SHEETS.CONFIG);
  var configRows = [
    { clave: 'curso_escolar', valor: payload.cursoEscolar || '2026/2027' },
    { clave: 'is_demo', valor: payload.isDemoData ? 'true' : 'false' },
    { clave: 'last_updated', valor: new Date().toISOString() }
  ];
  writeObjectsToSheet(configSheet, ['clave', 'valor'], configRows);
  return { success: true, message: 'Datos sincronizados en Google Sheets.' };
}

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
    if (row.every(function(c) { return c === '' || c === null; })) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = String(headers[j]).trim();
      var cleanKey = header.toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/[\\s\\-]+/g, '_');
      var val = row[j];
      var dispVal = displayRow[j] !== undefined && displayRow[j] !== null ? String(displayRow[j]).trim() : '';
      if (val !== undefined && val !== null) {
        var finalVal;
        if (cleanKey === 'activo') finalVal = val === true || String(val).toLowerCase() === 'true';
        else if (cleanKey.indexOf('hora') !== -1 || cleanKey === 'inicio' || cleanKey === 'fin') finalVal = formatGasTime(dispVal || val);
        else if (cleanKey === 'dia' || cleanKey === 'dia_semana') finalVal = normalizeGasDia(dispVal || val);
        else finalVal = dispVal || String(val);
        obj[header] = finalVal;
        if (cleanKey && cleanKey !== header) obj[cleanKey] = finalVal;
      }
    }
    rows.push(obj);
  }
  return rows;
}

function writeObjectsToSheet(sheet, headers, objects) {
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (!objects || objects.length === 0) return;
  var rows = objects.map(function(obj) {
    return headers.map(function(h) { return obj[h] !== undefined && obj[h] !== null ? obj[h] : ''; });
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function computeSha256(text, salt) {
  salt = salt || DEFAULT_SALT;
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + text, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i]; if (b < 0) b += 256;
    var s = b.toString(16); if (s.length == 1) s = '0' + s;
    hex += s;
  }
  return hex;
}

function verifyAdminLogin(password) {
  if (!password) return { success: false, error: 'Introduce la contraseña.' };
  var props = PropertiesService.getScriptProperties();
  var storedHash = props.getProperty(SCRIPT_PROP_KEYS.ADMIN_HASH);
  var salt = props.getProperty(SCRIPT_PROP_KEYS.ADMIN_SALT) || DEFAULT_SALT;
  var enteredHash = computeSha256(password, salt);
  if (!storedHash) return enteredHash === computeSha256(DEFAULT_INITIAL_PWD, DEFAULT_SALT) ? { success: true } : { success: false, error: 'Contraseña incorrecta.' };
  return enteredHash === storedHash ? { success: true } : { success: false, error: 'Contraseña incorrecta.' };
}

function changeAdminPassword(current, next) {
  var check = verifyAdminLogin(current);
  if (!check.success) return { success: false, error: 'La contraseña actual no es correcta.' };
  if (!next || next.trim().length < 4) return { success: false, error: 'Mínimo 4 caracteres.' };
  var props = PropertiesService.getScriptProperties();
  props.setProperty(SCRIPT_PROP_KEYS.ADMIN_HASH, computeSha256(next, DEFAULT_SALT));
  return { success: true, message: 'Contraseña cambiada con éxito.' };
}

function requestPasswordReset(email) {
  if (!email || email.indexOf('@') === -1) return { success: false, error: 'Correo no válido.' };
  var props = PropertiesService.getScriptProperties();
  var code = Math.floor(100000 + Math.random() * 900000).toString();
  var expiry = Date.now() + 15 * 60 * 1000;
  props.setProperty(SCRIPT_PROP_KEYS.RESET_CODE, code);
  props.setProperty(SCRIPT_PROP_KEYS.RESET_EXPIRY, expiry.toString());
  
  MailApp.sendEmail({
    to: email,
    subject: 'Código de recuperación - Localizador Docente (CEIP Antonio Gala)',
    htmlBody: '<p>Tu código de seguridad es: <h2>' + code + '</h2> (Válido por 15 minutos)</p>'
  });
  return { success: true, message: 'Código de seguridad enviado a ' + email };
}

function verifyAndResetPassword(code, newPassword) {
  var props = PropertiesService.getScriptProperties();
  var savedCode = props.getProperty(SCRIPT_PROP_KEYS.RESET_CODE);
  var savedExpiry = parseInt(props.getProperty(SCRIPT_PROP_KEYS.RESET_EXPIRY) || '0', 10);
  if (!savedCode || savedCode !== code.trim()) return { success: false, error: 'Código incorrecto.' };
  if (Date.now() > savedExpiry) return { success: false, error: 'Código caducado.' };
  props.setProperty(SCRIPT_PROP_KEYS.ADMIN_HASH, computeSha256(newPassword, DEFAULT_SALT));
  props.deleteProperty(SCRIPT_PROP_KEYS.RESET_CODE);
  return { success: true, message: 'Contraseña actualizada.' };
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gasScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Header Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Google Apps Script & Google Sheets
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    connected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {connected ? 'Conectado a la nube' : 'Modo local'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Base de datos compartida y autenticación de Administrador multidispositivo en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleManualPull}
              disabled={!connected || isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              title="Descarga los datos actuales desde Google Sheets"
            >
              <DownloadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Descargar de Sheets'}</span>
            </button>

            <button
              type="button"
              onClick={handleManualPush}
              disabled={!connected || isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              title="Sube los horarios y docentes actuales a Google Sheets"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Subir a Sheets</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mt-6 -mx-5 sm:-mx-6 px-5 sm:px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveGuideTab('status')}
            className={`pb-3 text-xs font-semibold px-2 border-b-2 transition cursor-pointer ${
              activeGuideTab === 'status'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Estado y Conexión
          </button>
          <button
            type="button"
            onClick={() => setActiveGuideTab('setup')}
            className={`pb-3 text-xs font-semibold px-2 border-b-2 transition cursor-pointer ${
              activeGuideTab === 'setup'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Guía de Instalación (2 min)
          </button>
          <button
            type="button"
            onClick={() => setActiveGuideTab('code')}
            className={`pb-3 text-xs font-semibold px-2 border-b-2 transition cursor-pointer ${
              activeGuideTab === 'code'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Código Code.gs
          </button>
          <button
            type="button"
            onClick={() => setActiveGuideTab('exportHtml')}
            className={`pb-3 text-xs font-semibold px-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeGuideTab === 'exportHtml'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Despliegue Apps Script (Index.html)</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
              testResult.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : testResult.type === 'info'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {testResult.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{testResult.message}</span>
          </div>
        )}

        {/* TAB 1: STATUS & CONFIGURATION */}
        {activeGuideTab === 'status' && (
          <div className="pt-5 space-y-5">
            {/* Quick stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Horarios
                </span>
                <strong className="text-base font-bold text-slate-800">{(horarios || []).length}</strong>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Docentes
                </span>
                <strong className="text-base font-bold text-slate-800">{(docentes || []).length}</strong>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Ubicaciones
                </span>
                <strong className="text-base font-bold text-slate-800">{(ubicaciones || []).length}</strong>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Última sincronización
                </span>
                <span className="text-xs font-medium text-slate-700 block truncate">
                  {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                </span>
              </div>
            </div>

            {/* Action Banner to sync local loaded schedules */}
            {(horarios || []).length > 0 && (
              <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <strong className="text-xs text-emerald-950 font-bold">
                      {(horarios || []).length} horarios cargados localmente
                    </strong>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Sube estos horarios a Google Sheets para que se reflejen en la versión desplegada en Google Apps Script y en los teléfonos móviles de los docentes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleManualPush}
                  disabled={!connected || isSyncing}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Subir ahora a Google Sheets</span>
                </button>
              </div>
            )}

            {/* URL Form */}
            <form onSubmit={handleSaveAndTestUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL de la Aplicación Web de Google Apps Script
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={gasUrl}
                    onChange={(e) => setGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isSavingUrl}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isSavingUrl ? 'Comprobando...' : 'Guardar y Probar'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pega la URL de implementación de tu script de Google Sheets (terminada en <code>/exec</code>).
                </p>
              </div>

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Sincronización automática de arranque
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Al abrir la aplicación en cualquier móvil u ordenador, se descargarán los datos más recientes de Google Sheets.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => handleToggleAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Share URL with Teachers */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    Abrir en el Móvil y Compartir con el Claustro
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowQrCode((prev) => !prev)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <QrCode className="w-3 h-3 text-blue-600" />
                      {showQrCode ? 'Ocultar QR' : 'Mostrar QR'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentGas = gasUrl.trim() || getGasWebAppUrl();
                        const shareUrl = currentGas
                          ? `${window.location.origin}${window.location.pathname}?script=${encodeURIComponent(currentGas)}`
                          : window.location.origin;
                        navigator.clipboard.writeText(shareUrl);
                        setTestResult({
                          type: 'info',
                          message: '¡Enlace inteligente copiado! Al abrirlo, el profesorado se conectará automáticamente a tu Google Sheets.',
                        });
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar enlace
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Abre este enlace desde tu móvil o compártelo por WhatsApp. Los docentes entrarán directamente en modo <strong>DOCENTE</strong> (consulta de horarios) y el móvil se conectará de inmediato a tu Google Sheets.
                </p>

                {showQrCode && (
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-white rounded-xl border border-blue-200">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs flex items-center justify-center">
                      <QRCodeSVG
                        value={
                          typeof window !== 'undefined'
                            ? (gasUrl.trim() || getGasWebAppUrl())
                              ? `${window.location.origin}${window.location.pathname}?script=${encodeURIComponent(gasUrl.trim() || getGasWebAppUrl())}`
                              : window.location.origin
                            : 'https://...'
                        }
                        size={128}
                        level="M"
                      />
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-1">
                        <QrCode className="w-3.5 h-3.5 text-blue-600" />
                        Apunta con la cámara de tu móvil aquí
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Escanea este código directamente desde la pantalla de tu ordenador para abrir la app sincronizada en tu teléfono al instante.
                      </p>
                      <div className="pt-1 flex flex-wrap justify-center sm:justify-start gap-2">
                        <a
                          href={
                            typeof window !== 'undefined'
                              ? `https://api.whatsapp.com/send?text=${encodeURIComponent(
                                  `Localizador Docente: ${
                                    (gasUrl.trim() || getGasWebAppUrl())
                                      ? `${window.location.origin}${window.location.pathname}?script=${encodeURIComponent(gasUrl.trim() || getGasWebAppUrl())}`
                                      : window.location.origin
                                  }`
                                )}`
                              : '#'
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-medium transition inline-flex items-center gap-1"
                        >
                          Enviar a WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-2 bg-white/80 rounded-lg border border-blue-200 font-mono text-[11px] text-blue-950 break-all select-all">
                  {typeof window !== 'undefined'
                    ? (gasUrl.trim() || getGasWebAppUrl())
                      ? `${window.location.origin}${window.location.pathname}?script=${encodeURIComponent(gasUrl.trim() || getGasWebAppUrl())}`
                      : window.location.origin
                    : 'https://...'}
                </div>

                {/* Helpful options for custom and friendly short links */}
                <div className="pt-2 border-t border-blue-200/70 space-y-2">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-blue-950">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>¿Cómo dar un enlace corto y bonito al claustro? (Ej: <em>tinyurl.com/horarios-gala</em>)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700">
                    <div className="p-2.5 bg-white rounded-lg border border-blue-100 space-y-1">
                      <strong className="text-slate-900 block font-semibold">1. Acortador gratuito (Recomendado)</strong>
                      <p className="text-slate-600">
                        Copia el enlace de arriba y pégalo en TinyURL para elegir un nombre personalizado del colegio:
                      </p>
                      <a
                        href={`https://tinyurl.com/create.php?url=${encodeURIComponent(
                          typeof window !== 'undefined'
                            ? (gasUrl.trim() || getGasWebAppUrl())
                              ? `${window.location.origin}${window.location.pathname}?script=${encodeURIComponent(gasUrl.trim() || getGasWebAppUrl())}`
                              : window.location.origin
                            : ''
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold underline pt-0.5"
                      >
                        Crear enlace corto en TinyURL <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-blue-100 space-y-1">
                      <strong className="text-slate-900 block font-semibold">2. Como App en pantalla de inicio</strong>
                      <p className="text-slate-600">
                        Los docentes solo abren el enlace una vez y en Chrome/Safari pulsan <em>«Añadir a pantalla de inicio»</em>. Se creará un icono como una app nativa sin necesidad de escribir la dirección nunca más.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: SETUP GUIDE */}
        {activeGuideTab === 'setup' && (
          <div className="pt-5 space-y-4 text-xs text-slate-600">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-emerald-900">
              <h3 className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Totalmente gratuito, sin cuotas y con Google Workspace</span>
              </h3>
              <p className="leading-relaxed">
                Utilizamos tu propia cuenta educativa o de Google (por ejemplo, tu cuenta institucional o de Google Workspace del centro).
                Tus datos escolares se guardan en una hoja de Google Sheets de tu propio Google Drive, cumpliendo con la privacidad del centro.
              </p>
            </div>

            <ol className="space-y-3 list-decimal list-inside pl-1 text-slate-700">
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-900">1. Crear la hoja de cálculo:</strong> Entra en{' '}
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline font-semibold inline-flex items-center gap-0.5"
                >
                  Google Sheets <ExternalLink className="w-3 h-3" />
                </a>{' '}
                y crea una hoja nueva con el nombre <em>«Localizador Docente - Datos»</em>.
              </li>
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-900">2. Abrir Apps Script:</strong> En el menú superior de la hoja, ve a{' '}
                <strong>Extensiones &gt; Apps Script</strong>.
              </li>
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-900">3. Pegar el código:</strong> Borra lo que aparezca en el editor, copia el código de la pestaña{' '}
                <button
                  onClick={() => setActiveGuideTab('code')}
                  className="text-emerald-700 underline font-bold cursor-pointer"
                >
                  «Código Code.gs»
                </button>{' '}
                y pégalo. Pulsa en <strong>Guardar</strong> (icono de disquete).
              </li>
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-900">4. Implementar como Aplicación Web:</strong>
                <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-600 pl-3">
                  <li>Haz clic en el botón azul superior <strong>Implementar &gt; Nueva implementación</strong>.</li>
                  <li>Selecciona el tipo de engranaje: <strong>Aplicación web</strong>.</li>
                  <li>Ejecutar como: <strong>Yo (tu cuenta)</strong>.</li>
                  <li>Quién tiene acceso: <strong>Cualquier persona (Any)</strong>.</li>
                  <li>Pulsa <strong>Implementar</strong> y autoriza los permisos requeridos por Google.</li>
                </ul>
              </li>
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-900">5. Conectar la app:</strong> Copia la <em>«URL de la aplicación web»</em> (la que empieza por <code>https://script.google.com/macros/s/...</code> y termina en <code>/exec</code>) y pégala arriba en la pestaña <strong>«Estado y Conexión»</strong>.
                <div className="mt-2 p-2.5 bg-emerald-50 text-emerald-900 rounded-lg text-[11px] border border-emerald-200">
                  <strong>ℹ️ ¿Abriste el enlace en el navegador y viste un texto en negro con <code>{"{\"success\":true...}"}</code>?</strong>
                  <p className="mt-0.5 text-emerald-800">
                    ¡Son excelentes noticias! Significa que tu script está 100% activo y respondiendo correctamente. No copies la URL temporal de la barra de direcciones del navegador (que empieza por <code>script.googleusercontent.com</code>); copia la <strong>URL de la aplicación web</strong> que te mostró Google al implementar (la que termina en <code>/exec</code>) y pégala arriba.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        )}

        {/* TAB 3: CODE SNIPPET */}
        {activeGuideTab === 'code' && (
          <div className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Script backend para Google Apps Script (Code.gs)
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? '¡Copiado!' : 'Copiar todo el código'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96 border border-slate-800 leading-relaxed">
                <code>{gasScriptCode}</code>
              </pre>
            </div>
            <p className="text-[11px] text-slate-500">
              Este script crea automáticamente las pestañas necesarias (Horarios, Docentes, Ubicaciones, Tipos, Configuración) y gestiona la contraseña y recuperación de correo con <code>PropertiesService</code> y <code>MailApp</code>.
            </p>
          </div>
        )}

        {/* TAB 4: EXPORT INDEX.HTML FOR APPS SCRIPT */}
        {activeGuideTab === 'exportHtml' && (
          <div className="pt-5 space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-blue-600" />
                <span>¿Por qué se necesita el archivo Index.html en Google Apps Script?</span>
              </h4>
              <p className="text-xs text-blue-900 leading-relaxed">
                Google Apps Script ejecuta la aplicación web sirviendo un archivo HTML único mediante <code>HtmlService.createHtmlOutputFromFile('Index')</code>. Si el archivo <code>Index.html</code> en Google Apps Script está vacío o desactualizado, los horarios y vistas no se mostrarán en la URL de Apps Script aunque funcionen en la vista previa.
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-900">
                Paso a paso para desplegar la interfaz completa en Google Apps Script:
              </h4>

              <ol className="text-xs text-slate-700 space-y-2.5 list-decimal list-inside leading-relaxed">
                <li>
                  <strong>Descarga el archivo <code>Index.html</code></strong> pulsando el botón verde a continuación.
                </li>
                <li>
                  Abre tu hoja de cálculo de Google Sheets y ve a <strong>Extensiones &gt; Apps Script</strong>.
                </li>
                <li>
                  En el menú lateral de archivos de Apps Script (a la izquierda), haz clic en el archivo <code>Index.html</code> (si no existe, pulsa el botón <strong>+ &gt; HTML</strong> y escribe <code>Index</code>).
                </li>
                <li>
                  Abre el archivo descargado <code>Index.html</code> en tu ordenador con cualquier editor de texto o navegador (o pulsa <em>«Abrir en nueva pestaña»</em>, pulsa <em>Ctrl+A</em> y luego <em>Ctrl+C</em> para copiar todo el código).
                </li>
                <li>
                  <strong>Pega todo el contenido en el editor de Apps Script</strong>, sustituyendo el código anterior, y pulsa <strong>Guardar (Ctrl+S)</strong>.
                </li>
                <li>
                  Haz clic en <strong>Implementar &gt; Administrar implementaciones &gt; Editar (icono lápiz) &gt; Versión: Nueva versión &gt; Implementar</strong>.
                </li>
              </ol>

              <div className="pt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCopyIndexHtml}
                  disabled={copyingIndexHtml}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {copiedIndexHtml ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>¡Copiado al portapapeles! Listo para pegar (Ctrl+V)</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{copyingIndexHtml ? 'Copiando...' : 'Copiar todo el código de Index.html'}</span>
                    </>
                  )}
                </button>
                <a
                  href="/Index.html"
                  download="Index.html"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Descargar archivo Index.html</span>
                </a>
                <a
                  href="/Index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir / Ver en pestaña nueva</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Admin Authentication Details */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Autenticación y Recuperación Multidispositivo
            </h3>
            <p className="text-xs text-slate-500">
              Funcionamiento sincronizado entre ordenadores y móviles del profesorado.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 pt-2">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Contraseña Centralizada</span>
            </h4>
            <p className="leading-relaxed text-slate-600">
              Al cambiar la contraseña en cualquier dispositivo, Google Apps Script guarda el nuevo hash seguro en <code>PropertiesService</code> de Google. Todos los administradores accederán con la misma contraseña.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>Recuperación Real por Correo</span>
            </h4>
            <p className="leading-relaxed text-slate-600">
              Si se olvida la contraseña, la opción <em>«¿Has olvidado la contraseña?»</em> genera un código de un solo uso y lo envía de forma nativa al correo configurado por la dirección del centro mediante <code>MailApp</code> de Google Workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
