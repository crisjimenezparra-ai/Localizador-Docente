import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Docente,
  DiaSemana,
  ExcelValidationResult,
  HorarioTramo,
  RefuerzoCentro,
  Role,
  TipoActividad,
  TipoDef,
  Ubicacion,
} from '../types';
import {
  DEMO_DOCENTES,
  DEMO_HORARIOS,
  DEMO_REFUERZOS,
  DEMO_TIPOS,
  DEMO_UBICACIONES,
} from '../data/demoData';
import { normalizeDia, timeToMinutes, formatTimeHHMM, areTeacherNamesEquivalent } from '../utils/timeUtils';
import {
  verifyAdminPassword,
  changeAdminPassword,
  getRecoveryEmail,
  setRecoveryEmail as saveRecoveryEmail,
  cleanupLegacyStorage,
} from '../services/securityService';
import {
  isGasConnected,
  fetchRemoteCenterData,
  saveRemoteCenterData,
  isAutoSyncEnabled,
} from '../services/gasService';

interface AppContextType {
  role: Role;
  setRole: (role: Role, password?: string) => Promise<boolean> | boolean;
  isAdmin: boolean;
  adminPin: string; // Deprecated placeholder kept for backward compatibility

  // Password & Security methods
  verifyPassword: (password: string) => Promise<boolean>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  recoveryEmail: string;
  updateRecoveryEmail: (email: string) => void;

  // Google Sheets Cloud Sync
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncWithSheets: () => Promise<{ success: boolean; message?: string; error?: string }>;
  pushToSheets: () => Promise<{ success: boolean; message?: string; error?: string }>;

  // Data
  horarios: HorarioTramo[];
  docentes: Docente[];
  ubicaciones: Ubicacion[];
  tipos: TipoDef[];
  refuerzos: RefuerzoCentro[];
  cursoEscolar: string;
  isDemoData: boolean;
  hasManualScheduleEdits: boolean;

  // Admin Actions
  importExcelData: (result: ExcelValidationResult) => void;
  loadDemoData: () => void;
  clearAllData: () => void;
  setCursoEscolar: (curso: string) => void;
  addOrUpdateDocente: (docente: Docente, oldDocenteId?: string) => void;
  deleteDocente: (docenteId: string) => void;
  addOrUpdateUbicacion: (ubic: Ubicacion) => void;
  deleteUbicacion: (codigo: string) => void;
  addOrUpdateTipo: (tipo: TipoDef) => void;
  addOrUpdateHorarioSlot: (slot: HorarioTramo) => { success: boolean; error?: string };
  deleteHorarioSlot: (slotId: string) => { success: boolean; error?: string };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ROLE: 'horarios_app_role',
  HORARIOS: 'horarios_app_data_horarios',
  DOCENTES: 'horarios_app_data_docentes',
  UBICACIONES: 'horarios_app_data_ubicaciones',
  TIPOS: 'horarios_app_data_tipos',
  REFUERZOS: 'horarios_app_data_refuerzos',
  CURSO: 'horarios_app_data_curso',
  IS_DEMO: 'horarios_app_is_demo',
  HAS_MANUAL_EDITS: 'horarios_app_has_manual_edits',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Role State
  const [role, setRoleState] = useState<Role>(() => {
    cleanupLegacyStorage();
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
    return saved === 'ADMIN' ? 'ADMIN' : 'DOCENTE';
  });

  const [recoveryEmail, setRecoveryEmailState] = useState<string>(() => {
    return getRecoveryEmail();
  });

