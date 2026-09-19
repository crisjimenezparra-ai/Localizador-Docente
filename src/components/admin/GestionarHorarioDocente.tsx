import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DiaSemana, DIAS_SEMANA, Docente, HorarioTramo } from '../../types';
import {
  formatUbicacion,
  normalizeDia,
  timeToMinutes,
  VALID_ACADEMIC_GROUPS,
  isValidDisplayGroup,
  isUbicacionSpecified,
  getSystemTimeInfo,
} from '../../utils/timeUtils';
import { ActivityBadge } from '../ActivityBadge';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Info,
  MapPin,
  Users,
  BookOpen,
} from 'lucide-react';

interface GestionarHorarioDocenteProps {
  docente: Docente;
  onBack: () => void;
}

interface SlotFormData {
  id?: string;
  día: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  actividad: string;
  grupo: string;
  ubicación: string;
  tipo: string;
}

const DEFAULT_SLOT_TIMES = [
  { inicio: '09:00', fin: '09:30', label: '1º Tramo (09:00–09:30)' },
  { inicio: '09:30', fin: '10:30', label: '2º Tramo (09:30–10:30)' },
  { inicio: '10:30', fin: '11:30', label: '3º Tramo (10:30–11:30)' },
  { inicio: '11:30', fin: '12:00', label: 'Recreo (11:30–12:00)' },
  { inicio: '12:00', fin: '13:00', label: '4º Tramo (12:00–13:00)' },
  { inicio: '13:00', fin: '14:00', label: '5º Tramo (13:00–14:00)' },
];

