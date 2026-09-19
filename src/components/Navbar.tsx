import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AdminAuthModal } from './AdminAuthModal';
import {
  Search,
  Users,
  Building2,
  LayoutGrid,
  ShieldCheck,
  Menu,
  X,
  Lock,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export type NavTab = 'donde-esta' | 'docentes' | 'grupos' | 'situacion' | 'admin';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { role, setRole, isAdmin, isDemoData, cursoEscolar } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const handleTabClick = (tab: NavTab) => {
    if (tab === 'admin' && !isAdmin) {
      // Protected access prompt
      setShowPinModal(true);
      return;
    }
    if (tab === 'situacion' && !isAdmin) {
      // Strictly restricted to ADMIN
      setShowPinModal(true);
      return;
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleAdminAuthSuccess = () => {
    setRole('ADMIN');
    setShowPinModal(false);
    setActiveTab('admin');
  };

  return (
    <>
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Center Title */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <img
                src="/icon.png"
                alt="Icono Localizador Docente"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shadow-xs shrink-0 border border-blue-400/30"
              />
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
                    Localizador Docente
                  </span>
                  {isDemoData && (
                    <span
                      id="badge-demo-mode"
                      className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap"
                      title="Mostrando datos de demostración. Importe su Excel en Administración para cargar sus horarios reales."
                    >
                      DEMO
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium whitespace-nowrap">
                  Curso {cursoEscolar}
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-1 xl:space-x-2">
              <button
                id="nav-tab-donde-esta"
                onClick={() => handleTabClick('donde-esta')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs xl:text-sm font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === 'donde-esta'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Search className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">¿Dónde está...?</span>
              </button>

              <button
                id="nav-tab-grupos"
                onClick={() => handleTabClick('grupos')}
                title="Consulta por grupo: ¿Quién está en...?"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs xl:text-sm font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === 'grupos'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">¿Quién está en...?</span>
              </button>

              <button
                id="nav-tab-docentes"
                onClick={() => handleTabClick('docentes')}
                title="Horarios del profesorado"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs xl:text-sm font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === 'docentes'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Horarios</span>
              </button>

              <button
                id="nav-tab-admin"
                onClick={() => handleTabClick('admin')}
                title="Admin"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs xl:text-sm font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isAdmin
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {isAdmin ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 shrink-0" />
                )}
                <span className="whitespace-nowrap">Admin</span>
              </button>
            </nav>

            {/* Role indicator / switch */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 text-xs">
                <button
                  id="btn-role-docente"
                  onClick={() => setRole('DOCENTE')}
                  className={`px-2.5 py-1 rounded-md font-medium transition whitespace-nowrap ${
                    role === 'DOCENTE'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Docente
                </button>
                <button
                  id="btn-role-admin"
                  onClick={() => {
                    if (role !== 'ADMIN') {
                      setShowPinModal(true);
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition whitespace-nowrap ${
                    role === 'ADMIN'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin</span>
                </button>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                id="btn-mobile-menu"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 px-4 pt-2 pb-4 space-y-1.5 bg-slate-900">
            <button
              onClick={() => handleTabClick('donde-esta')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                activeTab === 'donde-esta' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>¿Dónde está...?</span>
            </button>
            <button
              onClick={() => handleTabClick('grupos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                activeTab === 'grupos' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>¿Quién está en...?</span>
            </button>
            <button
              onClick={() => handleTabClick('docentes')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                activeTab === 'docentes' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Horarios</span>
            </button>
            <button
              onClick={() => handleTabClick('admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                activeTab === 'admin' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>

            {/* Mobile role switcher */}
            <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Rol actual: <strong className="text-white">{role}</strong></span>
              <button
                onClick={() => {
                  if (isAdmin) {
                    setRole('DOCENTE');
                  } else {
                    setShowPinModal(true);
                  }
                }}
                className="px-3 py-1 bg-slate-800 text-blue-400 font-semibold rounded border border-slate-700"
              >
                {isAdmin ? 'Cambiar a Docente' : 'Acceder como Admin'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handleAdminAuthSuccess}
      />
    </>
  );
};
