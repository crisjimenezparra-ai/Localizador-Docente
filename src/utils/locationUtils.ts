import { Docente, Ubicacion } from '../types';

/**
 * Normalizes a location string to its canonical center representation
 * for comparison and display, preventing logical duplicates.
 *
 * Requirements:
 * - Canonical visible values:
 *   Classrooms: INF 3, INF 4, INF 5A, INF 5B, 1º, 2º, 3º, 4º, 5ºA, 5ºB, 6º
 *   Special spaces: Biblioteca, Dirección, Jefatura, Secretaría, Recreo, Gimnasio,
 *                   Pistas Deportivas, Sala de Profesores, Aula de Música, Aula de Apoyo / PT, etc.
 * - Does NOT alter stored schedules; comparison and validation are centralized here.
 */
export function normalizeLocation(raw?: string | null): string {
  if (!raw) return 'NO_ESPECIFICADA';
  const clean = raw.trim();
  if (!clean) return 'NO_ESPECIFICADA';

  // System location check
  const upperNoPunct = clean
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');

  if (
    upperNoPunct === 'NOESPECIFICADA' ||
    upperNoPunct === 'UBICACIONNOESPECIFICADA' ||
    upperNoPunct === 'SINESPECIFICAR' ||
    upperNoPunct === 'NINGUNA'
  ) {
    return 'NO_ESPECIFICADA';
  }

  const upper = clean
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. INFANTIL
  // INF 5A: INF_5_A, INF 5 A, INF5A, INF_5A, INFANTIL 5A, INFANTIL 5 A, AULA INFANTIL 5 A
  if (/INF.*5.*[_\s-]*A\b/i.test(upper) || upper === 'INF5A' || upper === 'INF_5A') {
    return 'INF 5A';
  }
  // INF 5B: INF_5_B, INF 5 B, INF5B, INF_5B, INFANTIL 5B, INFANTIL 5 B
  if (/INF.*5.*[_\s-]*B\b/i.test(upper) || upper === 'INF5B' || upper === 'INF_5B') {
    return 'INF 5B';
  }
  // INF 3
  if (/INF.*3\b/i.test(upper) || upper === 'INF3' || upper === 'INF_3') {
    return 'INF 3';
  }
  // INF 4
  if (/INF.*4\b/i.test(upper) || upper === 'INF4' || upper === 'INF_4') {
    return 'INF 4';
  }

  // 2. PRIMARIA
  // 5ºA: 5º A, 5ºA, 5º_A, 5 A, 5A, 5º PRIMARIA A, 5-A, 5_A
  if (/^5\s*[º°]?[_\s-]*.*A\b/i.test(upper) || upper === '5A' || upper === '5 A' || upper === '5ºA') {
    return '5ºA';
  }
  // 5ºB: 5º B, 5ºB, 5º_B, 5 B, 5B, 5º PRIMARIA B, 5-B, 5_B
  if (/^5\s*[º°]?[_\s-]*.*B\b/i.test(upper) || upper === '5B' || upper === '5 B' || upper === '5ºB') {
    return '5ºB';
  }
  // 1º
  if (/^1\s*[º°]?(\s*(PRIMARIA|EP|A))?$/i.test(upper) || upper === '1º' || upper === '1') {
    return '1º';
  }
  // 2º
  if (/^2\s*[º°]?(\s*(PRIMARIA|EP|A))?$/i.test(upper) || upper === '2º' || upper === '2') {
    return '2º';
  }
  // 3º
  if (/^3\s*[º°]?(\s*(PRIMARIA|EP|A))?$/i.test(upper) || upper === '3º' || upper === '3') {
    return '3º';
  }
  // 4º
  if (/^4\s*[º°]?(\s*(PRIMARIA|EP|A))?$/i.test(upper) || upper === '4º' || upper === '4') {
    return '4º';
  }
  // 6º
  if (/^6\s*[º°]?(\s*(PRIMARIA|EP|A))?$/i.test(upper) || upper === '6º' || upper === '6') {
    return '6º';
  }

  // 3. SPACES & ROOMS
  if (upper.includes('DIRECCION') || upper.includes('DESPACHO DIRECCION')) {
    return 'Dirección';
  }
  if (upper.includes('JEFATURA') || upper.includes('DESPACHO JEFATURA')) {
    return 'Jefatura';
  }
  if (upper.includes('SECRETARIA') || upper.includes('SECRETARÍA')) {
    return 'Secretaría';
  }
  if (upper.includes('BIBLIOTECA')) {
    return 'Biblioteca';
  }
  if (upper.includes('RECREO') || upper.includes('PATIO')) {
    return 'Recreo';
  }
  if (upper.includes('PISTA') || upper.includes('POLIDEPORTIV')) {
    return 'Pistas Deportivas';
  }
  if (upper.includes('GIMNASIO')) {
    return 'Gimnasio';
  }
  if (upper.includes('SALA DE PROFESORES') || upper.includes('SALA PROFESORES')) {
    return 'Sala de Profesores';
  }
  if (upper.includes('MUSICA')) {
    return 'Aula de Música';
  }
  if (upper.includes('APOYO') || upper.includes('PT') || upper.includes('AUDICION')) {
    return 'Aula de Apoyo / PT';
  }
  if (upper.includes('COMEDOR')) {
    return 'Comedor';
  }

  return clean;
}

/**
 * Checks if two location codes/strings are logically equivalent.
 */
export function areLocationsEquivalent(locA?: string | null, locB?: string | null): boolean {
  if (!locA && !locB) return true;
  if (!locA || !locB) return false;
  const normA = normalizeLocation(locA).toUpperCase();
  const normB = normalizeLocation(locB).toUpperCase();
  return normA === normB;
}

/**
 * Checks if a location is the special system location "NO_ESPECIFICADA".
 */
export function isSystemLocation(codigo?: string | null): boolean {
  if (!codigo) return true;
  const norm = normalizeLocation(codigo);
  return norm === 'NO_ESPECIFICADA';
}

/**
 * Automatically generates a clean, URL-safe, accent-free unique ID for a docente from full name.
 * Example: "Ana Belén Gallego Martínez" -> "ana_belen_gallego_martinez"
 * Avoids collisions by appending _2, _3 if necessary.
 * Never modifies existing imported IDs.
 */
export function generateDocenteIdFromName(
  fullName: string,
  existingDocentes: Docente[],
  currentEditingId?: string
): string {
  const base = fullName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[\s-]+/g, '_')         // spaces and hyphens to underscore
    .replace(/[^a-z0-9_]/g, '')      // remove non-alphanumeric chars
    .replace(/^_+|_+$/g, '');        // trim leading/trailing underscores

  if (!base) return 'docente_nuevo';

  let candidate = base;
  let counter = 2;

  // Collision checking against existing docentes, excluding current one if editing
  while (
    existingDocentes.some(
      (d) => d.docente_id === candidate && (!currentEditingId || d.docente_id !== currentEditingId)
    )
  ) {
    candidate = `${base}_${counter}`;
    counter++;
  }

  return candidate;
}

/**
 * Official academic tutoría options
 */
export const TUTORIA_OPTIONS = [
  'Sin tutoría',
  'INF 3',
  'INF 4',
  'INF 5A',
  'INF 5B',
  '1º',
  '2º',
  '3º',
  '4º',
  '5ºA',
  '5ºB',
  '6º',
] as const;
