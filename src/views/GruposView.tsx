import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DiaSemana, DIAS_SEMANA, HorarioTramo } from '../types';
import {
  VALID_ACADEMIC_GROUPS,
  normalizeAcademicGroup,
  isSameAcademicGroup,
  formatUbicacion,
  isTimeInSlot,
  normalizeDia,
  timeToMinutes,
  getCenterDayRange,
  getDisplayObservation,
  isValidDisplayGroup,
  formatDisplayGroup,
  isUbicacionSpecified,
  getSystemTimeInfo,
  getCleanVisualCellMetadata,
} from '../utils/timeUtils';
import { ActivityBadge } from '../components/ActivityBadge';
import { TemporalStatusHeader } from '../components/TemporalStatusHeader';
import {
  Building2,
  Users,
  Clock,
  MapPin,
  BookOpen,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface GruposViewProps {
  onSelectDocente?: (docenteId: string) => void;
}

export const GruposView: React.FC<GruposViewProps> = () => {
  const { horarios, ubicaciones } = useApp();

  // A) FECHA Y HORA REALES (Device clock)
  const [systemTime, setSystemTime] = useState(() => getSystemTimeInfo());
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(getSystemTimeInfo());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const realSchoolDay = systemTime.realSchoolDay; // strictly null on weekend
  const realTime = systemTime.realTimeStr;
  const isWeekend = systemTime.isWeekend;

  // B) MOMENTO CONSULTADO (Selected by user)
  const [selectedDay, setSelectedDay] = useState<DiaSemana>(() => {
    const initial = getSystemTimeInfo();
    return initial.realSchoolDay || initial.defaultConsultationDay;
  });
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    return getSystemTimeInfo().realTimeStr;
  });

  // Real-time synchronization active only when today is a school day and user hasn't overridden
  const [isRealTimeSync, setIsRealTimeSync] = useState<boolean>(() => {
    return !getSystemTimeInfo().isWeekend;
  });

  // Automatically update consulted moment when in real-time sync during school days
  useEffect(() => {
    if (!isRealTimeSync || isWeekend || !realSchoolDay) return;
    setSelectedDay(realSchoolDay);
    setSelectedTime(realTime);
  }, [isRealTimeSync, isWeekend, realSchoolDay, realTime]);

  const isRealTime =
    !isWeekend &&
    realSchoolDay !== null &&
    selectedDay === realSchoolDay &&
    (isRealTimeSync || selectedTime === realTime);

  const resetToReal = () => {
    const current = getSystemTimeInfo();
    setSystemTime(current);
    if (!current.isWeekend && current.realSchoolDay) {
      setSelectedDay(current.realSchoolDay);
      setSelectedTime(current.realTimeStr);
      setIsRealTimeSync(true);
    } else {
      setSelectedDay(current.defaultConsultationDay);
      setSelectedTime(current.realTimeStr);
      setIsRealTimeSync(false);
    }
  };

  // Dynamically compile available academic groups exclusively from real imported schedules
  const allGrupos = useMemo(() => {
    const present = new Set<string>();

    (horarios || []).forEach((h) => {
      const rawG = (h?.grupo || '').trim();
      if (!rawG || rawG.toLowerCase() === 'sin grupo' || rawG.toLowerCase() === 'no especificada') return;
      const norm = normalizeAcademicGroup(rawG);
      if (norm) {
        present.add(norm);
      } else {
        present.add(rawG);
      }
    });

    // Strictly order according to canonical academic hierarchy, followed by any additional center groups
    const result: string[] = [];
    VALID_ACADEMIC_GROUPS.forEach((g) => {
      if (present.has(g)) {
        result.push(g);
        present.delete(g);
      }
    });
    const extra = Array.from(present).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    return [...result, ...extra];
  }, [horarios]);

  // Dynamically compile non-group spaces and locations from ubicaciones and schedules
  const allEspacios = useMemo(() => {
    const set = new Set<string>();

    (ubicaciones || []).forEach((u) => {
      const name = (u?.nombre || u?.codigo || '').trim();
      if (name && isUbicacionSpecified(name)) {
        if (!normalizeAcademicGroup(name)) {
          set.add(name);
        }
      }
    });

    (horarios || []).forEach((h) => {
      const u = (h?.ubicación || '').trim();
      if (u && isUbicacionSpecified(u)) {
        if (!normalizeAcademicGroup(u)) {
          set.add(u);
        }
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [ubicaciones, horarios]);

  const [selectedTarget, setSelectedTarget] = useState<string>(() => {
    if (allGrupos && allGrupos.length > 0) {
      return allGrupos.includes('4º') ? 'grupo:4º' : `grupo:${allGrupos[0]}`;
    }
    return 'grupo:4º';
  });

  const isEspacio = selectedTarget.startsWith('espacio:');
  const selectedName = isEspacio
    ? selectedTarget.replace('espacio:', '')
    : selectedTarget.replace('grupo:', '');

  // Collapsible state for group schedule table
  const [isScheduleExpanded, setIsScheduleExpanded] = useState<boolean>(false);

  // Keep selected target synchronized
  useEffect(() => {
    if (selectedTarget.startsWith('grupo:')) {
      const grp = selectedTarget.replace('grupo:', '');
      if (allGrupos.length > 0 && !allGrupos.includes(grp)) {
        const norm = normalizeAcademicGroup(grp);
        if (norm && allGrupos.includes(norm)) {
          setSelectedTarget(`grupo:${norm}`);
        } else {
          setSelectedTarget(`grupo:${allGrupos[0]}`);
        }
      }
    }
  }, [allGrupos, selectedTarget]);

  // Query teachers in this group or space at selectedDay & selectedTime
  const activeTeachers = useMemo(() => {
    const targetMin = timeToMinutes(selectedTime);
    const cleanSelected = (selectedName || '').trim().toLowerCase();

    return horarios.filter((h) => {
      if (!h || normalizeDia(h.día) !== selectedDay) return false;

      if (isEspacio) {
        if (!h.ubicación || !isUbicacionSpecified(h.ubicación)) return false;
        if (!cleanSelected) return false;
        if (h.ubicación.trim().toLowerCase() !== cleanSelected) return false;
      } else {
        if (!h.grupo || !selectedName || !isSameAcademicGroup(h.grupo, selectedName)) return false;
      }

      const start = timeToMinutes(h.hora_inicio);
      const end = timeToMinutes(h.hora_fin);

      return targetMin >= start && targetMin < end;
    });
  }, [horarios, isEspacio, selectedName, selectedDay, selectedTime]);

  // Full day schedule for this target on selectedDay
  const targetDaySchedule = useMemo(() => {
    const cleanSelected = (selectedName || '').trim().toLowerCase();

    return horarios
      .filter((h) => {
        if (!h || normalizeDia(h.día) !== selectedDay) return false;
        if (isEspacio) {
          return (
            isUbicacionSpecified(h.ubicación) &&
            Boolean(h.ubicación && cleanSelected && h.ubicación.trim().toLowerCase() === cleanSelected)
          );
        }
        return Boolean(h.grupo && selectedName && isSameAcademicGroup(h.grupo, selectedName));
      })
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));
  }, [horarios, isEspacio, selectedName, selectedDay]);

  // Center schedule boundaries for selectedDay
  const centerRange = useMemo(() => getCenterDayRange(horarios, selectedDay), [horarios, selectedDay]);
  const activeMin = timeToMinutes(selectedTime);
  const isBeforeSchool = activeMin < timeToMinutes(centerRange.start);
  const isAfterSchool = activeMin >= timeToMinutes(centerRange.end);
  const isOutsideSchoolHours = isBeforeSchool || isAfterSchool;

  return (
    <div id="view-grupos" className="w-full space-y-4 sm:space-y-6">
      {/* 1. Header Card (matches reference style: turquoise/cyan identity with Building2) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
                ¿Quién está en…?
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Consulta qué docente o docentes están asignados a un grupo, aula o espacio.
              </p>
            </div>
          </div>

          <TemporalStatusHeader
            systemTime={systemTime}
            isRealTime={isRealTime}
            consultedDay={selectedDay}
            consultedTimeLabel={selectedTime}
            onResetToReal={resetToReal}
            accentColor="cyan"
          />
        </div>
      </div>

      {/* 2. Selectors Panel: Exactly 3 controls (Grupo o espacio, Día, Hora) */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-3.5 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-end">
          {/* Control 1: GRUPO O ESPACIO */}
          <div className="w-full">
            <label
              htmlFor="select-grupo-target"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Grupo o espacio
            </label>
            <div className="relative w-full">
              <select
                id="select-grupo-target"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 shadow-2xs focus:ring-2 focus:ring-cyan-500 focus:outline-none cursor-pointer transition appearance-none"
              >
                <optgroup label="Grupos / Aulas">
                  {allGrupos.map((grp) => (
                    <option key={`opt-grupo-${grp}`} value={`grupo:${grp}`}>
                      {grp}
                    </option>
                  ))}
                </optgroup>
                {allEspacios.length > 0 && (
                  <optgroup label="Espacios y Otras Ubicaciones">
                    {allEspacios.map((esp) => (
                      <option key={`opt-espacio-${esp}`} value={`espacio:${esp}`}>
                        {esp}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Control 2: DÍA (Dropdown) */}
          <div className="w-full">
            <label
              htmlFor="select-grupo-dia"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Día
            </label>
            <div className="relative w-full">
              <select
                id="select-grupo-dia"
                value={selectedDay}
                onChange={(e) => {
                  setSelectedDay(e.target.value as DiaSemana);
                  setIsRealTimeSync(false);
                }}
                className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 shadow-2xs focus:ring-2 focus:ring-cyan-500 focus:outline-none cursor-pointer transition appearance-none"
              >
                {DIAS_SEMANA.map((dia) => (
                  <option key={`dia-opt-${dia}`} value={dia}>
                    {dia}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Control 3: HORA */}
          <div className="w-full">
            <label
              htmlFor="input-grupo-hora"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Hora
            </label>
            <div className="relative w-full">
              <input
                id="input-grupo-hora"
                type="time"
                value={selectedTime}
                onChange={(e) => {
                  setSelectedTime(e.target.value);
                  setIsRealTimeSync(false);
                }}
                className="w-full text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2 shadow-2xs focus:ring-2 focus:ring-cyan-500 focus:outline-none transition cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Results for Selected Target at selectedDay & selectedTime */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-6">
          {/* Header: Title without temporal duplication + Teacher Count */}
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Situación en <span className="text-cyan-600">{selectedName}</span>
            </h2>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {activeTeachers.length === 1
                  ? '1 docente asignado'
                  : `${activeTeachers.length} docentes asignados`}
              </span>
            </span>
          </div>

          {activeTeachers.length === 0 ? (
            <div className="py-8 sm:py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 mx-auto mb-2" />
              {isOutsideSchoolHours ? (
                <>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    Fuera del horario lectivo
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    {isBeforeSchool
                      ? `La jornada registrada comienza a las ${centerRange.start}.`
                      : `La jornada registrada finaliza a las ${centerRange.end}.`}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    Sin docencia o actividad asignada en este momento
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 px-4">
                    No hay ningún docente registrado en {isEspacio ? 'el espacio' : 'el grupo'} «{selectedName}» el {selectedDay} a las{' '}
                    {selectedTime}.
                  </p>
                </>
              )}
            </div>
          ) : (
            /* Compact Teacher Cards supporting multiple simultaneous teachers */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {activeTeachers.map((slot, idx) => {
                const displayObs = getDisplayObservation(slot.observaciones);
                const { displayActivity } = getCleanVisualCellMetadata(
                  slot.actividad,
                  slot.grupo,
                  slot.ubicación
                );

                // Location formatting
                const hasUbic = isUbicacionSpecified(slot.ubicación);
                const formattedUbic = hasUbic ? formatUbicacion(slot.ubicación) : null;

                // Location display: show physical location if querying a group and specified
                const ubicToShow = !isEspacio && hasUbic ? formattedUbic : null;

                // Group display: show group when querying an espacio, or if different from selected group
                const hasValidGroup = isValidDisplayGroup(slot.grupo);
                const groupToShow =
                  hasValidGroup && (isEspacio || !isSameAcademicGroup(slot.grupo, selectedName))
                    ? formatDisplayGroup(slot.grupo)
                    : null;

                return (
                  <div
                    key={slot.id || `active-${slot.docente_id || ''}-${slot.hora_inicio}-${idx}`}
                    className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white shadow-xs hover:border-cyan-400 transition flex flex-col justify-between gap-2.5"
                  >
                    {/* Row 1: Teacher Name + Activity Type Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight leading-snug">
                        {slot.nombre_docente}
                      </h3>
                      <div className="shrink-0">
                        <ActivityBadge tipo={slot.tipo} size="sm" />
                      </div>
                    </div>

                    {/* Row 2: Horario · Materia/Actividad */}
                    <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-slate-700">
                      <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {slot.hora_inicio}–{slot.hora_fin}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-semibold text-slate-900 uppercase tracking-tight">
                        {displayActivity}
                      </span>
                    </div>

                    {/* Row 3: Ubicación y/o Grupo secundario (visual deduplication applied) */}
                    {(ubicToShow || groupToShow || displayObs) && (
                      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 pt-2 border-t border-slate-100">
                        {ubicToShow && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{ubicToShow}</span>
                          </span>
                        )}
                        {groupToShow && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>
                              Grupo: <strong className="text-slate-900">{groupToShow}</strong>
                            </span>
                          </span>
                        )}
                        {displayObs && (
                          <span className="text-slate-500 italic text-[11.5px]">
                            ({displayObs})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Collapsible Schedule Block for this Target */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <button
            id="btn-toggle-horario-grupo"
            type="button"
            onClick={() => setIsScheduleExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-bold text-slate-800 hover:text-cyan-700 hover:bg-slate-50/80 transition cursor-pointer"
            aria-expanded={isScheduleExpanded}
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div
                className={`p-1.5 rounded-lg transition ${
                  isScheduleExpanded
                    ? 'bg-cyan-100 text-cyan-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-sm sm:text-base font-bold text-slate-900">
                {isScheduleExpanded
                  ? isEspacio
                    ? `Horario en ${selectedName} · ${selectedDay}`
                    : `Horario de ${selectedName} · ${selectedDay}`
                  : `Ver horario de ${selectedName} para el ${(selectedDay || '').toLowerCase()}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="hidden sm:inline">
                {isScheduleExpanded ? 'Plegar' : 'Desplegar'}
              </span>
              {isScheduleExpanded ? (
                <ChevronDown className="w-4 h-4 text-cyan-600 transition-transform" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 transition-transform" />
              )}
            </div>
          </button>

          {isScheduleExpanded && (
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/30 animate-in fade-in duration-150">
              {targetDaySchedule.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No hay tramos registrados para {isEspacio ? 'este espacio' : 'este grupo'} el {selectedDay}.
                </p>
              ) : (
                <>
                  {/* MOBILE CARDS VIEW (< md) */}
                  <div className="md:hidden space-y-2.5">
                    {targetDaySchedule.map((slot, idx) => {
                      const isSlotActuallyActive =
                        isRealTime &&
                        isTimeInSlot(realTime, slot.hora_inicio, slot.hora_fin);

                      const isSlotConsulted =
                        !isRealTime &&
                        isTimeInSlot(selectedTime, slot.hora_inicio, slot.hora_fin);

                      const validGroup = formatDisplayGroup(slot.grupo);
                      const hasUbic = isUbicacionSpecified(slot.ubicación);

                      return (
                        <div
                          key={slot.id || `m-target-${idx}`}
                          className={`p-3 rounded-xl border transition text-xs ${
                            isSlotActuallyActive
                              ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-400/40 shadow-xs'
                              : isSlotConsulted
                              ? 'bg-cyan-50/90 border-cyan-300 ring-1 ring-cyan-400/40 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-800">
                                {slot.hora_inicio}–{slot.hora_fin}
                              </span>
                              {isSlotActuallyActive && (
                                <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-2xs">
                                  ACTUAL
                                </span>
                              )}
                              {isSlotConsulted && (
                                <span className="text-[9px] bg-cyan-700 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-2xs">
                                  CONSULTADO
                                </span>
                              )}
                            </div>
                            <ActivityBadge tipo={slot.tipo} size="sm" />
                          </div>

                          <div className="space-y-1">
                            <div className="font-bold text-sm text-slate-900">{slot.nombre_docente}</div>
                            <div className="text-slate-700 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium">{slot.actividad}</span>
                            </div>
                            <div className="text-slate-600 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {isEspacio ? (
                                  validGroup ? (
                                    <>
                                      Grupo: <strong className="text-slate-800">{validGroup}</strong>
                                    </>
                                  ) : (
                                    '—'
                                  )
                                ) : hasUbic ? (
                                  formatUbicacion(slot.ubicación)
                                ) : (
                                  <span className="italic text-slate-400">Ubicación no especificada</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP TABLE VIEW (>= md) with internal scroll containment */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700">
                          <th className="p-3 font-bold">Horario</th>
                          <th className="p-3 font-bold">Docente</th>
                          <th className="p-3 font-bold">Materia / Actividad</th>
                          <th className="p-3 font-bold">
                            {isEspacio ? 'Grupo' : 'Ubicación'}
                          </th>
                          <th className="p-3 font-bold text-center">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {targetDaySchedule.map((slot, idx) => {
                          const isSlotActuallyActive =
                            isRealTime &&
                            isTimeInSlot(realTime, slot.hora_inicio, slot.hora_fin);

                          const isSlotConsulted =
                            !isRealTime &&
                            isTimeInSlot(selectedTime, slot.hora_inicio, slot.hora_fin);

                          const validGroup = formatDisplayGroup(slot.grupo);
                          const hasUbic = isUbicacionSpecified(slot.ubicación);

                          return (
                            <tr
                              key={slot.id || `schedule-row-${slot.docente_id || ''}-${slot.hora_inicio}-${idx}`}
                              className={
                                isSlotActuallyActive
                                  ? 'bg-blue-50/90 font-medium'
                                  : isSlotConsulted
                                  ? 'bg-cyan-50/80 font-medium'
                                  : 'hover:bg-slate-50/80'
                              }
                            >
                              <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                                {slot.hora_inicio}–{slot.hora_fin}
                                {isSlotActuallyActive && (
                                  <span className="ml-2 text-[9.5px] bg-blue-600 text-white font-sans font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shadow-2xs">
                                    ACTUAL
                                  </span>
                                )}
                                {isSlotConsulted && (
                                  <span className="ml-2 text-[9.5px] bg-cyan-700 text-white font-sans font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shadow-2xs">
                                    CONSULTADO
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-semibold text-slate-900">
                                {slot.nombre_docente}
                              </td>
                              <td className="p-3 text-slate-800 font-medium">{slot.actividad}</td>
                              <td className="p-3 text-slate-600">
                                {isEspacio ? (
                                  validGroup ? (
                                    <strong className="font-semibold text-slate-900">{validGroup}</strong>
                                  ) : (
                                    '—'
                                  )
                                ) : hasUbic ? (
                                  formatUbicacion(slot.ubicación)
                                ) : (
                                  <span className="italic text-slate-400">Ubicación no especificada</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <ActivityBadge tipo={slot.tipo} size="sm" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
