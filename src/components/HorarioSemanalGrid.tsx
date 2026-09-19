import React, { useMemo } from 'react';
import { DiaSemana, DIAS_SEMANA, HorarioTramo } from '../types';
import {
  formatUbicacion,
  isTimeInSlot,
  isUbicacionSpecified,
  minutesToTime,
  normalizeDia,
  timeToMinutes,
  formatTimeHHMM,
  getCleanVisualCellMetadata,
} from '../utils/timeUtils';
import {
  getActivityCategoryStyles,
  getActivityCellClasses,
  getLegendCategories,
} from '../utils/activityStyles';

interface HorarioSemanalGridProps {
  slots: HorarioTramo[];
  realSchoolDay?: DiaSemana | null;
  realTime?: string;
  currentRealDay?: DiaSemana | null; // Kept for backwards compatibility
  currentRealTime?: string; // Kept for backwards compatibility
  consultedDay?: DiaSemana;
  consultedTime?: string;
}

interface TimeSlice {
  index: number;
  startMin: number;
  endMin: number;
  startStr: string;
  endStr: string;
  label: string;
  isCurrentTimeSlice: boolean;
}

const COMPACT_DAYS: Record<DiaSemana, string> = {
  Lunes: 'Lun',
  Martes: 'Mar',
  Miércoles: 'Mié',
  Jueves: 'Jue',
  Viernes: 'Vie',
};

