/**
 * Client Service for Google Apps Script & Google Sheets integration.
 *
 * Supports both:
 * 1. Embedded mode within Google Apps Script (via `google.script.run`)
 * 2. Standalone / PWA web mode (via Google Apps Script Web App endpoint /exec)
 */

declare global {
  interface Window {
    google?: {
      script?: {
        run: {
          withSuccessHandler: (callback: (response: any) => void) => {
            withFailureHandler: (callback: (error: any) => void) => any;
          };
          [key: string]: any;
        };
      };
    };
  }
}

export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbyQfBVOd1xPwZewu8T0M4ncuZRfvj2RnJVX7qTOgbRso1nEfPJiU8_njhH02LqOVCOizQ/exec';

const STORAGE_KEYS = {
  GAS_URL: 'horarios_gas_webapp_url',
  LAST_SYNC: 'horarios_gas_last_sync',
  AUTO_SYNC: 'horarios_gas_auto_sync',
};

/**
 * Returns the Google Apps Script Web App URL.
 * In Web App mode (/exec), it automatically detects window.location as the endpoint.
 * In development or standalone mode, it defaults to the center's configured Google Sheets Web App.
 */
export function getGasWebAppUrl(): string {
  try {
    if (typeof window !== 'undefined' && window.location) {
      // 1. Direct Web App execution URL: if running inside script.google.com /exec
      const href = window.location.href;
      if (href.includes('/macros/s/') && href.includes('/exec')) {
        const execMatch = href.match(/(https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec)/);
        if (execMatch) {
          return execMatch[1];
        }
      }

      // 2. Query param ?script= or ?gas=
      const params = new URLSearchParams(window.location.search);
      const paramUrl = params.get('script') || params.get('gas');
      if (paramUrl && paramUrl.startsWith('http')) {
        const trimmed = decodeURIComponent(paramUrl).trim();
        localStorage.setItem(STORAGE_KEYS.GAS_URL, trimmed);
        try {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {
          // ignore history state error if iframe restrictions apply
        }
        return trimmed;
      }
    }

    const saved = localStorage.getItem(STORAGE_KEYS.GAS_URL);
    if (saved && saved.startsWith('https://script.google.com/macros/s/')) {
      return saved.trim();
    }
    return DEFAULT_GAS_URL;
  } catch {
    return DEFAULT_GAS_URL;
  }
}

/**
 * Saves the Google Apps Script Web App URL
 */
export function setGasWebAppUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEYS.GAS_URL, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEYS.GAS_URL);
    }
  } catch (e) {
    console.error('Error saving GAS URL', e);
  }
}

/**
 * Checks if the application is connected to Google Apps Script (embedded or URL configured)
 */
export function isGasConnected(): boolean {
  if (typeof window !== 'undefined' && window.google?.script?.run) {
    return true;
  }
  return Boolean(getGasWebAppUrl());
}

/**
 * Checks if auto-sync is enabled
 */
export function isAutoSyncEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Error saving auto sync setting', e);
  }
}

/**
 * Low-level caller that works via google.script.run or fetch to Web App URL
 */
async function callGasApi(action: string, payload: any = {}): Promise<any> {
  // 1. Embedded mode: inside Google Apps Script iframe
  if (typeof window !== 'undefined' && window.google?.script?.run) {
    return new Promise((resolve, reject) => {
      window.google!.script!.run
        .withSuccessHandler((res: any) => {
          if (typeof res === 'string') {
            try {
              resolve(JSON.parse(res));
              return;
            } catch {
              // fallback to raw string
            }
          }
          resolve(res);
        })
        .withFailureHandler((err: any) => reject(new Error(err?.message || String(err))))
        .handleApiRequest(action, payload);
    });
  }

  // 2. Standalone web app / mobile PWA mode: call Google Apps Script Web App
  const webAppUrl = getGasWebAppUrl();
  if (!webAppUrl) {
    throw new Error('No se ha configurado la URL de la aplicación web de Google Apps Script.');
  }

  const url = new URL(webAppUrl);
  url.searchParams.set('action', action);

  let response: Response;
  try {
    // Send request as POST with text/plain body to avoid CORS preflight rejection in Google Apps Script
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
    });
  } catch (postErr) {
    // If POST fetch is blocked or fails on GET-safe actions, fallback to GET
    if (action === 'getData' || action === 'testConnection' || action === 'test') {
      response = await fetch(url.toString(), { redirect: 'follow' });
    } else {
      throw postErr;
    }
  }

  if (!response.ok) {
    throw new Error(`Error en servidor Google Apps Script (código HTTP ${response.status}).`);
  }

  const json = await response.json();
  return json;
}

