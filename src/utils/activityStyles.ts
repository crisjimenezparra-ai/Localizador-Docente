/**
 * Single source of truth for Activity Categories and their visual styling
 * across all views of «Localizador Docente».
 *
 * Requirements:
 * - Deterministic color mapping based EXCLUSIVELY on the real `tipo` / category field.
 * - Soft and consistent palette for backgrounds, borders, text, and badges.
 * - Centralized definitions to guarantee zero style drift between screens.
 */

import { CategoriaMaestra } from '../types';

export const MASTER_CATEGORIES: CategoriaMaestra[] = [
  'DOCENCIA',
  'REFUERZO',
  'COORDINACIÓN',
  'EQUIPO DIRECTIVO',
  'RECREO',
  'OTROS',
];

export type CanonicalCategory =
  | 'DOCENCIA'
  | 'REFUERZO'
  | 'COORDINACIÓN'
  | 'EQUIPO_DIRECTIVO'
  | 'RECREO'
  | 'OTROS'
  | 'TDE'
  | 'STEAM'
  | 'PLAN_APERTURA'
  | 'ITINERANCIA'
  | 'REDUCCIÓN';

export interface ActivityStyleDefinition {
  key: CanonicalCategory;
  /** Visible user-facing label (e.g., "Docencia", "Equipo Directivo") */
  label: string;
  /** Uppercase visible label for uppercase badge contexts */
  labelUpper: string;
  /** Tailwind classes for cards and weekly grid cells */
  bgClass: string;
  borderClass: string;
  textClass: string;
  /** Tailwind classes for badges and pills */
  badgeBgClass: string;
  badgeBorderClass: string;
  badgeTextClass: string;
  /** Tailwind class for dot / status indicators */
  dotClass: string;
  /** Raw hex colors for charts, svgs, or inline styles */
  hex: {
    bg: string;
    border: string;
    text: string;
    dot: string;
  };
}

/**
 * Standardized category styles according to specified soft palette
 */
