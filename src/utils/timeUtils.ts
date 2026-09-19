import { DiaSemana, DIAS_SEMANA, HorarioTramo } from '../types';

/**
 * Checks if two teacher names are equivalent (handles "García Pérez, María" vs "María García Pérez", accents, case, and whitespace)
 */
export function areTeacherNamesEquivalent(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[,\-_./]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const a = clean(nameA);
  const b = clean(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))) return true;

  // Compare unordered set of words: e.g. "García Moreno, Antonio" vs "Antonio García Moreno"
  const wordsA = a.split(' ').filter((w) => w.length > 1).sort().join(' ');
  const wordsB = b.split(' ').filter((w) => w.length > 1).sort().join(' ');
  return wordsA.length > 0 && wordsA === wordsB;
}

export const VALID_ACADEMIC_GROUPS = [
  'INF 3',
  'INF 3A',
  'INF 3B',
  'INF 4',
  'INF 4A',
  'INF 4B',
  'INF 5',
  'INF 5A',
  'INF 5B',
  '1º',
  '1ºA',
  '1ºB',
  '2º',
  '2ºA',
  '2ºB',
  '3º',
  '3ºA',
  '3ºB',
  '4º',
  '4ºA',
  '4ºB',
  '5º',
  '5ºA',
  '5ºB',
  '6º',
  '6ºA',
  '6ºB',
] as const;

export type AcademicGroup = typeof VALID_ACADEMIC_GROUPS[number];

const EXCLUDED_LOCATIONS_KEYWORDS = [
  'DIRECCION',
  'DIRECCIÓN',
  'JEFATURA',
  'SECRETARIA',
  'SECRETARÍA',
  'BIBLIOTECA',
  'RECREO',
  'PATIO',
  'PISTA',
  'PISTAS',
  'GIMNASIO',
  'SALA',
  'PROFESOR',
  'COORDINACION',
  'COORDINACIÓN',
  'TUTORIA',
  'TUTORÍA',
  'NO ESPECIFICADA',
  'SIN GRUPO',
  'NINGUNO',
  'COMEDOR',
  'APERTURA',
  'TRANSFORMACION',
  'TRANSFORMACIÓN',
  'DIGITAL',
  'TDE',
  'DESPACHO',
  'CONVIVENCIA',
  'CLAUSTRO',
  'CONSEJO',
  'REUNION',
  'REUNIÓN',
  'GUARDIA',
];

/**
 * Normalizes an academic group name string into its canonical center group representation.
 * If the input represents a functional space, non-academic location, or is invalid, returns null.
 *
 * Valid canonical groups:
 * - INF 3
 * - INF 4
 * - INF 5A
 * - INF 5B
 * - 1º
 * - 2º
 * - 3º
 * - 4º
 * - 5ºA
 * - 5ºB
 * - 6º
 */
