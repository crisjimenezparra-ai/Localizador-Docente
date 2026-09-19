import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DiaSemana } from '../types';
import { SystemTimeInfo } from '../utils/timeUtils';

export interface TemporalStatusHeaderProps {
  systemTime: SystemTimeInfo;
  isRealTime: boolean;
  consultedDay: DiaSemana;
  consultedTimeLabel: string;
  onResetToReal: () => void;
  accentColor?: 'blue' | 'cyan' | 'amber';
}

export const TemporalStatusHeader: React.FC<TemporalStatusHeaderProps> = ({
  systemTime,
  isRealTime,
  consultedDay,
  consultedTimeLabel,
  onResetToReal,
  accentColor = 'blue',
}) => {
  const isWeekend = systemTime.isWeekend;

  // CASO 1: Momento real en día lectivo
  if (isRealTime) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs sm:text-sm font-semibold text-slate-700">
          Ahora · <strong className="text-slate-900">{consultedDay} {systemTime.realTimeStr}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          TIEMPO REAL
        </span>
      </div>
    );
  }

  // Button styles depending on section accent color
  const buttonClasses = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    cyan: 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border-cyan-200',
    amber: 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200',
  }[accentColor];

  // CASO CONSULTA MANUAL (en día lectivo o fin de semana)
  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-xs sm:text-sm font-semibold text-slate-800">
          Consultando · <strong className="text-slate-900">{consultedDay} {consultedTimeLabel}</strong>
        </span>
        <button
          onClick={onResetToReal}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs shrink-0 ${buttonClasses}`}
          title="Restablecer a fecha y hora reales"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Volver a ahora</span>
        </button>
      </div>
      {isWeekend && (
        <p className="text-[11px] text-slate-500 font-medium sm:text-right pt-0.5">
          Hoy es {systemTime.realDayName.toLowerCase()} · Sin jornada lectiva
        </p>
      )}
    </div>
  );
};
