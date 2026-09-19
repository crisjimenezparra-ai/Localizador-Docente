import React, { useState } from 'react';
import { Lock, Mail, ArrowLeft, X, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import {
  verifyAdminPassword,
  getRecoveryEmail,
  requestAdminPasswordReset,
  verifyAndResetAdminPassword,
} from '../services/securityService';
import { isGasConnected } from '../services/gasService';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [view, setView] = useState<'login' | 'recovery'>('login');

  // Recovery sub-flow state
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'code'>('email');
  const [inputEmail, setInputEmail] = useState(() => getRecoveryEmail() || '');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Por favor, introduce la contraseña.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const isValid = await verifyAdminPassword(password);
      if (isValid) {
        setPassword('');
        setError('');
        onSuccess();
      } else {
        setError('Contraseña incorrecta. Por favor, inténtelo de nuevo (clave inicial por defecto: 1234).');
      }
    } catch (err) {
      setError('Error al verificar la contraseña. Inténtelo de nuevo.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryStatus(null);
    if (!inputEmail || !inputEmail.includes('@')) {
      setRecoveryStatus({ type: 'error', text: 'Por favor, introduce una dirección de correo válida.' });
      return;
    }

    setIsSubmittingRecovery(true);
    try {
      const res = await requestAdminPasswordReset(inputEmail);
      if (res.success) {
        setRecoveryStatus({
          type: 'success',
          text: res.message || 'Código de seguridad enviado. Revisa tu correo.',
        });
        setRecoveryStep('code');
      } else {
        setRecoveryStatus({
          type: 'error',
          text: res.error || 'No se pudo enviar el código de recuperación.',
        });
      }
    } catch (err: any) {
      setRecoveryStatus({
        type: 'error',
        text: err?.message || 'Error de red al solicitar el código.',
      });
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryStatus(null);

    if (!resetCode || resetCode.trim().length < 4) {
      setRecoveryStatus({ type: 'error', text: 'Introduce el código de seguridad recibido por correo.' });
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setRecoveryStatus({ type: 'error', text: 'La nueva contraseña debe tener al menos 4 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryStatus({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }

    setIsSubmittingRecovery(true);
    try {
      const res = await verifyAndResetAdminPassword(resetCode.trim(), newPassword);
      if (res.success) {
        setRecoveryStatus({
          type: 'success',
          text: '¡Contraseña restablecida con éxito! Ya puedes iniciar sesión con tu nueva clave.',
        });
        setTimeout(() => {
          setView('login');
          setPassword(newPassword);
          setRecoveryStep('email');
          setResetCode('');
          setNewPassword('');
          setConfirmPassword('');
          setRecoveryStatus(null);
        }, 1800);
      } else {
        setRecoveryStatus({
          type: 'error',
          text: res.error || 'Código incorrecto o caducado.',
        });
      }
    } catch (err: any) {
      setRecoveryStatus({
        type: 'error',
        text: err?.message || 'Error de conexión al restablecer contraseña.',
      });
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setView('login');
    setRecoveryStep('email');
    setRecoveryStatus(null);
    onClose();
  };

  const connectedToGas = isGasConnected();

  return (
    <div
      id="modal-admin-auth-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="modal-admin-auth-container"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 border border-slate-200 relative"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {view === 'login' ? (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3.5 border border-blue-100 shadow-2xs">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-slate-900 tracking-tight">
              Acceso a Administración
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1.5 mb-5 leading-relaxed">
              Introduce la contraseña de administrador multidispositivo.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="input-admin-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Contraseña
                </label>
                <input
                  id="input-admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                />

                {error && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setView('recovery');
                    setRecoveryStatus(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer transition"
                >
                  ¿Has olvidado la contraseña?
                </button>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-admin-login-submit"
                  disabled={isVerifying}
                  className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? 'Comprobando...' : 'Acceder'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Password Recovery View */
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3.5 border border-amber-100 shadow-2xs">
              <Mail className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-slate-900 tracking-tight">
              Recuperar contraseña
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-4">
              Envío de código de seguridad por correo electrónico
            </p>

            {recoveryStatus && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 ${
                  recoveryStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {recoveryStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{recoveryStatus.text}</span>
              </div>
            )}

            {recoveryStep === 'email' ? (
              <form onSubmit={handleRequestCode} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo del administrador
                  </label>
                  <input
                    type="email"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="direccion@centroeducativo.es"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Te enviaremos un código de seguridad de 6 dígitos mediante Google Apps Script para validar tu identidad.
                  </p>
                </div>

                {!connectedToGas && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">Conexión con Google Apps Script requerida:</p>
                    <p className="text-[11px] text-amber-700">
                      Para el envío automático de correos, conecta la app con tu Google Apps Script en Administración &gt; Conexión Google Sheets.
                    </p>
                    <p className="text-[11px] text-slate-600 pt-1 font-mono">
                      Clave inicial por defecto: <strong>1234</strong>
                    </p>
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingRecovery ? 'Enviando...' : 'Enviar código'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código de seguridad (6 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full text-center tracking-widest text-lg font-mono font-bold px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 text-center">
                    Introduce el código que has recibido en <strong className="text-slate-700">{inputEmail}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirmar nueva
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('email')}
                    className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingRecovery ? 'Restableciendo...' : 'Restablecer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