export const activityCategoryStyles: Record<CanonicalCategory, ActivityStyleDefinition> = {
  DOCENCIA: {
    key: 'DOCENCIA',
    label: 'Docencia',
    labelUpper: 'DOCENCIA',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700',
    badgeBgClass: 'bg-blue-50',
    badgeBorderClass: 'border-blue-200',
    badgeTextClass: 'text-blue-700',
    dotClass: 'bg-blue-600',
    hex: {
      bg: '#EFF6FF',
      border: '#BFDBFE',
      text: '#1D4ED8',
      dot: '#2563EB',
    },
  },
  REFUERZO: {
    key: 'REFUERZO',
    label: 'Refuerzo',
    labelUpper: 'REFUERZO',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-700',
    badgeBgClass: 'bg-emerald-50',
    badgeBorderClass: 'border-emerald-200',
    badgeTextClass: 'text-emerald-700',
    dotClass: 'bg-emerald-500',
    hex: {
      bg: '#ECFDF5',
      border: '#A7F3D0',
      text: '#047857',
      dot: '#10B981',
    },
  },
  COORDINACIÓN: {
    key: 'COORDINACIÓN',
    label: 'Coordinación',
    labelUpper: 'COORDINACIÓN',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-300',
    textClass: 'text-amber-700',
    badgeBgClass: 'bg-amber-50',
    badgeBorderClass: 'border-amber-300',
    badgeTextClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    hex: {
      bg: '#FFFBEB',
      border: '#FCD34D',
      text: '#B45309',
      dot: '#F59E0B',
    },
  },
  EQUIPO_DIRECTIVO: {
    key: 'EQUIPO_DIRECTIVO',
    label: 'Equipo Directivo',
    labelUpper: 'EQUIPO DIRECTIVO',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    textClass: 'text-purple-700',
    badgeBgClass: 'bg-purple-50',
    badgeBorderClass: 'border-purple-200',
    badgeTextClass: 'text-purple-700',
    dotClass: 'bg-purple-600',
    hex: {
      bg: '#F5F3FF',
      border: '#DDD6FE',
      text: '#6D28D9',
      dot: '#7C3AED',
    },
  },
  RECREO: {
    key: 'RECREO',
    label: 'Recreo',
    labelUpper: 'RECREO',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    textClass: 'text-indigo-700',
    badgeBgClass: 'bg-indigo-50',
    badgeBorderClass: 'border-indigo-200',
    badgeTextClass: 'text-indigo-700',
    dotClass: 'bg-indigo-600',
    hex: {
      bg: '#EEF2FF',
      border: '#C7D2FE',
      text: '#4338CA',
      dot: '#6366F1',
    },
  },
  OTROS: {
    key: 'OTROS',
    label: 'Otros',
    labelUpper: 'OTROS',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-300',
    textClass: 'text-slate-600',
    badgeBgClass: 'bg-slate-50',
    badgeBorderClass: 'border-slate-300',
    badgeTextClass: 'text-slate-600',
    dotClass: 'bg-slate-500',
    hex: {
      bg: '#F8FAFC',
      border: '#CBD5E1',
      text: '#475569',
      dot: '#64748B',
    },
  },
  TDE: {
    key: 'TDE',
    label: 'TDE',
    labelUpper: 'TDE',
    bgClass: 'bg-cyan-50',
    borderClass: 'border-cyan-200',
    textClass: 'text-cyan-700',
    badgeBgClass: 'bg-cyan-50',
    badgeBorderClass: 'border-cyan-200',
    badgeTextClass: 'text-cyan-700',
    dotClass: 'bg-cyan-500',
    hex: {
      bg: '#ECFEFF',
      border: '#A5F3FC',
      text: '#0E7490',
      dot: '#06B6D4',
    },
  },
  STEAM: {
    key: 'STEAM',
    label: 'STEAM',
    labelUpper: 'STEAM',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    textClass: 'text-sky-700',
    badgeBgClass: 'bg-sky-50',
    badgeBorderClass: 'border-sky-200',
    badgeTextClass: 'text-sky-700',
    dotClass: 'bg-sky-500',
    hex: {
      bg: '#F0F9FF',
      border: '#BAE6FD',
      text: '#0369A1',
      dot: '#0284C7',
    },
  },
  PLAN_APERTURA: {
    key: 'PLAN_APERTURA',
    label: 'Plan de Apertura',
    labelUpper: 'PLAN DE APERTURA',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    textClass: 'text-orange-700',
    badgeBgClass: 'bg-orange-50',
    badgeBorderClass: 'border-orange-200',
    badgeTextClass: 'text-orange-700',
    dotClass: 'bg-orange-500',
    hex: {
      bg: '#FFF7ED',
      border: '#FED7AA',
      text: '#C2410C',
      dot: '#EA580C',
    },
  },
  ITINERANCIA: {
    key: 'ITINERANCIA',
    label: 'Itinerancia',
    labelUpper: 'ITINERANCIA',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-200',
    textClass: 'text-yellow-700',
    badgeBgClass: 'bg-yellow-50',
    badgeBorderClass: 'border-yellow-200',
    badgeTextClass: 'text-yellow-700',
    dotClass: 'bg-yellow-500',
    hex: {
      bg: '#FEFCE8',
      border: '#FEF08A',
      text: '#A16207',
      dot: '#EAB308',
    },
  },
  REDUCCIÓN: {
    key: 'REDUCCIÓN',
    label: 'Reducción',
    labelUpper: 'REDUCCIÓN',
    bgClass: 'bg-zinc-50',
    borderClass: 'border-zinc-200',
    textClass: 'text-zinc-700',
    badgeBgClass: 'bg-zinc-50',
    badgeBorderClass: 'border-zinc-200',
    badgeTextClass: 'text-zinc-700',
    dotClass: 'bg-zinc-500',
    hex: {
      bg: '#F4F4F5',
      border: '#E4E4E7',
      text: '#52525B',
      dot: '#71717A',
    },
  },
};

