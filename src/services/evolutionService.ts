/**
 * Evolution API v2 Service
 * Centralized service for all WhatsApp API interactions via Evolution API
 */

import { supabase } from "@/integrations/supabase/client";

// Configuration from environment variables
const EVOLUTION_API_URL = import.meta.env.VITE_EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY || '';
const INSTANCE_NAME = import.meta.env.VITE_EVOLUTION_INSTANCE || '';

// Types
export type ConnectionState = 'open' | 'close' | 'connecting';

export interface InstanceInfo {
  instance: {
    instanceName: string;
    state: ConnectionState;
    profilePictureUrl?: string;
    profileName?: string;
  };
}

export interface QrCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

export interface SendTextPayload {
  phone: string;
  message: string;
  leadId?: string | null;
  logToDb?: boolean;
}

export interface SendImagePayload {
  phone: string;
  caption: string;
  imageBase64: string;
  imageMimeType: string;
  imageFilename: string;
  leadId?: string | null;
  logToDb?: boolean;
}

interface EvolutionError {
  message?: string;
  error?: string;
  status?: number;
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

// Helper to build chat ID (Evolution uses @s.whatsapp.net)
function buildRemoteJid(phone: string): string {
  const cleanPhone = formatPhoneNumber(phone);
  return `${cleanPhone}@s.whatsapp.net`;
}

// Build legacy chat ID for DB compatibility
function buildChatId(phone: string): string {
  const cleanPhone = formatPhoneNumber(phone);
  return `${cleanPhone}@s.whatsapp.net`;
}

// Generic fetch wrapper with error handling
async function evolutionFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData: EvolutionError = await response.json().catch(() => ({}));
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
      console.warn("Failed to log outbound WhatsApp message:", error);
    }
  } catch (e) {
    console.warn("Failed to log outbound WhatsApp message:", e);
  }
}

// ============================================
// SESSION / INSTANCE MANAGEMENT
// ============================================

export async function getConnectionState(): Promise<ConnectionState> {
  try {
    const data = await evolutionFetch<{ instance: { state: ConnectionState } }>(
      `/instance/connectionState/${INSTANCE_NAME}`
    );
    return data?.instance?.state || 'close';
  } catch (error) {
    console.error('Error fetching connection state:', error);
    return 'close';
  }
}

export async function getInstanceInfo(): Promise<InstanceInfo | null> {
  try {
    const data = await evolutionFetch<InstanceInfo[]>(
      `/instance/fetchInstances?instanceName=${INSTANCE_NAME}`
    );
    return data?.[0] || null;
  } catch (error) {
    console.error('Error fetching instance info:', error);
    return null;
  }
}

export async function connectInstance(): Promise<QrCodeResponse | null> {
  try {
    const data = await evolutionFetch<QrCodeResponse>(
      `/instance/connect/${INSTANCE_NAME}`
    );
    return data;
  } catch (error) {
    console.error('Error connecting instance:', error);
    return null;
  }
}

export async function restartInstance(): Promise<void> {
  await evolutionFetch(`/instance/restart/${INSTANCE_NAME}`, {
    method: 'PUT',
  });
}

export async function logoutInstance(): Promise<void> {
  await evolutionFetch(`/instance/logout/${INSTANCE_NAME}`, {
    method: 'DELETE',
  });
}

export async function deleteInstance(): Promise<void> {
  await evolutionFetch(`/instance/delete/${INSTANCE_NAME}`, {
    method: 'DELETE',
  });
}

// ============================================
// MESSAGING
// ============================================