/**
 * Tests connection with the Google Apps Script Web App
 */
export async function testGasConnection(overrideUrl?: string): Promise<{ success: boolean; message: string }> {
  try {
    const urlToUse = overrideUrl !== undefined ? overrideUrl.trim() : getGasWebAppUrl();

    if (!urlToUse && !(typeof window !== 'undefined' && window.google?.script?.run)) {
      return {
        success: false,
        message: 'Por favor, introduce la URL de la aplicación web de Google Apps Script.',
      };
    }

    if (overrideUrl !== undefined) {
      if (urlToUse.includes('script.googleusercontent.com')) {
        return {
          success: false,
          message: 'Has pegado la dirección de redirección temporal de la barra del navegador (script.googleusercontent.com). Debes copiar la "URL de la aplicación web" desde la ventana de Apps Script (la que empieza por https://script.google.com/macros/s/... y termina en /exec).',
        };
      }

      // Test the specific URL
      const url = new URL(urlToUse);
      url.searchParams.set('action', 'testConnection');
      let data: any;
      try {
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'testConnection' }),
          redirect: 'follow',
        });
        data = await res.json();
      } catch {
        // Try GET fallback if POST is blocked by browser CORS policy
        const getRes = await fetch(url.toString(), { redirect: 'follow' });
        data = await getRes.json();
      }

      return {
        success: Boolean(data?.success),
        message: data?.message || (data?.success ? 'Conexión verificada con éxito.' : data?.error || 'Error de conexión.'),
      };
    }

    const data = await callGasApi('testConnection');
    return {
      success: Boolean(data?.success),
      message: data?.message || 'Conexión verificada con éxito.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'No se pudo conectar con Google Apps Script. Revisa que la URL esté bien escrita y tenga acceso "Cualquier persona".',
    };
  }
}

/**
 * Retrieves all center data (horarios, docentes, ubicaciones, tipos, curso) from Google Sheets
 */
export async function fetchRemoteCenterData(): Promise<{
  success: boolean;
  data?: {
    docentes: any[];
    horarios: any[];
    ubicaciones: any[];
    tipos: any[];
    cursoEscolar: string;
    isDemoData: boolean;
    lastUpdated?: string;
  };
  error?: string;
}> {
  try {
    const res = await callGasApi('getData');
    if (res?.success && res.data) {
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      } catch {
        // sandbox safe
      }
      return { success: true, data: res.data };
    }
    return { success: false, error: res?.error || 'No se pudieron obtener los datos de Google Sheets.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error de red al consultar Google Sheets.' };
  }
}

/**
 * Uploads all center data to Google Sheets
 */
export async function saveRemoteCenterData(payload: {
  horarios: any[];
  docentes: any[];
  ubicaciones: any[];
  tipos: any[];
  cursoEscolar: string;
  isDemoData: boolean;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await callGasApi('saveData', payload);
    if (res?.success) {
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      } catch {
        // sandbox safe
      }
      return { success: true, message: res.message || 'Datos guardados en Google Sheets con éxito.' };
    }
    return { success: false, error: res?.error || 'Error al guardar los datos en Google Sheets.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error de red al escribir en Google Sheets.' };
  }
}

/**
 * Verifies admin login password on Google Apps Script
 */
export async function gasAdminLogin(password: string): Promise<{ success: boolean; isDefaultPassword?: boolean; error?: string }> {
  try {
    const res = await callGasApi('login', { password });
    return {
      success: Boolean(res?.success),
      isDefaultPassword: Boolean(res?.isDefaultPassword),
      error: res?.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al verificar la contraseña en Google Apps Script.' };
  }
}

/**
 * Changes admin password on Google Apps Script
 */
export async function gasChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callGasApi('changePassword', { currentPassword, newPassword });
    return {
      success: Boolean(res?.success),
      error: res?.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al cambiar la contraseña en Google Apps Script.' };
  }
}

/**
 * Requests an admin password reset code via Google Workspace MailApp
 */
export async function gasRequestPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await callGasApi('requestReset', { email });
    return {
      success: Boolean(res?.success),
      message: res?.message,
      error: res?.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al solicitar el código de recuperación.' };
  }
}

/**
 * Validates recovery code and resets password on Google Apps Script
 */
export async function gasVerifyResetCode(
  code: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await callGasApi('verifyReset', { code, newPassword });
    return {
      success: Boolean(res?.success),
      message: res?.message,
      error: res?.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al validar el código de recuperación.' };
  }
}
