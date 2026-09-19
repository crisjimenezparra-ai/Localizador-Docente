/**
 * Security Service for Administrator Authentication and Access Control.
 *
 * Implements salted SHA-256 hashing using the standard Web Crypto API (SubtleCrypto).
 * Password is never stored or transmitted in plain text.
 *
 * NOTE ON FRONTEND ARCHITECTURE LIMITATIONS:
 * Because this application currently runs as a client-side Single Page Application (SPA),
 * cryptographic verification and storage take place locally in the browser (localStorage).
 * For enterprise-grade security with multiple administrative accounts and automated SMTP
 * email recovery, this module provides the exact contract ready to connect to a backend
 * API endpoint (e.g. POST /api/auth/login, POST /api/auth/change-password, POST /api/auth/recover).
 */

import {
  isGasConnected,
  gasAdminLogin,
  gasChangePassword,
  gasRequestPasswordReset,
  gasVerifyResetCode,
} from './gasService';

const STORAGE_KEYS = {
  HASH: 'horarios_app_admin_pwd_hash',
  SALT: 'horarios_app_admin_pwd_salt',
  RECOVERY_EMAIL: 'horarios_app_recovery_email',
  LEGACY_PIN: 'horarios_app_admin_pin',
};

const DEFAULT_SALT = 'ceip_antonio_gala_localizador_2026_salt_';

/**
 * Computes a salted SHA-256 hash of a string using the native Web Crypto API.
 */
export async function hashWithSalt(plainText: string, salt: string = DEFAULT_SALT): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${plainText}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cleans up any legacy plain-text PIN stored in localStorage by previous versions.
 */
export function cleanupLegacyStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.LEGACY_PIN);
  } catch (e) {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Verifies if the provided plain-text password matches the administrator credentials.
 * If connected to Google Apps Script, verifies multidispositivo against Google Apps Script backend.
 * Falls back to local cryptographic hash if offline or not yet connected.
 */
export async function verifyAdminPassword(enteredPassword: string): Promise<boolean> {
  if (!enteredPassword) return false;

  cleanupLegacyStorage();

  // 1. If connected to Google Apps Script, verify against the central backend
  if (isGasConnected()) {
    try {
      const gasResult = await gasAdminLogin(enteredPassword);
      if (gasResult.success) {
        // Cache the valid hash locally for offline continuity
        const validHash = await hashWithSalt(enteredPassword);
        localStorage.setItem(STORAGE_KEYS.HASH, validHash);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Network error checking password with Google Apps Script, falling back to local hash', e);
    }
  }

  // 2. Local fallback check
  const enteredHash = await hashWithSalt(enteredPassword);
  const storedHash = localStorage.getItem(STORAGE_KEYS.HASH);

  if (!storedHash) {
    // Initial center default credential hash ('1234')
    const initialDefaultHash = await hashWithSalt('1234');
    return enteredHash === initialDefaultHash;
  }

  return enteredHash === storedHash;
}

/**
 * Changes the administrator password multidispositivo.
 * Updates both Google Apps Script (central cloud) and local cryptographic hash.
 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<{ success: boolean; error?: string }> {
  cleanupLegacyStorage();

  // 1. Basic format validations
  if (!newPassword || newPassword.trim().length < 4) {
    return {
      success: false,
      error: 'La nueva contraseña debe tener al menos 4 caracteres.',
    };
  }

  if (newPassword !== confirmNewPassword) {
    return {
      success: false,
      error: 'La nueva contraseña y su confirmación no coinciden.',
    };
  }

  // 2. If connected to Google Apps Script, update central backend
  if (isGasConnected()) {
    try {
      const gasResult = await gasChangePassword(currentPassword, newPassword);
      if (!gasResult.success) {
        return { success: false, error: gasResult.error || 'Error al cambiar la contraseña en Google Apps Script.' };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error de conexión con Google Apps Script al cambiar la contraseña.' };
    }
  } else {
    // Check local current password
    const isCurrentValid = await verifyAdminPassword(currentPassword);
    if (!isCurrentValid) {
      return { success: false, error: 'La contraseña actual no es correcta.' };
    }
  }

  // 3. Compute and store new salted hash locally
  const newHash = await hashWithSalt(newPassword);
  localStorage.setItem(STORAGE_KEYS.HASH, newHash);

  return { success: true };
}

/**
 * Sends a password recovery request (triggers automated email with verification code via Google Apps Script MailApp).
 */
export async function requestAdminPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, error: 'Por favor, introduce una dirección de correo electrónico válida.' };
  }

  setRecoveryEmail(trimmed);

  if (isGasConnected()) {
    return gasRequestPasswordReset(trimmed);
  }

  return {
    success: false,
    error: 'La aplicación aún no está conectada a Google Apps Script. Configura la URL del script en Administración > Conexión Google Sheets para habilitar el envío automático de correos.',
  };
}

/**
 * Verifies recovery code and sets a new password in Google Apps Script and local storage.
 */
export async function verifyAndResetAdminPassword(
  code: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!code || !newPassword) {
    return { success: false, error: 'Debes introducir el código de seguridad y la nueva contraseña.' };
  }

  if (newPassword.trim().length < 4) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
  }

  if (isGasConnected()) {
    const result = await gasVerifyResetCode(code, newPassword);
    if (result.success) {
      const newHash = await hashWithSalt(newPassword);
      localStorage.setItem(STORAGE_KEYS.HASH, newHash);
    }
    return result;
  }

  return {
    success: false,
    error: 'No hay conexión con Google Apps Script para validar el código de recuperación.',
  };
}

/**
 * Retrieves the configured recovery email address.
 */
export function getRecoveryEmail(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.RECOVERY_EMAIL) || '';
  } catch {
    return '';
  }
}

/**
 * Updates the recovery email address.
 */
export function setRecoveryEmail(email: string): void {
  try {
    const trimmed = email.trim().toLowerCase();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEYS.RECOVERY_EMAIL, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEYS.RECOVERY_EMAIL);
    }
  } catch (e) {
    console.error('Error saving recovery email', e);
  }
}

export { isGasConnected } from './gasService';

/**
 * Masks an email for safe display (e.g. "d***@centro.es")
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) {
    return `${local[0] || ''}*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.max(1, Math.min(local.length - 2, 4)))}${local[local.length - 1]}@${domain}`;
}
