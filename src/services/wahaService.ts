/**
 * WAHA (WhatsApp HTTP API) Service
 * Centralized service for all WhatsApp API interactions
 */

// Configuration from environment variables with fallbacks for local development
const WAHA_API_URL = import.meta.env.VITE_WAHA_API_URL || 'http://localhost:3000';
const WAHA_API_KEY = import.meta.env.VITE_WAHA_API_KEY || '12345678';
const SESSION_NAME = 'default';

// Types
export type SessionStatus = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'NOT_FOUND';

export interface SessionInfo {
  name: string;
  status: SessionStatus;
  me?: {
    id: string;
    pushName: string;
  };
}

export interface SendTextPayload {
  phone: string;
  message: string;
}

export interface SendImagePayload {
  phone: string;
  caption: string;
  imageBase64: string;
  imageMimeType: string;
  imageFilename: string;
}

interface WahaError {
  message?: string;
  error?: string;
}

// Helper to format phone numbers
export function formatPhoneNumber(phone: string): string {
  let cleanPhone = phone.replace(/\D/g, '');
  
  // If the number doesn't start with country code (34 for Spain), add it
  if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
    cleanPhone = '34' + cleanPhone;
  }
  
  return cleanPhone;
}

// Helper to build chat ID
function buildChatId(phone: string): string {
  const cleanPhone = formatPhoneNumber(phone);
  return `${cleanPhone}@c.us`;
}

// Generic fetch wrapper with error handling
async function wahaFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${WAHA_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData: WahaError = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Error HTTP: ${response.status}`);
  }

  return response.json();
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function getSessionStatus(): Promise<SessionInfo | null> {
  try {
    const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}`, {
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Error al obtener estado de sesión');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching session status:', error);
    return null;
  }
}

export async function getSessionQrCode(): Promise<string | null> {
  try {
    const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}/auth/qr`, {
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (error) {
    console.error('Error fetching QR code:', error);
    return null;
  }
}

export async function createSession(): Promise<void> {
  await wahaFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      name: SESSION_NAME,
      start: true,
      config: {
        noweb: {
          store: {
            enabled: true,
            fullSync: false,
          },
        },
      },
    }),
  });
}

export async function startSession(): Promise<void> {
  await wahaFetch(`/api/sessions/${SESSION_NAME}/start`, {
    method: 'POST',
    body: JSON.stringify({
      config: {
        noweb: {
          store: {
            enabled: true,
            fullSync: false,
          },
        },
      },
    }),
  });
}

export async function stopSession(): Promise<void> {
  await wahaFetch(`/api/sessions/${SESSION_NAME}/stop`, {
    method: 'POST',
  });
}

export async function restartSession(): Promise<void> {
  await wahaFetch(`/api/sessions/${SESSION_NAME}/restart`, {
    method: 'POST',
  });
}

export async function deleteSession(): Promise<void> {
  await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}`, {
    method: 'DELETE',
    headers: {
      'X-Api-Key': WAHA_API_KEY,
    },
  });
}

// ============================================
// MESSAGING
// ============================================

export async function sendText({ phone, message }: SendTextPayload): Promise<void> {
  const chatId = buildChatId(phone);
  
  console.log('📤 Enviando WhatsApp:', { chatId, message: message.substring(0, 50) + '...' });
  
  await wahaFetch('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      text: message,
      session: SESSION_NAME,
    }),
  });
}

export async function sendImage({ 
  phone, 
  caption, 
  imageBase64, 
  imageMimeType, 
  imageFilename 
}: SendImagePayload): Promise<void> {
  const chatId = buildChatId(phone);
  
  console.log('📤 Enviando imagen WhatsApp:', { chatId, caption: caption.substring(0, 50) + '...', filename: imageFilename });
  
  await wahaFetch('/api/sendImage', {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      file: {
        mimetype: imageMimeType,
        filename: imageFilename,
        data: imageBase64,
      },
      caption,
      session: SESSION_NAME,
    }),
  });
}

// Export config for components that need to check connection
export const wahaConfig = {
  apiUrl: WAHA_API_URL,
  sessionName: SESSION_NAME,
};
