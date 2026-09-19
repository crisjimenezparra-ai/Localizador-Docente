import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { exportExcelTemplate, parseAndValidateExcel } from '../services/excelService';
import { CategoriaMaestra, Docente, ExcelValidationResult, TipoDef, Ubicacion } from '../types';
import { ActivityBadge } from '../components/ActivityBadge';
import { GestionarHorarioDocente } from '../components/admin/GestionarHorarioDocente';
import { AdminSecuritySection } from '../components/admin/AdminSecuritySection';
import { ActividadProfesoradoView } from './ActividadProfesoradoView';
import {
  areLocationsEquivalent,
  generateDocenteIdFromName,
  isSystemLocation,
  normalizeLocation,
  TUTORIA_OPTIONS,
} from '../utils/locationUtils';
import { getMasterCategory, MASTER_CATEGORIES } from '../utils/activityStyles';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  Plus,
  ShieldCheck,
  Calendar,
  Users,
  MapPin,
  Tag,
  Search,
  Edit3,
  Check,
  X,
  Clock,
  KeyRound,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export type AdminTabType =
  | 'import'
  | 'docentes'
  | 'ubicaciones'
  | 'tipos'
  | 'actividad'
  | 'seguridad';

interface AdminViewProps {
  initialTab?: AdminTabType;
  activeSubTab?: AdminTabType;
  onSubTabChange?: (tab: AdminTabType) => void;
}

/**
 * Helper to display docente tutoría or '—'
 */
function getDocenteTutoria(d: Docente): string {
  if (d.tutoria && d.tutoria.trim() && d.tutoria !== 'Sin tutoría') {
    return d.tutoria.trim();
  }
  const combined = `${d.especialidad || ''} ${d.observaciones || ''}`.toUpperCase();
  if (combined.includes('TUTOR')) {
    if (combined.includes('INF 3') || combined.includes('3 ANOS') || combined.includes('3 AÑOS')) return 'INF 3';
    if (combined.includes('INF 4') || combined.includes('4 ANOS') || combined.includes('4 AÑOS')) return 'INF 4';
    if (combined.includes('INF 5A') || combined.includes('5 ANOS A') || combined.includes('5 AÑOS A')) return 'INF 5A';
    if (combined.includes('INF 5B') || combined.includes('5 ANOS B') || combined.includes('5 AÑOS B')) return 'INF 5B';
    if (combined.includes('5ºA') || combined.includes('5º A') || combined.includes('5A')) return '5ºA';
    if (combined.includes('5ºB') || combined.includes('5º B') || combined.includes('5B')) return '5ºB';
    if (combined.includes('1º')) return '1º';
    if (combined.includes('2º')) return '2º';
    if (combined.includes('3º')) return '3º';
    if (combined.includes('4º')) return '4º';
    if (combined.includes('6º')) return '6º';
  }
  return '—';
}