export const GestionarHorarioDocente: React.FC<GestionarHorarioDocenteProps> = ({
  docente,
  onBack,
}) => {
  const {
    horarios,
    ubicaciones,
    tipos,
    addOrUpdateHorarioSlot,
    deleteHorarioSlot,
    cursoEscolar,
  } = useApp();

  // A) Real system time (device clock)
  const [systemTime, setSystemTime] = useState(() => getSystemTimeInfo());
  const realSchoolDay = systemTime.realSchoolDay; // null on weekends

  // Filter schedules strictly for this teacher
  const teacherSlots = useMemo(() => {
    return horarios
      .filter((h) => h.docente_id.toLowerCase() === docente.docente_id.toLowerCase())
      .sort((a, b) => {
        const dayDiff = DIAS_SEMANA.indexOf(a.día) - DIAS_SEMANA.indexOf(b.día);
        if (dayDiff !== 0) return dayDiff;
        return timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio);
      });
  }, [horarios, docente.docente_id]);

  // Selected Day Filter: 'TODOS' or DiaSemana
  const [filterDay, setFilterDay] = useState<DiaSemana | 'TODOS'>('TODOS');

  // Modal states for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<SlotFormData>({
    día: 'Lunes',
    hora_inicio: '09:00',
    hora_fin: '10:00',
    actividad: '',
    grupo: '',
    ubicación: '',
    tipo: 'DOCENCIA',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete Confirmation Modal state
  const [slotToDelete, setSlotToDelete] = useState<HorarioTramo | null>(null);

  // Available groups for dropdown (Canonical academic groups + any currently present)
  const availableGroups = useMemo(() => {
    const set = new Set<string>(VALID_ACADEMIC_GROUPS);
    horarios.forEach((h) => {
      if (h.grupo && isValidDisplayGroup(h.grupo)) {
        set.add(h.grupo.trim());
      }
    });
    return Array.from(set).sort();
  }, [horarios]);

  // Available locations for dropdown
  const availableLocations = useMemo(() => {
    const map = new Map<string, string>();
    ubicaciones.forEach((u) => {
      map.set(u.codigo.trim(), u.nombre ? `${u.codigo} (${u.nombre})` : u.codigo);
    });
    horarios.forEach((h) => {
      if (h.ubicación && isUbicacionSpecified(h.ubicación)) {
        const trimmed = h.ubicación.trim();
        if (!map.has(trimmed)) {
          map.set(trimmed, trimmed);
        }
      }
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [ubicaciones, horarios]);

  // Available activity types
  const availableTypes = useMemo(() => {
    if (tipos.length > 0) return tipos;
    return [
      { codigo: 'DOCENCIA', nombre: 'Docencia directa', categoria: 'DOCENCIA' as const, color: 'blue' },
      { codigo: 'REFUERZO', nombre: 'Refuerzo pedagógico', categoria: 'APOYO' as const, color: 'emerald' },
      { codigo: 'COORDINACION', nombre: 'Coordinación docente', categoria: 'GESTION' as const, color: 'amber' },
      { codigo: 'EQUIPO_DIRECTIVO', nombre: 'Equipo Directivo', categoria: 'GESTION' as const, color: 'purple' },
      { codigo: 'RECREO', nombre: 'Guardia de recreo', categoria: 'DESCANSO' as const, color: 'indigo' },
      { codigo: 'BIBLIOTECA', nombre: 'Atención a Biblioteca', categoria: 'APOYO' as const, color: 'teal' },
      { codigo: 'TUTORIA', nombre: 'Tutoría', categoria: 'GESTION' as const, color: 'rose' },
      { codigo: 'OTROS', nombre: 'Otras actividades', categoria: 'OTROS' as const, color: 'slate' },
    ];
  }, [tipos]);

  // Count slots per day for tabs
  const countPerDay = useMemo(() => {
    const counts: Record<DiaSemana, number> = {
      Lunes: 0,
      Martes: 0,
      Miércoles: 0,
      Jueves: 0,
      Viernes: 0,
    };
    teacherSlots.forEach((slot) => {
      const norm = normalizeDia(slot.día);
      if (norm && counts[norm] !== undefined) {
        counts[norm]++;
      }
    });
    return counts;
  }, [teacherSlots]);

  // Open Add Modal
  const handleOpenAddModal = (presetDay?: DiaSemana) => {
    const day = presetDay || (filterDay !== 'TODOS' ? filterDay : 'Lunes');
    setFormData({
      día: day,
      hora_inicio: '09:00',
      hora_fin: '10:00',
      actividad: '',
      grupo: '',
      ubicación: '',
      tipo: 'DOCENCIA',
    });
    setIsEditing(false);
    setFormError(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (slot: HorarioTramo) => {
    setFormData({
      id: slot.id,
      día: (normalizeDia(slot.día) || 'Lunes') as DiaSemana,
      hora_inicio: slot.hora_inicio,
      hora_fin: slot.hora_fin,
      actividad: slot.actividad,
      grupo: slot.grupo && isValidDisplayGroup(slot.grupo) ? slot.grupo : '',
      ubicación: slot.ubicación && isUbicacionSpecified(slot.ubicación) ? slot.ubicación : '',
      tipo: slot.tipo,
    });
    setIsEditing(true);
    setFormError(null);
    setModalOpen(true);
  };

  // Quick preset button click
  const handleSelectPresetTime = (inicio: string, fin: string) => {
    setFormData((prev) => ({
      ...prev,
      hora_inicio: inicio,
      hora_fin: fin,
    }));
  };

  // Form Submit Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation 1: Required activity
    if (!formData.actividad.trim()) {
      setFormError('Debe especificar la actividad (ej. Matemáticas, Tutoría, Guardia...).');
      return;
    }

    // Validation 2: Time ordering
    const startMin = timeToMinutes(formData.hora_inicio);
    const endMin = timeToMinutes(formData.hora_fin);
    if (isNaN(startMin) || isNaN(endMin) || endMin <= startMin) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    // Construct slot
    const slotToSave: HorarioTramo = {
      id: formData.id,
      docente_id: docente.docente_id,
      nombre_docente: docente.nombre_docente,
      día: formData.día,
      hora_inicio: formData.hora_inicio,
      hora_fin: formData.hora_fin,
      actividad: formData.actividad.trim(),
      grupo: formData.grupo.trim(),
      ubicación: formData.ubicación.trim(),
      tipo: formData.tipo,
      curso_escolar: cursoEscolar,
    };

    const result = addOrUpdateHorarioSlot(slotToSave);
    if (!result.success) {
      setFormError(result.error || 'No se pudo guardar el tramo.');
      return;
    }

    setModalOpen(false);
    setSuccessToast(
      isEditing
        ? `Tramo actualizado correctamente (${formData.día} ${formData.hora_inicio}–${formData.hora_fin}).`
        : `Nuevo tramo añadido correctamente al horario de ${docente.nombre_docente}.`
    );
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Confirm Delete
  const handleExecuteDelete = () => {
    if (!slotToDelete) return;
    const res = deleteHorarioSlot(slotToDelete.id);
    if (res.success) {
      setSuccessToast(
        `Tramo eliminado del horario (${slotToDelete.día} ${slotToDelete.hora_inicio}–${slotToDelete.hora_fin}).`
      );
      setTimeout(() => setSuccessToast(null), 4000);
    }
    setSlotToDelete(null);
  };

  const displayedDays = filterDay === 'TODOS' ? DIAS_SEMANA : [filterDay];

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header with Back button and Teacher summary */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <button
            id="btn-back-to-docentes"
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Volver a la lista de docentes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {docente.nombre_docente}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Especialidad: <strong>{docente.especialidad || 'General'}</strong>
              {docente.email ? ` • ${docente.email}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Discreet Notice: Excel vs App State (Requirement 9) */}
      <div className="px-4 py-3 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-500 shrink-0" />
        <p className="leading-relaxed">
          Los cambios realizados aquí afectan al horario almacenado en la aplicación. Una futura
          importación de Excel puede sustituir estos cambios.
        </p>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Day Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-semibold">
        <button
          id="tab-day-todos"
          onClick={() => setFilterDay('TODOS')}
          className={`px-3 py-2 rounded-lg transition whitespace-nowrap cursor-pointer ${
            filterDay === 'TODOS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Semana Completa ({teacherSlots.length})
        </button>
        {DIAS_SEMANA.map((d) => {
          const isToday = realSchoolDay !== null && d === realSchoolDay;
          return (
            <button
              key={d}
              id={`tab-day-${d.toLowerCase()}`}
              onClick={() => setFilterDay(d)}
              className={`px-3 py-2 rounded-lg transition whitespace-nowrap cursor-pointer ${
                filterDay === d
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {d} {isToday ? '· Hoy ' : ''}({countPerDay[d]})
            </button>
          );
        })}
      </div>

      {/* Day by Day schedule cards */}
      <div className="space-y-6">
        {displayedDays.map((dia) => {
          const daySlots = teacherSlots.filter((s) => normalizeDia(s.día) === dia);
          const isToday = realSchoolDay !== null && dia === realSchoolDay;

          return (
            <div
              key={dia}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
            >
              {/* Day Card Header */}
              <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{dia}</span>
                    {isToday && (
                      <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Hoy
                      </span>
                    )}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">
                    {daySlots.length} {daySlots.length === 1 ? 'tramo' : 'tramos'}
                  </span>
                </div>

                <button
                  onClick={() => handleOpenAddModal(dia)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir tramo el {dia}</span>
                </button>
              </div>

              {/* Day Slots List */}
              {daySlots.length === 0 ? (
                <div className="py-8 px-6 text-center text-slate-400 text-xs">
                  <p>Sin tramos asignados para el {dia}.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50/40 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="py-2.5 px-4">Horario</th>
                        <th className="py-2.5 px-4">Actividad</th>
                        <th className="py-2.5 px-4">Grupo</th>
                        <th className="py-2.5 px-4">Ubicación</th>
                        <th className="py-2.5 px-4">Tipo</th>
                        <th className="py-2.5 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {daySlots.map((slot) => {
                        const hasLocation = isUbicacionSpecified(slot.ubicación);
                        const hasGroup = isValidDisplayGroup(slot.grupo);

                        return (
                          <tr
                            key={slot.id}
                            className="hover:bg-slate-50/80 transition group"
                          >
                            {/* Time */}
                            <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  {slot.hora_inicio}–{slot.hora_fin}
                                </span>
                              </div>
                            </td>

                            {/* Activity */}
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {slot.actividad}
                            </td>

                            {/* Group */}
                            <td className="py-3 px-4 text-slate-700">
                              {hasGroup ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-800 border border-slate-200 text-xs">
                                  <Users className="w-3 h-3 text-slate-500" />
                                  <span>{slot.grupo}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Location */}
                            <td className="py-3 px-4">
                              {hasLocation ? (
                                <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{slot.ubicación}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-xs">
                                  Ubicación no especificada
                                </span>
                              )}
                            </td>

                            {/* Type */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <ActivityBadge tipo={slot.tipo} size="sm" />
                            </td>

                            {/* Actions: Edit & Delete */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  id={`btn-edit-slot-${slot.id}`}
                                  onClick={() => handleOpenEditModal(slot)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 font-semibold text-xs transition cursor-pointer"
                                  title="Editar este tramo"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  id={`btn-delete-slot-${slot.id}`}
                                  onClick={() => setSlotToDelete(slot)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition cursor-pointer"
                                  title="Eliminar este tramo del horario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: AÑADIR O EDITAR TRAMO HORARIO */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 text-slate-900 animate-in fade-in my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  {isEditing ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {isEditing ? 'Editar tramo horario' : 'Añadir nuevo tramo horario'}
                  </h3>
                  <p className="text-xs text-slate-500">{docente.nombre_docente}</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Día */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Día de la semana *
                </label>
                <select
                  value={formData.día}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, día: e.target.value as DiaSemana }))
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tramos Estandar Rápidos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Plantillas de horario habitual
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {DEFAULT_SLOT_TIMES.map((t) => {
                    const isSelected =
                      formData.hora_inicio === t.inicio && formData.hora_fin === t.fin;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => handleSelectPresetTime(t.inicio, t.fin)}
                        className={`px-2 py-1.5 rounded-lg border text-left text-[11px] font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 text-blue-800 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-mono">{t.inicio}–{t.fin}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hora Inicio y Hora Fin */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hora Inicio (HH:MM) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.hora_inicio}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, hora_inicio: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hora Fin (HH:MM) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.hora_fin}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, hora_fin: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Actividad */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Actividad / Materia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Matemáticas, Lengua Castellana, Tutoría, Guardia..."
                  value={formData.actividad}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, actividad: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Grupo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Grupo académico
                </label>
                <select
                  value={formData.grupo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, grupo: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">(Sin grupo asignado / Dejar vacío)</option>
                  {availableGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Dejar vacío cuando la actividad no corresponda a un grupo concreto.
                </p>
              </div>

              {/* Ubicación */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ubicación registrada
                </label>
                <select
                  value={formData.ubicación}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, ubicación: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">(Ubicación no especificada / Dejar vacío)</option>
                  {availableLocations.map((loc) => (
                    <option key={loc.code} value={loc.code}>
                      {loc.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Si se deja vacía, se mostrará "Ubicación no especificada".
                </p>
              </div>

              {/* Tipo de Actividad */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Actividad *
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tipo: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {availableTypes.map((t) => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.codigo} - {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer"
                >
                  {isEditing ? 'Guardar Cambios' : 'Guardar Tramo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN (Requirement 6) */}
      {/* ========================================================================= */}
      {slotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-slate-900 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center">
              ¿Eliminar este tramo del horario?
            </h3>

            <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Docente:</span>
                <strong className="text-slate-800">{docente.nombre_docente}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Día:</span>
                <strong className="text-slate-800">{slotToDelete.día}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Horario:</span>
                <strong className="font-mono text-slate-900">
                  {slotToDelete.hora_inicio}–{slotToDelete.hora_fin}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Actividad:</span>
                <strong className="text-slate-800">{slotToDelete.actividad}</strong>
              </div>
              {slotToDelete.grupo && isValidDisplayGroup(slotToDelete.grupo) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Grupo:</span>
                  <span className="font-semibold text-slate-800">{slotToDelete.grupo}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                id="btn-cancel-delete-slot"
                onClick={() => setSlotToDelete(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-delete-slot"
                onClick={handleExecuteDelete}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-xs cursor-pointer"
              >
                Eliminar tramo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