/**
 * Normalizes any raw `tipo` string to its canonical category key.
 *
 * STRICT RULE: Mappings depend EXCLUSIVELY on the category / tipo field,
 * NEVER on activity name words like ATEDU, REF, JEFATURA, etc.
 *
 * Specific mappings:
 * - JEFATURA / SECRETARÍA / DIRECCIÓN / EQUIPO_DIRECTIVO -> EQUIPO_DIRECTIVO (Violeta)
 * - CONVIVENCIA / COORDINACIÓN / GESTION / TUTORIA -> COORDINACIÓN (Ámbar)
 * - BIBLIOTECA / OTROS -> OTROS (Gris)
 * - REFUERZO / APOYO -> REFUERZO (Verde)
 * - RECREO / DESCANSO -> RECREO (Rosa/Rojo)
 * - DOCENCIA (including ATEDU when marked as DOCENCIA) -> DOCENCIA (Azul)
 */
export function normalizeCategoryKey(rawTipo?: string | null): CanonicalCategory {
  if (!rawTipo) return 'OTROS';

  const clean = rawTipo
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Strip accents for matching

  // 1. DOCENCIA
  if (clean === 'DOCENCIA' || clean === 'ATEDU' || clean === 'A. EDUCATIVA') {
    return 'DOCENCIA';
  }

  // 2. REFUERZO / APOYO
  if (clean === 'REFUERZO' || clean === 'APOYO' || clean === 'REF' || clean === 'PT' || clean === 'AL') {
    return 'REFUERZO';
  }

  // 3. EQUIPO DIRECTIVO
  if (
    clean === 'EQUIPO_DIRECTIVO' ||
    clean === 'EQUIPO DIRECTIVO' ||
    clean === 'DIRECTIVO' ||
    clean === 'DIRECCION' ||
    clean === 'SECRETARIA' ||
    clean === 'JEFATURA'
  ) {
    return 'EQUIPO_DIRECTIVO';
  }

  // 4. COORDINACIÓN & GESTIÓN
  if (
    clean === 'COORDINACION' ||
    clean === 'CONVIVENCIA' ||
    clean === 'GESTION' ||
    clean === 'TUTORIA'
  ) {
    return 'COORDINACIÓN';
  }

  // 5. RECREO / DESCANSO
  if (clean === 'RECREO' || clean === 'DESCANSO') {
    return 'RECREO';
  }

  // 6. BIBLIOTECA -> OTROS (as specified in requirements)
  if (clean === 'BIBLIOTECA') {
    return 'OTROS';
  }

  // 7. SPECIFIC SPECIAL CATEGORIES
  if (clean === 'TDE') return 'TDE';
  if (clean === 'STEAM') return 'STEAM';
  if (clean === 'PLAN_APERTURA' || clean === 'PLAN DE APERTURA') return 'PLAN_APERTURA';
  if (clean === 'ITINERANCIA') return 'ITINERANCIA';
  if (clean === 'REDUCCION') return 'REDUCCIÓN';

  // 8. DEFAULT / FALLBACK
  return 'OTROS';
}

/**
 * Maps any activity code, raw tipo, or category to one of the 6 Master Categories:
 * DOCENCIA | REFUERZO | COORDINACIÓN | EQUIPO DIRECTIVO | RECREO | OTROS
 *
 * Rules:
 * - A. EDUCATIVA / ATEDU -> DOCENCIA (Blue)
 * - DIRECCION / SECRETARIA / JEFATURA -> EQUIPO DIRECTIVO (Violet)
 * - COORDINACION / TUTORIA / GESTION -> COORDINACIÓN (Amber)
 * - REFUERZO / APOYO -> REFUERZO (Green)
 * - RECREO -> RECREO (Indigo)
 * - TDE / BIBLIOTECA / STEAM / ITINERANCIA / REDUCCION / OTROS -> OTROS (Gray)
 */
