import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NavTab } from './Navbar';
import { AdminTabType } from '../views/AdminView';
import { isSystemLocation } from '../utils/locationUtils';
import {
  MapPin,
  Calendar,
  Building2,
  ShieldCheck,
  Lock,
  X,
  GraduationCap,
  ChevronDown,
  FileSpreadsheet,
  Users,
  Tag,
  LayoutGrid,
  KeyRound,
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  adminSubTab: AdminTabType;
  setAdminSubTab: (tab: AdminTabType) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onOpenPinModal: (targetTab?: NavTab) => void;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  colorClass: {
    activeBg: string;
    activeText: string;
    iconBg: string;
    iconText: string;
  };
  requiresAdmin?: boolean;
}

interface AdminSubItem {
  id: AdminTabType;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface AdminGroup {
  name: string;
  items: AdminSubItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  adminSubTab,
  setAdminSubTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  onOpenPinModal,
}) => {
  const { isAdmin, role, setRole, docentes, ubicaciones, tipos, cursoEscolar } = useApp();
  const [adminExpanded, setAdminExpanded] = useState<boolean>(activeTab === 'admin');

  // Automatically expand submenu if entering admin, and collapse when navigating to normal tabs
  useEffect(() => {
    if (activeTab === 'admin') {
      setAdminExpanded(true);
    } else {
      setAdminExpanded(false);
    }
  }, [activeTab]);

  // Main primary navigation items
  const mainNavItems: NavItemConfig[] = [
    {
      id: 'donde-esta',
      label: '¿Dónde está...?',
      icon: MapPin,
      colorClass: {
        activeBg: 'bg-blue-600 text-white shadow-xs',
        activeText: 'text-white',
        iconBg: 'bg-blue-100 text-blue-700',
        iconText: 'text-blue-700',
      },
    },
    {
      id: 'grupos',
      label: '¿Quién está en...?',
      icon: Building2,
      colorClass: {
        activeBg: 'bg-cyan-600 text-white shadow-xs',
        activeText: 'text-white',
        iconBg: 'bg-cyan-100 text-cyan-700',
        iconText: 'text-cyan-700',
      },
    },
    {
      id: 'docentes',
      label: 'Horarios',
      icon: Calendar,
      colorClass: {
        activeBg: 'bg-violet-600 text-white shadow-xs',
        activeText: 'text-white',
        iconBg: 'bg-violet-100 text-violet-700',
        iconText: 'text-violet-700',
      },
    },
  ];

  const ordinaryUbicacionesCount = (ubicaciones || []).filter((u) => !isSystemLocation(u.codigo)).length;

  const adminGroups: AdminGroup[] = [
    {
      name: 'DATOS',
      items: [
        {
          id: 'import',
          label: 'Importar Excel',
          icon: FileSpreadsheet,
        },
        {
          id: 'docentes',
          label: 'Docentes',
          icon: Users,
          badge: (docentes || []).length,
        },
        {
          id: 'ubicaciones',
          label: 'Ubicaciones',
          icon: MapPin,
          badge: ordinaryUbicacionesCount,
        },
        {
          id: 'tipos',
          label: 'Tipos de actividad',
          icon: Tag,
          badge: (tipos || []).length,
        },
      ],
    },
    {
      name: 'HERRAMIENTAS',
      items: [
        {
          id: 'actividad',
          label: 'Actividad del profesorado',
          icon: LayoutGrid,
        },
      ],
    },
    {
      name: 'CONFIGURACIÓN',
      items: [
        {
          id: 'seguridad',
          label: 'Acceso y seguridad',
          icon: KeyRound,
        },
      ],
    },
  ];

  const handleNavigate = (tab: NavTab) => {
    setActiveTab(tab);
    setAdminExpanded(false);
    setMobileMenuOpen(false);
  };

  const handleAdminToggle = () => {
    if (!isAdmin) {
      setMobileMenuOpen(false);
      onOpenPinModal('admin');
      return;
    }
    if (activeTab !== 'admin') {
      setActiveTab('admin');
      setAdminExpanded(true);
    } else {
      setAdminExpanded(!adminExpanded);
    }
  };

  const handleMobileAdminClick = () => {
    setMobileMenuOpen(false);
    if (!isAdmin) {
      onOpenPinModal('admin');
    } else {
      setActiveTab('admin');
    }
  };

  const handleAdminSubItemClick = (subId: AdminTabType) => {
    if (!isAdmin) {
      setMobileMenuOpen(false);
      onOpenPinModal('admin');
      return;
    }
    setActiveTab('admin');
    setAdminSubTab(subId);
    setAdminExpanded(true);
    setMobileMenuOpen(false);
  };

  const isAdminActive = activeTab === 'admin';

  // Desktop Navigation Content (with expandable sub-menu)
  const desktopNavContent = (
    <nav className="flex flex-col space-y-1.5" aria-label="Navegación principal de escritorio">
      {/* 3 standard primary nav items */}
      {mainNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            id={`sidebar-nav-${item.id}`}
            onClick={() => handleNavigate(item.id)}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-semibold text-sm transition cursor-pointer text-left ${
              isActive
                ? `${item.colorClass.activeBg} font-bold`
                : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                  isActive ? 'bg-white/20 text-white' : item.colorClass.iconBg
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="tracking-tight">{item.label}</span>
            </div>
          </button>
        );
      })}

      {/* Administración collapsible parent menu */}
      <div className="pt-1">
        <button
          id="sidebar-nav-admin"
          onClick={handleAdminToggle}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-semibold text-sm transition cursor-pointer text-left ${
            isAdminActive
              ? 'bg-emerald-600 text-white font-bold shadow-xs'
              : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60 shadow-2xs'
          }`}
          aria-expanded={adminExpanded}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                isAdminActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="tracking-tight">Administración</span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isAdmin ? (
              <span title="Acceso restringido a Administración" className="p-1 text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </span>
            ) : (
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isAdminActive ? 'text-white' : 'text-slate-400'
                } ${adminExpanded ? 'rotate-180' : ''}`}
              />
            )}
          </div>
        </button>

        {/* Collapsible Submenu (Desktop only) */}
        {isAdmin && adminExpanded && (
          <div className="ml-3.5 pl-3 my-1.5 border-l-2 border-emerald-400/50 space-y-2 animate-in fade-in duration-150">
            {adminGroups.map((group) => (
              <div key={group.name} className="space-y-0.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1.5 pb-0.5 select-none">
                  {group.name}
                </div>
                {group.items.map((subItem) => {
                  const isSelected = isAdminActive && adminSubTab === subItem.id;
                  const SubIcon = subItem.icon;
                  return (
                    <button
                      key={subItem.id}
                      id={`sidebar-admin-subtab-${subItem.id}`}
                      type="button"
                      onClick={() => handleAdminSubItemClick(subItem.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300/80 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/90 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        {isSelected ? (
                          <span className="text-emerald-700 font-bold text-[11px] shrink-0 leading-none">
                            →
                          </span>
                        ) : (
                          <span className="w-2 shrink-0" />
                        )}
                        <SubIcon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        />
                        <span className="leading-snug text-left break-normal">
                          {subItem.label}
                        </span>
                      </div>
                      {subItem.badge !== undefined && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                            isSelected
                              ? 'bg-emerald-200/90 text-emerald-950 font-bold'
                              : 'bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          {subItem.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR (>= lg) */}
      <aside className="hidden lg:flex w-64 xl:w-72 flex-col shrink-0 bg-[#eef2f6] border-r border-slate-200/80 p-4 min-h-[calc(100vh-64px)]">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">
          Navegación
        </div>
        {desktopNavContent}
      </aside>

      {/* MOBILE DRAWER MODAL (< lg) - Compact, exactly 4 main sections, no sub-items */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-over container */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#f0f4f8] shadow-2xl p-4 overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <img
                  src="/icon.png"
                  alt="Icono Localizador Docente"
                  className="w-8 h-8 rounded-lg object-cover shadow-xs border border-blue-400/20"
                />
                <div>
                  <div className="font-bold text-sm text-slate-900">Localizador Docente</div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">CEIP Antonio Gala</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Menú principal
            </div>

            {/* Mobile Navigation: 4 compact primary sections only */}
            <nav className="flex flex-col space-y-1.5" aria-label="Menú principal móvil">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`mobile-nav-${item.id}`}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-semibold text-sm transition cursor-pointer text-left ${
                      isActive
                        ? `${item.colorClass.activeBg} font-bold`
                        : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                          isActive ? 'bg-white/20 text-white' : item.colorClass.iconBg
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="tracking-tight">{item.label}</span>
                    </div>
                  </button>
                );
              })}

              {/* 4th primary section: Administración (Compact, no sub-items on mobile) */}
              <button
                id="mobile-nav-admin"
                onClick={handleMobileAdminClick}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-semibold text-sm transition cursor-pointer text-left ${
                  isAdminActive
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                      isAdminActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="tracking-tight">Administración</span>
                </div>
                {!isAdmin && (
                  <span title="Acceso restringido a Administración" className="p-1 text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            </nav>

            {/* Mobile bottom role status & switch */}
            <div className="mt-auto pt-6 border-t border-slate-200/80">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rol actual</div>
                  <div className="text-xs font-bold text-slate-800">
                    {isAdmin ? 'Administrador' : 'Docente'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (isAdmin) {
                      setRole('DOCENTE');
                      setMobileMenuOpen(false);
                    } else {
                      setMobileMenuOpen(false);
                      onOpenPinModal('admin');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                >
                  {isAdmin ? 'Cerrar sesión' : 'Acceso Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