export function normalizeAcademicGroup(raw?: string | null): AcademicGroup | null {
  if (!raw) return null;
  const str = raw.trim().toUpperCase();
  if (!str) return null;

  // Filter out functional locations, non-academic entries and common non-groups
  for (const kw of EXCLUDED_LOCATIONS_KEYWORDS) {
    if (str.includes(kw)) {
      return null;
    }
  }

  // Exact canonical match check
  if (str === 'INF 3') return 'INF 3';
  if (str === 'INF 4') return 'INF 4';
  if (str === 'INF 5A') return 'INF 5A';
  if (str === 'INF 5B') return 'INF 5B';
  if (str === '1º') return '1º';
  if (str === '2º') return '2º';
  if (str === '3º') return '3º';
  if (str === '4º') return '4º';
  if (str === '5ºA') return '5ºA';
  if (str === '5ºB') return '5ºB';
  if (str === '6º') return '6º';

  // Normalize accents and strip generic filler terms ("AULA", "EDUCACION", "DE")
  const clean = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bAULA\b/gi, '')
    .replace(/\bEDUCACION\b/gi, '')
    .replace(/\bDE\b/gi, '')
    .trim();

  // 1. Infantil: "INF", "INFANTIL", "I3"/"I4"/"I5", or mentions "ANOS"/"AÑOS"
  const isInfantil =
    clean.includes('INF') ||
    clean.includes('ANO') ||
    /^I[345]/i.test(clean);

  if (isInfantil) {
    if (clean.includes('3')) {
      if (clean.includes('B')) return 'INF 3B';
      if (clean.includes('A')) return 'INF 3A';
      return 'INF 3';
    }
    if (clean.includes('4')) {
      if (clean.includes('B')) return 'INF 4B';
      if (clean.includes('A')) return 'INF 4A';
      return 'INF 4';
    }
    if (clean.includes('5')) {
      if (clean.includes('B')) return 'INF 5B';
      if (clean.includes('A')) return 'INF 5A';
      return 'INF 5';
    }
    return null;
  }

  // 2. Primaria:
  // 6º
  if (/^6\s*[º°]?\s*.*B/i.test(clean) || clean === '6º B' || clean === '6B' || clean === '6 B') return '6ºB';
  if (/^6\s*[º°]?\s*.*A/i.test(clean) || clean === '6º A' || clean === '6A' || clean === '6 A') return '6ºA';
  if (/^6\s*[º°]?(\s*(PRIMARIA|EP|P))?$/i.test(clean) || clean === '6º PRIMARIA' || clean === '6 PRIMARIA') return '6º';

  // 5º
  if (/^5\s*[º°]?\s*.*B/i.test(clean) || clean === '5º B' || clean === '5B' || clean === '5 B') return '5ºB';
  if (/^5\s*[º°]?\s*.*A/i.test(clean) || clean === '5º A' || clean === '5A' || clean === '5 A') return '5ºA';
  if (/^5\s*[º°]?(\s*(PRIMARIA|EP|P))?$/i.test(clean) || clean === '5º PRIMARIA' || clean === '5 PRIMARIA') return '5º';

  // 4º
  if (/^4\s*[º°]?\s*.*B/i.test(clean) || clean === '4º B' || clean === '4B' || clean === '4 B') return '4ºB';
  if (/^4\s*[º°]?\s*.*A/i.test(clean) || clean === '4º A' || clean === '4A' || clean === '4 A') return '4ºA';
  if (/^4\s*[º°]?(\s*(PRIMARIA|EP|P))?$/i.test(clean) || clean === '4º PRIMARIA' || clean === '4 PRIMARIA') return '4º';

  // 3º
  if (/^3\s*[º°]?\s*.*B/i.test(clean) || clean === '3º B' || clean === '3B' || clean === '3 B') return '3ºB';
  if (/^3\s*[º°]?\s*.*A/i.test(clean) || clean === '3º A' || clean === '3A' || clean === '3 A') return '3ºA';
  if (/^3\s*[º°]?(\s*(PRIMARIA|EP|P))?$/i.test(clean) || clean === '3º PRIMARIA' || clean === '3 PRIMARIA') return '3º';

  // 2º
  if (/^2\s*[º°]?\s*.*B/i.test(clean) || clean === '2º B' || clean === '2B' || clean === '2 B') return '2ºB';
  if (/^2\s*[º°]?\s*.*A/i.test(clean) || clean === '2º A' || clean === '2A' || clean === '2 A') return '2ºA';
  if (/^2\s*[º°]?(\s*(PRIMARIA|EP|P))?$/i.test(clean) || clean === '2º PRIMARIA' || clean === '2 PRIMARIA') return '2º';

  // 1º
  if (/^1\s*[º°]?\s*.*B/i.test(clean) || clean === '1º B' || clean === '1B' || clean === '1 B') return '1ºB';
  if (/^1\s*[º°]?\s*.*A/i.test(clean) || clean === '1º A' || clean === '1A' || clean === '1 A') return '1ºA';
  if (/^1\s*[º°]?(\s*(PRIMARIA|EP|P))?$/i.test(clean) || clean === '1º PRIMARIA' || clean === '1 PRIMARIA') return '1º';

  return null;
}

/**
 * Checks if two group representations refer to the same academic group.
 * Matches if raw trimmed values are equal (case-insensitive) OR if their normalized academic group values match.
 */
