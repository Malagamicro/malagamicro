/**
 * WAHA (WhatsApp HTTP API) Service
 * Centralized service for all WhatsApp API interactions
 */

import { supabase } from "@/integrations/supabase/client";

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
  // QR code can be in the response directly
  qr?: {
    value?: string;
    data?: string;
  };
}

export interface SendTextPayload {
  phone: string;
  message: string;
  /** Optional: associate the outbound message with an existing lead */
  leadId?: string | null;
  /** Optional: avoid writing to DB when caller handles it (e.g., Inbox) */
  logToDb?: boolean;
}

export interface SendImagePayload {
  phone: string;
  caption: string;
  imageBase64: string;
  imageMimeType: string;
  imageFilename: string;
  /** Optional: associate the outbound message with an existing lead */
  leadId?: string | null;
  /** Optional: avoid writing to DB when caller handles it */
  logToDb?: boolean;
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

async function tryLogOutboundMessage(params: {
  chatId: string;
  content: string;
  leadId?: string | null;
}) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;

    const { error } = await (supabase as any).from("waha_messages").insert({
      chat_id: params.chatId,
      content: params.content,
      from_me: true,
      timestamp: new Date().toISOString(),
      lead_id: params.leadId ?? null,
      user_id: userId,
    });

    if (error) {
      // Do not fail the WhatsApp send if logging fails
      console.warn("Failed to log outbound WhatsApp message:", error);
    }
  } catch (e) {
    console.warn("Failed to log outbound WhatsApp message:", e);
  }
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
    // WAHA endpoint for QR: /api/{session}/auth/qr
    // Try different formats

    // Format 1: /api/{session}/auth/qr?format=raw (returns text)
    try {
      const textResponse = await fetch(`${WAHA_API_URL}/api/${SESSION_NAME}/auth/qr?format=raw`, {
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (textResponse.ok) {
        const text = await textResponse.text();
        if (text && text.length > 10 && !text.includes('<!DOCTYPE')) {
          console.log('QR obtained as raw text');
          return text;
        }
      }
    } catch (e) {
      console.log('Raw QR format not available');
    }

    // Format 2: /api/{session}/auth/qr (returns image)
    try {
      const imageResponse = await fetch(`${WAHA_API_URL}/api/${SESSION_NAME}/auth/qr`, {
        headers: {
          'X-Api-Key': WAHA_API_KEY,
          'Accept': 'image/png',
        },
      });

      if (imageResponse.ok) {
        const contentType = imageResponse.headers.get('content-type');
        if (contentType?.includes('image')) {
          const blob = await imageResponse.blob();
          console.log('QR obtained as image');
          return `image:${URL.createObjectURL(blob)}`;
        }
      }
    } catch (e) {
      console.log('Image QR format not available');
    }

    // Format 3: /api/screenshot?session={session} (some WAHA versions)
    try {
      const screenshotResponse = await fetch(`${WAHA_API_URL}/api/screenshot?session=${SESSION_NAME}`, {
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (screenshotResponse.ok) {
        const blob = await screenshotResponse.blob();
        if (blob.size > 1000) {
          console.log('QR obtained via screenshot');
          return `image:${URL.createObjectURL(blob)}`;
        }
      }
    } catch (e) {
      console.log('Screenshot not available');
    }

    console.log('No QR code available');
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

// Anti-spam: track last message timestamp per chat
const lastMessageTimestamps = new Map<string, number>();
const ANTI_SPAM_DELAY_MS = 5000; // 5 seconds minimum between messages

export function canSendMessage(phone: string): { allowed: boolean; waitMs: number } {
  const chatId = buildChatId(phone);
  const lastSent = lastMessageTimestamps.get(chatId);
  
  if (!lastSent) {
    return { allowed: true, waitMs: 0 };
  }
  
  const elapsed = Date.now() - lastSent;
  if (elapsed >= ANTI_SPAM_DELAY_MS) {
    return { allowed: true, waitMs: 0 };
  }
  
  return { allowed: false, waitMs: ANTI_SPAM_DELAY_MS - elapsed };
}

export async function sendText(payload: SendTextPayload): Promise<void> {
  const { phone, message, leadId, logToDb } = payload;
  const chatId = buildChatId(phone);
  
  // Anti-spam check
  const { allowed, waitMs } = canSendMessage(phone);
  if (!allowed) {
    throw new Error(`Espera ${Math.ceil(waitMs / 1000)} segundos antes de enviar otro mensaje`);
  }
  
  console.log('📤 Enviando WhatsApp:', { chatId, message: message.substring(0, 50) + '...' });
  
  await wahaFetch('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      text: message,
      session: SESSION_NAME,
    }),
  });
  
  // Record timestamp after successful send
  lastMessageTimestamps.set(chatId, Date.now());

  // Log to DB (so Inbox can show new chats even when sent from other screens)
  // NOTE: Inbox can disable this and do its own insert to include leadId, etc.
  // (kept best-effort: never throws)
  if (logToDb !== false) {
    await tryLogOutboundMessage({
      chatId,
      content: message,
      leadId,
    });
  }
}

export async function sendImage(payload: SendImagePayload): Promise<void> {
  const {
    phone,
    caption,
    imageBase64,
    imageMimeType,
    imageFilename,
    leadId,
    logToDb,
  } = payload;

  const chatId = buildChatId(phone);

  // Anti-spam check (same policy as sendText)
  const { allowed, waitMs } = canSendMessage(phone);
  if (!allowed) {
    throw new Error(`Espera ${Math.ceil(waitMs / 1000)} segundos antes de enviar otro mensaje`);
  }
  
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

  lastMessageTimestamps.set(chatId, Date.now());

  if (logToDb !== false) {
    await tryLogOutboundMessage({
      chatId,
      content: caption?.trim() || "[Imagen]",
      leadId,
    });
  }
}

// ============================================
// DIRECT CHAT ID MESSAGING (for Inbox)
// These functions work directly with chatId instead of phone
// and don't log to DB (Inbox handles its own logging)
// ============================================

export async function sendTextMessage(
  chatId: string, 
  text: string
): Promise<{ id?: string }> {
  console.log('📤 Enviando WhatsApp directo:', { chatId, text: text.substring(0, 50) + '...' });
  
  const response = await wahaFetch<{ id?: string }>('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      text,
      session: SESSION_NAME,
    }),
  });
  
  return response;
}

export async function sendImageMessage(
  chatId: string,
  imageBase64: string,
  imageMimeType: string,
  imageFilename: string,
  caption: string = ''
): Promise<{ id?: string }> {
  console.log('📤 Enviando imagen WhatsApp directo:', { chatId, caption: caption.substring(0, 50) + '...', filename: imageFilename });
  
  const response = await wahaFetch<{ id?: string }>('/api/sendImage', {
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
  
  return response;
}

// Export config for components that need to check connection
export const wahaConfig = {
  apiUrl: WAHA_API_URL,
  sessionName: SESSION_NAME,
};