export function getMasterCategory(raw?: string | null): CategoriaMaestra {
  if (!raw) return 'OTROS';

  const clean = raw
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    clean === 'DOCENCIA' ||
    clean === 'ATEDU' ||
    clean === 'A. EDUCATIVA' ||
    clean === 'A.EDUCATIVA' ||
    clean === 'ATENCION EDUCATIVA' ||
    clean.includes('EDUCATIVA')
  ) {
    return 'DOCENCIA';
  }

  if (
    clean === 'REFUERZO' ||
    clean === 'APOYO' ||
    clean === 'REF' ||
    clean === 'PT' ||
    clean === 'AL'
  ) {
    return 'REFUERZO';
  }

  if (
    clean === 'EQUIPO_DIRECTIVO' ||
    clean === 'EQUIPO DIRECTIVO' ||
    clean === 'DIRECTIVO' ||
    clean === 'DIRECCION' ||
    clean === 'SECRETARIA' ||
    clean === 'JEFATURA'
  ) {
    return 'EQUIPO DIRECTIVO';
  }

  if (
    clean === 'COORDINACION' ||
    clean === 'CONVIVENCIA' ||
    clean === 'GESTION' ||
    clean === 'TUTORIA'
  ) {
    return 'COORDINACIÓN';
  }

  if (clean === 'RECREO' || clean === 'DESCANSO') {
    return 'RECREO';
  }

  return 'OTROS';
}

/**
 * Returns the full styling definition for any activity `tipo`.
 */
export function getActivityCategoryStyles(rawTipo?: string | null): ActivityStyleDefinition {
  const canonicalKey = normalizeCategoryKey(rawTipo);
  return activityCategoryStyles[canonicalKey] || activityCategoryStyles.OTROS;
}

/**
 * Returns Tailwind classes for weekly schedule cells or daily activity cards.
 * If `isCurrent` is true, an intense current-slot highlight is overlaid
 * while preserving the underlying category base color.
 */
export function getActivityCellClasses(rawTipo?: string | null, isCurrent?: boolean): string {
  const styles = getActivityCategoryStyles(rawTipo);
  const base = `${styles.bgClass} ${styles.borderClass} ${styles.textClass}`;

  if (isCurrent) {
    return `${base} ring-2 ring-blue-500 shadow-md border-blue-500 font-semibold`;
  }

  return `${base} border`;
}

/**
 * Generates an array of category style definitions for visual legends.
 * If an array of present types is provided, only categories actually
 * present in the data are returned. Otherwise, returns the primary canonical list.
 */
export function getLegendCategories(presentTipos?: (string | null | undefined)[]): ActivityStyleDefinition[] {
  if (presentTipos && presentTipos.length > 0) {
    const presentKeys = new Set<CanonicalCategory>();
    presentTipos.forEach((t) => {
      if (t) {
        presentKeys.add(normalizeCategoryKey(t));
      }
    });

    const list: ActivityStyleDefinition[] = [];
    // Order according to canonical priority
    const priority: CanonicalCategory[] = [
      'DOCENCIA',
      'REFUERZO',
      'COORDINACIÓN',
      'EQUIPO_DIRECTIVO',
      'RECREO',
      'OTROS',
      'TDE',
      'STEAM',
      'PLAN_APERTURA',
      'ITINERANCIA',
      'REDUCCIÓN',
    ];

    priority.forEach((k) => {
      if (presentKeys.has(k) && activityCategoryStyles[k]) {
        list.push(activityCategoryStyles[k]);
      }
    });

    return list.length > 0 ? list : [activityCategoryStyles.DOCENCIA, activityCategoryStyles.OTROS];
  }

  // Default core legend
  return [
    activityCategoryStyles.DOCENCIA,
    activityCategoryStyles.REFUERZO,
    activityCategoryStyles.COORDINACIÓN,
    activityCategoryStyles.EQUIPO_DIRECTIVO,
    activityCategoryStyles.RECREO,
    activityCategoryStyles.OTROS,
  ];
}