  // Data State - Defaults to empty/demo data in memory; Google Sheets is the single source of truth.
  // We do not prioritize stale localStorage over Google Sheets.
  const [horarios, setHorarios] = useState<HorarioTramo[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [tipos, setTipos] = useState<TipoDef[]>([]);
  const [refuerzos, setRefuerzos] = useState<RefuerzoCentro[]>([]);
  const [cursoEscolar, setCursoEscolarState] = useState<string>('2026/2027');
  const [isDemoData, setIsDemoData] = useState<boolean>(false);
  const [hasManualScheduleEdits, setHasManualScheduleEdits] = useState<boolean>(false);

  // Google Sheets Cloud Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const syncWithSheets = useCallback(async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!isGasConnected()) {
      return { success: false, error: 'No se ha configurado la conexión con Google Apps Script.' };
    }
    setIsSyncing(true);
    try {
      const res = await fetchRemoteCenterData();
      if (res.success && res.data) {
        let normalizedDocentes: Docente[] = [];
        if (res.data.docentes && Array.isArray(res.data.docentes) && res.data.docentes.length > 0) {
          normalizedDocentes = res.data.docentes
            .map((d: any) => {
              const docId = String(d.docente_id || d.id || d.codigo || '').trim();
              const docNombre = String(
                d.nombre_docente ||
                d.nombre ||
                d.profesor ||
                d.profesora ||
                d.maestro ||
                d.maestra ||
                docId
              ).trim();
              return {
                docente_id: docId || `D_${docNombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25)}`,
                nombre_docente: docNombre || docId,
                especialidad: d.especialidad || '',
                tutoria: d.tutoria || '',
                email: d.email || '',
                telefono: d.telefono || '',
                observaciones: d.observaciones || '',
              };
            })
            .filter((d: Docente) => Boolean(d.docente_id || d.nombre_docente));
        }

        let normalizedHorarios: HorarioTramo[] = [];
        if (res.data.horarios && Array.isArray(res.data.horarios) && res.data.horarios.length > 0) {
          const docMap = new Map<string, string>();
          normalizedDocentes.forEach((d) => {
            if (d.docente_id) docMap.set(d.docente_id.toLowerCase(), d.nombre_docente);
          });

          normalizedHorarios = res.data.horarios
            .map((h: any, idx: number) => {
              // Robust teacher extraction
              let docId = String(h.docente_id || h.id_docente || h.id || h.codigo || '').trim();
              let docNombre = String(h.nombre_docente || h.nombre || h.profesor || h.profesora || h.maestro || h.docente || '').trim();

              if (!docNombre && docId) {
                if (docMap.has(docId.toLowerCase())) {
                  docNombre = docMap.get(docId.toLowerCase()) || docId;
                } else {
                  const found = normalizedDocentes.find((d) => areTeacherNamesEquivalent(d.nombre_docente, docId));
                  if (found) {
                    docNombre = found.nombre_docente;
                    docId = found.docente_id;
                  } else {
                    docNombre = docId;
                  }
                }
              }

              if (!docId && docNombre) {
                const found = normalizedDocentes.find(
                  (d) =>
                    d.nombre_docente.toLowerCase() === docNombre.toLowerCase() ||
                    areTeacherNamesEquivalent(d.nombre_docente, docNombre)
                );
                docId = found ? found.docente_id : `D_${docNombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25)}`;
              }

              // Robust time extraction (handles HH:MM, HH:MM:SS, Date objects, fraction numbers, or combined slots)
              let hInicio = formatTimeHHMM(h.hora_inicio || h.inicio || h.desde || h.horainicio || '');
              let hFin = formatTimeHHMM(h.hora_fin || h.fin || h.hasta || h.horafin || '');

              if ((!hInicio || !hFin) && (h.tramo || h.horario || h.hora)) {
                const tramoRaw = String(h.tramo || h.horario || h.hora).trim();
                const parts = tramoRaw.split(/[-–—aA]/);
                if (parts.length >= 2) {
                  hInicio = formatTimeHHMM(parts[0]);
                  hFin = formatTimeHHMM(parts[1]);
                }
              }

              // Robust day normalization
              const rawDia = String(h['día'] || h.dia || h.dia_semana || h.diasemana || '').trim();
              const diaVal = normalizeDia(rawDia) || 'Lunes';

              return {
                id: h.id || `gas-${idx}-${docId || 'slot'}`,
                docente_id: docId || docNombre,
                nombre_docente: docNombre || docId,
                día: diaVal,
                hora_inicio: hInicio || '09:00',
                hora_fin: hFin || '10:00',
                actividad: String(h.actividad || h.materia || h.asignatura || h.tarea || '').trim(),
                grupo: String(h.grupo || h.curso || h.clase || h.nivel || '').trim(),
                ubicación: String(h['ubicación'] || h.ubicacion || h.aula || h.espacio || 'Ubicación no especificada').trim(),
                tipo: (h.tipo || 'DOCENCIA') as TipoActividad,
                curso_escolar: String(h.curso_escolar || res.data?.cursoEscolar || '2026/2027').trim(),
                observaciones: h.observaciones ? String(h.observaciones).trim() : '',
              };
            })
            .filter((h: HorarioTramo) => Boolean(h.docente_id || h.nombre_docente));

          if (normalizedDocentes.length === 0 && normalizedHorarios.length > 0) {
            const seen = new Set<string>();
            normalizedHorarios.forEach((h) => {
              const key = (h.docente_id || h.nombre_docente).toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                normalizedDocentes.push({
                  docente_id: h.docente_id || h.nombre_docente,
                  nombre_docente: h.nombre_docente || h.docente_id,
                });
              }
            });
          }
        }

        if (normalizedHorarios.length > 0) {
          setHorarios(normalizedHorarios);
          try {
            localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(normalizedHorarios));
          } catch {
            // sandbox safe
          }
        }
        if (normalizedDocentes.length > 0) {
          setDocentes(normalizedDocentes);
          try {
            localStorage.setItem(STORAGE_KEYS.DOCENTES, JSON.stringify(normalizedDocentes));
          } catch {
            // sandbox safe
          }
        }
        if (res.data.ubicaciones && Array.isArray(res.data.ubicaciones) && res.data.ubicaciones.length > 0) {
          setUbicaciones(res.data.ubicaciones);
          try {
            localStorage.setItem(STORAGE_KEYS.UBICACIONES, JSON.stringify(res.data.ubicaciones));
          } catch {
            // sandbox safe
          }
        }
        if (res.data.tipos && Array.isArray(res.data.tipos) && res.data.tipos.length > 0) {
          setTipos(res.data.tipos);
          try {
            localStorage.setItem(STORAGE_KEYS.TIPOS, JSON.stringify(res.data.tipos));
          } catch {
            // sandbox safe
          }
        }
        if (res.data.cursoEscolar) {
          setCursoEscolarState(res.data.cursoEscolar);
          try {
            localStorage.setItem(STORAGE_KEYS.CURSO, res.data.cursoEscolar);
          } catch {
            // sandbox safe
          }
        }
        if (res.data.isDemoData !== undefined) {
          setIsDemoData(res.data.isDemoData);
          try {
            localStorage.setItem(STORAGE_KEYS.IS_DEMO, res.data.isDemoData ? 'true' : 'false');
          } catch {
            // sandbox safe
          }
        }
        const now = new Date().toISOString();
        setLastSyncTime(now);
        return {
          success: true,
          message: `Datos sincronizados exitosamente desde Google Sheets (${normalizedHorarios.length} horarios, ${normalizedDocentes.length} docentes).`,
        };
      }
      return { success: false, error: res.error || 'Error al obtener datos de Google Sheets.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión con Google Sheets.' };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const pushToSheets = useCallback(async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!isGasConnected()) {
      return { success: false, error: 'No se ha configurado la conexión con Google Apps Script.' };
    }
    setIsSyncing(true);
    try {
      const res = await saveRemoteCenterData({
        horarios,
        docentes,
        ubicaciones,
        tipos,
        cursoEscolar,
        isDemoData,
      });
      if (res.success) {
        const now = new Date().toISOString();
        setLastSyncTime(now);
        return { success: true, message: res.message || 'Datos del centro guardados con éxito en Google Sheets.' };
      }
      return { success: false, error: res.error || 'Error al guardar en Google Sheets.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión con Google Sheets.' };
    } finally {
      setIsSyncing(false);
    }
  }, [horarios, docentes, ubicaciones, tipos, cursoEscolar, isDemoData]);

  // Automatic background synchronization on load if connected
  useEffect(() => {
    if (isGasConnected()) {
      syncWithSheets().catch((err) => {
        console.warn('Auto-sync on load notification:', err);
      });
    }
  }, [syncWithSheets]);

  const handleSetRole = (newRole: Role, password?: string): Promise<boolean> | boolean => {
    if (newRole === 'ADMIN') {
      if (password !== undefined) {
        return (async () => {
          const isValid = await verifyAdminPassword(password);
          if (isValid) {
            setRoleState('ADMIN');
            localStorage.setItem(STORAGE_KEYS.ROLE, 'ADMIN');
            return true;
          }
          return false;
        })();
      } else {
        setRoleState('ADMIN');
        localStorage.setItem(STORAGE_KEYS.ROLE, 'ADMIN');
        return true;
      }
    } else {
      setRoleState('DOCENTE');
      localStorage.setItem(STORAGE_KEYS.ROLE, 'DOCENTE');
      return true;
    }
  };

  const handleChangePassword = async (
    curr: string,
    next: string,
    conf: string
  ): Promise<{ success: boolean; error?: string }> => {
    return changeAdminPassword(curr, next, conf);
  };

  const handleUpdateRecoveryEmail = (email: string) => {
    saveRecoveryEmail(email);
    setRecoveryEmailState(email.trim().toLowerCase());
  };

  const importExcelData = (result: ExcelValidationResult) => {
    if (role !== 'ADMIN') {
      console.error('Acceso denegado: solo ADMIN puede importar datos.');
      return;
    }
    if (!result.isValid && result.validRows.length === 0) {
      console.error('No hay datos válidos para importar.');
      return;
    }

    setHorarios(result.validRows);
    try {
      localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(result.validRows));
    } catch {
      // sandbox safe
    }

    if (result.docentesList && result.docentesList.length > 0) {
      setDocentes(result.docentesList);
      try {
        localStorage.setItem(STORAGE_KEYS.DOCENTES, JSON.stringify(result.docentesList));
      } catch {
        // sandbox safe
      }
    }

    if (result.ubicacionesList && result.ubicacionesList.length > 0) {
      setUbicaciones(result.ubicacionesList);
      try {
        localStorage.setItem(STORAGE_KEYS.UBICACIONES, JSON.stringify(result.ubicacionesList));
      } catch {
        // sandbox safe
      }
    }

    if (result.tiposList && result.tiposList.length > 0) {
      setTipos(result.tiposList);
      try {
        localStorage.setItem(STORAGE_KEYS.TIPOS, JSON.stringify(result.tiposList));
      } catch {
        // sandbox safe
      }
    }

    if (result.refuerzosList && result.refuerzosList.length > 0) {
      setRefuerzos(result.refuerzosList);
      try {
        localStorage.setItem(STORAGE_KEYS.REFUERZOS, JSON.stringify(result.refuerzosList));
      } catch {
        // sandbox safe
      }
    }

    if (result.cursoDetectado) {
      setCursoEscolarState(result.cursoDetectado);
      try {
        localStorage.setItem(STORAGE_KEYS.CURSO, result.cursoDetectado);
      } catch {
        // sandbox safe
      }
    }

    setIsDemoData(false);
    try {
      localStorage.setItem(STORAGE_KEYS.IS_DEMO, 'false');
      localStorage.removeItem(STORAGE_KEYS.HAS_MANUAL_EDITS);
    } catch {
      // sandbox safe
    }
    setHasManualScheduleEdits(false);

    // Si está conectado a Google Apps Script / Google Sheets, subir automáticamente los nuevos horarios a la nube
    if (isGasConnected()) {
      saveRemoteCenterData({
        horarios: result.validRows,
        docentes: result.docentesList || [],
        ubicaciones: result.ubicacionesList || [],
        tipos: result.tiposList || [],
        cursoEscolar: result.cursoDetectado || '2026/2027',
        isDemoData: false,
      })
        .then((res) => {
          if (res.success) {
            console.log('Horarios subidos automáticamente a Google Sheets tras importación.');
            setLastSyncTime(new Date().toISOString());
          }
        })
        .catch((e) => {
          console.warn('No se pudo auto-sincronizar con Google Sheets:', e);
        });
    }
  };

  const loadDemoData = () => {
    if (role !== 'ADMIN') return;
    setHorarios(DEMO_HORARIOS);
    setDocentes(DEMO_DOCENTES);
    setUbicaciones(DEMO_UBICACIONES);
    setTipos(DEMO_TIPOS);
    setRefuerzos(DEMO_REFUERZOS);
    setCursoEscolarState('2026/2027');
    setIsDemoData(true);
    setHasManualScheduleEdits(false);
    localStorage.removeItem(STORAGE_KEYS.HAS_MANUAL_EDITS);

    localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(DEMO_HORARIOS));
    localStorage.setItem(STORAGE_KEYS.DOCENTES, JSON.stringify(DEMO_DOCENTES));
    localStorage.setItem(STORAGE_KEYS.UBICACIONES, JSON.stringify(DEMO_UBICACIONES));
    localStorage.setItem(STORAGE_KEYS.TIPOS, JSON.stringify(DEMO_TIPOS));
    localStorage.setItem(STORAGE_KEYS.REFUERZOS, JSON.stringify(DEMO_REFUERZOS));
    localStorage.setItem(STORAGE_KEYS.CURSO, '2026/2027');
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, 'true');
  };

  const clearAllData = () => {
    if (role !== 'ADMIN') return;
    setHorarios([]);
    setDocentes([]);
    setUbicaciones([]);
    setRefuerzos([]);
    setIsDemoData(false);
    setHasManualScheduleEdits(false);
    localStorage.removeItem(STORAGE_KEYS.HAS_MANUAL_EDITS);

    localStorage.removeItem(STORAGE_KEYS.HORARIOS);
    localStorage.removeItem(STORAGE_KEYS.DOCENTES);
    localStorage.removeItem(STORAGE_KEYS.UBICACIONES);
    localStorage.removeItem(STORAGE_KEYS.REFUERZOS);
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, 'false');
  };

  const setCursoEscolar = (curso: string) => {
    if (role !== 'ADMIN') return;
    setCursoEscolarState(curso);
    localStorage.setItem(STORAGE_KEYS.CURSO, curso);
  };

  const addOrUpdateDocente = (doc: Docente, oldDocenteId?: string) => {
    if (role !== 'ADMIN') return;
    const lookupId = (oldDocenteId || doc.docente_id).toLowerCase();

    setDocentes((prev) => {
      const idx = prev.findIndex((d) => d.docente_id.toLowerCase() === lookupId);
      const updated = idx >= 0 ? prev.map((d, i) => (i === idx ? doc : d)) : [...prev, doc];
      localStorage.setItem(STORAGE_KEYS.DOCENTES, JSON.stringify(updated));
      return updated;
    });

    // Keep schedules in sync if the name or ID was updated
    setHorarios((prev) => {
      let changed = false;
      const updated = prev.map((h) => {
        if (h.docente_id.toLowerCase() === lookupId) {
          changed = true;
          return {
            ...h,
            docente_id: doc.docente_id,
            nombre_docente: doc.nombre_docente,
          };
        }
        return h;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
  };

  const deleteDocente = (docenteId: string) => {
    if (role !== 'ADMIN') return;
    setDocentes((prev) => {
      const updated = prev.filter((d) => d.docente_id.toLowerCase() !== docenteId.toLowerCase());
      localStorage.setItem(STORAGE_KEYS.DOCENTES, JSON.stringify(updated));
      return updated;
    });
    // Also remove their schedules
    setHorarios((prev) => {
      const updated = prev.filter((h) => h.docente_id.toLowerCase() !== docenteId.toLowerCase());
      localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(updated));
      return updated;
    });
  };

  const addOrUpdateUbicacion = (ubic: Ubicacion) => {
    if (role !== 'ADMIN') return;
    setUbicaciones((prev) => {
      const idx = prev.findIndex((u) => u.codigo.toLowerCase() === ubic.codigo.toLowerCase());
      const updated = idx >= 0 ? prev.map((u, i) => (i === idx ? ubic : u)) : [...prev, ubic];
      localStorage.setItem(STORAGE_KEYS.UBICACIONES, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteUbicacion = (codigo: string) => {
    if (role !== 'ADMIN') return;
    setUbicaciones((prev) => {
      const updated = prev.filter((u) => u.codigo.toLowerCase() !== codigo.toLowerCase());
      localStorage.setItem(STORAGE_KEYS.UBICACIONES, JSON.stringify(updated));
      return updated;
    });
  };

  const addOrUpdateTipo = (tp: TipoDef) => {
    if (role !== 'ADMIN') return;
    setTipos((prev) => {
      const idx = prev.findIndex((t) => t.codigo.toUpperCase() === tp.codigo.toUpperCase());
      const updated = idx >= 0 ? prev.map((t, i) => (i === idx ? tp : t)) : [...prev, tp];
      localStorage.setItem(STORAGE_KEYS.TIPOS, JSON.stringify(updated));
      return updated;
    });
  };

  const addOrUpdateHorarioSlot = (slot: HorarioTramo): { success: boolean; error?: string } => {
    if (role !== 'ADMIN') {
      return { success: false, error: 'Permisos insuficientes: solo el administrador puede modificar horarios.' };
    }

    // 1. Validate times
    const startMin = timeToMinutes(slot.hora_inicio);
    const endMin = timeToMinutes(slot.hora_fin);
    if (isNaN(startMin) || isNaN(endMin) || endMin <= startMin) {
      return { success: false, error: 'La hora de fin debe ser posterior a la hora de inicio.' };
    }

    // 2. Overlap check on the same day for this teacher
    const normDay = normalizeDia(slot.día);
    const slotDocId = (slot.docente_id || '').trim().toLowerCase();
    const hasOverlap = horarios.some((h) => {
      // Exclude current slot if editing
      if (slot.id && h.id === slot.id) return false;
      const hDocId = (h.docente_id || '').trim().toLowerCase();
      if (!hDocId || !slotDocId || hDocId !== slotDocId) return false;
      if (normalizeDia(h.día) !== normDay) return false;

      const hStart = timeToMinutes(h.hora_inicio);
      const hEnd = timeToMinutes(h.hora_fin);
      // Overlap condition: startA < endB && endA > startB
      return startMin < hEnd && endMin > hStart;
    });

    if (hasOverlap) {
      return { success: false, error: 'Este tramo se solapa con otro tramo del horario del docente.' };
    }

    // 3. Duplicate check
    const isDuplicate = horarios.some((h) => {
      if (slot.id && h.id === slot.id) return false;
      const hDocId = (h.docente_id || '').trim().toLowerCase();
      if (!hDocId || !slotDocId || hDocId !== slotDocId) return false;
      if (normalizeDia(h.día) !== normDay) return false;
      return (
        h.hora_inicio === slot.hora_inicio &&
        h.hora_fin === slot.hora_fin &&
        (h.actividad || '').trim().toLowerCase() === (slot.actividad || '').trim().toLowerCase() &&
        (h.grupo || '').trim().toLowerCase() === (slot.grupo || '').trim().toLowerCase() &&
        (h.ubicación || '').trim().toLowerCase() === (slot.ubicación || '').trim().toLowerCase()
      );
    });

    if (isDuplicate) {
      return { success: false, error: 'Ya existe un tramo idéntico en el horario del docente.' };
    }

    const slotId = slot.id || `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const preparedSlot: HorarioTramo = {
      ...slot,
      id: slotId,
      curso_escolar: slot.curso_escolar || cursoEscolar,
      grupo: slot.grupo ? slot.grupo.trim() : '',
      ubicación: slot.ubicación ? slot.ubicación.trim() : '',
      actividad: slot.actividad.trim(),
    };

    setHorarios((prev) => {
      const idx = slot.id ? prev.findIndex((h) => h.id === slot.id) : -1;
      const updated = idx >= 0 ? prev.map((h, i) => (i === idx ? preparedSlot : h)) : [...prev, preparedSlot];
      localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(updated));
      return updated;
    });

    setHasManualScheduleEdits(true);
    localStorage.setItem(STORAGE_KEYS.HAS_MANUAL_EDITS, 'true');

    return { success: true };
  };

  const deleteHorarioSlot = (slotId: string): { success: boolean; error?: string } => {
    if (role !== 'ADMIN') {
      return { success: false, error: 'Permisos insuficientes: solo el administrador puede eliminar tramos.' };
    }

    setHorarios((prev) => {
      const updated = prev.filter((h) => h.id !== slotId);
      localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(updated));
      return updated;
    });

    setHasManualScheduleEdits(true);
    localStorage.setItem(STORAGE_KEYS.HAS_MANUAL_EDITS, 'true');

    return { success: true };
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole: handleSetRole,
        isAdmin: role === 'ADMIN',
        adminPin: '',
        verifyPassword: verifyAdminPassword,
        changePassword: handleChangePassword,
        recoveryEmail,
        updateRecoveryEmail: handleUpdateRecoveryEmail,
        isSyncing,
        lastSyncTime,
        syncWithSheets,
        pushToSheets,
        horarios,
        docentes,
        ubicaciones,
        tipos,
        refuerzos,
        cursoEscolar,
        isDemoData,
        hasManualScheduleEdits,
        importExcelData,
        loadDemoData,
        clearAllData,
        setCursoEscolar,
        addOrUpdateDocente,
        deleteDocente,
        addOrUpdateUbicacion,
        deleteUbicacion,
        addOrUpdateTipo,
        addOrUpdateHorarioSlot,
        deleteHorarioSlot,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
