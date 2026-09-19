import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { DiaSemana, DIAS_SEMANA, HorarioTramo } from '../types';
import {
  formatUbicacion,
  isTimeInSlot,
  normalizeDia,
  timeToMinutes,
  getDisplayObservation,
  getSystemTimeInfo,
  getCleanVisualCellMetadata,
  areTeacherNamesEquivalent,
  isSlotForTeacher,
} from '../utils/timeUtils';
import { ActivityBadge } from '../components/ActivityBadge';
import { HorarioSemanalGrid } from '../components/HorarioSemanalGrid';
import { getActivityCategoryStyles } from '../utils/activityStyles';
import {
  Search,
  Calendar,
  ChevronDown,
  Clock,
  MapPin,
  Users,
} from 'lucide-react';

interface DocentesViewProps {
  initialDocenteId?: string;
  initialViewMode?: 'dia' | 'semana';
  onLocateDocenteNow?: (docenteId: string) => void;
}

export const DocentesView: React.FC<DocentesViewProps> = ({
  initialDocenteId,
  initialViewMode = 'semana',
}) => {
  const { docentes, horarios } = useApp();

  // Real device temporal state
  const [systemTime, setSystemTime] = useState(() => getSystemTimeInfo());
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(getSystemTimeInfo());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const realSchoolDay = systemTime.realSchoolDay; // strictly null on weekends
  const realTime = systemTime.realTimeStr;

  // Selected teacher
  const [selectedDocenteId, setSelectedDocenteId] = useState<string>(() => {
    if (initialDocenteId && (docentes || []).some((d) => d?.docente_id === initialDocenteId)) {
      return initialDocenteId;
    }
    return (docentes && docentes.length > 0) ? docentes[0].docente_id : '';
  });

  // Automatically keep selectedDocenteId in sync when docentes list updates
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

  // Consulted day state: defaults to real school day, or fallback default (Lunes) on weekends
  const [selectedDay, setSelectedDay] = useState<DiaSemana>(() => {
    return systemTime.realSchoolDay || systemTime.defaultConsultationDay;
  });
  const [viewMode, setViewMode] = useState<'dia' | 'semana'>(initialViewMode);

  // Dropdown state for teacher selector
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const teacherDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTeacherDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialDocenteId && docentes.some((d) => d.docente_id === initialDocenteId)) {
      setSelectedDocenteId(initialDocenteId);
    }
  }, [initialDocenteId, docentes]);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Alphabetically sorted teachers
  const sortedDocentes = useMemo(() => {
    return [...(docentes || [])].sort((a, b) =>
      (a?.nombre_docente || '').localeCompare(b?.nombre_docente || '', 'es', { sensitivity: 'base' })
    );
  }, [docentes]);

  // Filtered teachers for dropdown search
  const filteredDropdownDocentes = useMemo(() => {
    const q = (teacherSearchQuery || '').trim().toLowerCase();
    if (!q) return sortedDocentes;
    return sortedDocentes.filter(
      (d) =>
        (d?.nombre_docente && d.nombre_docente.toLowerCase().includes(q)) ||
        (d?.docente_id && d.docente_id.toLowerCase().includes(q)) ||
        (d?.especialidad && d.especialidad.toLowerCase().includes(q)) ||
        (d?.observaciones && d.observaciones.toLowerCase().includes(q))
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

  // All schedules for selected teacher
  const teacherAllSlots = useMemo(() => {
    if (!selectedDocenteId && !selectedDocente) return [];
    return (horarios || []).filter((h) => {
      if (!h) return false;
      return (
        (selectedDocente && isSlotForTeacher(h, selectedDocente)) ||
        isSlotForTeacher(h, selectedDocenteId)
      );
    });
  }, [horarios, selectedDocenteId, selectedDocente]);

  // Slots for the selected day, ordered chronologically
  const daySlots = useMemo(() => {
    return (teacherAllSlots || [])
      .filter((h) => normalizeDia(h.día) === selectedDay)
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));
  }, [teacherAllSlots, selectedDay]);

  return (
    <div id="view-docentes" className="w-full space-y-4 sm:space-y-6">
      {/* 1. Header Card (focused exclusively on consulting schedules) */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              Horario de docente
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Consulta el horario semanal o diario del profesorado.
            </p>
          </div>
        </div>

        {/* 2. Controls Bar: Docente Dropdown & Vista Switcher */}
        <div className="mt-3.5 pt-3.5 sm:mt-5 sm:pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
          {/* Docente Selector Dropdown with Integrated Search */}
          <div className="w-full md:flex-1 md:max-w-xl">
            <label
              htmlFor="btn-selector-docente-horarios"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Docente
            </label>
            <div ref={teacherDropdownRef} className="relative w-full">
              <button
                id="btn-selector-docente-horarios"
                type="button"
                onClick={() => {
                  setIsTeacherDropdownOpen((prev) => !prev);
                  setTeacherSearchQuery('');
                }}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-left text-sm font-semibold text-slate-900 shadow-2xs focus:ring-2 focus:ring-violet-500 focus:outline-none transition cursor-pointer"
                aria-expanded={isTeacherDropdownOpen}
                aria-haspopup="listbox"
              >
                <span className="truncate">
                  {selectedDocente ? (
                    <>
                      <span className="font-bold text-slate-900 uppercase">
                        {selectedDocente.nombre_docente}
                      </span>
                      {selectedDocente.especialidad && (
                        <span className="text-slate-500 font-normal">
                          {' '}· {selectedDocente.especialidad}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">Seleccionar docente...</span>
                  )}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                    isTeacherDropdownOpen ? 'rotate-180 text-violet-600' : ''
                  }`}
                />
              </button>

              {isTeacherDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden animate-in fade-in"
                  role="listbox"
                >
                  {/* Search inside dropdown */}
                  <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={teacherSearchQuery}
                        onChange={(e) => setTeacherSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, especialidad o tutoría..."
                        className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-[16px] sm:text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
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

                  {/* List of teachers */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {filteredDropdownDocentes.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        No se encontraron docentes con «{teacherSearchQuery}».
                      </div>
                    ) : (
                      filteredDropdownDocentes.map((doc, idx) => {
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
                            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs transition cursor-pointer ${
                              isSelected
                                ? 'bg-violet-50 text-violet-900 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate uppercase">
                                {doc.nombre_docente}
                              </span>
                              {doc.especialidad && (
                                <span className="text-[11px] text-slate-500 block truncate">
                                  {doc.especialidad}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <span className="text-[10px] uppercase font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">
                                Seleccionado
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vista Switcher: Semanal / Diaria */}
          <div className="w-full md:w-auto md:min-w-[200px]">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Vista
            </span>
            <div className="inline-flex w-full bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                id="btn-vista-semanal"
                type="button"
                onClick={() => setViewMode('semana')}
                className={`flex-1 py-2 rounded-lg font-bold transition text-center cursor-pointer ${
                  viewMode === 'semana'
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semanal
              </button>
              <button
                id="btn-vista-diaria"
                type="button"
                onClick={() => setViewMode('dia')}
                className={`flex-1 py-2 rounded-lg font-bold transition text-center cursor-pointer ${
                  viewMode === 'dia'
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diaria
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {selectedDocente ? (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden p-3.5 sm:p-6">
          {/* Header clearly identifying the teacher over the schedule */}
          <div className="mb-4 pb-3 border-b border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 uppercase tracking-tight">
              {selectedDocente.nombre_docente}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
              {selectedDocente.especialidad ? `${selectedDocente.especialidad} · ` : ''}
              {viewMode === 'semana' ? 'Horario semanal completo' : `Horario diario (${selectedDay})`}
            </p>
          </div>

          {viewMode === 'semana' ? (
            /* Weekly View: Grid */
            <div>
              <HorarioSemanalGrid
                slots={teacherAllSlots}
                realSchoolDay={realSchoolDay}
                realTime={realTime}
              />
            </div>
          ) : (
            /* Daily View: List with Day Dropdown */
            <div>
              {/* Daily View: Day Dropdown Selector */}
              <div className="mb-5 max-w-xs">
                <label
                  htmlFor="select-dia-diaria"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Día
                </label>
                <div className="relative">
                  <select
                    id="select-dia-diaria"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value as DiaSemana)}
                    className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 shadow-2xs focus:ring-2 focus:ring-violet-500 focus:outline-none cursor-pointer transition appearance-none"
                  >
                    {DIAS_SEMANA.map((dia) => {
                      const isToday = realSchoolDay !== null && dia === realSchoolDay;
                      return (
                        <option key={dia} value={dia}>
                          {dia}{isToday ? ' · Hoy' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {daySlots.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-500 font-medium text-sm">
                    No hay tramos registrados para el {selectedDay}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {daySlots.map((slot, idx) => {
                    const isCurrentSlot =
                      realSchoolDay !== null &&
                      selectedDay === realSchoolDay &&
                      isTimeInSlot(realTime, slot.hora_inicio, slot.hora_fin);

                    // Visual deduplication of group / location vs activity
                    const { displayActivity, secondaryMeta } = getCleanVisualCellMetadata(
                      slot.actividad,
                      slot.grupo,
                      slot.ubicación
                    );
                    const displayObs = getDisplayObservation(slot.observaciones);

                    const catStyle = getActivityCategoryStyles(slot.tipo);
                    const cardBgBorder = isCurrentSlot
                      ? `${catStyle.bgClass} border-blue-500 ring-2 ring-blue-500 shadow-md`
                      : `${catStyle.bgClass} ${catStyle.borderClass} hover:brightness-95`;

                    return (
                      <div
                        key={slot.id || `dayslot-${slot.docente_id || ''}-${slot.día || ''}-${slot.hora_inicio}-${idx}`}
                        className={`p-3.5 sm:px-4 sm:py-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBgBorder}`}
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div
                            className={`px-2.5 py-1.5 rounded-lg text-center font-mono text-xs font-bold whitespace-nowrap shrink-0 ${
                              isCurrentSlot
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-white/80 text-slate-800 border border-slate-200/80 shadow-2xs'
                            }`}
                          >
                            {slot.hora_inicio}–{slot.hora_fin}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-900">
                                {displayActivity}
                              </h4>
                              {isCurrentSlot && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                                  Tramo Actual ({realTime})
                                </span>
                              )}
                            </div>

                            {(secondaryMeta || displayObs) && (
                              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 mt-0.5">
                                {secondaryMeta && (
                                  <span className="font-semibold text-slate-800">
                                    {secondaryMeta}
                                  </span>
                                )}
                                {displayObs && (
                                  <span className="text-slate-500 italic">
                                    ({displayObs})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="self-end sm:self-center">
                          <ActivityBadge tipo={slot.tipo} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <p className="text-slate-500">Seleccione un docente para ver su horario.</p>
        </div>
      )}
    </div>
  );
};
