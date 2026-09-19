export type Role = 'DOCENTE' | 'ADMIN';

export type DiaSemana = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes';

export const DIAS_SEMANA: DiaSemana[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export type TipoActividad =
  | 'DOCENCIA'
  | 'REFUERZO'
  | 'COORDINACIÓN'
  | 'EQUIPO_DIRECTIVO'
  | 'DIRECCIÓN'
  | 'SECRETARÍA'
  | 'JEFATURA'
  | 'TDE'
  | 'BIBLIOTECA'
  | 'PLAN_APERTURA'
  | 'STEAM'
  | 'REDUCCIÓN'
  | 'RECREO'
  | 'ITINERANCIA'
  | 'OTROS';

export type CategoriaMaestra =
  | 'DOCENCIA'
  | 'REFUERZO'
  | 'COORDINACIÓN'
  | 'EQUIPO DIRECTIVO'
  | 'RECREO'
  | 'OTROS';

export interface Docente {
  docente_id: string;
  nombre_docente: string;
  especialidad?: string;
  tutoria?: string;
  email?: string;
  telefono?: string;
  observaciones?: string;
}

export interface HorarioTramo {
  id?: string;
  docente_id: string;
  nombre_docente: string;
  día: DiaSemana;
  hora_inicio: string; // "HH:MM" 24h
  hora_fin: string;    // "HH:MM" 24h
  actividad: string;
  grupo: string;
  ubicación: string;
  tipo: TipoActividad | string;
  curso_escolar: string;
  observaciones?: string;
  estado_revision?: string;
}

export interface Ubicacion {
  codigo: string;
  nombre: string;
  planta?: string;
  edificio?: string;
  capacidad?: number;
}

export interface TipoDef {
  codigo: string;
  nombre: string;
  categoria: CategoriaMaestra | 'DOCENCIA' | 'GESTION' | 'APOYO' | 'DESCANSO' | 'OTRO' | string;
  color?: string;
}

export interface RefuerzoCentro {
  id: string;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  grupo_apoyado: string;
  docente_refuerzo: string;
  materia: string;
  observaciones?: string;
}

export interface ExcelValidationResult {
  isValid: boolean;
  sheetsFound: string[];
  missingSheets: string[];
  totalRowsHorarios: number;
  totalRowsDocentes: number;
  validRows: HorarioTramo[];
  errorRows: { rowNumber: number; data: any; reason: string }[];
  warningRows: { rowNumber: number; data: any; reason: string }[];
  errors?: { rowNumber: number; data: any; reason: string }[];
  warnings?: { rowNumber: number; data: any; reason: string }[];
  docentesList: Docente[];
  ubicacionesList: Ubicacion[];
  tiposList: TipoDef[];
  refuerzosList: RefuerzoCentro[];
  cursoDetectado: string;
}

export interface TramoReferencia {
  etiqueta: string;
  hora_inicio: string;
  hora_fin: string;
  esRecreo?: boolean;
}

export const TRAMOS_ESTANDAR: TramoReferencia[] = [
  { etiqueta: '1º Tramo (09:00–09:30)', hora_inicio: '09:00', hora_fin: '09:30' },
  { etiqueta: '2º Tramo (09:30–10:30)', hora_inicio: '09:30', hora_fin: '10:30' },
  { etiqueta: '3º Tramo (10:30–11:30)', hora_inicio: '10:30', hora_fin: '11:30' },
  { etiqueta: 'Recreo (11:30–12:00)', hora_inicio: '11:30', hora_fin: '12:00', esRecreo: true },
  { etiqueta: '4º Tramo (12:00–13:00)', hora_inicio: '12:00', hora_fin: '13:00' },
  { etiqueta: '5º Tramo (13:00–14:00)', hora_inicio: '13:00', hora_fin: '14:00' },
];
