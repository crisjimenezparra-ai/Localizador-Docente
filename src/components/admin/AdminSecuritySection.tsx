import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  KeyRound,
  Mail,
  CheckCircle2,
  AlertCircle,
  Lock,
  Info,
} from 'lucide-react';
import { maskEmail, isGasConnected } from '../../services/securityService';
import { Cloud, CheckCircle2 as CloudCheck } from 'lucide-react';

export const AdminSecuritySection: React.FC = () => {
  const { changePassword, recoveryEmail, updateRecoveryEmail } = useApp();

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // Recovery Email state
  const [emailInput, setEmailInput] = useState(recoveryEmail || '');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword) {
      setPwdError('Por favor, introduce la contraseña actual.');
      return;
    }
    if (!newPassword) {
      setPwdError('Por favor, introduce la nueva contraseña.');
      return;
    }
    if (newPassword.length < 4) {
      setPwdError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    setIsChangingPwd(true);
    try {
      const result = await changePassword(currentPassword, newPassword, confirmPassword);
      if (result.success) {
        setPwdSuccess('¡Contraseña actualizada con éxito!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwdError(result.error || 'Error al cambiar la contraseña.');
      }
    } catch (err) {
      setPwdError('Error inesperado al actualizar la contraseña.');
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError('Por favor, introduce una dirección de correo válida.');
      return;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError('El formato del correo electrónico no es válido.');
      return;
    }

    updateRecoveryEmail(trimmed);
    setEmailSuccess('Correo de recuperación guardado correctamente.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. Change Password Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Cambiar Contraseña de Administración
            </h2>
            <p className="text-xs text-slate-500">
              Modifica la clave de acceso requerida para entrar en el panel de administración y funciones restringidas.
            </p>
          </div>
        </div>

        {pwdSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{pwdSuccess}</span>
          </div>
        )}

        {pwdError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{pwdError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="input-current-pwd"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Contraseña actual
            </label>
            <input
              id="input-current-pwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full sm:max-w-md px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-new-pwd"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nueva contraseña
              </label>
              <input
                id="input-new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Mínimo 4 caracteres
              </span>
            </div>

            <div>
              <label
                htmlFor="input-confirm-pwd"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Confirmar nueva contraseña
              </label>
              <input
                id="input-confirm-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="btn-update-password"
              disabled={isChangingPwd}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isChangingPwd ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Recovery Email Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Correo de Recuperación de Contraseña
            </h2>
            <p className="text-xs text-slate-500">
              Dirección de correo a la que se vinculará la solicitud de restablecimiento en caso de olvido.
            </p>
          </div>
        </div>

        {emailSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{emailSuccess}</span>
          </div>
        )}

        {emailError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{emailError}</span>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="input-recovery-email"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Correo electrónico de recuperación
            </label>
            <input
              id="input-recovery-email"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="direccion@centro.es"
              className="w-full sm:max-w-md px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {recoveryEmail && (
              <p className="text-[11px] text-slate-500 mt-1">
                Correo actualmente configurado: <strong className="font-mono text-slate-700">{maskEmail(recoveryEmail)}</strong>
              </p>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
            Este correo se utilizará como destinatario del protocolo de recuperación de acceso cuando se pulse en <em>«¿Has olvidado la contraseña?»</em> en la pantalla de inicio de sesión de Administración.
          </p>

          <div>
            <button
              type="submit"
              id="btn-save-recovery-email"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Guardar correo de recuperación
            </button>
          </div>
        </form>
      </div>

      {/* 3. Multidispositivo Google Apps Script Status Banner */}
      {isGasConnected() ? (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-950">
            <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Autenticación y recuperación multidispositivo activa</span>
          </div>
          <p className="leading-relaxed text-emerald-800">
            La contraseña y el correo de recuperación están vinculados a tu backend de <strong>Google Apps Script y Google Sheets</strong>. Los cambios realizados aquí se sincronizan inmediatamente en todos los dispositivos y los códigos de recuperación se envían mediante <code>MailApp</code> de Google Workspace.
          </p>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Seguridad multidispositivo vinculada a Google Sheets</span>
          </div>
          <p className="leading-relaxed text-slate-600">
            Al acceder a la aplicación web a través de la URL de Google Apps Script, la contraseña y los datos se sincronizan automáticamente con la hoja de cálculo del centro.
          </p>
        </div>
      )}
    </div>
  );
};