export function isSameAcademicGroup(groupA?: string | null, groupB?: string | null): boolean {
  if (!groupA || !groupB) return false;
  const cleanA = groupA.trim().toLowerCase();
  const cleanB = groupB.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const normA = normalizeAcademicGroup(groupA);
  const normB = normalizeAcademicGroup(groupB);
  if (normA && normB && normA === normB) {
    return true;
  }
  return false;
}

/**
 * Robustly normalizes any time representation to "HH:MM" (24h format).
 * Handles:
 * - Direct "09:00", "9:00", "9:30"
 * - Seconds "09:00:00", "09:30:00"
 * - Excel fraction of day (e.g. 0.375 = 09:00)
 * - JavaScript Date objects or ISO strings (e.g. "Sat Dec 30 1899 09:00:00 GMT+0000" or "1899-12-30T09:00:00.000Z")
 * - Strings with non-standard dates or timestamps
 */
export function formatTimeHHMM(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    if (val > 0 && val <= 1) {
      // Excel fraction of 24-hour day
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (val > 1 && val < 1440) {
      const hours = Math.floor(val / 60) % 24;
      const minutes = Math.floor(val % 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }
  if (val instanceof Date) {
    return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  if (!str) return '';

  // Match HH:MM(:SS)? inside strings like "09:00", "9:00:00", "Sat Dec 30 1899 09:00:00 GMT+0000", "T09:00:00"
  const match = str.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const h = String(parseInt(match[1], 10)).padStart(2, '0');
    const m = String(parseInt(match[2], 10)).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Fallback simple split if contains colon
  if (str.includes(':')) {
    const parts = str.split(':');
    const numH = parseInt(parts[0].replace(/\D/g, ''), 10);
    const numM = parseInt(parts[1].replace(/\D/g, ''), 10);
    if (!isNaN(numH) && !isNaN(numM)) {
      return `${String(numH).padStart(2, '0')}:${String(numM).padStart(2, '0')}`;
    }
  }

  return str;
}

/**
 * Robustly matches whether a schedule slot belongs to a given teacher,
 * regardless of whether teacher was referenced by ID or by Name or inverted name.
 */
export function isSlotForTeacher(
  slot: { docente_id?: string; nombre_docente?: string } | null | undefined,
  teacher: { docente_id?: string; nombre_docente?: string } | string | null | undefined
): boolean {
  if (!slot || !teacher) return false;
  const tId = typeof teacher === 'string' ? teacher.trim().toLowerCase() : (teacher.docente_id || '').trim().toLowerCase();
  const tName = typeof teacher === 'string' ? teacher.trim().toLowerCase() : (teacher.nombre_docente || '').trim().toLowerCase();
  const sId = (slot.docente_id || '').trim().toLowerCase();
  const sName = (slot.nombre_docente || '').trim().toLowerCase();

  // Direct exact matches
  if (sId && tId && sId === tId) return true;
  if (sName && tName && sName === tName) return true;
  if (sId && tName && sId === tName) return true;
  if (sName && tId && sName === tId) return true;

  // Name equivalence (handles inverted surnames, accents, etc.)
  if (sName && tName && areTeacherNamesEquivalent(sName, tName)) return true;
  if (sId && tName && areTeacherNamesEquivalent(sId, tName)) return true;
  if (sName && tId && areTeacherNamesEquivalent(sName, tId)) return true;

  // Substring checks for longer names (min 6 chars to avoid false positives)
  if (sName.length > 5 && tName.length > 5 && (sName.includes(tName) || tName.includes(sName))) return true;
  if (sId.length > 5 && tName.length > 5 && (sId.includes(tName) || tName.includes(sId))) return true;

  return false;
}

/**
 * Converts "HH:MM" (24-hour format) to total minutes since midnight.
 * Robust against Date strings or seconds.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = formatTimeHHMM(timeStr);
  const parts = clean.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Converts total minutes since midnight to "HH:MM" (24-hour format)
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(normalized / 60) % 24;
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Normalizes day string from Excel or input to standard DiaSemana
 */
export function normalizeDia(diaStr: string): DiaSemana | null {
  if (!diaStr) return null;
  const clean = diaStr
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean.startsWith('lun')) return 'Lunes';
  if (clean.startsWith('mar')) return 'Martes';
  if (clean.startsWith('mie')) return 'Miércoles';
  if (clean.startsWith('jue')) return 'Jueves';
  if (clean.startsWith('vie')) return 'Viernes';
  return null;
}

export type RealDayName =
  | 'Lunes'
  | 'Martes'
  | 'Miércoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sábado'
  | 'Domingo';

export interface SystemTimeInfo {
  realDate: Date;
  realDayName: RealDayName;
  realSchoolDay: DiaSemana | null; // null if weekend (Sábado or Domingo)
  isWeekend: boolean; // true on Sábado or Domingo
  realTimeStr: string; // Device time "HH:MM"
  defaultConsultationDay: DiaSemana; // Default consultation day ('Lunes' on weekend, or today if weekday)
}

/**
 * Returns comprehensive real system time information from device clock and calendar.
 * Strictly distinguishes school days (Lunes-Viernes) from weekends (Sábado-Domingo).
 */
export function getSystemTimeInfo(customDate?: Date): SystemTimeInfo {
  const d = customDate || new Date();
  const dayIndex = d.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const realTimeStr = `${hours}:${minutes}`;

  switch (dayIndex) {
    case 1:
      return { realDate: d, realDayName: 'Lunes', realSchoolDay: 'Lunes', isWeekend: false, realTimeStr, defaultConsultationDay: 'Lunes' };
    case 2:
      return { realDate: d, realDayName: 'Martes', realSchoolDay: 'Martes', isWeekend: false, realTimeStr, defaultConsultationDay: 'Martes' };
    case 3:
      return { realDate: d, realDayName: 'Miércoles', realSchoolDay: 'Miércoles', isWeekend: false, realTimeStr, defaultConsultationDay: 'Miércoles' };
    case 4:
      return { realDate: d, realDayName: 'Jueves', realSchoolDay: 'Jueves', isWeekend: false, realTimeStr, defaultConsultationDay: 'Jueves' };
    case 5:
      return { realDate: d, realDayName: 'Viernes', realSchoolDay: 'Viernes', isWeekend: false, realTimeStr, defaultConsultationDay: 'Viernes' };
    case 6:
      return { realDate: d, realDayName: 'Sábado', realSchoolDay: null, isWeekend: true, realTimeStr, defaultConsultationDay: 'Lunes' };
    case 0:
    default:
      return { realDate: d, realDayName: 'Domingo', realSchoolDay: null, isWeekend: true, realTimeStr, defaultConsultationDay: 'Lunes' };
  }
}

/**
 * Alias for getSystemTimeInfo to make the distinction crystal-clear.
 */
export const getRealDateTime = getSystemTimeInfo;

/**
 * Strictly verifies whether a school day is genuinely TODAY according to real device clock.
 * Returns FALSE if today is Saturday or Sunday, or if the day differs.
 */
export function isDayActuallyToday(day: DiaSemana, customDate?: Date): boolean {
  const info = getSystemTimeInfo(customDate);
  if (info.isWeekend || !info.realSchoolDay) {
    return false;
  }
  return info.realSchoolDay === day;
}

/**
 * Strictly determines whether a slot is genuinely CURRENT (ACTUAL).
 * A slot is ACTUAL IF AND ONLY IF:
 * 1. Today is a real school day (NOT weekend);
 * 2. The slot's day matches the REAL school day today;
 * 3. The REAL device clock time falls within [hora_inicio, hora_fin).
 *
 * NEVER relies on user-selected consultation moment.
 */
export function isSlotActuallyCurrent(
  slot: { día: string; hora_inicio: string; hora_fin: string },
  customDate?: Date
): boolean {
  const info = getSystemTimeInfo(customDate);
  if (info.isWeekend || !info.realSchoolDay) {
    return false;
  }
  if (normalizeDia(slot.día) !== info.realSchoolDay) {
    return false;
  }
  return isTimeInSlot(info.realTimeStr, slot.hora_inicio, slot.hora_fin);
}

/**
 * Strictly verifies if a consulted moment corresponds to REAL TIME.
 * Returns FALSE if today is Saturday or Sunday, or if the day or time is customized.
 */
export function isMomentInRealTime(
  consultedDay: DiaSemana,
  consultedTime: string,
  isRealTimeSync: boolean,
  customDate?: Date
): boolean {
  const info = getSystemTimeInfo(customDate);
  if (info.isWeekend || !info.realSchoolDay) {
    return false;
  }
  if (consultedDay !== info.realSchoolDay) {
    return false;
  }
  if (!isRealTimeSync) {
    return consultedTime === info.realTimeStr;
  }
  return true;
}

/**
 * Checks if a slot matches the user's manual consultation moment.
 */
export function isSlotConsulted(
  slot: { día: string; hora_inicio: string; hora_fin: string },
  consultedDay: DiaSemana,
  consultedTime: string
): boolean {
  if (normalizeDia(slot.día) !== consultedDay) {
    return false;
  }
  return isTimeInSlot(consultedTime, slot.hora_inicio, slot.hora_fin);
}

/**
 * Gets current Spanish day name. If weekend, realSchoolDay is null, and 'dia' returns default consultation day (Lunes).
 */
export function getCurrentSchoolDay(customDate?: Date): {
  dia: DiaSemana;
  isWeekend: boolean;
  realSchoolDay: DiaSemana | null;
} {
  const info = getSystemTimeInfo(customDate);
  return {
    dia: info.realSchoolDay || info.defaultConsultationDay,
    isWeekend: info.isWeekend,
    realSchoolDay: info.realSchoolDay,
  };
}

/**
 * Gets current formatted time "HH:MM"
 */
export function getCurrentTimeStr(customDate?: Date): string {
  const d = customDate || new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Checks if targetTime ("HH:MM") falls inside [startTime, endTime)
 */
export function isTimeInSlot(targetTime: string, startTime: string, endTime: string): boolean {
  const target = timeToMinutes(targetTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  // Normal daytime school intervals
  return target >= start && target < end;
}

/**
 * Checks if an activity's interval strictly overlaps with a queried time slot.
 *
 * Real overlap condition (A1):
 * activityStart < selectedEnd AND activityEnd > selectedStart
 *
 * Examples with slot 09:30–10:30:
 * - 09:30–10:30 -> OVERLAPS
 * - 09:30–10:00 -> OVERLAPS
 * - 10:00–10:30 -> OVERLAPS
 * - 09:00–10:00 -> OVERLAPS
 * - Ends at 09:30 (e.g. 09:00–09:30) -> DOES NOT OVERLAP (aEnd <= sStart)
 * - Starts at 10:30 (e.g. 10:30–11:30) -> DOES NOT OVERLAP (aStart >= sEnd)
 */
export function isActivityOverlappingSlot(
  activityStart: string,
  activityEnd: string,
  slotStart: string,
  slotEnd: string
): boolean {
  const aStart = timeToMinutes(activityStart);
  const aEnd = timeToMinutes(activityEnd);
  const sStart = timeToMinutes(slotStart);
  const sEnd = timeToMinutes(slotEnd);

  return aStart < sEnd && aEnd > sStart;
}

/**
 * Checks if an activity is active at an exact instant.
 *
 * Instant condition (A6):
 * activityStart <= instant AND activityEnd > instant
 */
export function isActivityActiveAtInstant(
  activityStart: string,
  activityEnd: string,
  instant: string
): boolean {
  const aStart = timeToMinutes(activityStart);
  const aEnd = timeToMinutes(activityEnd);
  const t = timeToMinutes(instant);

  return aStart <= t && aEnd > t;
}

/**
 * Finds the slot for a teacher on a given day & time
 */
export function findTeacherSlot(
  horarios: HorarioTramo[],
  docenteId: string,
  dia: DiaSemana,
  hora: string
): HorarioTramo | null {
  const targetMin = timeToMinutes(hora);
  const cleanDocenteId = (docenteId || '').trim().toLowerCase();

  // Filter for teacher and day
  const teacherDaySlots = (horarios || []).filter(
    (h) => {
      if (!h || normalizeDia(h.día) !== dia) return false;
      const hId = (h.docente_id || '').trim().toLowerCase();
      const hName = (h.nombre_docente || '').trim().toLowerCase();

      return (
        (hId && hId === cleanDocenteId) ||
        (hName && (hName === cleanDocenteId || areTeacherNamesEquivalent(hName, cleanDocenteId)))
      );
    }
  );

  // Check matching interval [hora_inicio, hora_fin)
  const match = teacherDaySlots.find((h) => {
    const start = timeToMinutes(h.hora_inicio);
    const end = timeToMinutes(h.hora_fin);
    return targetMin >= start && targetMin < end;
  });

  return match || null;
}

/**
 * Finds all teachers in a specific group on a given day & time
 */
export function findTeachersInGroup(
  horarios: HorarioTramo[],
  grupo: string,
  dia: DiaSemana,
  hora: string
): HorarioTramo[] {
  const targetMin = timeToMinutes(hora);

  return (horarios || []).filter((h) => {
    if (!h) return false;
    if (normalizeDia(h.día) !== dia) return false;
    if (!h.grupo || !isSameAcademicGroup(h.grupo, grupo)) return false;

    const start = timeToMinutes(h.hora_inicio);
    const end = timeToMinutes(h.hora_fin);
    return targetMin >= start && targetMin < end;
  });
}

/**
 * Normalizes location string: if missing/empty, returns "Ubicación no especificada".
 * Strict rule: NEVER invent location.
 */
export function formatUbicacion(ubicacion?: string): string {
  if (!ubicacion || !ubicacion.trim() || ubicacion.trim().toLowerCase() === 'no especificada') {
    return 'Ubicación no especificada';
  }
  return ubicacion.trim();
}

export interface CenterDayRange {
  start: string; // e.g. "09:00"
  end: string;   // e.g. "14:00"
}

/**
 * Calculates the center's registered activity interval for a specific day.
 * Defaults to 09:00 - 14:00 if no slots exist.
 */
export function getCenterDayRange(horarios: HorarioTramo[], dia: DiaSemana): CenterDayRange {
  const daySlots = (horarios || []).filter((h) => h && normalizeDia(h.día) === dia);
  if (!daySlots || daySlots.length === 0) {
    return { start: '09:00', end: '14:00' };
  }
  let minStart = 24 * 60;
  let maxEnd = 0;
  let minStartStr = '09:00';
  let maxEndStr = '14:00';

  for (const s of daySlots) {
    const sMin = timeToMinutes(s.hora_inicio);
    const eMin = timeToMinutes(s.hora_fin);
    if (sMin < minStart) {
      minStart = sMin;
      minStartStr = s.hora_inicio;
    }
    if (eMin > maxEnd) {
      maxEnd = eMin;
      maxEndStr = s.hora_fin;
    }
  }
  return { start: minStartStr, end: maxEndStr };
}

/**
 * Determines whether an observation string is an internal technical note
 * (e.g. subtramo divisions created during data import/prep) that must be hidden
 * from regular end-user views.
 */
export function isTechnicalObservation(obs?: string | null): boolean {
  if (!obs) return true;
  const clean = obs.trim().toLowerCase();
  if (!clean) return true;
  if (clean.includes('subtramo')) return true;
  if (clean.includes('división del horario') || clean.includes('division del horario')) return true;
  if (clean.includes('horario original')) return true;
  if (clean.includes('auto-generado') || clean.includes('autogenerado')) return true;
  return false;
}

/**
 * Returns the observation string only if it is user-facing and non-technical.
 * Otherwise returns null.
 */
export function getDisplayObservation(obs?: string | null): string | null {
  if (!obs || isTechnicalObservation(obs)) return null;
  return obs.trim();
}

/**
 * Checks if grupo and ubicación represent the exact same normalized academic group or room.
 * For example: "4º" vs "4º", "4º" vs "4º Primaria", "4º" vs "Aula 4º".
 */
export function areGroupAndLocationEqual(grupo?: string | null, ubicacion?: string | null): boolean {
  if (!grupo || !ubicacion) return false;
  const cleanG = grupo.trim().toLowerCase();
  const cleanU = ubicacion.trim().toLowerCase();
  if (!cleanG || !cleanU || cleanU === 'no especificada' || cleanU === 'ubicación no especificada') {
    return false;
  }
  if (cleanG === cleanU) return true;

  if (isSameAcademicGroup(grupo, ubicacion)) return true;

  const cleanUWithoutAula = cleanU.replace(/^aula\s+(de\s+)?/i, '').trim();
  if (cleanG === cleanUWithoutAula) return true;

  const normG = normalizeAcademicGroup(cleanG);
  const normWithoutAula = normalizeAcademicGroup(cleanUWithoutAula);
  if (normG && normWithoutAula && normG === normWithoutAula) return true;

  return false;
}

/**
 * Checks if a group string is valid to display.
 * Returns false if empty, null, undefined, "Sin grupo", "SIN GRUPO", "Sin grupo asignado", etc.
 */
export function isValidDisplayGroup(group?: string | null): boolean {
  if (!group) return false;
  const clean = group.trim().toLowerCase();
  return (
    clean !== '' &&
    clean !== 'sin grupo' &&
    clean !== 'sin grupo asignado' &&
    clean !== 'ninguno' &&
    clean !== 'no especificado' &&
    clean !== 'no especificada' &&
    clean !== 'no' &&
    clean !== 'null' &&
    clean !== 'undefined' &&
    clean !== '—' &&
    clean !== '-'
  );
}

/**
 * Formats a group string for display, returning null if invalid or "Sin grupo".
 */
export function formatDisplayGroup(group?: string | null): string | null {
  if (!isValidDisplayGroup(group)) return null;
  return group!.trim();
}

/**
 * Checks if a location string is actually specified (not empty, "no especificada", etc.)
 */
export function isUbicacionSpecified(ubicacion?: string | null): boolean {
  if (!ubicacion) return false;
  const clean = ubicacion.trim().toLowerCase();
  return (
    clean !== '' &&
    clean !== 'no especificada' &&
    clean !== 'ubicación no especificada' &&
    clean !== 'ubicacion no especificada' &&
    clean !== 'null' &&
    clean !== 'undefined' &&
    clean !== '—' &&
    clean !== '-'
  );
}

/**
 * Visual deduplication rule for schedule cells.
 * Eliminates redundant group or location text when the activity itself
 * already specifies the course/group or location (e.g. "REF 6º" with group "6º",
 * "MÚSICA 2º" with group "2º", "RECREO" with location "RECREO").
 *
 * Distinct information (e.g. "MATEMÁTICAS" with group "4º") is preserved.
 * This deduplication is strictly visual and does not alter stored data.
 */
export function getCleanVisualCellMetadata(
  actividad: string,
  rawGrupo?: string | null,
  rawUbicacion?: string | null
): { displayActivity: string; secondaryMeta: string } {
  const act = (actividad || '').trim();
  const actNorm = act
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  let validGroup = isValidDisplayGroup(rawGrupo) ? formatDisplayGroup(rawGrupo) : null;
  let validUbic = isUbicacionSpecified(rawUbicacion) ? formatUbicacion(rawUbicacion) : null;

  // 1. Check if group is redundant with activity
  if (validGroup) {
    const grpNorm = validGroup
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (actNorm === grpNorm) {
      validGroup = null;
    } else {
      // Check if actNorm contains grpNorm as a distinct token/word
      // Examples: "REF 6º" contains "6º", "MÚSICA 2º" contains "2º", "LENGUA 4ºB" contains "4ºB"
      const escapedGrp = grpNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|[-_./])${escapedGrp}($|\\s|[-_./])`, 'i');
      if (regex.test(actNorm)) {
        validGroup = null;
      }
    }
  }

  // 2. Check if ubicación is redundant with activity
  if (validUbic) {
    const ubicNorm = validUbic
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (actNorm === ubicNorm) {
      validUbic = null;
    } else {
      const escapedUbic = ubicNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|[-_./])${escapedUbic}($|\\s|[-_./])`, 'i');
      if (regex.test(actNorm)) {
        validUbic = null;
      }
    }
  }

  // 3. Check if group and ubicación are redundant with each other
  if (validGroup && validUbic) {
    if (areGroupAndLocationEqual(validGroup, validUbic)) {
      validUbic = null;
    }
  }

  const parts: string[] = [];
  if (validGroup) parts.push(validGroup);
  if (validUbic) parts.push(validUbic);

  return {
    displayActivity: act,
    secondaryMeta: parts.join(' · '),
  };
}

