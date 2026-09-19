import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  findTeacherSlot,
  formatUbicacion,
  normalizeDia,
  timeToMinutes,
  getCenterDayRange,
  getDisplayObservation,
  areGroupAndLocationEqual,
  isValidDisplayGroup,
  formatDisplayGroup,
  isUbicacionSpecified,
  isTimeInSlot,
  getSystemTimeInfo,
  isActivityOverlappingSlot,
  isActivityActiveAtInstant,
  areTeacherNamesEquivalent,
  isSlotForTeacher,
} from '../utils/timeUtils';
import { ActivityBadge } from '../components/ActivityBadge';
import { TemporalStatusHeader } from '../components/TemporalStatusHeader';
import {
  Search,
  MapPin,
  BookOpen,
  Users,
  Clock,
  UserCheck,
  AlertCircle,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ChevronDown,
  Check,
} from 'lucide-react';
import { DIAS_SEMANA, DiaSemana, HorarioTramo, TRAMOS_ESTANDAR } from '../types';

interface DondeEstaViewProps {
  onSelectDocenteForSchedule?: (docenteId: string) => void;
}

export const DondeEstaView: React.FC<DondeEstaViewProps> = ({ onSelectDocenteForSchedule }) => {
  const { docentes, horarios } = useApp();

  // A) FECHA Y HORA REALES (Device clock and calendar)
  const [systemTime, setSystemTime] = useState(() => getSystemTimeInfo());
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(getSystemTimeInfo());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const realSchoolDay = systemTime.realSchoolDay; // strictly null on weekends (Sábado / Domingo)
  const realTime = systemTime.realTimeStr;
  const isWeekend = systemTime.isWeekend;

  // Helper to find standard tramo covering a given time
  const findMatchingTramoStart = (timeStr: string): string => {
    const direct = TRAMOS_ESTANDAR.find((t) => t.hora_inicio === timeStr);
    if (direct) return direct.hora_inicio;
    const inside = TRAMOS_ESTANDAR.find((t) => isTimeInSlot(timeStr, t.hora_inicio, t.hora_fin));
    if (inside) return inside.hora_inicio;
    return TRAMOS_ESTANDAR[0].hora_inicio;
  };

  // B) MOMENTO CONSULTADO (Selected day, tramo, and exact time)
  const [consultedDay, setConsultedDay] = useState<DiaSemana>(() => {
    const initial = getSystemTimeInfo();
    return initial.realSchoolDay || initial.defaultConsultationDay;
  });

  const [consultedTime, setConsultedTime] = useState<string>(() => {
    return getSystemTimeInfo().realTimeStr;
  });

  // Selected standard tramo key (hora_inicio)
  const [selectedTramoKey, setSelectedTramoKey] = useState<string>(() => {
    return findMatchingTramoStart(getSystemTimeInfo().realTimeStr);
  });

  // Mode: 'tramo' (queries full slot interval via overlap) | 'hora' (queries exact instant)
  const [consultationMode, setConsultationMode] = useState<'tramo' | 'hora'>('tramo');

  // Real-time synchronization active only when today is a school day and user hasn't overridden
  const [isRealTimeSync, setIsRealTimeSync] = useState<boolean>(() => {
    return !getSystemTimeInfo().isWeekend;
  });

  // Collapsible state for "Consultar otro momento" panel (default: collapsed)
  const [isConsultarMomentoOpen, setIsConsultarMomentoOpen] = useState(false);

  // Automatically update consulted moment when in real-time sync during school days
  useEffect(() => {
    if (!isRealTimeSync || isWeekend || !realSchoolDay) return;
    setConsultedDay(realSchoolDay);
    setConsultedTime(realTime);
    setSelectedTramoKey(findMatchingTramoStart(realTime));
  }, [isRealTimeSync, isWeekend, realSchoolDay, realTime]);

  // Is the currently consulted moment genuinely corresponding to REAL TIME?
  const isRealTime =
    !isWeekend &&
    realSchoolDay !== null &&
    consultedDay === realSchoolDay &&
    (isRealTimeSync || consultedTime === realTime);

  // Active Tramo object
  const selectedTramo = useMemo(() => {
    return (
      TRAMOS_ESTANDAR.find((t) => t.hora_inicio === selectedTramoKey) || TRAMOS_ESTANDAR[0]
    );
  }, [selectedTramoKey]);

  // Label to show in header: either interval "13:00–14:00" if in tramo mode or exact time "13:56"
  const consultedTimeLabel = useMemo(() => {
    if (consultationMode === 'tramo') {
      return `${selectedTramo.hora_inicio}–${selectedTramo.hora_fin}`;
    }
    return consultedTime;
  }, [consultationMode, selectedTramo, consultedTime]);

  const resetToReal = () => {
    const current = getSystemTimeInfo();
    setSystemTime(current);
    if (!current.isWeekend && current.realSchoolDay) {
      setConsultedDay(current.realSchoolDay);
      setConsultedTime(current.realTimeStr);
      setSelectedTramoKey(findMatchingTramoStart(current.realTimeStr));
      setIsRealTimeSync(true);
      setConsultationMode('hora');
    } else {
      setConsultedDay(current.defaultConsultationDay);
      setConsultedTime(current.realTimeStr);
      setSelectedTramoKey(findMatchingTramoStart(current.realTimeStr));
      setIsRealTimeSync(false);
      setConsultationMode('hora');
    }
  };

  const handleSelectDay = (day: DiaSemana) => {
    setConsultedDay(day);
    setIsRealTimeSync(false);
  };

  const handleSelectTramo = (horaInicio: string) => {
    const tramo = TRAMOS_ESTANDAR.find((t) => t.hora_inicio === horaInicio) || TRAMOS_ESTANDAR[0];
    setSelectedTramoKey(tramo.hora_inicio);
    setConsultedTime(tramo.hora_inicio);
    setConsultationMode('tramo');
    setIsRealTimeSync(false);
  };

  const handleCustomTime = (time: string) => {
    setConsultedTime(time);
    setConsultationMode('hora');
    setIsRealTimeSync(false);
    setSelectedTramoKey(findMatchingTramoStart(time));
  };

  const [selectedDocenteId, setSelectedDocenteId] = useState<string>(() => {
    return (docentes && docentes.length > 0) ? docentes[0].docente_id : '';
  });

  // Automatically synchronize selectedDocenteId when docentes list changes (e.g. after Excel import)
  useEffect(() => {
    if (!docentes || docentes.length === 0) {
      setSelectedDocenteId('');
      return;
    }
    const exists = docentes.some(
      (d) =>
        (d?.docente_id && selectedDocenteId && d.docente_id.toLowerCase() === selectedDocenteId.toLowerCase()) ||
        (d?.nombre_docente && selectedDocenteId && d.nombre_docente.toLowerCase() === selectedDocenteId.toLowerCase())
    );
    if (!exists) {
      setSelectedDocenteId(docentes[0].docente_id);
    }
  }, [docentes]);
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState<boolean>(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState<string>('');
  const teacherDropdownRef = useRef<HTMLDivElement>(null);

  // Close teacher dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTeacherDropdownOpen(false);
      }
    };
    if (isTeacherDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTeacherDropdownOpen]);

  // Track active consultation anchor moment for navigation
  const isSlotNavigatingRef = useRef(false);
  const [consultationAnchor, setConsultationAnchor] = useState<{ time: string; wasReal: boolean }>({
    time: consultedTime,
    wasReal: isRealTime,
  });

  useEffect(() => {
    if (isSlotNavigatingRef.current) {
      isSlotNavigatingRef.current = false;
    } else {
      setConsultationAnchor({
        time: consultedTime,
        wasReal: isRealTime,
      });
    }
  }, [consultedTime, consultedDay, isRealTime]);

  // Alphabetically sorted teachers
  const sortedDocentes = useMemo(() => {
    return [...(docentes || [])].sort((a, b) =>
      (a?.nombre_docente || '').localeCompare(b?.nombre_docente || '', 'es', { sensitivity: 'base' })
    );
  }, [docentes]);

  // Filtered teachers list for dropdown search
  const filteredDocentes = useMemo(() => {
    const q = (teacherSearchQuery || '').trim().toLowerCase();
    if (!q) return sortedDocentes;
    return sortedDocentes.filter(
      (d) =>
        (d?.nombre_docente && d.nombre_docente.toLowerCase().includes(q)) ||
        (d?.docente_id && d.docente_id.toLowerCase().includes(q)) ||
        (d?.especialidad && d.especialidad.toLowerCase().includes(q))
    );
  }, [sortedDocentes, teacherSearchQuery]);

  // Selected teacher object
  const selectedDocente = useMemo(() => {
    if (!selectedDocenteId) return null;
    const cleanId = selectedDocenteId.trim().toLowerCase();
    return (
      (docentes || []).find((d) => (d?.docente_id || '').trim().toLowerCase() === cleanId) ||
      (docentes || []).find((d) => (d?.nombre_docente || '').trim().toLowerCase() === cleanId) ||
      (docentes || []).find((d) => areTeacherNamesEquivalent(d?.nombre_docente, cleanId)) ||
      null
    );
  }, [docentes, selectedDocenteId]);

  // Full slots for the selected teacher on consultedDay (sorted by start time)
  const todaySlots = useMemo(() => {
    if (!selectedDocenteId && !selectedDocente) return [];

    return (horarios || [])
      .filter((h) => {
        if (!h || normalizeDia(h.día) !== consultedDay) return false;
        return (
          (selectedDocente && isSlotForTeacher(h, selectedDocente)) ||
          isSlotForTeacher(h, selectedDocenteId)
        );
      })
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));
  }, [horarios, selectedDocenteId, selectedDocente, consultedDay]);

  // Current slot for selected teacher at consultedDay & consultedTime / selectedTramo
  // Supports subtramos (15 and 30 min) through strict temporal overlap / instant check
  const currentSlot: HorarioTramo | null = useMemo(() => {
    if (!selectedDocenteId || !todaySlots || todaySlots.length === 0) return null;

    if (consultationMode === 'hora') {
      // Condition A6: exact instant
      return (
        todaySlots.find((h) =>
          isActivityActiveAtInstant(h.hora_inicio, h.hora_fin, consultedTime)
        ) || null
      );
    } else {
      // Condition A1: slot overlap with selected tramo interval
      // Prioritize slot active at consultedTime within the selected tramo
      const exactOrActive = todaySlots.find((h) =>
        isActivityActiveAtInstant(h.hora_inicio, h.hora_fin, consultedTime)
      );
      if (
        exactOrActive &&
        isActivityOverlappingSlot(
          exactOrActive.hora_inicio,
          exactOrActive.hora_fin,
          selectedTramo.hora_inicio,
          selectedTramo.hora_fin
        )
      ) {
        return exactOrActive;
      }
      // Otherwise find the first slot of this teacher overlapping the selected tramo
      const overlapping = todaySlots.find((h) =>
        isActivityOverlappingSlot(
          h.hora_inicio,
          h.hora_fin,
          selectedTramo.hora_inicio,
          selectedTramo.hora_fin
        )
      );
      return overlapping || null;
    }
  }, [selectedDocenteId, todaySlots, consultationMode, consultedTime, selectedTramo]);

  // Center schedule boundaries for consultedDay
  const centerRange = useMemo(() => getCenterDayRange(horarios, consultedDay), [horarios, consultedDay]);
  const activeMin = timeToMinutes(consultedTime);
  const startMin = timeToMinutes(centerRange.start);
  const endMin = timeToMinutes(centerRange.end);

  const isBeforeSchool = activeMin < startMin;
  const isAfterSchool = activeMin >= endMin;
  const isOutsideSchoolHours = isBeforeSchool || isAfterSchool;

  // Temporal navigation slots on the same day
  const { prevSlot, nextSlot } = useMemo(() => {
    if (todaySlots.length === 0) {
      return { prevSlot: null, nextSlot: null };
    }

    const currentMin = timeToMinutes(consultedTime);

    if (currentSlot) {
      const idx = todaySlots.findIndex(
        (s) =>
          s.id === currentSlot.id ||
          (s.hora_inicio === currentSlot.hora_inicio && s.hora_fin === currentSlot.hora_fin)
      );
      return {
        prevSlot: idx > 0 ? todaySlots[idx - 1] : null,
        nextSlot: idx >= 0 && idx < todaySlots.length - 1 ? todaySlots[idx + 1] : null,
      };
    }

    const prevCandidates = todaySlots.filter((s) => timeToMinutes(s.hora_inicio) < currentMin);
    const prev = prevCandidates.length > 0 ? prevCandidates[prevCandidates.length - 1] : null;

    const nextCandidates = todaySlots.filter((s) => timeToMinutes(s.hora_inicio) > currentMin);
    const next = nextCandidates.length > 0 ? nextCandidates[0] : null;

    return { prevSlot: prev, nextSlot: next };
  }, [todaySlots, currentSlot, consultedTime]);

  const handleAnterior = () => {
    if (prevSlot) {
      isSlotNavigatingRef.current = true;
      setConsultedTime(prevSlot.hora_inicio);
      setIsRealTimeSync(false);
      setConsultationMode('tramo');
      setSelectedTramoKey(findMatchingTramoStart(prevSlot.hora_inicio));
    }
  };

  const handleSiguiente = () => {
    if (nextSlot) {
      isSlotNavigatingRef.current = true;
      setConsultedTime(nextSlot.hora_inicio);
      setIsRealTimeSync(false);
      setConsultationMode('tramo');
      setSelectedTramoKey(findMatchingTramoStart(nextSlot.hora_inicio));
    }
  };

  const handleTramoActual = () => {
    if (consultationAnchor.wasReal) {
      resetToReal();
    } else {
      setConsultedTime(consultationAnchor.time);
      setIsRealTimeSync(false);
      const isStd = TRAMOS_ESTANDAR.some((t) => t.hora_inicio === consultationAnchor.time);
      setConsultationMode(isStd ? 'tramo' : 'hora');
      setSelectedTramoKey(findMatchingTramoStart(consultationAnchor.time));
    }
  };

  // Check if group and location in current slot are identical
  const isGroupLocationEqual = currentSlot
    ? areGroupAndLocationEqual(currentSlot.grupo, currentSlot.ubicación)
    : false;

  return (
    <div id="view-donde-esta" className="w-full space-y-4 sm:space-y-5">
      {/* 1. Header Card (matches reference style: blue identity) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                ¿Dónde está...?
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Localización inmediata del profesorado en el centro.
              </p>
            </div>
          </div>

          <TemporalStatusHeader
            systemTime={systemTime}
            isRealTime={isRealTime}
            consultedDay={consultedDay}
            consultedTimeLabel={consultedTimeLabel}
            onResetToReal={resetToReal}
            accentColor="blue"
          />
        </div>
      </div>

      {/* 2. Panel «Consultar otro momento» (Plegable / Collapsible, colapsado por defecto para ahorrar espacio vertical) */}
      <div
        id="panel-consultar-otro-momento"
        className="bg-[#EFF6FF] border border-blue-200/90 rounded-2xl overflow-hidden shadow-xs transition-all"
      >
        {/* Header / Botón de despliegue */}
        <button
          type="button"
          id="btn-toggle-consultar-otro-momento"
          onClick={() => setIsConsultarMomentoOpen(!isConsultarMomentoOpen)}
          className="w-full flex items-center justify-between p-3 sm:py-3.5 sm:px-4 cursor-pointer hover:bg-blue-100/50 transition text-left"
          aria-expanded={isConsultarMomentoOpen}
          aria-controls="controls-consultar-otro-momento"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              Consultar otro momento
            </h3>
            {!isRealTime && (
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-900 shrink-0">
                {consultedDay} · {consultedTimeLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-blue-700 text-xs font-semibold shrink-0 ml-2">
            <span className="hidden sm:inline text-[11px] text-slate-500">
              {isConsultarMomentoOpen ? 'Ocultar' : 'Cambiar día/hora'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${
                isConsultarMomentoOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* Contenido desplegable con los 3 controles: DÍA, TRAMO, HORA EXACTA */}
        {isConsultarMomentoOpen && (
          <div
            id="controls-consultar-otro-momento"
            className="p-3 sm:p-4 pt-1 sm:pt-2 border-t border-blue-200/60 animate-in fade-in duration-150"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 pt-1">
              {/* DÍA */}
              <div>
                <label
                  htmlFor="select-dia"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  DÍA
                </label>
                <select
                  id="select-dia"
                  value={consultedDay}
                  onChange={(e) => handleSelectDay(e.target.value as DiaSemana)}
                  className="w-full text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 sm:py-2.5 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer transition"
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia} value={dia}>
                      {dia}
                    </option>
                  ))}
                </select>
              </div>

              {/* TRAMO */}
              <div>
                <label
                  htmlFor="select-tramo"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  TRAMO
                </label>
                <select
                  id="select-tramo"
                  value={selectedTramoKey}
                  onChange={(e) => handleSelectTramo(e.target.value)}
                  className="w-full text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 sm:py-2.5 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer transition"
                >
                  {TRAMOS_ESTANDAR.map((tramo) => (
                    <option key={tramo.hora_inicio} value={tramo.hora_inicio}>
                      {tramo.hora_inicio}–{tramo.hora_fin}{tramo.esRecreo ? ' · Recreo' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* HORA EXACTA */}
              <div>
                <label
                  htmlFor="input-hora-exacta"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  HORA EXACTA
                </label>
                <input
                  id="input-hora-exacta"
                  type="time"
                  value={consultedTime}
                  onChange={(e) => handleCustomTime(e.target.value)}
                  className="w-full text-xs sm:text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 sm:py-2.5 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer tracking-wide transition"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Selector de Docente Único (Desplegable y con búsqueda) */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 px-3.5 py-2.5 sm:px-5 sm:py-3">
        <label
          htmlFor="btn-selector-docente"
          className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1"
        >
          DOCENTE
        </label>
        <div ref={teacherDropdownRef} className="relative w-full sm:w-[480px] max-w-full">
          <button
            id="btn-selector-docente"
            type="button"
            onClick={() => {
              setIsTeacherDropdownOpen((prev) => !prev);
              setTeacherSearchQuery('');
            }}
            className="w-full flex items-center justify-between gap-3 px-3.5 py-2 sm:py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-left text-sm font-semibold text-slate-900 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none transition cursor-pointer"
            aria-expanded={isTeacherDropdownOpen}
            aria-haspopup="listbox"
          >
            <span className="truncate">
              {selectedDocente ? (
                <>
                  <span className="font-bold text-slate-900">{selectedDocente.nombre_docente}</span>
                  {selectedDocente.especialidad && (
                    <span className="text-slate-500 font-normal"> · {selectedDocente.especialidad}</span>
                  )}
                </>
              ) : (
                <span className="text-slate-400">Seleccionar docente...</span>
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                isTeacherDropdownOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {isTeacherDropdownOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden animate-in fade-in"
              role="listbox"
            >
              {/* Buscador dentro del desplegable */}
              <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o especialidad..."
                    className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-[16px] sm:text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {teacherSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTeacherSearchQuery('')}
                      className="absolute right-2 top-1.5 text-[10px] text-slate-400 hover:text-slate-600 bg-slate-100 px-1 py-0.5 rounded cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Lista con todos los docentes */}
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredDocentes.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    No se encontraron docentes con «{teacherSearchQuery}».
                  </div>
                ) : (
                  filteredDocentes.map((doc, idx) => {
                    const isSelected = doc.docente_id === selectedDocenteId;
                    return (
                      <button
                        key={doc.docente_id || `doc-${doc.nombre_docente}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedDocenteId(doc.docente_id);
                          setIsTeacherDropdownOpen(false);
                          setTeacherSearchQuery('');
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="truncate">
                          <span className={isSelected ? 'font-bold text-blue-950' : 'font-medium text-slate-800'}>
                            {doc.nombre_docente}
                          </span>
                          {doc.especialidad && (
                            <span className="text-slate-500 font-normal"> · {doc.especialidad}</span>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Result Card */}
      {selectedDocente ? (
        <div className="space-y-4">
          <div
            id="result-docente-card"
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            {/* Teacher header banner */}
            <div className="bg-[#0A1128] text-white px-3.5 sm:px-6 py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
                      <h2 className="text-base sm:text-xl font-bold tracking-tight uppercase truncate">
                        {selectedDocente.nombre_docente}
                      </h2>
                    </div>
                    {selectedDocente.especialidad && (
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5 truncate">
                        {selectedDocente.especialidad}
                      </p>
                    )}
                  </div>

                  {/* Badge on mobile top right */}
                  <div className="sm:hidden shrink-0">
                    {currentSlot ? (
                      <ActivityBadge tipo={currentSlot.tipo} size="sm" />
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {isOutsideSchoolHours ? 'Fuera de horario' : 'Sin tramo'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3.5 pt-2 sm:pt-0 border-t border-slate-800/80 sm:border-t-0 shrink-0">
                  {/* Temporal Navigation: Anterior · Tramo actual · Siguiente */}
                  <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-1 sm:gap-2 text-xs shrink-0">
                    <button
                      id="btn-nav-tramo-anterior"
                      onClick={handleAnterior}
                      disabled={!prevSlot}
                      title={
                        prevSlot
                          ? `Ir a tramo anterior (${prevSlot.hora_inicio}–${prevSlot.hora_fin})`
                          : 'No hay tramo anterior hoy'
                      }
                      className={`inline-flex items-center gap-0.5 sm:gap-1 text-slate-300 hover:text-white font-medium transition py-1 px-1.5 rounded-md whitespace-nowrap shrink-0 ${
                        prevSlot
                          ? 'cursor-pointer hover:bg-white/10'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span>Anterior</span>
                    </button>

                    <button
                      id="btn-nav-tramo-actual"
                      onClick={handleTramoActual}
                      title={
                        isRealTime
                          ? 'Volver al tramo actual real'
                          : `Volver al tramo consultado (${consultationAnchor.time})`
                      }
                      className="inline-flex items-center gap-0.5 sm:gap-1 text-blue-400 hover:text-blue-300 font-semibold transition cursor-pointer py-1 px-1.5 rounded-md hover:bg-white/10 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{isRealTime ? 'Tramo actual' : 'Tramo consultado'}</span>
                    </button>

                    <button
                      id="btn-nav-tramo-siguiente"
                      onClick={handleSiguiente}
                      disabled={!nextSlot}
                      title={
                        nextSlot
                          ? `Ir a siguiente tramo (${nextSlot.hora_inicio}–${nextSlot.hora_fin})`
                          : 'No hay tramo siguiente hoy'
                      }
                      className={`inline-flex items-center gap-0.5 sm:gap-1 text-slate-300 hover:text-white font-medium transition py-1 px-1.5 rounded-md whitespace-nowrap shrink-0 ${
                        nextSlot
                          ? 'cursor-pointer hover:bg-white/10'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    </button>
                  </div>

                  {/* Badge on desktop */}
                  <div className="hidden sm:block shrink-0">
                    {currentSlot ? (
                      <ActivityBadge tipo={currentSlot.tipo} size="md" />
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {isOutsideSchoolHours ? 'Fuera de horario' : 'Sin tramo activo'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-3 sm:p-5">
              {currentSlot ? (
                <div
                  className={`grid grid-cols-1 ${
                    isGroupLocationEqual || !isValidDisplayGroup(currentSlot.grupo)
                      ? 'sm:grid-cols-3'
                      : 'sm:grid-cols-2 lg:grid-cols-4'
                  } gap-2.5 sm:gap-4`}
                >
                  {/* Ubicación */}
                  <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center gap-2.5 sm:gap-3.5">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      {isUbicacionSpecified(currentSlot.ubicación) ? (
                        <>
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 tracking-wider block">
                            UBICACIÓN
                          </span>
                          <p id="slot-ubicacion" className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 leading-snug">
                            {formatUbicacion(currentSlot.ubicación)}
                          </p>
                        </>
                      ) : (
                        <p id="slot-ubicacion" className="text-xs sm:text-sm italic text-slate-400 font-normal mt-0.5">
                          Ubicación no especificada
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actividad */}
                  <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center gap-2.5 sm:gap-3.5">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 tracking-wider block">
                        ACTIVIDAD
                      </span>
                      <p id="slot-actividad" className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 leading-snug">
                        {currentSlot.actividad}
                      </p>
                      {getDisplayObservation(currentSlot.observaciones) && (
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                          Obs: {getDisplayObservation(currentSlot.observaciones)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Grupo (ONLY shown if different from ubicación and valid group) */}
                  {!isGroupLocationEqual && isValidDisplayGroup(currentSlot.grupo) && (
                    <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center gap-2.5 sm:gap-3.5">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 tracking-wider block">
                          GRUPO
                        </span>
                        <p id="slot-grupo" className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 leading-snug">
                          {currentSlot.grupo}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Horario del tramo */}
                  <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center gap-2.5 sm:gap-3.5">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 tracking-wider block">
                        HORARIO DEL TRAMO
                      </span>
                      <p id="slot-horario" className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5 leading-snug whitespace-nowrap">
                        {currentSlot.hora_inicio} – {currentSlot.hora_fin}
                      </p>
                      <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">
                        {consultedDay} ({currentSlot.curso_escolar || '2026/2027'})
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* No active slot at this moment - Compact display */
                <div
                  id="slot-no-activity"
                  className="py-3.5 px-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-600"
                >
                  <div className="flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">
                      {isOutsideSchoolHours ? 'Fuera del horario lectivo' : 'Sin actividad registrada en este tramo'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isOutsideSchoolHours
                      ? isBeforeSchool
                        ? `La jornada registrada comienza a las ${centerRange.start}.`
                        : `La jornada registrada finaliza a las ${centerRange.end}.`
                      : `No consta docencia, coordinación ni vigilancia asignada para ${selectedDocente.nombre_docente} el ${consultedDay} a las ${consultedTime}.`}
                  </p>
                </div>
              )}

              {/* Bottom Action: Ver horario completo */}
              {onSelectDocenteForSchedule && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    id="btn-ver-horario-completo"
                    onClick={() => onSelectDocenteForSchedule(selectedDocente.docente_id)}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    <span>Ver horario completo de la semana</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick agenda for consultedDay */}
          {todaySlots.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-2.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Horario de {selectedDocente.nombre_docente} para {realSchoolDay !== null && consultedDay === realSchoolDay ? `hoy (${consultedDay})` : `el ${consultedDay}`}
                </h3>
              </div>

              <div className="divide-y divide-slate-100">
                {todaySlots.map((slot, sIdx) => {
                  const isSlotActuallyActive =
                    isRealTime &&
                    realSchoolDay !== null &&
                    consultedDay === realSchoolDay &&
                    isTimeInSlot(realTime, slot.hora_inicio, slot.hora_fin);

                  const isSlotConsulted =
                    !isRealTime &&
                    currentSlot?.hora_inicio === slot.hora_inicio &&
                    currentSlot?.hora_fin === slot.hora_fin;

                  const isSlotGroupLocationEqual = areGroupAndLocationEqual(
                    slot.grupo,
                    slot.ubicación
                  );

                  return (
                    <div
                      key={slot.id || `slot-${slot.docente_id || ''}-${slot.día || ''}-${slot.hora_inicio}-${slot.hora_fin}-${slot.actividad || ''}-${sIdx}`}
                      className={`py-2 px-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 transition ${
                        isSlotActuallyActive
                          ? 'bg-blue-50 border border-blue-200 shadow-xs'
                          : isSlotConsulted
                          ? 'bg-cyan-50/70 border border-cyan-300 shadow-2xs'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-slate-700 w-22 sm:w-24 shrink-0">
                          {slot.hora_inicio}–{slot.hora_fin}
                        </span>
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
                            {slot.actividad}
                          </span>
                          <span className="text-xs text-slate-500 inline-flex items-center gap-1 flex-wrap">
                            {!isSlotGroupLocationEqual && isValidDisplayGroup(slot.grupo) && (
                              <span>Grupo: <strong>{slot.grupo}</strong> ·</span>
                            )}
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>
                                {isUbicacionSpecified(slot.ubicación) ? (
                                  formatUbicacion(slot.ubicación)
                                ) : (
                                  <span className="italic text-slate-400">Ubicación no especificada</span>
                                )}
                              </span>
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSlotActuallyActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                            Actual
                          </span>
                        )}
                        {!isSlotActuallyActive && isSlotConsulted && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-700 text-white shadow-2xs">
                            Consultado
                          </span>
                        )}
                        <ActivityBadge tipo={slot.tipo} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500 text-sm">No hay docentes registrados en la aplicación.</p>
        </div>
      )}
    </div>
  );
};

