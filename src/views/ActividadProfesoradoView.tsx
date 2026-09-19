import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DiaSemana, DIAS_SEMANA, TRAMOS_ESTANDAR, TramoReferencia } from '../types';
import {
  formatUbicacion,
  normalizeDia,
  timeToMinutes,
  getDisplayObservation,
  isValidDisplayGroup,
  formatDisplayGroup,
  isUbicacionSpecified,
  getSystemTimeInfo,
  isDayActuallyToday,
  isActivityOverlappingSlot,
  isActivityActiveAtInstant,
  areGroupAndLocationEqual,
} from '../utils/timeUtils';
import { TemporalStatusHeader } from '../components/TemporalStatusHeader';
import {
  CanonicalCategory,
  normalizeCategoryKey,
} from '../utils/activityStyles';
import {
  LayoutGrid,
  Clock,
  Users,
  Shield,
  BookOpen,
  Coffee,
  Building,
  MapPin,
  ShieldAlert,
} from 'lucide-react';

interface ActivityDisplayItem {
  id: string;
  docente_id: string;
  nombre_docente: string;
  actividad: string;
  grupo?: string;
  ubicación?: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: string;
  canonicalCategory: CanonicalCategory;
  observaciones?: string;
  origen: 'horario' | 'refuerzo_centro';
}

const MODO_OPTIONS = [
  { id: 'hora_exacta', label: 'Hora exacta', isTramo: false, start: '', end: '' },
  { id: '09:00-09:30', label: '09:00–09:30', isTramo: true, start: '09:00', end: '09:30' },
  { id: '09:30-10:30', label: '09:30–10:30', isTramo: true, start: '09:30', end: '10:30' },
  { id: '10:30-11:30', label: '10:30–11:30', isTramo: true, start: '10:30', end: '11:30' },
  { id: '11:30-12:00', label: '11:30–12:00 · Recreo', isTramo: true, start: '11:30', end: '12:00' },
  { id: '12:00-13:00', label: '12:00–13:00', isTramo: true, start: '12:00', end: '13:00' },
  { id: '13:00-14:00', label: '13:00–14:00', isTramo: true, start: '13:00', end: '14:00' },
];