export const AdminView: React.FC<AdminViewProps> = ({
  initialTab = 'import',
  activeSubTab,
  onSubTabChange,
}) => {
  const {
    isAdmin,
    horarios,
    docentes,
    ubicaciones,
    tipos,
    cursoEscolar,
    isDemoData,
    hasManualScheduleEdits,
    importExcelData,
    clearAllData,
    addOrUpdateDocente,
    deleteDocente,
    addOrUpdateUbicacion,
    deleteUbicacion,
    addOrUpdateTipo,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docenteFormRef = useRef<HTMLDivElement>(null);

  // Sub-tabs in admin (controlled via props if provided, or internal fallback)
  const [internalAdminTab, setInternalAdminTab] = useState<AdminTabType>(initialTab);
  const adminTab = activeSubTab !== undefined ? activeSubTab : internalAdminTab;
  const setAdminTab = onSubTabChange ?? setInternalAdminTab;

  const [managingDocenteSchedule, setManagingDocenteSchedule] = useState<Docente | null>(null);

  // Clear managing docente schedule when tab changes
  useEffect(() => {
    setManagingDocenteSchedule(null);
  }, [adminTab]);

  // Excel Parsing & Review State
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [validationResult, setValidationResult] = useState<ExcelValidationResult | null>(null);
  const [showExcelStructure, setShowExcelStructure] = useState(false);
  const [incidenciasFilter, setIncidenciasFilter] = useState<'all' | 'errors' | 'warnings'>('all');

  // In-app Status Message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // In-app Confirmation Modal
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Double-protected Clear All Confirmation
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');

  // Docente editing state
  const [editingDocenteOriginalId, setEditingDocenteOriginalId] = useState<string | null>(null);
  const [docenteSearchQuery, setDocenteSearchQuery] = useState('');
  const [docenteForm, setDocenteForm] = useState<{
    nombre_docente: string;
    especialidad: string;
    tutoria: string;
    email?: string;
    telefono?: string;
    observaciones?: string;
  }>({
    nombre_docente: '',
    especialidad: '',
    tutoria: 'Sin tutoría',
  });

  // Ubicacion & Tipo states
  const [newUbicacion, setNewUbicacion] = useState<Ubicacion>({
    codigo: '',
    nombre: '',
    planta: '',
  });
  const [newTipo, setNewTipo] = useState<{
    codigo: string;
    nombre: string;
    categoria: CategoriaMaestra;
  }>({
    codigo: '',
    nombre: '',
    categoria: 'DOCENCIA',
  });

  // Role Access Guard
  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md mx-auto mt-12">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Acceso restringido</h2>
        <p className="text-xs text-slate-500 mt-2">
          La sección de Administración requiere credenciales de Administrador.
        </p>
      </div>
    );
  }

  // Handle Excel file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setStatusMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseAndValidateExcel(buffer);
      setValidationResult(result);
    } catch (error) {
      console.error('Error al procesar el archivo Excel', error);
      setStatusMessage({
        type: 'error',
        text: 'Error al leer el archivo. Asegúrese de que sea un archivo Excel válido (.xlsx o .xls).',
      });
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = () => {
    if (!validationResult) return;
    importExcelData(validationResult);
    setStatusMessage({
      type: 'success',
      text: `¡Importación completada con éxito! Se han guardado ${validationResult.validRows?.length ?? 0} tramos horarios y ${validationResult.docentesList?.length ?? 0} docentes para el curso ${validationResult.cursoDetectado || cursoEscolar}.`,
    });
    setValidationResult(null);
  };

  const handleCancelImport = () => {
    setValidationResult(null);
  };

  // Protected Clear all data handler with verification modal
  const handleClearAllClick = () => {
    setClearAllConfirmText('');
    setClearAllModalOpen(true);
  };

  const handleExecuteClearAll = () => {
    if (clearAllConfirmText.trim().toUpperCase() !== 'BORRAR') return;
    clearAllData();
    setClearAllModalOpen(false);
    setClearAllConfirmText('');
    setStatusMessage({
      type: 'success',
      text: 'Se han eliminado todos los horarios y docentes cargados con éxito.',
    });
  };

  // Teacher editing handlers
  const handleStartEditDocente = (doc: Docente) => {
    setEditingDocenteOriginalId(doc.docente_id);
    let tut = doc.tutoria || 'Sin tutoría';
    if (!doc.tutoria) {
      const derived = getDocenteTutoria(doc);
      if (derived !== '—') tut = derived;
    }
    setDocenteForm({
      nombre_docente: doc.nombre_docente,
      especialidad: doc.especialidad || '',
      tutoria: tut,
      email: doc.email || '',
      telefono: doc.telefono || '',
      observaciones: doc.observaciones || '',
    });
    docenteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleCancelEditDocente = () => {
    setEditingDocenteOriginalId(null);
    setDocenteForm({
      nombre_docente: '',
      especialidad: '',
      tutoria: 'Sin tutoría',
    });
  };

  const handleSaveDocente = (e: React.FormEvent) => {
    e.preventDefault();
    const name = docenteForm.nombre_docente.trim();
    if (!name) {
      setStatusMessage({
        type: 'error',
        text: 'El Nombre Completo del docente es obligatorio.',
      });
      return;
    }

    let finalId = editingDocenteOriginalId;
    if (!finalId) {
      // Auto generate slug ID from full name: ana_belen_gallego_martinez
      finalId = generateDocenteIdFromName(name, docentes);
    }

    const docenteToSave: Docente = {
      docente_id: finalId,
      nombre_docente: name,
      especialidad: docenteForm.especialidad.trim() || undefined,
      tutoria: docenteForm.tutoria !== 'Sin tutoría' ? docenteForm.tutoria : undefined,
      email: docenteForm.email || undefined,
      telefono: docenteForm.telefono || undefined,
      observaciones: docenteForm.observaciones || undefined,
    };

    addOrUpdateDocente(docenteToSave, editingDocenteOriginalId || undefined);
    const wasEditing = !!editingDocenteOriginalId;
    handleCancelEditDocente();
    setStatusMessage({
      type: 'success',
      text: wasEditing
        ? `Docente "${name}" actualizado correctamente.`
        : `Docente "${name}" añadido con éxito.`,
    });
  };

  const handleDeleteDocenteClick = (doc: Docente) => {
    setConfirmDialog({
      title: `¿Eliminar al docente ${doc.nombre_docente}?`,
      message: `Se eliminará el docente "${doc.nombre_docente}" y también se retirarán todos sus tramos horarios asignados.`,
      confirmLabel: 'Eliminar Docente',
      isDestructive: true,
      onConfirm: () => {
        deleteDocente(doc.docente_id);
        setConfirmDialog(null);
        setStatusMessage({
          type: 'success',
          text: `Docente "${doc.nombre_docente}" eliminado con éxito.`,
        });
      },
    });
  };

  // Location handler with normalization duplicate prevention
  const handleSaveUbicacion = () => {
    const rawCode = newUbicacion.codigo.trim();
    if (!rawCode) {
      setStatusMessage({ type: 'error', text: 'El código o aula es obligatorio.' });
      return;
    }

    if (isSystemLocation(rawCode)) {
      setStatusMessage({
        type: 'error',
        text: '«NO ESPECIFICADA» es un estado reservado del sistema y no puede crearse como aula ordinaria.',
      });
      return;
    }

    const existing = ubicaciones.find((u) => areLocationsEquivalent(u.codigo, rawCode));
    if (existing) {
      setStatusMessage({
        type: 'error',
        text: `Ya existe una ubicación equivalente: ${existing.codigo}`,
      });
      return;
    }

    addOrUpdateUbicacion({
      codigo: rawCode,
      nombre: newUbicacion.nombre.trim() || rawCode,
      planta: newUbicacion.planta?.trim() || undefined,
    });
    setNewUbicacion({ codigo: '', nombre: '', planta: '' });
    setStatusMessage({ type: 'success', text: `Ubicación "${rawCode}" guardada correctamente.` });
  };

  const handleDeleteUbicacionClick = (ubic: Ubicacion) => {
    const usageCount = horarios.filter((h) => areLocationsEquivalent(h.ubicación, ubic.codigo)).length;
    setConfirmDialog({
      title: `¿Eliminar ubicación ${ubic.codigo}?`,
      message:
        usageCount > 0
          ? `Esta ubicación está siendo utilizada en ${usageCount} tramos horarios. Se recomienda no eliminarla o reasignar dichos tramos previamente.`
          : `Se retirará "${ubic.nombre || ubic.codigo}" del listado de ubicaciones registradas.`,
      confirmLabel: 'Eliminar Ubicación',
      isDestructive: true,
      onConfirm: () => {
        deleteUbicacion(ubic.codigo);
        setConfirmDialog(null);
        setStatusMessage({
          type: 'success',
          text: `Ubicación "${ubic.codigo}" eliminada.`,
        });
      },
    });
  };

  // Filter docentes for display
  const filteredDocentes = useMemo(() => {
    const q = (docenteSearchQuery || '').trim().toLowerCase();
    if (!q) return docentes;
    return (docentes || []).filter(
      (d) =>
        (d?.nombre_docente && d.nombre_docente.toLowerCase().includes(q)) ||
        (d?.especialidad && d.especialidad.toLowerCase().includes(q)) ||
        (d?.tutoria && d.tutoria.toLowerCase().includes(q))
    );
  }, [docentes, docenteSearchQuery]);

  // Count schedules for each teacher
  const schedulesCountByTeacher = useMemo(() => {
    const counts: Record<string, number> = {};
    (horarios || []).forEach((h) => {
      const key = (h?.docente_id || '').trim().toLowerCase();
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [horarios]);

  // Filter out system location from ordinary view
  const ordinaryUbicaciones = useMemo(() => {
    return ubicaciones.filter((u) => !isSystemLocation(u.codigo));
  }, [ubicaciones]);

  const hasSystemLocation = useMemo(() => {
    return ubicaciones.some((u) => isSystemLocation(u.codigo));
  }, [ubicaciones]);

  return (
    <div id="view-admin" className="w-full space-y-6">
      {/* 1. Header Card (Updated per Requirement 2) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Administración
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gestión del centro: profesorado, ubicaciones, horarios y configuración.
            </p>
          </div>
        </div>
      </div>

      {/* In-App Status Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-start justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-sm">
                {statusMessage.type === 'success' ? 'Operación exitosa' : 'Aviso'}
              </h4>
              <p className="text-xs mt-0.5">{statusMessage.text}</p>
            </div>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Mobile Sub-tab Selector (< lg only) */}
      <div className="lg:hidden bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <label
          htmlFor="select-admin-subtab-mobile"
          className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
        >
          Sección de administración:
        </label>
        <div className="relative">
          <select
            id="select-admin-subtab-mobile"
            value={adminTab}
            onChange={(e) => {
              setAdminTab(e.target.value as AdminTabType);
              setManagingDocenteSchedule(null);
            }}
            className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none cursor-pointer pr-10"
          >
            <optgroup label="DATOS">
              <option value="import">Importar Excel</option>
              <option value="docentes">Docentes ({docentes.length})</option>
              <option value="ubicaciones">Ubicaciones ({ordinaryUbicaciones.length})</option>
              <option value="tipos">Tipos de actividad ({tipos.length})</option>
            </optgroup>
            <optgroup label="HERRAMIENTAS">
              <option value="actividad">Actividad del profesorado</option>
            </optgroup>
            <optgroup label="CONFIGURACIÓN">
              <option value="seguridad">Acceso y seguridad</option>
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Content Area - Full Available Width */}
      <div className="w-full space-y-6">
        {/* TAB 1: IMPORT EXCEL */}
          {adminTab === 'import' && (
            <div className="space-y-6">
              {!validationResult && (
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
                  {/* Clean Section Header per Requirement 3 */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Importar horarios
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Selecciona o arrastra el archivo Excel estructurado de Localizador Docente.
                    </p>
                  </div>

                  {/* Upload Dropzone */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="excel-file-input"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-8 text-center cursor-pointer transition"
                    >
                      <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                      <p className="text-base font-bold text-slate-900">
                        Seleccionar o arrastrar archivo Excel
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formatos compatibles: .xlsx y .xls
                      </p>
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        <span>Seleccionar archivo</span>
                      </button>
                    </div>
                  </div>

                  {isProcessingFile && (
                    <div className="text-center text-sm font-semibold text-emerald-600 animate-pulse">
                      Analizando y validando estructura del libro Excel...
                    </div>
                  )}

                  {/* Compact Current Database Stats per Requirement 3 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">Base de datos actual:</span>
                      <span className="text-slate-600 ml-2">
                        {horarios.length} tramos · {docentes.length} docentes
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {isDemoData ? 'Datos de demostración activos' : 'Datos importados'}
                    </span>
                  </div>

                  {/* Official Template Action per Requirement 2 & 3 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">Plantilla oficial de importación</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Descarga el archivo Excel preformateado con las hojas y columnas necesarias.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={exportExcelTemplate}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 shadow-2xs transition cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Descargar plantilla Excel</span>
                    </button>
                  </div>

                  {/* Collapsible Expected Structure per Requirement 4 */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExcelStructure(!showExcelStructure)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      {showExcelStructure ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span>Ver estructura esperada del Excel</span>
                    </button>

                    {showExcelStructure && (
                      <div className="mt-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 animate-in fade-in">
                        <p className="font-bold text-slate-900">Hojas reconocidas en el libro Excel:</p>
                        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 list-disc pl-4 font-mono text-[11px] text-slate-600">
                          <li>1. DOCENTES</li>
                          <li>2. HORARIOS (Principal)</li>
                          <li>3. UBICACIONES</li>
                          <li>4. TIPOS</li>
                          <li>5. REFUERZOS_CENTRO</li>
                          <li>6. INSTRUCCIONES</li>
                        </ul>
                        <p className="text-slate-500 text-[11px] italic mt-2">
                          Se comprueba la existencia de campos obligatorios y se evitan duplicados antes de confirmar.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PRE-IMPORT REVIEW SCREEN */}
              {validationResult && (() => {
                const validCount = validationResult.validRows?.length ?? 0;
                const errorCount = validationResult.errorRows?.length ?? (validationResult as any).errors?.length ?? 0;
                const warningCount = validationResult.warningRows?.length ?? (validationResult as any).warnings?.length ?? 0;
                const totalIssues = errorCount + warningCount;

                const rawErrors = validationResult.errorRows || (validationResult as any).errors || [];
                const rawWarnings = validationResult.warningRows || (validationResult as any).warnings || [];

                const errorsList = rawErrors.map((err: any) => ({ ...err, type: 'error' as const }));
                const warningsList = rawWarnings.map((warn: any) => ({ ...warn, type: 'warning' as const }));

                const displayedIssues =
                  incidenciasFilter === 'errors'
                    ? errorsList
                    : incidenciasFilter === 'warnings'
                    ? warningsList
                    : [...errorsList, ...warningsList];

                const parseIssue = (item: { rowNumber: number; data: any; reason: string; type: 'error' | 'warning' }) => {
                  const d = item.data || {};
                  const docente =
                    d.nombreDocente ||
                    d.nombre_docente ||
                    d.NOMBRE_DOCENTE ||
                    d.docente ||
                    d.DOCENTE ||
                    d.docenteId ||
                    d.docente_id ||
                    'Docente no especificado';

                  const dia = d.dia || d.día || d.dia_semana || d.DIA || '';
                  const horaInicio = d.horaInicio || d.hora_inicio || d.HORA_INICIO || '';
                  const horaFin = d.horaFin || d.hora_fin || d.HORA_FIN || '';
                  const actividad = d.actividad || d.materia || d.ACTIVIDAD || d.MATERIA || '';
                  const grupo = d.grupo || d.GRUPO || '';
                  const ubicacion = d.ubicacion || d.ubicación || d.UBICACION || '';
                  const conflictingWith = d.conflictingWith;

                  return {
                    docente,
                    dia,
                    horaInicio,
                    horaFin,
                    actividad,
                    grupo,
                    ubicacion,
                    conflictingWith,
                  };
                };

                return (
                  <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 space-y-6 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          Revisión previa a la importación
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Revise el estado de los datos detectados antes de proceder a guardarlos.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          id="btn-cancel-import"
                          onClick={handleCancelImport}
                          className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar Importación
                        </button>
                        <button
                          id="btn-confirm-import"
                          onClick={handleConfirmImport}
                          disabled={validCount === 0}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          Confirmar y Guardar ({validCount} tramos)
                        </button>
                      </div>
                    </div>

                    {/* Prominent Safety Alert when Critical Errors Exist */}
                    {errorCount > 0 && (
                      <div
                        id="alert-omitted-error-rows"
                        className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3 animate-in fade-in"
                      >
                        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-amber-950">
                            Se omitirán {errorCount} {errorCount === 1 ? 'tramo' : 'tramos'} con errores. Revisa las incidencias antes de continuar.
                          </h4>
                          <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                            Los tramos con errores críticos se descartarán para garantizar la integridad y coherencia de los horarios. Puedes consultar el motivo exacto de cada exclusión en el bloque de <strong>Detalle de incidencias</strong> a continuación.
                          </p>
                        </div>
                      </div>
                    )}

                    {hasManualScheduleEdits && (
                      <div
                        id="alert-manual-edits-overwrite"
                        className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3 animate-in fade-in"
                      >
                        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-950">
                            Aviso sobre modificaciones manuales
                          </h4>
                          <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                            Existen horarios modificados manualmente en la aplicación. La importación puede sustituir estos cambios.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* SUMMARY METRIC CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Filas Correctas</span>
                        </div>
                        <p className="text-2xl font-black text-emerald-900 mt-2">
                          {validCount}
                        </p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Tramos horarios listos para indexar
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                          <AlertTriangle className="w-5 h-5" />
                          <span>Advertencias</span>
                        </div>
                        <p className="text-2xl font-black text-amber-900 mt-2">
                          {warningCount}
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Incidencias menores no bloqueantes
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                          <XCircle className="w-5 h-5" />
                          <span>Errores Críticos</span>
                        </div>
                        <p className="text-2xl font-black text-red-900 mt-2">
                          {errorCount}
                        </p>
                        <p className="text-xs text-red-700 mt-0.5">
                          Filas omitidas por incoherencia
                        </p>
                      </div>
                    </div>

                    {/* BLOQUE DETALLE DE INCIDENCIAS */}
                    {totalIssues > 0 && (
                      <div id="bloque-detalle-incidencias" className="space-y-4 pt-3 border-t border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              <AlertTriangle className={`w-4 h-4 ${errorCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
                              <span>Detalle de incidencias</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {errorCount > 0
                                ? `Revisa los datos de las ${errorCount} ${errorCount === 1 ? 'fila rechazada' : 'filas rechazadas'} y el motivo del descarte.`
                                : 'Advertencias detectadas en los datos del archivo.'}
                            </p>
                          </div>

                          {errorCount > 0 && warningCount > 0 && (
                            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => setIncidenciasFilter('all')}
                                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                  incidenciasFilter === 'all'
                                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Todas ({totalIssues})
                              </button>
                              <button
                                type="button"
                                onClick={() => setIncidenciasFilter('errors')}
                                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                  incidenciasFilter === 'errors'
                                    ? 'bg-red-600 text-white shadow-2xs font-bold'
                                    : 'text-red-700 hover:text-red-900'
                                }`}
                              >
                                Errores críticos ({errorCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => setIncidenciasFilter('warnings')}
                                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                  incidenciasFilter === 'warnings'
                                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                                    : 'text-amber-700 hover:text-amber-900'
                                }`}
                              >
                                Advertencias ({warningCount})
                              </button>
                            </div>
                          )}
                        </div>

                        {/* DESKTOP TABLE VIEW */}
                        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4 w-44">Incidencia</th>
                                <th className="py-3 px-4 w-52">Docente</th>
                                <th className="py-3 px-4 w-36">Día y Horas</th>
                                <th className="py-3 px-4 w-44">Actividad / Espacio</th>
                                <th className="py-3 px-4">Motivo del rechazo / Diagnóstico</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {displayedIssues.map((item, idx) => {
                                const isError = item.type === 'error';
                                const details = parseIssue(item);
                                return (
                                  <tr
                                    key={`desk-issue-${item.type}-${item.rowNumber}-${idx}`}
                                    className={`transition ${isError ? 'hover:bg-red-50/40' : 'hover:bg-amber-50/40'}`}
                                  >
                                    <td className="py-3.5 px-4 align-top">
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                                          isError
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}
                                      >
                                        {isError ? (
                                          <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                        ) : (
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        )}
                                        <span>
                                          {isError ? 'Error crítico' : 'Advertencia'} · Fila {item.rowNumber}
                                        </span>
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 align-top">
                                      <span className="font-bold text-slate-900 block">{details.docente}</span>
                                    </td>
                                    <td className="py-3.5 px-4 align-top">
                                      <span className="font-semibold text-slate-800 block">
                                        {details.dia || '—'}
                                      </span>
                                      <span className="text-slate-500 font-mono text-[11px] block mt-0.5">
                                        {details.horaInicio && details.horaFin
                                          ? `${details.horaInicio}–${details.horaFin}`
                                          : '—'}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 align-top">
                                      <span className="font-semibold text-slate-800 block">
                                        {details.actividad || '—'}
                                      </span>
                                      {(details.grupo || details.ubicacion) && (
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                          {details.grupo && <span>Grupo: {details.grupo}</span>}
                                          {details.grupo && details.ubicacion && <span> · </span>}
                                          {details.ubicacion && <span>Ubic.: {details.ubicacion}</span>}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 align-top">
                                      <div className="space-y-1.5">
                                        <div
                                          className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                                            isError
                                              ? 'bg-red-50 text-red-950 border border-red-200'
                                              : 'bg-amber-50 text-amber-950 border border-amber-200'
                                          }`}
                                        >
                                          <strong className="font-semibold">Motivo: </strong>
                                          <span>{item.reason}</span>
                                        </div>

                                        {details.conflictingWith && (
                                          <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-300 text-[11px] text-red-950 flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1 font-bold text-red-900">
                                              <AlertTriangle className="w-3 h-3 text-red-700 shrink-0" />
                                              <span>Conflicto con Fila {details.conflictingWith.rowNumber}:</span>
                                            </div>
                                            <p className="text-slate-800 pl-4 font-medium">
                                              <strong>
                                                {details.conflictingWith.nombreDocente || details.conflictingWith.docenteId}
                                              </strong>
                                              {details.conflictingWith.dia ? ` · ${details.conflictingWith.dia}` : ''}
                                              {details.conflictingWith.horaInicio && details.conflictingWith.horaFin
                                                ? ` · ${details.conflictingWith.horaInicio}–${details.conflictingWith.horaFin}`
                                                : ''}
                                              {details.conflictingWith.actividad ? ` · ${details.conflictingWith.actividad}` : ''}
                                              {details.conflictingWith.grupo ? ` · Grupo: ${details.conflictingWith.grupo}` : ''}
                                              {details.conflictingWith.ubicacion ? ` · Ubic.: ${details.conflictingWith.ubicacion}` : ''}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* MOBILE VERTICAL CARDS */}
                        <div className="block md:hidden space-y-3">
                          {displayedIssues.map((item, idx) => {
                            const isError = item.type === 'error';
                            const details = parseIssue(item);
                            return (
                              <div
                                key={`mob-issue-${item.type}-${item.rowNumber}-${idx}`}
                                className={`p-4 rounded-xl border ${
                                  isError
                                    ? 'bg-red-50/40 border-red-200'
                                    : 'bg-amber-50/40 border-amber-200'
                                } space-y-2.5`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                                      isError
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {isError ? (
                                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    ) : (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    )}
                                    <span>
                                      {isError ? 'Error crítico' : 'Advertencia'} · Fila {item.rowNumber}
                                    </span>
                                  </span>
                                </div>

                                <div>
                                  <h5 className="font-bold text-slate-900 text-sm">{details.docente}</h5>
                                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                                    {details.dia ? details.dia : 'Día no especificado'}
                                    {details.horaInicio && details.horaFin ? ` · ${details.horaInicio}–${details.horaFin}` : ''}
                                  </p>
                                </div>

                                {(details.actividad || details.grupo || details.ubicacion) && (
                                  <div className="text-xs bg-white/90 p-2.5 rounded-lg border border-slate-200 space-y-0.5 text-slate-700">
                                    {details.actividad && (
                                      <p>
                                        <strong className="text-slate-900 font-semibold">Actividad:</strong> {details.actividad}
                                      </p>
                                    )}
                                    {(details.grupo || details.ubicacion) && (
                                      <p>
                                        {details.grupo && (
                                          <span>
                                            <strong className="text-slate-900 font-semibold">Grupo:</strong> {details.grupo}
                                          </span>
                                        )}
                                        {details.grupo && details.ubicacion && <span> · </span>}
                                        {details.ubicacion && (
                                          <span>
                                            <strong className="text-slate-900 font-semibold">Ubicación:</strong> {details.ubicacion}
                                          </span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                )}

                                <div
                                  className={`p-3 rounded-lg text-xs leading-relaxed ${
                                    isError
                                      ? 'bg-red-100/70 text-red-950 border border-red-200'
                                      : 'bg-amber-100/70 text-amber-950 border border-amber-200'
                                  }`}
                                >
                                  <strong className="font-semibold">Motivo: </strong>
                                  <span>{item.reason}</span>

                                  {details.conflictingWith && (
                                    <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-950 space-y-1">
                                      <div className="flex items-center gap-1 font-bold text-red-900">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                        <span>Conflicto con Fila {details.conflictingWith.rowNumber}:</span>
                                      </div>
                                      <p className="text-slate-800 font-medium pl-4">
                                        <strong>
                                          {details.conflictingWith.nombreDocente || details.conflictingWith.docenteId}
                                        </strong>
                                        {details.conflictingWith.dia ? ` · ${details.conflictingWith.dia}` : ''}
                                        {details.conflictingWith.horaInicio && details.conflictingWith.horaFin
                                          ? ` · ${details.conflictingWith.horaInicio}–${details.conflictingWith.horaFin}`
                                          : ''}
                                        {details.conflictingWith.actividad ? ` · ${details.conflictingWith.actividad}` : ''}
                                        {details.conflictingWith.grupo ? ` · Grupo: ${details.conflictingWith.grupo}` : ''}
                                        {details.conflictingWith.ubicacion ? ` · Ubic.: ${details.conflictingWith.ubicacion}` : ''}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Advanced Actions Zone: Clear database per Requirement 5 */}
              <div className="pt-4 border-t border-slate-200">
                <div className="p-5 rounded-2xl bg-red-50/30 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                      Acciones avanzadas
                    </h4>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      Limpieza de la base de datos
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Elimina todos los datos existentes para iniciar una configuración limpia.
                    </p>
                  </div>
                  <button
                    id="btn-clear-all-data"
                    type="button"
                    onClick={handleClearAllClick}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-300 text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>Limpiar todos los datos</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GESTIÓN DE DOCENTES (Updated per Requirements 6, 7, 8, 9, 10, 11) */}
          {adminTab === 'docentes' && (
            managingDocenteSchedule ? (
              <GestionarHorarioDocente
                docente={managingDocenteSchedule}
                onBack={() => setManagingDocenteSchedule(null)}
              />
            ) : (
              <div className="space-y-6">
                {/* Simplified Docente Form: Only Name, Specialty, Tutoring */}
                <div
                  ref={docenteFormRef}
                  className={`rounded-2xl p-6 border shadow-xs transition ${
                    editingDocenteOriginalId
                      ? 'bg-blue-50/40 border-blue-300 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {editingDocenteOriginalId ? (
                        <>
                          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-600 text-white">
                            Modo Edición
                          </span>
                          <h3 className="text-base font-bold text-slate-900">
                            Editando docente: <span className="text-emerald-700">{docenteForm.nombre_docente}</span>
                          </h3>
                        </>
                      ) : (
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Plus className="w-4 h-4 text-emerald-600" />
                          <span>Añadir Nuevo Docente</span>
                        </h3>
                      )}
                    </div>

                    {editingDocenteOriginalId && (
                      <button
                        type="button"
                        onClick={handleCancelEditDocente}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveDocente}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* FIELD 1: NOMBRE COMPLETO */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Nombre completo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="ej. Ana Belén Gallego Martínez"
                          value={docenteForm.nombre_docente}
                          onChange={(e) =>
                            setDocenteForm({ ...docenteForm, nombre_docente: e.target.value })
                          }
                          className="w-full text-xs font-medium p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>

                      {/* FIELD 2: ESPECIALIDAD / FUNCIÓN */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Especialidad / Función
                        </label>
                        <input
                          type="text"
                          placeholder="ej. Música, Inglés, Primaria, PT"
                          value={docenteForm.especialidad}
                          onChange={(e) =>
                            setDocenteForm({ ...docenteForm, especialidad: e.target.value })
                          }
                          className="w-full text-xs font-medium p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>

                      {/* FIELD 3: TUTORÍA (DROPDOWN per Requirement 7) */}
                      <div>
                        <label
                          htmlFor="select-docente-tutoria"
                          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                        >
                          Tutoría
                        </label>
                        <div className="relative">
                          <select
                            id="select-docente-tutoria"
                            value={docenteForm.tutoria}
                            onChange={(e) =>
                              setDocenteForm({ ...docenteForm, tutoria: e.target.value })
                            }
                            className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
                          >
                            {TUTORIA_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-5">
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {editingDocenteOriginalId
                            ? 'Guardar Cambios del Docente'
                            : 'Añadir Docente'}
                        </span>
                      </button>

                      {editingDocenteOriginalId && (
                        <button
                          type="button"
                          onClick={handleCancelEditDocente}
                          className="px-4 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Docentes List: Columns DOCENTE | ESPECIALIDAD / FUNCIÓN | TUTORÍA | TRAMOS | ACCIONES */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-sm text-slate-900">
                        Docentes Registrados ({docentes.length})
                      </h3>
                    </div>

                    {/* Search filter */}
                    <div className="w-full sm:w-72 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Buscar por docente o especialidad..."
                        value={docenteSearchQuery}
                        onChange={(e) => setDocenteSearchQuery(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {docentes.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                      No hay docentes registrados. Puede añadir uno arriba o importar un libro Excel.
                    </p>
                  ) : filteredDocentes.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                      No se encontraron docentes con el término "{docenteSearchQuery}".
                    </p>
                  ) : (
                    <>
                      {/* MOBILE CARDS (< md) */}
                      <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
                        {filteredDocentes.map((d) => {
                          const docKey = (d?.docente_id || '').trim().toLowerCase();
                          const sessionsCount = (docKey && schedulesCountByTeacher[docKey]) || 0;
                          const isCurrentlyEditing = editingDocenteOriginalId === d.docente_id;
                          const tutoriaLabel = getDocenteTutoria(d);

                          return (
                            <div
                              key={`m-doc-${d.docente_id}`}
                              className={`p-3.5 rounded-xl border transition text-xs ${
                                isCurrentlyEditing
                                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                                <div>
                                  <p className="font-bold text-sm text-slate-900 leading-tight">
                                    {d.nombre_docente}
                                  </p>
                                  {d.especialidad && (
                                    <p className="text-xs text-slate-600 mt-0.5">{d.especialidad}</p>
                                  )}
                                </div>
                                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{sessionsCount} tramos</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mb-3 text-xs">
                                <span className="text-slate-500">Tutoría:</span>
                                {tutoriaLabel !== '—' ? (
                                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    {tutoriaLabel}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">—</span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <button
                                  id={`btn-manage-schedule-mob-${d.docente_id}`}
                                  type="button"
                                  onClick={() => setManagingDocenteSchedule(d)}
                                  className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-bold px-2.5 py-2 rounded-lg text-xs transition cursor-pointer"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Gestionar horario</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDocente(d)}
                                  className="inline-flex items-center justify-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-semibold px-3 py-2 rounded-lg text-xs transition cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDocenteClick(d)}
                                  className="inline-flex items-center justify-center gap-1 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 font-semibold px-2.5 py-2 rounded-lg text-xs transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* DESKTOP TABLE (>= md) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                            <tr>
                              <th className="p-3">Docente</th>
                              <th className="p-3">Especialidad / Función</th>
                              <th className="p-3">Tutoría</th>
                              <th className="p-3">Tramos</th>
                              <th className="p-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredDocentes.map((d) => {
                              const docKey = (d?.docente_id || '').trim().toLowerCase();
                              const sessionsCount = (docKey && schedulesCountByTeacher[docKey]) || 0;
                              const isCurrentlyEditing = editingDocenteOriginalId === d.docente_id;
                              const tutoriaLabel = getDocenteTutoria(d);

                              return (
                                <tr
                                  key={d.docente_id}
                                  className={`hover:bg-slate-50 transition ${
                                    isCurrentlyEditing ? 'bg-emerald-50/60 font-medium' : ''
                                  }`}
                                >
                                  <td className="p-3">
                                    <p className="font-semibold text-slate-900">{d.nombre_docente}</p>
                                  </td>
                                  <td className="p-3 text-slate-600">
                                    {d.especialidad || '—'}
                                  </td>
                                  <td className="p-3">
                                    {tutoriaLabel !== '—' ? (
                                      <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                                        {tutoriaLabel}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-mono">—</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>
                                        {sessionsCount} {sessionsCount === 1 ? 'tramo' : 'tramos'}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="p-3 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        id={`btn-manage-schedule-${d.docente_id}`}
                                        type="button"
                                        onClick={() => setManagingDocenteSchedule(d)}
                                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer text-xs"
                                        title="Gestionar horario y tramos de este docente"
                                      >
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Gestionar horario</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditDocente(d)}
                                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-emerald-100/50 transition cursor-pointer text-xs"
                                        title="Editar datos de este docente"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Editar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDocenteClick(d)}
                                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-100/50 transition cursor-pointer text-xs"
                                        title="Eliminar este docente"
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
                    </>
                  )}
                </div>
              </div>
            )
          )}

          {/* TAB 3: GESTIÓN DE UBICACIONES (Updated per Requirements 12, 13, 14, 15, 16) */}
          {adminTab === 'ubicaciones' && (
            <div className="space-y-6">
              {/* Form to add location */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-4">Añadir Nueva Ubicación</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Código / Aula <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ej. INF 5A o Biblioteca"
                      value={newUbicacion.codigo}
                      onChange={(e) => setNewUbicacion({ ...newUbicacion, codigo: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Nombre Descriptivo
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Aula Infantil 5 años A"
                      value={newUbicacion.nombre}
                      onChange={(e) => setNewUbicacion({ ...newUbicacion, nombre: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Planta / Edificio
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Planta Baja / Infantil"
                      value={newUbicacion.planta || ''}
                      onChange={(e) => setNewUbicacion({ ...newUbicacion, planta: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveUbicacion}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                >
                  Guardar Ubicación
                </button>
              </div>

              {/* System Location Notice per Requirement 15 */}
              {hasSystemLocation && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span className="font-semibold text-slate-700">Estado del sistema:</span>
                    <span>Ubicación «NO ESPECIFICADA» gestionada para actividades sin aula asignada.</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Sistema
                  </span>
                </div>
              )}

              {/* Ubicaciones Table: CÓDIGO | NOMBRE | PLANTA / EDIFICIO | ACCIONES */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <tr>
                        <th className="p-3">Código</th>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Planta / Edificio</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ordinaryUbicaciones.map((u) => {
                        const usageCount = horarios.filter((h) =>
                          areLocationsEquivalent(h.ubicación, u.codigo)
                        ).length;

                        return (
                          <tr key={u.codigo} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-900">{u.codigo}</td>
                            <td className="p-3 text-slate-700">{u.nombre}</td>
                            <td className="p-3 text-slate-500">{u.planta || u.edificio || '—'}</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteUbicacionClick(u)}
                                className="text-red-600 hover:text-red-800 p-1 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                title={
                                  usageCount > 0
                                    ? `Utilizada en ${usageCount} tramos horarios`
                                    : 'Eliminar ubicación'
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TIPOS DE ACTIVIDAD (Updated per Requirements 17, 18, 19, 20, 21, 22) */}
          {adminTab === 'tipos' && (
            <div className="space-y-6">
              {/* Form to add activity type */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-4">Añadir Tipo de Actividad</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Código <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ej. INNOVACION"
                      value={newTipo.codigo}
                      onChange={(e) =>
                        setNewTipo({ ...newTipo, codigo: e.target.value.toUpperCase() })
                      }
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Proyectos de Innovación"
                      value={newTipo.nombre}
                      onChange={(e) => setNewTipo({ ...newTipo, nombre: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="select-tipo-categoria"
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      Categoría
                    </label>
                    <div className="relative">
                      <select
                        id="select-tipo-categoria"
                        value={newTipo.categoria}
                        onChange={(e) =>
                          setNewTipo({
                            ...newTipo,
                            categoria: e.target.value as CategoriaMaestra,
                          })
                        }
                        className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none cursor-pointer"
                      >
                        {MASTER_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newTipo.codigo.trim()) {
                      setStatusMessage({
                        type: 'error',
                        text: 'El código del tipo es obligatorio.',
                      });
                      return;
                    }
                    addOrUpdateTipo({
                      codigo: newTipo.codigo.trim(),
                      nombre: newTipo.nombre.trim() || newTipo.codigo.trim(),
                      categoria: newTipo.categoria,
                    });
                    setNewTipo({ codigo: '', nombre: '', categoria: 'DOCENCIA' });
                    setStatusMessage({
                      type: 'success',
                      text: `Tipo "${newTipo.codigo}" guardado correctamente.`,
                    });
                  }}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                >
                  Guardar Tipo
                </button>
              </div>

              {/* Cards for Activity Types per Requirement 21 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tipos.map((tp) => {
                  const masterCat = getMasterCategory(tp.categoria || tp.codigo);
                  return (
                    <div
                      key={tp.codigo}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 leading-snug truncate" title={tp.nombre}>
                          {tp.nombre}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          Código: <span className="font-semibold text-slate-700">{tp.codigo}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Categoría: <span className="font-semibold text-slate-700">{masterCat}</span>
                        </p>
                      </div>
                      <div className="shrink-0">
                        <ActivityBadge tipo={masterCat} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVIDAD DEL PROFESORADO */}
          {adminTab === 'actividad' && <ActividadProfesoradoView />}

          {/* TAB 6: ACCESO Y SEGURIDAD */}
          {adminTab === 'seguridad' && <AdminSecuritySection />}
        </div>

      {/* In-app Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  confirmDialog.isDestructive ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {confirmDialog.isDestructive ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition cursor-pointer ${
                  confirmDialog.isDestructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double-protection Clear All Data Modal per Requirement 5 */}
      {clearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  ¿Limpiar todos los datos del centro?
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Se eliminarán docentes, horarios, ubicaciones, tipos y configuración importada.
                </p>
                <div className="mt-4 p-3.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
                  <p className="font-semibold mb-1">Protección contra borrado accidental:</p>
                  <p>
                    Para confirmar la eliminación definitiva, escriba exactamente la palabra{' '}
                    <strong>BORRAR</strong> en el recuadro:
                  </p>
                  <input
                    id="input-confirm-borrar"
                    type="text"
                    value={clearAllConfirmText}
                    onChange={(e) => setClearAllConfirmText(e.target.value)}
                    placeholder="Escriba BORRAR"
                    className="mt-2 w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-red-300 rounded-lg text-red-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setClearAllModalOpen(false);
                  setClearAllConfirmText('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-all-definitively"
                disabled={clearAllConfirmText.trim().toUpperCase() !== 'BORRAR'}
                onClick={handleExecuteClearAll}
                className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition cursor-pointer bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Eliminar definitivamente todos los datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
