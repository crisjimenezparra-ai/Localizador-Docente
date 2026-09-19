import React from 'react';
import { useApp } from '../context/AppContext';
import { isGasConnected } from '../services/gasService';
import {
  GraduationCap,
  Menu,
  X,
  User,
  ShieldCheck,
  Lock,
  Cloud,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onOpenPinModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  onOpenPinModal,
}) => {
  const { cursoEscolar, isDemoData, role, setRole, isAdmin, isSyncing, syncWithSheets } = useApp();
  const gasConnected = isGasConnected();

  return (
    <header className="bg-[#0e263e] text-white sticky top-0 z-40 border-b border-[#1c3c5d] shadow-sm w-full max-w-full">
      <div className="w-full px-2.5 sm:px-6 lg:px-8 max-w-full">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-4 max-w-full">
          {/* Left: Hamburger menu + Brand Identity */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Mobile Menu Toggle Button */}
            <button
              id="btn-mobile-sidebar-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-200 hover:text-white hover:bg-[#183a5e] transition cursor-pointer shrink-0"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            {/* School Crest / App Icon */}
            <img
              src="/icon.png"
              alt="Icono Localizador Docente"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-sm shrink-0 object-cover border border-blue-400/30"
            />

            {/* Title and Center Name */}
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="font-bold text-sm sm:text-lg tracking-tight text-white leading-tight whitespace-nowrap">
                  Localizador Docente
                </span>
                {isDemoData && (
                  <span
                    id="badge-header-demo"
                    className="hidden md:inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap"
                    title="Mostrando datos de demostración"
                  >
                    DEMO
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-blue-200/90 uppercase tracking-wider truncate">
                CEIP Antonio Gala · Curso {cursoEscolar}
              </p>
            </div>
          </div>

          {/* Right: Cloud Sync & User Profile / Role Pill */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {gasConnected && (
              <button
                type="button"
                onClick={() => syncWithSheets()}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                title="Google Sheets centralizado activo (clic para actualizar datos ahora)"
              >
                <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-emerald-200' : 'text-emerald-400'}`} />
                <span className="hidden md:inline">{isSyncing ? 'Sincronizando...' : 'Conectado a Sheets'}</span>
              </button>
            )}

            <div className="flex items-center bg-[#163657] border border-[#2b537d] rounded-xl shrink-0">
              {/* Desktop User text & role switch */}
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {isAdmin ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <User className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isAdmin ? 'text-emerald-300' : 'text-blue-200'
                      }`}
                    >
                      {isAdmin ? 'ADMIN' : 'DOCENTE'}
                    </span>
                    <button
                      onClick={() => {
                        if (isAdmin) {
                          setRole('DOCENTE');
                        } else {
                          onOpenPinModal();
                        }
                      }}
                      className="text-[10px] text-slate-300 hover:text-white underline underline-offset-2 ml-1 cursor-pointer"
                      title={isAdmin ? 'Cambiar a modo Docente' : 'Iniciar sesión como Administrador'}
                    >
                      {isAdmin ? 'Salir' : 'Acceso Admin'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Role Switch Button (compact, touch-friendly min 40px target) */}
              <button
                onClick={() => {
                  if (isAdmin) {
                    setRole('DOCENTE');
                  } else {
                    onOpenPinModal();
                  }
                }}
                className={`sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl transition cursor-pointer ${
                  isAdmin
                    ? 'bg-emerald-600/25 text-emerald-300'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={isAdmin ? 'Rol ADMIN activo (clic para salir a Docente)' : 'Acceso Administrador (requiere contraseña)'}
                aria-label={isAdmin ? 'Cerrar sesión de Administrador' : 'Acceso Administrador'}
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px] font-bold tracking-wide">ADMIN</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-300">Admin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
