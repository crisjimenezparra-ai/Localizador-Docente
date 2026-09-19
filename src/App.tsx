/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { NavTab } from './components/Navbar';
import { DondeEstaView } from './views/DondeEstaView';
import { DocentesView } from './views/DocentesView';
import { GruposView } from './views/GruposView';
import { AdminView, AdminTabType } from './views/AdminView';
import { AdminAuthModal } from './components/AdminAuthModal';

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>('donde-esta');
  const [adminSubTab, setAdminSubTab] = useState<AdminTabType>('import');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | undefined>(undefined);
  const [docentesViewMode, setDocentesViewMode] = useState<'dia' | 'semana'>('semana');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetProtectedTab, setTargetProtectedTab] = useState<NavTab | null>(null);

  const { cursoEscolar, isDemoData, role, setRole, isAdmin } = useApp();

  // Role-Based Access Control: redirect DOCENTE from protected views
  useEffect(() => {
    if (!isAdmin && (activeTab === 'situacion' || activeTab === 'admin')) {
      setActiveTab('donde-esta');
    } else if (isAdmin && activeTab === 'situacion') {
      setActiveTab('admin');
      setAdminSubTab('actividad');
    }
  }, [isAdmin, activeTab]);

  const handleSelectDocenteForSchedule = (docenteId: string) => {
    setSelectedTeacherId(docenteId);
    setActiveTab('docentes');
  };

  const handleLocateDocenteNow = (docenteId: string) => {
    setSelectedTeacherId(docenteId);
    setActiveTab('donde-esta');
  };

  const handleAdminAuthSuccess = () => {
    setRole('ADMIN');
    setShowPinModal(false);
    if (targetProtectedTab) {
      setActiveTab(targetProtectedTab);
      setTargetProtectedTab(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 flex flex-col font-sans w-full max-w-full">
      {/* 1. Top Navy Blue Header */}
      <Header
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onOpenPinModal={() => {
          setTargetProtectedTab('admin');
          setShowPinModal(true);
        }}
      />

      {/* 2. Main Content Area with Sidebar */}
      <div className="flex-1 flex w-full min-w-0">
        {/* Left Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          adminSubTab={adminSubTab}
          setAdminSubTab={setAdminSubTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onOpenPinModal={(targetTab?: NavTab) => {
            setTargetProtectedTab(targetTab || 'admin');
            setShowPinModal(true);
          }}
        />

        {/* Dynamic Main View */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'donde-esta' && (
            <DondeEstaView onSelectDocenteForSchedule={handleSelectDocenteForSchedule} />
          )}

          {activeTab === 'docentes' && (
            <DocentesView
              initialDocenteId={selectedTeacherId}
              initialViewMode={docentesViewMode}
              onLocateDocenteNow={handleLocateDocenteNow}
            />
          )}

          {activeTab === 'grupos' && (
            <GruposView onSelectDocente={handleSelectDocenteForSchedule} />
          )}

          {activeTab === 'situacion' &&
            (isAdmin ? (
              <AdminView
                activeSubTab="actividad"
                onSubTabChange={setAdminSubTab}
              />
            ) : (
              <DondeEstaView onSelectDocenteForSchedule={handleSelectDocenteForSchedule} />
            ))}

          {activeTab === 'admin' &&
            (isAdmin ? (
              <AdminView
                activeSubTab={adminSubTab}
                onSubTabChange={setAdminSubTab}
              />
            ) : (
              <DondeEstaView onSelectDocenteForSchedule={handleSelectDocenteForSchedule} />
            ))}
        </main>
      </div>

      {/* 3. Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Localizador Docente</span>
            <span>·</span>
            <span>CEIP Antonio Gala</span>
            <span>·</span>
            <span>Curso {cursoEscolar}</span>
            {isDemoData && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                MODO DEMO
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setTargetProtectedTab(null);
        }}
        onSuccess={handleAdminAuthSuccess}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

