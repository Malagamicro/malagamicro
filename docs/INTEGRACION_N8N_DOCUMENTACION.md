# 📋 DOCUMENTACIÓN COMPLETA DEL CRM - INTEGRACIÓN N8N Y STEL ORDER

**Fecha de generación:** 2026-02-09
**Proyecto:** Málaga Micro CRM
**URL Preview:** https://id-preview--f3bf1c78-0b5b-4342-aeab-ae4d614dbc9b.lovable.app
**URL Publicada:** https://malagamicro.lovable.app

---

## 📑 ÍNDICE

1. [Esquema de Base de Datos](#1-esquema-de-base-de-datos)
2. [Análisis del Módulo de Presupuestos](#2-análisis-del-módulo-de-presupuestos)
3. [Sistema de API y Webhooks](#3-sistema-de-api-y-webhooks)
4. [Configuración SMTP](#4-configuración-smtp)
5. [Integración WAHA (WhatsApp)](#5-integración-waha-whatsapp)
6. [Sistema de Gestión de Archivos](#6-sistema-de-gestión-de-archivos)
7. [Variables de Entorno y Secrets](#7-variables-de-entorno-y-secrets)
8. [Sistema de Autenticación](#8-sistema-de-autenticación)
9. [Estructura del Proyecto](#9-estructura-del-proyecto)
10. [Componente Chatbot IA](#10-componente-chatbot-ia)
11. [Endpoints para n8n](#11-endpoints-para-n8n)
12. [Mejoras Propuestas](#12-mejoras-propuestas)

---

## 1. ESQUEMA DE BASE DE DATOS

### Tablas Principales

#### `budget_requests` - Solicitudes de Presupuesto
```sql
CREATE TABLE public.budget_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID NOT NULL,
    prompt TEXT NOT NULL,
    emails JSONB NOT NULL DEFAULT '[]',
    products JSONB NOT NULL DEFAULT '[]',
    email_empresa TEXT DEFAULT 'presupuestos@malagamicro.com',
    request_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    emails_preview JSONB,
    response_data JSONB,
    solicitud_original TEXT
);

-- Estados posibles: pending, pending_approval, approved, rejected, completed, respondido, error
```

#### `budgets_received` - Presupuestos Recibidos de Proveedores
```sql
CREATE TABLE public.budgets_received (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    request_id TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    email_proveedor TEXT NOT NULL,
    productos JSONB NOT NULL DEFAULT '[]',
    total NUMERIC,
    observaciones TEXT,
    fecha_recepcion TIMESTAMP WITH TIME ZONE DEFAULT now(),
    selected BOOLEAN DEFAULT false,
    invoice_id TEXT,
    user_responsible UUID NOT NULL,
    validez TEXT,
    estado TEXT DEFAULT 'revision',
    email_original TEXT,
    stel_budget_id TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Estados: revision, aprobado, rechazado, enviado_stel
```

#### `budget_notifications` - Notificaciones de Presupuestos
```sql
CREATE TABLE public.budget_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    request_id TEXT,
    invoice_url TEXT,
    metadata JSONB
);

-- Tipos: success, warning, info, error
```

#### `providers` - Proveedores
```sql
CREATE TABLE public.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    especialidad TEXT[] DEFAULT '{}',
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'
);
```

#### `leads` - Leads/Prospectos
```sql
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    mobile_phone TEXT,
    website TEXT,
    address TEXT,
    city TEXT DEFAULT 'Málaga',
    status TEXT DEFAULT 'nuevo',  -- nuevo, contactado, interesado, cliente
    segment TEXT DEFAULT 'pyme',  -- pyme, autonomo, corporativo
    source TEXT DEFAULT 'manual',
    notes TEXT,
    tags TEXT[],
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    equipment_count INTEGER,
    score INTEGER DEFAULT 0,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    email_unsubscribed BOOLEAN DEFAULT false,
    folder_id UUID,
    whatsapp_verified BOOLEAN,
    whatsapp_sent_count INTEGER DEFAULT 0,
    phone_type TEXT DEFAULT 'unknown',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `profiles` - Perfiles de Usuario
```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    theme_preference TEXT DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `workflow_logs` - Logs de Workflows
```sql
CREATE TABLE public.workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    level TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    error_details TEXT,
    request_id TEXT,
    node_error TEXT,
    metadata JSONB
);
```

#### `waha_messages` - Mensajes de WhatsApp
```sql
CREATE TABLE public.waha_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT NOT NULL,
    content TEXT NOT NULL,
    from_me BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    message_id TEXT,
    media_url TEXT,
    message_type TEXT DEFAULT 'text',
    ack_status TEXT,
    reaction TEXT,
    reply_to_id TEXT,
    is_revoked BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    lead_id UUID,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `whatsapp_chats` - Chats de WhatsApp
```sql
CREATE TABLE public.whatsapp_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    chat_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    custom_name TEXT,
    avatar_url TEXT,
    is_archived BOOLEAN DEFAULT false,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    unread_count INTEGER DEFAULT 0,
    folder_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `shared_files` - Archivos Compartidos
```sql
CREATE TABLE public.shared_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT,
    description TEXT,
    folder_id UUID,
    folder_path TEXT DEFAULT '/',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `email_templates` - Plantillas de Email
```sql
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `message_templates` - Plantillas de Mensajes (WhatsApp)
```sql
CREATE TABLE public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `general_reminders` - Recordatorios Generales
```sql
CREATE TABLE public.general_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority TEXT DEFAULT 'normal',  -- low, normal, high
    category TEXT DEFAULT 'general',
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### `osticket_tickets` - Tickets de Soporte
```sql
CREATE TABLE public.osticket_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ticket_id TEXT,
    ticket_number TEXT,
    subject TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    department TEXT,
    priority TEXT,
    message TEXT,
    notification_phone TEXT,
    notification_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Funciones de Base de Datos

```sql
-- Calcular score de lead automáticamente
CREATE OR REPLACE FUNCTION public.calculate_lead_score(p_lead_id uuid) RETURNS integer;

-- Obtener email de usuario
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid) RETURNS text;

-- Verificar rol de usuario
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean;

-- Verificar participante de conversación
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid) RETURNS boolean;
```

---

## 2. ANÁLISIS DEL MÓDULO DE PRESUPUESTOS

### Estructura de Componentes

```
src/components/budget/
├── BudgetModule.tsx          # Módulo principal con tabs
├── BudgetChatbot.tsx         # Chatbot para crear solicitudes
├── BudgetApprovalPanel.tsx   # Panel de aprobaciones (solo admin)
├── BudgetsReceivedTable.tsx  # Tabla de presupuestos recibidos
├── BudgetDashboard.tsx       # Dashboard con estadísticas
├── BudgetNotificationsPopover.tsx # Popover de notificaciones
├── ManualBudgetUpload.tsx    # Subida manual de presupuestos
└── ProvidersManager.tsx      # Gestión de proveedores
```

### Flujo de Estados de un Presupuesto

```
┌─────────────┐     ┌───────────────────┐     ┌────────────┐
│   pending   │ ──► │ pending_approval  │ ──► │  approved  │
└─────────────┘     └───────────────────┘     └────────────┘
                            │                        │
                            ▼                        ▼
                    ┌────────────┐           ┌──────────────┐
                    │  rejected  │           │  respondido  │
                    └────────────┘           └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │   completed  │
                                            └──────────────┘
```

**Estados de `budget_requests`:**
- `pending` - Solicitud creada, pendiente de envío a n8n
- `pending_approval` - Esperando aprobación de admin (Inma)
- `approved` - Aprobada, emails enviados a proveedores
- `rejected` - Rechazada por admin
- `respondido` - Proveedor ha respondido con presupuesto
- `completed` - Proceso finalizado
- `error` - Error en el proceso

**Estados de `budgets_received`:**
- `revision` - Pendiente de revisión
- `aprobado` - Presupuesto del proveedor aprobado
- `rechazado` - Presupuesto del proveedor rechazado
- `enviado_stel` - Enviado a STEL Order

### Estructura JSON de un Presupuesto

```json
{
  "id": "uuid",
  "request_id": "BR-1234567890-abc123def",
  "prompt": "Necesito cotizar 100 sacos de cemento Portland",
  "emails": ["proveedor1@email.com", "proveedor2@email.com"],
  "products": [
    {
      "nombre": "Cemento Portland",
      "cantidad": 100,
      "unidad": "sacos"
    }
  ],
  "email_empresa": "presupuestos@malagamicro.com",
  "status": "pending_approval",
  "user_id": "user-uuid",
  "created_at": "2026-02-09T10:00:00Z"
}
```

### Estructura JSON de Presupuesto Recibido

```json
{
  "id": "uuid",
  "request_id": "BR-1234567890-abc123def",
  "proveedor": "Cementos del Sur",
  "email_proveedor": "ventas@cementosdelsur.com",
  "productos": [
    {
      "descripcion": "Cemento Portland 42.5R",
      "cantidad": 100,
      "precio_unitario": 4.50,
      "precio_total": 450.00,
      "iva": 21
    }
  ],
  "total": 544.50,
  "validez": "15 días",
  "observaciones": "Entrega en 48h",
  "estado": "revision",
  "fecha_recepcion": "2026-02-09T12:00:00Z"
}
```

### Hook Principal: `useBudgetRequests`

```typescript
interface BudgetRequest {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  prompt: string;
  emails: string[];
  products: BudgetProduct[];
  email_empresa: string;
  request_id: string;
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'error';
  emails_preview?: any;
  response_data?: any;
}

interface BudgetReceived {
  id: string;
  created_at: string;
  request_id: string;
  proveedor: string;
  email_proveedor: string;
  productos: BudgetProduct[];
  total: number;
  observaciones?: string;
  fecha_recepcion: string;
  selected: boolean;
  invoice_id?: string;
  user_responsible: string;
  estado?: string;
  validez?: string;
  stel_budget_id?: string;
}
```

---

## 3. SISTEMA DE API Y WEBHOOKS

### Edge Functions Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/functions/v1/budget-request` | POST | Crear solicitud de presupuesto |
| `/functions/v1/receive-budget-from-n8n` | POST | Webhook para recibir presupuestos de n8n |
| `/functions/v1/notify-n8n-approval` | POST | Notificar aprobación/rechazo a n8n |
| `/functions/v1/send-to-stel-order` | POST | Enviar presupuesto a STEL Order |
| `/functions/v1/send-smtp-email` | POST | Enviar email vía SMTP |
| `/functions/v1/send-whatsapp` | POST | Enviar mensaje WhatsApp |
| `/functions/v1/osticket-webhook` | POST | Webhook de osTicket |
| `/functions/v1/waha-webhook` | POST | Webhook de WAHA |
| `/functions/v1/perplexity-chat` | POST | Chat IA con herramientas |

### Autenticación de Endpoints

**Para endpoints autenticados (desde frontend):**
```typescript
const { data: session } = await supabase.auth.getSession();

const response = await supabase.functions.invoke('budget-request', {
  body: { ... },
  headers: {
    Authorization: `Bearer ${session.session?.access_token}`
  }
});
```

**Para webhooks externos (desde n8n):**
```typescript
// Headers requeridos
{
  'x-webhook-secret': 'TU_WEBHOOK_SECRET',
  // o
  'x-api-key': 'TU_API_KEY',
  // o
  'Authorization': 'Bearer TU_TOKEN'
}
```

### Ejemplo: Crear Endpoint POST para n8n

```typescript
// supabase/functions/n8n-presupuestos/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticación
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    
    if (webhookSecret && providedSecret !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Procesar datos
    const body = await req.json();
    const { solicitud_id, cliente, productos, prioridad } = body;

    // Cliente Supabase con service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Guardar en BD
    const { data, error } = await supabase
      .from('budget_requests')
      .insert({ ... })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 4. CONFIGURACIÓN SMTP

### Secrets Configurados

| Secret | Descripción |
|--------|-------------|
| `SMTP_HOST` | Servidor SMTP (ej: smtp.office365.com) |
| `SMTP_PORT` | Puerto (587 para STARTTLS) |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASSWORD` | Contraseña SMTP |
| `SMTP_FROM_EMAIL` | Email remitente |
| `SMTP_FROM_NAME` | Nombre remitente |

### Edge Function: send-smtp-email

```typescript
// Ubicación: supabase/functions/send-smtp-email/index.ts

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

// Ejemplo de uso:
await supabase.functions.invoke('send-smtp-email', {
  body: {
    to: 'destinatario@email.com',
    subject: 'Asunto del email',
    html: '<h1>Contenido HTML</h1>',
    replyTo: 'responder@email.com'
  }
});
```

### ⚠️ IMAP NO ESTÁ CONFIGURADO

Actualmente **NO** hay configuración IMAP para recibir emails. Para implementarlo, se necesitaría:

1. Crear tabla `emails_received`:
```sql
CREATE TABLE public.emails_received (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    message_id TEXT UNIQUE,
    in_reply_to TEXT,
    thread_id TEXT,
    attachments JSONB DEFAULT '[]',
    is_read BOOLEAN DEFAULT false,
    is_processed BOOLEAN DEFAULT false,
    request_id TEXT,
    user_id UUID
);
```

2. Crear Edge Function con `npm:imapflow` para polling de emails

3. Añadir secrets: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`

---

## 5. INTEGRACIÓN WAHA (WhatsApp)

### Configuración

```typescript
// src/services/wahaService.ts

const WAHA_API_URL = import.meta.env.VITE_WAHA_API_URL;  // URL de instancia WAHA
const WAHA_API_KEY = import.meta.env.VITE_WAHA_API_KEY;  // API Key
const SESSION_NAME = 'default';
```

### Funciones Disponibles

```typescript
// Gestión de sesión
getSessionStatus(): Promise<SessionInfo | null>
getSessionQrCode(): Promise<string | null>
createSession(): Promise<void>
startSession(): Promise<void>
stopSession(): Promise<void>
restartSession(): Promise<void>
deleteSession(): Promise<void>

// Envío de mensajes
sendText(payload: SendTextPayload): Promise<void>
sendImage(payload: SendImagePayload): Promise<void>
sendTextMessage(chatId: string, text: string): Promise<{ id?: string }>
sendImageMessage(chatId, imageBase64, mimeType, filename, caption): Promise<{ id?: string }>

// Utilidades
formatPhoneNumber(phone: string): string
canSendMessage(phone: string): { allowed: boolean; waitMs: number }
```

### Ejemplo: Enviar WhatsApp desde Backend

```typescript
// Edge function
const WAHA_API_URL = Deno.env.get('WAHA_API_URL');
const WAHA_API_KEY = Deno.env.get('WAHA_API_KEY');

async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const chatId = `34${phone.replace(/\D/g, '')}@c.us`;
  
  const response = await fetch(`${WAHA_API_URL}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_API_KEY,
    },
    body: JSON.stringify({
      chatId,
      text: message,
      session: 'default',
    }),
  });
  
  return response.ok;
}
```

### Eventos que Envían WhatsApp

1. **Tickets osTicket** - Cuando llega un nuevo ticket
2. **Recordatorios** - Notificaciones de recordatorios
3. **Presupuestos** - Notificaciones de nuevos presupuestos

---

## 6. SISTEMA DE GESTIÓN DE ARCHIVOS

### Storage Buckets (Supabase Storage)

| Bucket | Público | Uso |
|--------|---------|-----|
| `shared-files` | Sí | Archivos compartidos del equipo |
| `avatars` | Sí | Fotos de perfil |
| `chat-files` | Sí | Archivos de chat interno |
| `chat-avatars` | Sí | Avatares de chats |

### Hook: useSharedFiles

```typescript
// Subir archivo
const { uploadFile } = useSharedFiles(folderId);

await uploadFile.mutateAsync({
  file: File,
  description: 'Descripción opcional',
  folderId: 'uuid' | null
});

// Descargar/obtener URL
const { data: { publicUrl } } = supabase.storage
  .from('shared-files')
  .getPublicUrl(filePath);
```

### Recibir Archivos desde n8n

```typescript
// Edge function para recibir archivos base64
serve(async (req) => {
  const { filename, content_base64, mime_type, folder_id } = await req.json();
  
  const supabase = createClient(url, serviceKey);
  
  // Decodificar base64
  const binaryData = Uint8Array.from(atob(content_base64), c => c.charCodeAt(0));
  
  // Subir a storage
  const { error } = await supabase.storage
    .from('shared-files')
    .upload(`n8n/${filename}`, binaryData, {
      contentType: mime_type
    });
  
  // Guardar metadata en BD
  await supabase.from('shared_files').insert({
    file_name: filename,
    file_path: publicUrl,
    file_size: binaryData.length,
    file_type: mime_type,
    folder_id,
    user_id: systemUserId
  });
});
```

---

## 7. VARIABLES DE ENTORNO Y SECRETS

### Variables de Entorno (.env - Frontend)

```env
VITE_SUPABASE_PROJECT_ID="tkbwrtdniyijjqmaynow"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
VITE_SUPABASE_URL="https://tkbwrtdniyijjqmaynow.supabase.co"
VITE_WAHA_API_URL="https://tu-instancia-waha.trycloudflare.com"
VITE_WAHA_API_KEY="TU_WAHA_API_KEY"
```

### Secrets Configurados (Backend)

| Secret | Descripción |
|--------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anónima |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (admin) |
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Puerto SMTP |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASSWORD` | Contraseña SMTP |
| `SMTP_FROM_EMAIL` | Email remitente |
| `SMTP_FROM_NAME` | Nombre remitente |
| `WAHA_API_URL` | URL instancia WAHA |
| `WAHA_API_KEY` | API Key WAHA |
| `WAHA_WEBHOOK_SECRET` | Secret para webhooks WAHA |
| `N8N_WEBHOOK_URL` | URL base webhooks n8n |
| `STELORDER_API_KEY` | API Key STEL Order |
| `PERPLEXITY_API_KEY` | API Key Perplexity |
| `OPENROUTER_API_KEY` | API Key OpenRouter |
| `GOOGLE_MAPS_API_KEY` | API Key Google Maps |
| `FIRECRAWL_API_KEY` | API Key Firecrawl (scraping) |
| `LOVABLE_API_KEY` | API Key Lovable AI |
| `RESEND_API_KEY` | API Key Resend |

### Secrets Nuevos Recomendados para n8n

```
N8N_API_KEY=tu_api_key_n8n
N8N_WEBHOOK_SECRET=tu_secret_para_validar_webhooks
STELORDER_API_URL=https://api.stelorder.com/v2
IMAP_HOST=imap.neodigit.net
IMAP_PORT=993
IMAP_USER=presupuestos@malagamicro.com
IMAP_PASSWORD=tu_password_imap
```

---

## 8. SISTEMA DE AUTENTICACIÓN

### Proveedor: Supabase Auth

```typescript
// src/hooks/useAuth.tsx

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isEmailVerified: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resendVerification: () => Promise<{ error: Error | null }>;
}
```

### Sistema de Roles

```sql
-- Tabla de roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,  -- 'admin' | 'user'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Función para verificar rol
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean;
```

### Identificar Usuario en Backend

```typescript
// En Edge Function
const authHeader = req.headers.get('Authorization');
const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
  global: { headers: { Authorization: authHeader } }
});

const { data: { user }, error } = await supabase.auth.getUser();
// user.id, user.email, etc.
```

### Identificar Usuario en Frontend

```typescript
const { user } = useAuth();
// user?.id, user?.email
```

---

## 9. ESTRUCTURA DEL PROYECTO

### Árbol de Directorios

```
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── budget/          # Módulo de presupuestos
│   │   ├── chat/            # Chatbot IA
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── internal-chat/   # Chat interno equipo
│   │   ├── layout/          # Sidebar, navegación
│   │   ├── leads/           # Gestión de leads
│   │   ├── reminders/       # Recordatorios
│   │   ├── reports/         # Reportes
│   │   ├── settings/        # Configuraciones
│   │   ├── shared-files/    # Archivos compartidos
│   │   ├── ui/              # Componentes shadcn/ui
│   │   └── whatsapp/        # Integración WhatsApp
│   ├── hooks/
│   │   ├── useAuth.tsx
│   │   ├── useBudgetRequests.tsx
│   │   ├── useProviders.tsx
│   │   ├── useLeads.tsx
│   │   └── ...
│   ├── pages/
│   │   ├── Auth.tsx
│   │   ├── Budgets.tsx
│   │   ├── Index.tsx
│   │   └── ...
│   ├── services/
│   │   └── wahaService.ts
│   └── integrations/
│       └── supabase/
│           ├── client.ts
│           └── types.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
│       ├── budget-request/
│       ├── receive-budget-from-n8n/
│       ├── notify-n8n-approval/
│       ├── send-to-stel-order/
│       ├── send-smtp-email/
│       ├── osticket-webhook/
│       ├── waha-webhook/
│       ├── perplexity-chat/
│       └── ...
└── docs/
    └── INTEGRACION_N8N_DOCUMENTACION.md
```

### Tecnologías Principales

| Categoría | Tecnología | Versión |
|-----------|------------|---------|
| Frontend | React | ^18.3.1 |
| Build | Vite | - |
| Estilos | Tailwind CSS | - |
| UI | shadcn/ui, Radix UI | - |
| Routing | react-router-dom | ^6.30.1 |
| State | @tanstack/react-query | ^5.83.0 |
| Backend | Supabase (Lovable Cloud) | ^2.90.1 |
| Edge Functions | Deno | - |
| Validación | Zod | ^3.25.76 |
| Fechas | date-fns | ^3.6.0 |
| Gráficos | Recharts | ^2.15.4 |
| Drag & Drop | @hello-pangea/dnd | ^17.0.0 |

---

## 10. COMPONENTE CHATBOT IA

### Chatbot de Presupuestos (BudgetChatbot)

El chatbot guía al usuario paso a paso:

1. **Prompt** - Descripción de lo que necesita cotizar
2. **Emails** - Lista de proveedores
3. **Products** - Productos/servicios específicos
4. **Email empresa** - Email de respuesta
5. **Confirm** - Confirmación y envío

### Chatbot IA General (PerplexityChatbot)

Chatbot con herramientas para:
- Buscar/crear/actualizar leads
- Ver estadísticas
- Gestionar recordatorios
- Ver chats WhatsApp
- Gestionar archivos
- Ver tickets osTicket

**Modelo:** OpenRouter con herramientas (function calling)

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Buscar leads...",
      parameters: { ... }
    }
  },
  // ... 20+ herramientas disponibles
];
```

---

## 11. ENDPOINTS PARA N8N

### Endpoints Existentes

#### 1. POST `/functions/v1/budget-request`
Crear nueva solicitud de presupuesto desde chatbot.

```json
// Request
{
  "prompt": "Necesito cotizar cemento",
  "emails": ["proveedor@email.com"],
  "products": "100 sacos cemento Portland",
  "email_empresa": "presupuestos@malagamicro.com",
  "user_name": "Nombre Usuario"
}

// Response
{
  "success": true,
  "request_id": "BR-1234567890-abc123def",
  "message": "Solicitud enviada correctamente"
}
```

#### 2. POST `/functions/v1/receive-budget-from-n8n`
Recibir presupuesto procesado de proveedor.

```json
// Request
{
  "request_id": "BR-1234567890-abc123def",
  "proveedor": "Cementos del Sur",
  "email_proveedor": "ventas@cementos.com",
  "productos": [
    {
      "descripcion": "Cemento Portland",
      "cantidad": 100,
      "precio_unitario": 4.50,
      "precio_total": 450.00
    }
  ],
  "total_general": 544.50,
  "validez": "15 días",
  "observaciones": "Entrega en 48h",
  "email_original": "Contenido del email original"
}

// Response
{
  "success": true,
  "budget_id": "uuid",
  "message": "Presupuesto guardado correctamente"
}
```

#### 3. POST `/functions/v1/notify-n8n-approval`
Notificar aprobación/rechazo de presupuesto.

```json
// Request
{
  "budget_id": "uuid",
  "request_id": "BR-xxx",
  "accion": "aprobar",  // o "rechazar"
  "enviar_stel": true
}

// Response
{
  "success": true,
  "message": "Presupuesto aprobado correctamente"
}
```

#### 4. POST `/functions/v1/send-to-stel-order`
Crear presupuesto/factura en STEL Order.

```json
// Request
{
  "budget_id": "uuid",
  "create_type": "budget"  // o "invoice"
}

// Response
{
  "success": true,
  "stel_id": "123456",
  "message": "Presupuesto creado en STEL Order"
}
```

### Endpoints a Crear

#### 5. POST `/functions/v1/n8n/email-proveedor-enviado`
```typescript
// Registrar que se envió email a proveedor
{
  "presupuesto_id": "uuid",
  "proveedor_email": "email@proveedor.com",
  "email_message_id": "msg-123",
  "timestamp": "2026-02-09T10:00:00Z"
}
```

#### 6. GET `/functions/v1/n8n/configuracion`
```typescript
// Obtener configuración actual (requiere auth admin)
{
  "smtp": {
    "host": "smtp.office365.com",
    "port": 587,
    "from_email": "presupuestos@malagamicro.com"
  },
  "waha": {
    "url": "https://...",
    "session": "default"
  },
  "providers": [...],
  "email_templates": [...]
}
```

---

## 12. MEJORAS PROPUESTAS

### Migraciones SQL Recomendadas

```sql
-- 1. Tabla emails_recibidos para IMAP
CREATE TABLE public.emails_received (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    from_email TEXT NOT NULL,
    from_name TEXT,
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    message_id TEXT UNIQUE,
    attachments JSONB DEFAULT '[]',
    is_processed BOOLEAN DEFAULT false,
    request_id TEXT,
    provider_id UUID REFERENCES providers(id),
    user_id UUID
);

-- 2. Tabla de logs de presupuestos (auditoría)
CREATE TABLE public.budget_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    budget_id UUID,
    request_id TEXT,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    user_id UUID,
    user_email TEXT,
    metadata JSONB DEFAULT '{}'
);

-- 3. Cola de tareas para n8n
CREATE TABLE public.n8n_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    task_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    user_id UUID
);
```

---

## 📞 SOPORTE

Para dudas sobre esta documentación o la integración:
- **Email:** administracion@malagamicro.com
- **Proyecto ID:** tkbwrtdniyijjqmaynow

---

*Documentación generada automáticamente por Lovable AI*