export const HorarioSemanalGrid: React.FC<HorarioSemanalGridProps> = ({
  slots = [],
  realSchoolDay,
  realTime,
  currentRealDay,
  currentRealTime,
  consultedDay,
  consultedTime,
}) => {
  // Real school day (strictly null on weekends)
  const resolvedRealSchoolDay = realSchoolDay !== undefined ? realSchoolDay : (currentRealDay ?? null);
  const resolvedRealTime = realTime !== undefined ? realTime : (currentRealTime ?? '');

  // Dynamic categories actually present in this schedule for the visual legend
  const presentCategories = useMemo(() => {
    const safeSlots = slots || [];
    const tipos = safeSlots.map((s) => s?.tipo);
    return getLegendCategories(tipos);
  }, [slots]);
  // 1. Filter and normalize valid slots with valid day and strictly positive duration
  const validSlots = useMemo(() => {
    return (slots || [])
      .map((s) => {
        if (!s) return null;
        const day = normalizeDia(s.día);
        if (!day) return null;
        const start = timeToMinutes(s.hora_inicio);
        let end = timeToMinutes(s.hora_fin);
        if (end <= start) {
          end = start + 60; // Default 1 hour duration if end time is missing or malformed
        }
        return {
          ...s,
          día: day,
          hora_inicio: formatTimeHHMM(s.hora_inicio) || minutesToTime(start),
          hora_fin: formatTimeHHMM(s.hora_fin) || minutesToTime(end),
        };
      })
      .filter(Boolean) as HorarioTramo[];
  }, [slots]);

  // 2. Extract dynamic time slices from all start and end points of the teacher's schedule
  const { slices, sortedMinutes } = useMemo(() => {
    if (validSlots.length === 0) {
      return { slices: [], sortedMinutes: [] };
    }

    const minSet = new Set<number>();
    validSlots.forEach((s) => {
      minSet.add(timeToMinutes(s.hora_inicio));
      minSet.add(timeToMinutes(s.hora_fin));
    });

    const sorted = Array.from(minSet).sort((a, b) => a - b);
    const result: TimeSlice[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const startMin = sorted[i];
      const endMin = sorted[i + 1];
      const startStr = minutesToTime(startMin);
      const endStr = minutesToTime(endMin);
      // ONLY considered current slice if today is genuinely a school day (not weekend)
      const isCurrent =
        resolvedRealSchoolDay !== null &&
        Boolean(resolvedRealTime) &&
        isTimeInSlot(resolvedRealTime, startStr, endStr);

      result.push({
        index: i,
        startMin,
        endMin,
        startStr,
        endStr,
        label: `${startStr} – ${endStr}`,
        isCurrentTimeSlice: isCurrent,
      });
    }

    return { slices: result, sortedMinutes: sorted };
  }, [validSlots, resolvedRealSchoolDay, resolvedRealTime]);

  // Empty state if no valid slots
  if (validSlots.length === 0 || slices.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-slate-500 font-medium text-xs sm:text-sm">
          No hay tramos registrados para este docente en la semana.
        </p>
      </div>
    );
  }

  // Pre-organize slots by normalized day for quick lookup
  const slotsByDay = new Map<DiaSemana, HorarioTramo[]>();
  DIAS_SEMANA.forEach((dia) => {
    slotsByDay.set(
      dia,
      validSlots.filter((s) => normalizeDia(s.día) === dia)
    );
  });

  return (
    <div className="w-full max-w-full">
      {/* Mobile Swipe Guidance Indicator */}
      <div className="md:hidden flex items-center justify-between text-[11px] text-slate-600 mb-2 py-1 px-2.5 rounded-lg bg-blue-50/70 border border-blue-200/60">
        <span className="font-semibold text-slate-700">Horario semanal</span>
        <span className="font-bold text-blue-700 inline-flex items-center gap-1 text-[10.5px]">
          <span>&larr;</span>
          <span>Deslizar para ver los 5 días</span>
          <span>&rarr;</span>
        </span>
      </div>

      {/* Scrollable Container with sticky header and sticky left time column */}
      <div className="overflow-x-auto overflow-y-auto max-h-[720px] rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs bg-white touch-pan-x">
        <table className="w-full min-w-[500px] sm:min-w-[580px] md:min-w-full table-fixed border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700">
              {/* Sticky Corner Header: Hora */}
              <th
                scope="col"
                className="sticky top-0 left-0 z-30 bg-slate-100/95 backdrop-blur-xs border-b border-r border-slate-200 p-1 sm:p-1.5 text-center text-[11px] sm:text-xs font-bold text-slate-700 w-[52px] sm:w-[78px] md:w-[86px]"
              >
                Hora
              </th>

              {/* Day Column Headers */}
              {DIAS_SEMANA.map((dia) => {
                // Strictly: HOY only appears if today is a real school day AND matches this column
                const isToday = resolvedRealSchoolDay !== null && dia === resolvedRealSchoolDay;
                return (
                  <th
                    key={dia}
                    scope="col"
                    className={`sticky top-0 z-20 backdrop-blur-xs border-b border-r border-slate-200 last:border-r-0 p-1 sm:p-1.5 text-center text-xs sm:text-sm font-bold transition-colors ${
                      isToday
                        ? 'bg-violet-50/95 text-violet-900 border-b-violet-200'
                        : 'bg-slate-100/95 text-slate-700'
                    }`}
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className="sm:hidden">{COMPACT_DAYS[dia]}</span>
                      <span className="hidden sm:inline">{dia}</span>
                      {isToday && (
                        <span className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider px-1 sm:px-1.5 py-0.2 rounded-full bg-violet-600 text-white shadow-2xs">
                          Hoy
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {slices.map((slice) => {
              return (
                <tr key={slice.index} className="transition-colors">
                  {/* Sticky Time Interval Column */}
                  <td
                    className={`sticky left-0 z-10 backdrop-blur-xs border-r border-b border-slate-200 p-0.5 sm:p-1 text-center font-semibold transition-colors w-[52px] sm:w-[78px] md:w-[86px] ${
                      slice.isCurrentTimeSlice
                        ? 'bg-violet-50/95 text-violet-900 font-bold'
                        : 'bg-slate-50/95 text-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-center justify-center font-mono leading-tight text-[9.5px] sm:text-[11px]">
                      <span>{slice.startStr}</span>
                      <span className="hidden sm:inline text-slate-400 mx-0.5">–</span>
                      <span className="text-slate-500 sm:text-inherit text-[9px] sm:text-[11px]">
                        {slice.endStr}
                      </span>
                    </div>
                  </td>

                  {/* Day Cells */}
                  {DIAS_SEMANA.map((dia) => {
                    const daySlots = slotsByDay.get(dia) || [];

                    // 1. Slots starting exactly at this slice
                    const startingSlots = daySlots.filter(
                      (s) => timeToMinutes(s.hora_inicio) === slice.startMin
                    );

                    // 2. If slots start here, compute rowSpan
                    if (startingSlots.length > 0) {
                      // Max end minute among all starting slots here
                      const maxEndMin = Math.max(
                        ...startingSlots.map((s) => timeToMinutes(s.hora_fin))
                      );

                      // Calculate span based on index in sortedMinutes
                      const targetIdx = sortedMinutes.indexOf(maxEndMin);
                      const span = targetIdx > slice.index ? targetIdx - slice.index : 1;

                      return (
                        <td
                          key={dia}
                          rowSpan={span}
                          className="border-r border-b border-slate-200/80 last:border-r-0 p-0.5 align-middle"
                        >
                          <div className="flex flex-col gap-0.5 w-full h-full justify-center">
                            {startingSlots.map((slot, sIdx) => {
                              // ACTUAL strictly requires real school day AND real time
                              const isCurrent =
                                resolvedRealSchoolDay !== null &&
                                dia === resolvedRealSchoolDay &&
                                Boolean(resolvedRealTime) &&
                                isTimeInSlot(resolvedRealTime, slot.hora_inicio, slot.hora_fin);

                              // CONSULTADO: queried moment matches slot, and slot is not ACTUAL
                              const isConsulted =
                                !isCurrent &&
                                consultedDay !== undefined &&
                                consultedTime !== undefined &&
                                dia === consultedDay &&
                                isTimeInSlot(consultedTime, slot.hora_inicio, slot.hora_fin);

                              const categoryStyle = getActivityCategoryStyles(slot.tipo);
                              const baseCellClasses = getActivityCellClasses(slot.tipo, isCurrent);
                              const cellClasses = isConsulted
                                ? `${baseCellClasses} ring-2 ring-cyan-500 border-cyan-500 shadow-xs`
                                : baseCellClasses;

                              // Visual deduplication of group / location vs activity
                              const { displayActivity, secondaryMeta } = getCleanVisualCellMetadata(
                                slot.actividad,
                                slot.grupo,
                                slot.ubicación
                              );

                              return (
                                <div
                                  key={slot.id || sIdx}
                                  className={`w-full h-full min-h-[28px] sm:min-h-[34px] py-1 px-1 sm:py-1 sm:px-1.5 rounded-md border transition flex flex-col justify-center items-center text-center relative ${cellClasses}`}
                                >
                                  {/* Current Time Badge */}
                                  {isCurrent && (
                                    <span className="absolute -top-1.5 right-0.5 text-[7.5px] sm:text-[8.5px] font-extrabold uppercase tracking-tight px-1 py-0.2 rounded bg-blue-600 text-white shadow-2xs">
                                      ACTUAL
                                    </span>
                                  )}

                                  {/* Consulted Time Badge */}
                                  {isConsulted && (
                                    <span className="absolute -top-1.5 right-0.5 text-[7.5px] sm:text-[8.5px] font-extrabold uppercase tracking-tight px-1 py-0.2 rounded bg-cyan-700 text-white shadow-2xs">
                                      CONSULTADO
                                    </span>
                                  )}

                                  {/* Activity / Subject (Primary) */}
                                  <div
                                    className={`text-[9.5px] sm:text-[11.5px] font-bold uppercase tracking-tight leading-snug line-clamp-3 max-w-full break-words hyphens-auto ${categoryStyle.textClass}`}
                                    title={displayActivity}
                                  >
                                    {displayActivity}
                                  </div>

                                  {/* Group and / or Location (Secondary) with deduplication applied */}
                                  {secondaryMeta && (
                                    <div
                                      className={`text-[8px] sm:text-[9.5px] font-medium leading-tight mt-0.5 max-w-full break-words ${categoryStyle.textClass} opacity-85`}
                                      title={secondaryMeta}
                                    >
                                      {secondaryMeta}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    }

                    // 3. Check if covered by an earlier slot that spans into this slice
                    const isCoveredByEarlier = daySlots.some((s) => {
                      const sStart = timeToMinutes(s.hora_inicio);
                      const sEnd = timeToMinutes(s.hora_fin);
                      return sStart < slice.startMin && sEnd >= slice.endMin;
                    });

                    // If covered by rowSpan from above, render NOTHING (HTML table fills it)
                    if (isCoveredByEarlier) {
                      return null;
                    }

                    // 4. Empty slot (Hueco / Sin actividad)
                    return (
                      <td
                        key={dia}
                        className="border-r border-b border-slate-200/70 last:border-r-0 p-0.5 align-middle"
                      >
                        <div className="w-full h-full min-h-[28px] sm:min-h-[34px] rounded-md bg-slate-50/40 border border-dashed border-slate-200/60 flex items-center justify-center text-slate-300 text-[10px]">
                          —
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend Bar (100% unified with central activityStyles and present categories) */}
      <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3 text-xs">
        <span className="text-slate-500 font-semibold mr-1">Leyenda:</span>
        {presentCategories.map((cat) => (
          <div
            key={cat.key}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-2xs font-medium text-xs transition-colors ${cat.badgeBgClass} ${cat.badgeBorderClass} ${cat.badgeTextClass}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${cat.dotClass}`} />
            <span>{cat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