// Anti-spam: track last message timestamp per chat
const lastMessageTimestamps = new Map<string, number>();
const ANTI_SPAM_DELAY_MS = 5000;

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
  const cleanPhone = formatPhoneNumber(phone);
  const chatId = buildChatId(phone);
  
  const { allowed, waitMs } = canSendMessage(phone);
  if (!allowed) {
    throw new Error(`Espera ${Math.ceil(waitMs / 1000)} segundos antes de enviar otro mensaje`);
  }
  
  console.log('📤 Enviando WhatsApp (Evolution):', { number: cleanPhone, message: message.substring(0, 50) + '...' });
  
  await evolutionFetch(`/message/sendText/${INSTANCE_NAME}`, {
    method: 'POST',
    body: JSON.stringify({
      number: cleanPhone,
      text: message,
    }),
  });
  
  lastMessageTimestamps.set(chatId, Date.now());

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

  const cleanPhone = formatPhoneNumber(phone);
  const chatId = buildChatId(phone);

  const { allowed, waitMs } = canSendMessage(phone);
  if (!allowed) {
    throw new Error(`Espera ${Math.ceil(waitMs / 1000)} segundos antes de enviar otro mensaje`);
  }
  
  console.log('📤 Enviando imagen WhatsApp (Evolution):', { number: cleanPhone, filename: imageFilename });
  
  await evolutionFetch(`/message/sendMedia/${INSTANCE_NAME}`, {
    method: 'POST',
    body: JSON.stringify({
      number: cleanPhone,
      mediatype: 'image',
      mimetype: imageMimeType,
      caption,
      media: imageBase64,
      fileName: imageFilename,
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
// ============================================

export async function sendTextMessage(
  chatId: string, 
  text: string
): Promise<{ id?: string }> {
  // Extract number from chatId (remove @s.whatsapp.net or @c.us)
  const number = chatId.replace(/@(s\.whatsapp\.net|c\.us)$/, '');
  
  console.log('📤 Enviando WhatsApp directo (Evolution):', { number, text: text.substring(0, 50) + '...' });
  
  const response = await evolutionFetch<{ key?: { id?: string } }>(`/message/sendText/${INSTANCE_NAME}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      text,
    }),
  });
  
  return { id: response?.key?.id };
}

export async function sendImageMessage(
  chatId: string,
  imageBase64: string,
  imageMimeType: string,
  imageFilename: string,
  caption: string = ''
): Promise<{ id?: string }> {
  const number = chatId.replace(/@(s\.whatsapp\.net|c\.us)$/, '');
  
  console.log('📤 Enviando imagen WhatsApp directo (Evolution):', { number, filename: imageFilename });
  
  const response = await evolutionFetch<{ key?: { id?: string } }>(`/message/sendMedia/${INSTANCE_NAME}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      mediatype: 'image',
      mimetype: imageMimeType,
      caption,
      media: imageBase64,
      fileName: imageFilename,
    }),
  });
  
  return { id: response?.key?.id };
}

// ============================================
// CHAT SYNC (Fetch from Evolution API)
// ============================================

export interface EvolutionChat {
  id: string;
  remoteJid: string;
  name?: string;
  profilePicUrl?: string;
  unreadMessages?: number;
  lastMsgTimestamp?: number;
}

export interface EvolutionChatMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { title?: string };
  };
  messageType?: string;
  messageTimestamp?: number;
  status?: number;
  mediaUrl?: string;
}

export async function fetchAllChats(): Promise<EvolutionChat[]> {
  try {
    const data = await evolutionFetch<EvolutionChat[]>(
      `/chat/findChats/${INSTANCE_NAME}`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    // Filter only individual chats (not groups)
    return (data || []).filter(c => c.remoteJid?.endsWith('@s.whatsapp.net'));
  } catch (error) {
    console.error('Error fetching chats from Evolution API:', error);
    return [];
  }
}

export async function fetchChatMessages(
  remoteJid: string, 
  limit: number = 50
): Promise<EvolutionChatMessage[]> {
  try {
    const data = await evolutionFetch<{ messages?: { records: EvolutionChatMessage[] } }>(
      `/chat/findMessages/${INSTANCE_NAME}`,
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          where: { key: { remoteJid } },
          limit,
        }) 
      }
    );
    return data?.messages?.records || [];
  } catch (error) {
    console.error('Error fetching messages from Evolution API:', error);
    return [];
  }
}

// Extract text content from a fetched message
export function extractMessageContent(msg: EvolutionChatMessage): string {
  if (!msg.message) return '';
  const m = msg.message;
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.documentMessage?.title
    || '';
}

// Fetch profile picture URL for a contact
export async function fetchProfilePicture(remoteJid: string): Promise<string | null> {
  try {
    const number = remoteJid.replace(/@(s\.whatsapp\.net|c\.us)$/, '');
    const data = await evolutionFetch<{ profilePictureUrl?: string; wuid?: string }>(
      `/chat/fetchProfilePictureUrl/${INSTANCE_NAME}`,
      { 
        method: 'POST', 
        body: JSON.stringify({ number }) 
      }
    );
    return data?.profilePictureUrl || null;
  } catch (error) {
    // Profile picture may not be available for all contacts
    return null;
  }
}

// Export config for components
export const evolutionConfig = {
  apiUrl: EVOLUTION_API_URL,
  instanceName: INSTANCE_NAME,
};