export const ActividadProfesoradoView: React.FC = () => {
  const { isAdmin, horarios, refuerzos } = useApp();

  // 1. FECHA Y HORA REALES (Device clock)
  const [systemTime, setSystemTime] = useState(() => getSystemTimeInfo());
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(getSystemTimeInfo());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const realSchoolDay = systemTime.realSchoolDay; // null on weekends
  const realTime = systemTime.realTimeStr;
  const isWeekend = systemTime.isWeekend;

  // 2. MOMENTO CONSULTADO
  const [selectedDay, setSelectedDay] = useState<DiaSemana>(() => {
    const initial = getSystemTimeInfo();
    return initial.realSchoolDay || initial.defaultConsultationDay;
  });

  const [selectedModo, setSelectedModo] = useState<string>(() => {
    const initial = getSystemTimeInfo();
    if (!initial.isWeekend && initial.realSchoolDay) {
      return 'hora_exacta';
    }
    return '09:30-10:30';
  });

  const [exactTime, setExactTime] = useState<string>(() => {
    return getSystemTimeInfo().realTimeStr;
  });

  // Filter by category: 'TODOS' or specific canonical category
  const [categoryFilter, setCategoryFilter] = useState<'TODOS' | CanonicalCategory>('TODOS');

  // Exact real time check
  const isRealTime =
    !isWeekend &&
    realSchoolDay !== null &&
    selectedDay === realSchoolDay &&
    selectedModo === 'hora_exacta' &&
    exactTime === realTime;

  // Label for consulted time in header
  const currentModoOpt = MODO_OPTIONS.find((m) => m.id === selectedModo) || MODO_OPTIONS[0];
  const consultedTimeLabel = currentModoOpt.isTramo
    ? `${currentModoOpt.start}–${currentModoOpt.end}`
    : exactTime;

  const resetToReal = () => {
    const current = getSystemTimeInfo();
    setSystemTime(current);
    if (!current.isWeekend && current.realSchoolDay) {
      setSelectedDay(current.realSchoolDay);
      setSelectedModo('hora_exacta');
      setExactTime(current.realTimeStr);
    } else {
      setSelectedDay(current.defaultConsultationDay);
      setSelectedModo('09:30-10:30');
      setExactTime(current.realTimeStr);
    }
    setCategoryFilter('TODOS');
  };

  // Role Access Guard: strictly restricted to ADMIN
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl shadow-md border border-slate-200 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Acceso Restringido</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          La sección <strong>Actividad del profesorado</strong> está reservada exclusivamente a usuarios con rol <strong>ADMIN</strong>.
        </p>
      </div>
    );
  }

  // 3. Gather all matching activities from HORARIOS & REFUERZOS
  const allMatchingActivities = useMemo(() => {
    const results: ActivityDisplayItem[] = [];
    const isTramoMode = currentModoOpt.isTramo;

    // Filter from HORARIOS
    horarios.forEach((h, idx) => {
      if (normalizeDia(h.día) !== selectedDay) return;

      let isIncluded = false;
      if (isTramoMode) {
        // Condition: activityStart < selectedEnd AND activityEnd > selectedStart
        isIncluded = isActivityOverlappingSlot(
          h.hora_inicio,
          h.hora_fin,
          currentModoOpt.start,
          currentModoOpt.end
        );
      } else {
        // Condition: activityStart <= exactTime AND activityEnd > exactTime
        isIncluded = isActivityActiveAtInstant(h.hora_inicio, h.hora_fin, exactTime);
      }

      if (isIncluded) {
        const cat = normalizeCategoryKey(h.tipo);
        results.push({
          id: h.id || `h-${h.docente_id || idx}-${h.hora_inicio}`,
          docente_id: h.docente_id,
          nombre_docente: h.nombre_docente,
          actividad: h.actividad,
          grupo: isValidDisplayGroup(h.grupo) ? h.grupo : undefined,
          ubicación: h.ubicación,
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
          tipo: h.tipo || cat,
          canonicalCategory: cat,
          observaciones: getDisplayObservation(h.observaciones) || undefined,
          origen: 'horario',
        });
      }
    });

    // Filter from REFUERZOS
    refuerzos.forEach((r, idx) => {
      if (normalizeDia(r.dia) !== selectedDay) return;

      let isIncluded = false;
      if (isTramoMode) {
        isIncluded = isActivityOverlappingSlot(
          r.hora_inicio,
          r.hora_fin,
          currentModoOpt.start,
          currentModoOpt.end
        );
      } else {
        isIncluded = isActivityActiveAtInstant(r.hora_inicio, r.hora_fin, exactTime);
      }

      if (!isIncluded) return;

      const refTeacher = (r.docente_refuerzo || '').trim().toLowerCase();
      const refId = (r.docente_id || '').trim().toLowerCase();

      // Check if already covered in results from HORARIOS
      const existing = results.find((item) => {
        if (item.canonicalCategory !== 'REFUERZO') return false;
        const itemTeacher = (item.nombre_docente || '').trim().toLowerCase();
        const itemId = (item.docente_id || '').trim().toLowerCase();

        const sameTeacher =
          (refId && itemId && refId === itemId) ||
          itemTeacher === refTeacher ||
          itemTeacher.includes(refTeacher) ||
          refTeacher.includes(itemTeacher);

        if (!sameTeacher) return false;

        return isActivityOverlappingSlot(
          item.hora_inicio,
          item.hora_fin,
          r.hora_inicio,
          r.hora_fin
        );
      });

      if (existing) {
        if (!existing.grupo && isValidDisplayGroup(r.grupo_apoyado)) {
          existing.grupo = r.grupo_apoyado;
        }
        if (!existing.observaciones && getDisplayObservation(r.observaciones)) {
          existing.observaciones = getDisplayObservation(r.observaciones) || undefined;
        }
      } else {
        results.push({
          id: r.id || `rc-${r.docente_refuerzo || idx}-${r.hora_inicio}`,
          docente_id: r.docente_id || '',
          nombre_docente: r.docente_refuerzo,
          actividad: r.materia || 'Refuerzo Pedagógico',
          grupo: isValidDisplayGroup(r.grupo_apoyado) ? r.grupo_apoyado : undefined,
          ubicación: undefined,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin,
          tipo: 'REFUERZO',
          canonicalCategory: 'REFUERZO',
          observaciones: getDisplayObservation(r.observaciones) || undefined,
          origen: 'refuerzo_centro',
        });
      }
    });

    return results;
  }, [horarios, refuerzos, selectedDay, currentModoOpt, exactTime]);

  // Merge ONLY identical contiguous intervals of same teacher & activity & location
  // Multiple distinct activities or non-contiguous slots of the same teacher are strictly preserved
  const deduplicateCategoryItems = (items: ActivityDisplayItem[]): ActivityDisplayItem[] => {
    const sorted = [...items].sort((a, b) => {
      const cmp = a.nombre_docente.localeCompare(b.nombre_docente, 'es');
      if (cmp !== 0) return cmp;
      return timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio);
    });

    const merged: ActivityDisplayItem[] = [];
    for (const item of sorted) {
      const prev = merged[merged.length - 1];

      const sameTeacher = Boolean(
        prev && (
          (prev.docente_id && item.docente_id && prev.docente_id.toLowerCase() === item.docente_id.toLowerCase()) ||
          ((prev.nombre_docente || '').trim().toLowerCase() === (item.nombre_docente || '').trim().toLowerCase())
        )
      );

      const sameActivity = Boolean(
        prev && ((prev.actividad || '').trim().toLowerCase() === (item.actividad || '').trim().toLowerCase())
      );
      const sameGroup = (prev?.grupo || '') === (item.grupo || '');
      const sameLocation = (prev?.ubicación || '') === (item.ubicación || '');
      const isContiguous = Boolean(prev && prev.hora_fin === item.hora_inicio);

      if (sameTeacher && sameActivity && sameGroup && sameLocation && isContiguous) {
        prev.hora_fin = item.hora_fin;
      } else {
        merged.push({ ...item });
      }
    }

    return merged;
  };

  // Group items by category
  const docenciaItems = useMemo(() => {
    const filtered = allMatchingActivities.filter((item) => item.canonicalCategory === 'DOCENCIA');
    const deduped = deduplicateCategoryItems(filtered);
    return deduped.sort((a, b) => (a.grupo || '').localeCompare(b.grupo || '', 'es', { numeric: true }));
  }, [allMatchingActivities]);

  const refuerzoItems = useMemo(() => {
    const filtered = allMatchingActivities.filter((item) => item.canonicalCategory === 'REFUERZO');
    return deduplicateCategoryItems(filtered);
  }, [allMatchingActivities]);

  const coordinacionItems = useMemo(() => {
    const filtered = allMatchingActivities.filter((item) => item.canonicalCategory === 'COORDINACIÓN');
    return deduplicateCategoryItems(filtered);
  }, [allMatchingActivities]);

  const equipoDirectivoItems = useMemo(() => {
    const filtered = allMatchingActivities.filter((item) => item.canonicalCategory === 'EQUIPO_DIRECTIVO');
    return deduplicateCategoryItems(filtered);
  }, [allMatchingActivities]);

  const recreoItems = useMemo(() => {
    const filtered = allMatchingActivities.filter((item) => item.canonicalCategory === 'RECREO');
    return deduplicateCategoryItems(filtered);
  }, [allMatchingActivities]);

  const otrasFuncionesItems = useMemo(() => {
    const filtered = allMatchingActivities.filter((item) => {
      const cat = item.canonicalCategory;
      return (
        cat !== 'DOCENCIA' &&
        cat !== 'REFUERZO' &&
        cat !== 'COORDINACIÓN' &&
        cat !== 'EQUIPO_DIRECTIVO' &&
        cat !== 'RECREO'
      );
    });
    return deduplicateCategoryItems(filtered);
  }, [allMatchingActivities]);

  // Unique teacher count helper
  const countUniqueTeachers = (items: ActivityDisplayItem[]) => {
    const set = new Set<string>();
    items.forEach((item) => {
      const key = item.docente_id?.trim() || (item.nombre_docente || '').trim().toLowerCase();
      if (key) set.add(key);
    });
    return set.size;
  };

  const totalUniqueCount = useMemo(() => countUniqueTeachers(allMatchingActivities), [allMatchingActivities]);
  const uniqueDocenciaCount = useMemo(() => countUniqueTeachers(docenciaItems), [docenciaItems]);
  const uniqueRefuerzoCount = useMemo(() => countUniqueTeachers(refuerzoItems), [refuerzoItems]);
  const uniqueCoordinacionCount = useMemo(() => countUniqueTeachers(coordinacionItems), [coordinacionItems]);
  const uniqueEquipoDirectivoCount = useMemo(() => countUniqueTeachers(equipoDirectivoItems), [equipoDirectivoItems]);
  const uniqueRecreoCount = useMemo(() => countUniqueTeachers(recreoItems), [recreoItems]);
  const uniqueOtrasFuncionesCount = useMemo(() => countUniqueTeachers(otrasFuncionesItems), [otrasFuncionesItems]);

  // Toggle category filter
  const handleCategoryFilterClick = (cat: 'TODOS' | CanonicalCategory) => {
    if (categoryFilter === cat && cat !== 'TODOS') {
      setCategoryFilter('TODOS');
    } else {
      setCategoryFilter(cat);
    }
  };

  // Determine which blocks to show: ONLY show if items.length > 0 AND filter matches
  const showDocencia = (categoryFilter === 'TODOS' || categoryFilter === 'DOCENCIA') && docenciaItems.length > 0;
  const showRefuerzo = (categoryFilter === 'TODOS' || categoryFilter === 'REFUERZO') && refuerzoItems.length > 0;
  const showCoordinacion = (categoryFilter === 'TODOS' || categoryFilter === 'COORDINACIÓN') && coordinacionItems.length > 0;
  const showEquipoDirectivo = (categoryFilter === 'TODOS' || categoryFilter === 'EQUIPO_DIRECTIVO') && equipoDirectivoItems.length > 0;
  const showRecreo = (categoryFilter === 'TODOS' || categoryFilter === 'RECREO') && recreoItems.length > 0;
  const showOtrasFunciones = (categoryFilter === 'TODOS' || categoryFilter === 'OTROS') && otrasFuncionesItems.length > 0;

  const hasAnyVisibleBlock = showDocencia || showRefuerzo || showCoordinacion || showEquipoDirectivo || showRecreo || showOtrasFunciones;

  return (
    <div id="view-actividad-profesorado" className="w-full space-y-5">
      {/* 1. Header Card with amber accent identity */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Actividad del profesorado
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Consulta qué está haciendo el profesorado en un momento determinado.
              </p>
            </div>
          </div>

          <TemporalStatusHeader
            systemTime={systemTime}
            isRealTime={isRealTime}
            consultedDay={selectedDay}
            consultedTimeLabel={consultedTimeLabel}
            onResetToReal={resetToReal}
            accentColor="amber"
          />
        </div>
      </div>

      {/* 2. Compact Temporal Controls Card: Día, Modo de consulta, Hora */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
          {/* DÍA */}
          <div>
            <label
              htmlFor="select-actividad-dia"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Día
            </label>
            <div className="relative">
              <select
                id="select-actividad-dia"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value as DiaSemana)}
                className="w-full text-sm font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer appearance-none"
              >
                {DIAS_SEMANA.map((dia) => {
                  const isToday = isDayActuallyToday(dia, systemTime.realDate);
                  return (
                    <option key={dia} value={dia}>
                      {dia} {isToday ? '(Hoy)' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <Clock className="w-4 h-4 opacity-50" />
              </div>
            </div>
          </div>

          {/* MODO DE CONSULTA */}
          <div>
            <label
              htmlFor="select-actividad-modo"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Modo de consulta
            </label>
            <div className="relative">
              <select
                id="select-actividad-modo"
                value={selectedModo}
                onChange={(e) => setSelectedModo(e.target.value)}
                className="w-full text-sm font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer appearance-none"
              >
                {MODO_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <Clock className="w-4 h-4 opacity-50" />
              </div>
            </div>
          </div>

          {/* HORA */}
          <div>
            <label
              htmlFor="input-actividad-hora"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between"
            >
              <span>Hora</span>
              {selectedModo !== 'hora_exacta' && (
                <span className="text-[10px] font-normal text-slate-400 normal-case">
                  (Modo tramo activo)
                </span>
              )}
            </label>
            <input
              id="input-actividad-hora"
              type="time"
              value={exactTime}
              onChange={(e) => {
                setExactTime(e.target.value);
                setSelectedModo('hora_exacta');
              }}
              title={selectedModo === 'hora_exacta' ? 'Modificar hora exacta' : 'Editar para cambiar a modo hora exacta'}
              className={`w-full text-sm font-mono font-bold px-3 py-2 rounded-xl border transition focus:outline-none ${
                selectedModo === 'hora_exacta'
                  ? 'border-amber-500 bg-amber-50/40 text-amber-950 focus:ring-2 focus:ring-amber-500'
                  : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-50'
              }`}
            />
          </div>
        </div>

        {/* 3. Category Summary Counters (These act directly as category filters) */}
        <div className="pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-600 mb-2">
            Filtrar por actividad:
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {/* TODOS counter */}
            <button
              id="counter-actividad-todos"
              type="button"
              onClick={() => handleCategoryFilterClick('TODOS')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'TODOS'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Mostrar todas las categorías"
            >
              <span>Todos ({totalUniqueCount})</span>
            </button>

            {/* DOCENCIA counter */}
            <button
              id="counter-actividad-docencia"
              type="button"
              onClick={() => handleCategoryFilterClick('DOCENCIA')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'DOCENCIA'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              }`}
              title="Filtrar por Docencia"
            >
              <span>Docencia ({uniqueDocenciaCount})</span>
            </button>

            {/* REFUERZO counter */}
            <button
              id="counter-actividad-refuerzo"
              type="button"
              onClick={() => handleCategoryFilterClick('REFUERZO')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'REFUERZO'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Filtrar por Refuerzo"
            >
              <span>Refuerzo ({uniqueRefuerzoCount})</span>
            </button>

            {/* COORDINACIÓN counter */}
            <button
              id="counter-actividad-coordinacion"
              type="button"
              onClick={() => handleCategoryFilterClick('COORDINACIÓN')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'COORDINACIÓN'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Filtrar por Coordinación"
            >
              <span>Coordinación ({uniqueCoordinacionCount})</span>
            </button>

            {/* EQUIPO DIRECTIVO counter */}
            <button
              id="counter-actividad-equipo-directivo"
              type="button"
              onClick={() => handleCategoryFilterClick('EQUIPO_DIRECTIVO')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'EQUIPO_DIRECTIVO'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-200'
                  : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
              }`}
              title="Filtrar por Equipo Directivo"
            >
              <span>Equipo Directivo ({uniqueEquipoDirectivoCount})</span>
            </button>

            {/* RECREO counter (if present) */}
            {uniqueRecreoCount > 0 && (
              <button
                id="counter-actividad-recreo"
                type="button"
                onClick={() => handleCategoryFilterClick('RECREO')}
                className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                  categoryFilter === 'RECREO'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Filtrar por Recreo"
              >
                <span>Recreo ({uniqueRecreoCount})</span>
              </button>
            )}

            {/* OTRAS FUNCIONES counter */}
            <button
              id="counter-actividad-otros"
              type="button"
              onClick={() => handleCategoryFilterClick('OTROS')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'OTROS'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-300'
                  : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
              }`}
              title="Filtrar por Otras funciones"
            >
              <span>Otras funciones ({uniqueOtrasFuncionesCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Category Blocks (ONLY rendered if items.length > 0) */}
      <div className="space-y-5">
        {/* BLOQUE: DOCENCIA */}
        {showDocencia && (
          <div
            id="bloque-actividad-docencia"
            className="bg-white rounded-2xl shadow-xs border border-blue-200 overflow-hidden"
          >
            <div className="p-3.5 sm:p-4 border-b border-blue-100 bg-blue-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Docencia ({uniqueDocenciaCount})
                </h2>
              </div>
            </div>
            <CategoryItemsTable items={docenciaItems} />
          </div>
        )}

        {/* BLOQUE: REFUERZO */}
        {showRefuerzo && (
          <div
            id="bloque-actividad-refuerzo"
            className="bg-white rounded-2xl shadow-xs border border-emerald-200 overflow-hidden"
          >
            <div className="p-3.5 sm:p-4 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Refuerzo ({uniqueRefuerzoCount})
                </h2>
              </div>
            </div>
            <CategoryItemsTable items={refuerzoItems} />
          </div>
        )}

        {/* BLOQUE: COORDINACIÓN */}
        {showCoordinacion && (
          <div
            id="bloque-actividad-coordinacion"
            className="bg-white rounded-2xl shadow-xs border border-amber-200 overflow-hidden"
          >
            <div className="p-3.5 sm:p-4 border-b border-amber-100 bg-amber-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Coordinación ({uniqueCoordinacionCount})
                </h2>
              </div>
            </div>
            <CategoryItemsTable items={coordinacionItems} />
          </div>
        )}

        {/* BLOQUE: EQUIPO DIRECTIVO */}
        {showEquipoDirectivo && (
          <div
            id="bloque-actividad-equipo-directivo"
            className="bg-white rounded-2xl shadow-xs border border-purple-200 overflow-hidden"
          >
            <div className="p-3.5 sm:p-4 border-b border-purple-100 bg-purple-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Equipo Directivo ({uniqueEquipoDirectivoCount})
                </h2>
              </div>
            </div>
            <CategoryItemsTable items={equipoDirectivoItems} />
          </div>
        )}

        {/* BLOQUE: RECREO */}
        {showRecreo && (
          <div
            id="bloque-actividad-recreo"
            className="bg-white rounded-2xl shadow-xs border border-indigo-200 overflow-hidden"
          >
            <div className="p-3.5 sm:p-4 border-b border-indigo-100 bg-indigo-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Coffee className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Recreo ({uniqueRecreoCount})
                </h2>
              </div>
            </div>
            <CategoryItemsTable items={recreoItems} />
          </div>
        )}

        {/* BLOQUE: OTRAS FUNCIONES */}
        {showOtrasFunciones && (
          <div
            id="bloque-actividad-otros"
            className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden"
          >
            <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Otras funciones ({uniqueOtrasFuncionesCount})
                </h2>
              </div>
            </div>
            <CategoryItemsTable items={otrasFuncionesItems} />
          </div>
        )}

        {/* Empty state: when no blocks are visible for this moment/filter */}
        {!hasAnyVisibleBlock && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs">
            <LayoutGrid className="w-8 h-8 text-slate-400 mx-auto mb-2.5 opacity-60" />
            <p className="text-sm font-semibold text-slate-800">
              {categoryFilter === 'TODOS'
                ? 'Sin actividad docente registrada para este momento.'
                : 'Sin registros para la categoría seleccionada en este momento.'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Prueba a cambiar el modo de consulta, hora o día lectivo.
            </p>
            {categoryFilter !== 'TODOS' && (
              <button
                onClick={() => setCategoryFilter('TODOS')}
                className="mt-3 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Ver todas las categorías
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Renders the clean 4-column table:
 * DOCENTE | ACTIVIDAD | GRUPO / UBICACIÓN | HORARIO
 * Removes the TIPO column completely.
 * Deduplicates Grupo and Ubicación visually if identical.
 */
const CategoryItemsTable: React.FC<{ items: ActivityDisplayItem[] }> = ({ items }) => {
  return (
    <>
      {/* MOBILE CARDS VIEW (< md) */}
      <div className="md:hidden p-3 space-y-2.5">
        {items.map((item, idx) => {
          return (
            <div
              key={item.id || idx}
              className="p-3.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs text-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <span className="font-bold text-slate-900 text-sm block">
                    {item.nombre_docente}
                  </span>
                  <span className="text-slate-600 font-medium text-xs block mt-0.5">
                    {item.actividad}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded block">
                    {item.hora_inicio}–{item.hora_fin}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-slate-600 pt-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Grupo / Ubicación:
                </span>
                <div className="text-right">
                  {renderGrupoUbicacionCell(item.grupo, item.ubicación)}
                </div>
              </div>

              {item.observaciones && (
                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-50">
                  {item.observaciones}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE VIEW (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider">
              <th className="p-3.5">Docente</th>
              <th className="p-3.5">Actividad</th>
              <th className="p-3.5">Grupo / Ubicación</th>
              <th className="p-3.5">Horario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              return (
                <tr key={item.id || idx} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-bold text-slate-900">
                    {item.nombre_docente}
                  </td>
                  <td className="p-3.5 text-slate-800 font-medium">
                    {item.actividad}
                    {item.observaciones && (
                      <span className="block text-xs text-slate-400 italic">
                        {item.observaciones}
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    {renderGrupoUbicacionCell(item.grupo, item.ubicación)}
                  </td>
                  <td className="p-3.5 font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
                    {item.hora_inicio}–{item.hora_fin}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

/**
 * Visual deduplication of Grupo and Ubicación:
 * If both exist and are identical: show only once (e.g. "4º").
 * If different: show both clearly (e.g. "4º · Gimnasio").
 * If only group: show group.
 * If only location: show location.
 * If neither: show "—".
 */
function renderGrupoUbicacionCell(grupo?: string, ubicacion?: string) {
  const displayGroup = isValidDisplayGroup(grupo) ? formatDisplayGroup(grupo) : null;
  const isUbicSpecified = isUbicacionSpecified(ubicacion);
  const formattedUbic = isUbicSpecified ? formatUbicacion(ubicacion) : null;

  if (displayGroup && formattedUbic) {
    if (areGroupAndLocationEqual(displayGroup, formattedUbic)) {
      return (
        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {displayGroup}
        </span>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap text-xs">
        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
          {displayGroup}
        </span>
        <span className="text-slate-400 font-bold">·</span>
        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{formattedUbic}</span>
        </span>
      </div>
    );
  }

  if (displayGroup) {
    return (
      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
        {displayGroup}
      </span>
    );
  }

  if (formattedUbic) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-600 text-xs font-medium">
        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
        <span>{formattedUbic}</span>
      </span>
    );
  }

  return <span className="text-slate-400 text-xs">—</span>;
}
