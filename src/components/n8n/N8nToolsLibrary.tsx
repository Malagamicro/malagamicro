import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Copy, Search, Download, BookOpen, Zap, Users, Calendar, Bell, FileText, MessageSquare, Mail, Brain, Ticket, Building2, Shield, Globe, FolderOpen, BarChart3, Sparkles, Eye, Lock, MessagesSquare, Newspaper } from 'lucide-react';
import { toast } from 'sonner';
import { ApiKeysManager } from './ApiKeysManager';

const BASE_URL_PLACEHOLDER = 'https://tkbwrtdniyijjqmaynow.supabase.co/functions/v1/crm-api';

interface N8nTool {
  id: string;
  name: string;
  description: string;
  toolDescription: string;
  method: string;
  path: string;
  icon: React.ReactNode;
  category: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  bodyFields?: { name: string; type: string; required: boolean; description: string }[];
  queryParams?: { name: string; type: string; description: string }[];
}

const TOOLS: N8nTool[] = [
  // LEADS
  {
    id: 'list-leads', name: 'Listar Leads', description: 'Obtiene todos los leads del CRM',
    toolDescription: 'Lista todos los leads/clientes potenciales del CRM. Puedes filtrar por estado (nuevo, contactado, interesado, cliente, perdido) y buscar por nombre o email.',
    method: 'GET', path: '/leads', icon: <Users className="w-4 h-4" />, category: 'Leads',
    queryParams: [
      { name: 'status', type: 'string', description: 'Filtrar por estado: nuevo, contactado, interesado, cliente, perdido' },
      { name: 'search', type: 'string', description: 'Buscar por nombre de empresa, contacto o email' },
      { name: 'limit', type: 'number', description: 'Límite de resultados (default: 50)' },
    ],
  },
  {
    id: 'get-lead', name: 'Obtener Lead', description: 'Obtiene un lead específico por ID',
    toolDescription: 'Obtiene los detalles completos de un lead específico por su ID. Incluye nombre, empresa, email, teléfono, estado, notas y más.',
    method: 'GET', path: '/leads/{id}', icon: <Users className="w-4 h-4" />, category: 'Leads',
  },
  {
    id: 'create-lead', name: 'Crear Lead', description: 'Crea un nuevo lead en el CRM',
    toolDescription: 'Crea un nuevo lead/cliente potencial en el CRM con los datos proporcionados.',
    method: 'POST', path: '/leads', icon: <Users className="w-4 h-4" />, category: 'Leads',
    bodyFields: [
      { name: 'company_name', type: 'string', required: true, description: 'Nombre de la empresa' },
      { name: 'contact_name', type: 'string', required: false, description: 'Nombre del contacto' },
      { name: 'email', type: 'string', required: false, description: 'Email del lead' },
      { name: 'phone', type: 'string', required: false, description: 'Teléfono' },
      { name: 'city', type: 'string', required: false, description: 'Ciudad' },
      { name: 'status', type: 'string', required: false, description: 'Estado: nuevo, contactado, interesado, cliente, perdido' },
      { name: 'source', type: 'string', required: false, description: 'Fuente del lead' },
      { name: 'notes', type: 'string', required: false, description: 'Notas adicionales' },
    ],
  },
  {
    id: 'update-lead', name: 'Actualizar Lead', description: 'Actualiza datos de un lead existente',
    toolDescription: 'Actualiza los campos de un lead existente. Puedes actualizar cualquier campo: estado, notas, contacto, etc.',
    method: 'PATCH', path: '/leads/{id}', icon: <Users className="w-4 h-4" />, category: 'Leads',
    bodyFields: [
      { name: 'status', type: 'string', required: false, description: 'Nuevo estado' },
      { name: 'notes', type: 'string', required: false, description: 'Notas' },
      { name: 'contact_name', type: 'string', required: false, description: 'Nombre del contacto' },
      { name: 'email', type: 'string', required: false, description: 'Email' },
      { name: 'phone', type: 'string', required: false, description: 'Teléfono' },
    ],
  },
  {
    id: 'delete-lead', name: 'Eliminar Lead', description: 'Elimina un lead por ID',
    toolDescription: 'Elimina permanentemente un lead del CRM por su ID.',
    method: 'DELETE', path: '/leads/{id}', icon: <Users className="w-4 h-4" />, category: 'Leads',
  },

  // ACTIVITIES
  {
    id: 'list-activities', name: 'Listar Actividades', description: 'Obtiene actividades de un lead',
    toolDescription: 'Lista todas las actividades/historial de interacciones de un lead específico.',
    method: 'GET', path: '/lead-activities?lead_id={lead_id}', icon: <FileText className="w-4 h-4" />, category: 'Leads',
    queryParams: [{ name: 'lead_id', type: 'string', description: 'ID del lead (requerido)' }],
  },
  {
    id: 'create-activity', name: 'Registrar Actividad', description: 'Registra una actividad en un lead',
    toolDescription: 'Registra una nueva actividad o interacción en el historial de un lead.',
    method: 'POST', path: '/lead-activities', icon: <FileText className="w-4 h-4" />, category: 'Leads',
    bodyFields: [
      { name: 'lead_id', type: 'string', required: true, description: 'ID del lead' },
      { name: 'type', type: 'string', required: true, description: 'Tipo: llamada, email, visita, nota, whatsapp' },
      { name: 'description', type: 'string', required: true, description: 'Descripción de la actividad' },
    ],
  },

  // REMINDERS
  {
    id: 'list-reminders', name: 'Listar Recordatorios', description: 'Obtiene los recordatorios del usuario',
    toolDescription: 'Lista todos los recordatorios pendientes o completados del usuario.',
    method: 'GET', path: '/reminders', icon: <Bell className="w-4 h-4" />, category: 'Recordatorios',
    queryParams: [{ name: 'completed', type: 'string', description: 'Filtrar: true o false' }],
  },
  {
    id: 'create-reminder', name: 'Crear Recordatorio', description: 'Crea un nuevo recordatorio',
    toolDescription: 'Crea un nuevo recordatorio con fecha, título, prioridad y más.',
    method: 'POST', path: '/reminders', icon: <Bell className="w-4 h-4" />, category: 'Recordatorios',
    bodyFields: [
      { name: 'title', type: 'string', required: true, description: 'Título del recordatorio' },
      { name: 'description', type: 'string', required: false, description: 'Descripción' },
      { name: 'reminder_date', type: 'string', required: true, description: 'Fecha ISO 8601 (ej: 2025-12-31T09:00:00Z)' },
      { name: 'priority', type: 'string', required: false, description: 'Prioridad: low, normal, high, urgent' },
      { name: 'category', type: 'string', required: false, description: 'Categoría: general, lead, tarea' },
    ],
  },
  {
    id: 'complete-reminder', name: 'Completar Recordatorio', description: 'Marca un recordatorio como completado',
    toolDescription: 'Marca un recordatorio existente como completado.',
    method: 'PATCH', path: '/reminders/{id}', icon: <Bell className="w-4 h-4" />, category: 'Recordatorios',
    bodyFields: [{ name: 'is_completed', type: 'boolean', required: true, description: 'true para completar' }],
  },

  // CALENDAR
  {
    id: 'list-events', name: 'Listar Eventos', description: 'Obtiene los eventos del calendario',
    toolDescription: 'Lista todos los eventos del calendario del usuario.',
    method: 'GET', path: '/calendar', icon: <Calendar className="w-4 h-4" />, category: 'Calendario',
  },
  {
    id: 'create-event', name: 'Crear Evento', description: 'Crea un evento en el calendario',
    toolDescription: 'Crea un nuevo evento en el calendario con fecha, hora y detalles.',
    method: 'POST', path: '/calendar', icon: <Calendar className="w-4 h-4" />, category: 'Calendario',
    bodyFields: [
      { name: 'title', type: 'string', required: true, description: 'Título del evento' },
      { name: 'event_date', type: 'string', required: true, description: 'Fecha (YYYY-MM-DD)' },
      { name: 'start_time', type: 'string', required: true, description: 'Hora inicio (HH:MM)' },
      { name: 'end_time', type: 'string', required: false, description: 'Hora fin (HH:MM)' },
      { name: 'description', type: 'string', required: false, description: 'Descripción' },
      { name: 'all_day', type: 'boolean', required: false, description: 'Evento de todo el día' },
    ],
  },

  // NOTES
  {
    id: 'list-notes', name: 'Listar Notas', description: 'Obtiene las notas rápidas',
    toolDescription: 'Lista todas las notas rápidas del usuario.',
    method: 'GET', path: '/notes', icon: <FileText className="w-4 h-4" />, category: 'Notas',
  },
  {
    id: 'create-note', name: 'Crear Nota', description: 'Crea una nota rápida',
    toolDescription: 'Crea una nueva nota rápida.',
    method: 'POST', path: '/notes', icon: <FileText className="w-4 h-4" />, category: 'Notas',
    bodyFields: [
      { name: 'title', type: 'string', required: true, description: 'Título de la nota' },
      { name: 'content', type: 'string', required: true, description: 'Contenido' },
    ],
  },

  // PROVIDERS
  {
    id: 'list-providers', name: 'Listar Proveedores', description: 'Obtiene los proveedores',
    toolDescription: 'Lista todos los proveedores registrados.',
    method: 'GET', path: '/providers', icon: <Building2 className="w-4 h-4" />, category: 'Proveedores',
  },
  {
    id: 'create-provider', name: 'Crear Proveedor', description: 'Registra un nuevo proveedor',
    toolDescription: 'Registra un nuevo proveedor en el sistema.',
    method: 'POST', path: '/providers', icon: <Building2 className="w-4 h-4" />, category: 'Proveedores',
    bodyFields: [
      { name: 'nombre', type: 'string', required: true, description: 'Nombre del proveedor' },
      { name: 'email', type: 'string', required: true, description: 'Email del proveedor' },
      { name: 'telefono', type: 'string', required: false, description: 'Teléfono' },
      { name: 'categoria', type: 'string', required: false, description: 'Categoría' },
      { name: 'notas', type: 'string', required: false, description: 'Notas' },
    ],
  },

  // AI MEMORY
  {
    id: 'list-memory', name: 'Listar Memoria IA', description: 'Obtiene los registros de memoria IA',
    toolDescription: 'Lista todos los registros de memoria IA del usuario y los compartidos.',
    method: 'GET', path: '/ai-memory', icon: <Brain className="w-4 h-4" />, category: 'IA',
  },
  {
    id: 'create-memory', name: 'Crear Memoria IA', description: 'Guarda información en la memoria IA',
    toolDescription: 'Guarda un nuevo registro en la memoria IA. Puede ser compartido o personal.',
    method: 'POST', path: '/ai-memory', icon: <Brain className="w-4 h-4" />, category: 'IA',
    bodyFields: [
      { name: 'memory_key', type: 'string', required: true, description: 'Clave/nombre del recuerdo' },
      { name: 'memory_value', type: 'object', required: true, description: 'Valor (JSON object)' },
      { name: 'category', type: 'string', required: false, description: 'Categoría: general, lead, producto, proceso' },
      { name: 'is_shared', type: 'boolean', required: false, description: 'true = visible para todos' },
    ],
  },

  // WHATSAPP
  {
    id: 'send-whatsapp', name: 'Enviar WhatsApp', description: 'Envía un mensaje de WhatsApp',
    toolDescription: 'Envía un mensaje de texto por WhatsApp a un número de teléfono.',
    method: 'POST', path: '/send-whatsapp', icon: <MessageSquare className="w-4 h-4" />, category: 'Comunicación',
    bodyFields: [
      { name: 'phone', type: 'string', required: true, description: 'Número con código país (ej: 34612345678)' },
      { name: 'message', type: 'string', required: true, description: 'Texto del mensaje' },
    ],
  },

  // EMAIL
  {
    id: 'send-email', name: 'Enviar Email', description: 'Envía un email desde tu perfil SMTP',
    toolDescription: 'Envía un email utilizando el perfil de correo configurado del usuario.',
    method: 'POST', path: '/send-email', icon: <Mail className="w-4 h-4" />, category: 'Comunicación',
    bodyFields: [
      { name: 'to', type: 'string', required: true, description: 'Dirección de email destino' },
      { name: 'subject', type: 'string', required: true, description: 'Asunto del email' },
      { name: 'body', type: 'string', required: true, description: 'Cuerpo del email (HTML permitido)' },
    ],
  },

  // TICKETS
  {
    id: 'list-tickets', name: 'Listar Tickets', description: 'Obtiene los tickets de soporte',
    toolDescription: 'Lista todos los tickets de soporte del usuario.',
    method: 'GET', path: '/tickets', icon: <Ticket className="w-4 h-4" />, category: 'Soporte',
  },
  {
    id: 'create-ticket', name: 'Crear Ticket', description: 'Crea un ticket de soporte',
    toolDescription: 'Crea un nuevo ticket de soporte.',
    method: 'POST', path: '/tickets', icon: <Ticket className="w-4 h-4" />, category: 'Soporte',
    bodyFields: [
      { name: 'subject', type: 'string', required: true, description: 'Asunto del ticket' },
      { name: 'message', type: 'string', required: false, description: 'Mensaje/descripción' },
      { name: 'priority', type: 'string', required: false, description: 'Prioridad: low, normal, high, emergency' },
      { name: 'customer_name', type: 'string', required: false, description: 'Nombre del cliente' },
      { name: 'customer_email', type: 'string', required: false, description: 'Email del cliente' },
    ],
  },

  // PROFILE
  {
    id: 'get-profile', name: 'Mi Perfil', description: 'Obtiene el perfil del usuario autenticado',
    toolDescription: 'Obtiene los datos del perfil del usuario asociado a la API Key.',
    method: 'GET', path: '/profile', icon: <Users className="w-4 h-4" />, category: 'Perfil',
  },

  // ===== CHAT INTERNO =====
  {
    id: 'list-conversations', name: 'Listar Conversaciones', description: 'Obtiene las conversaciones del chat interno',
    toolDescription: 'Lista todas las conversaciones del chat interno en las que participa el usuario.',
    method: 'GET', path: '/conversations', icon: <MessagesSquare className="w-4 h-4" />, category: 'Chat Interno',
  },
  {
    id: 'get-conversation-messages', name: 'Mensajes de Conversación', description: 'Obtiene los mensajes de una conversación',
    toolDescription: 'Lista los mensajes de una conversación específica del chat interno.',
    method: 'GET', path: '/conversations/{conversation_id}', icon: <MessagesSquare className="w-4 h-4" />, category: 'Chat Interno',
    queryParams: [{ name: 'limit', type: 'number', description: 'Límite de mensajes (default: 100)' }],
  },
  {
    id: 'create-conversation', name: 'Crear Conversación', description: 'Crea una nueva conversación',
    toolDescription: 'Crea una nueva conversación en el chat interno y añade participantes.',
    method: 'POST', path: '/conversations', icon: <MessagesSquare className="w-4 h-4" />, category: 'Chat Interno',
    bodyFields: [
      { name: 'name', type: 'string', required: false, description: 'Nombre de la conversación (para grupos)' },
      { name: 'is_group', type: 'boolean', required: false, description: 'true para grupo, false para 1:1' },
      { name: 'participant_ids', type: 'array', required: true, description: 'Array de UUIDs de los participantes' },
    ],
  },
  {
    id: 'send-internal-message', name: 'Enviar Mensaje Interno', description: 'Envía un mensaje en una conversación',
    toolDescription: 'Envía un mensaje de texto a una conversación del chat interno.',
    method: 'POST', path: '/send-message', icon: <MessagesSquare className="w-4 h-4" />, category: 'Chat Interno',
    bodyFields: [
      { name: 'conversation_id', type: 'string', required: true, description: 'ID de la conversación' },
      { name: 'content', type: 'string', required: true, description: 'Texto del mensaje' },
    ],
  },

  // ===== SEGURIDAD =====
  {
    id: 'list-audit-logs', name: 'Listar Auditoría', description: 'Obtiene los logs de auditoría',
    toolDescription: 'Lista los registros de auditoría del sistema. Puedes filtrar por usuario, acción o tipo de entidad.',
    method: 'GET', path: '/audit-logs', icon: <Shield className="w-4 h-4" />, category: 'Seguridad',
    queryParams: [
      { name: 'user_id', type: 'string', description: 'Filtrar por ID de usuario' },
      { name: 'action', type: 'string', description: 'Filtrar por acción (ej: login, create, update)' },
      { name: 'entity_type', type: 'string', description: 'Filtrar por tipo de entidad' },
      { name: 'limit', type: 'number', description: 'Límite de resultados (default: 100)' },
    ],
  },
  {
    id: 'create-audit-log', name: 'Registrar Auditoría', description: 'Crea un registro de auditoría manual',
    toolDescription: 'Registra una entrada manual en el log de auditoría del sistema.',
    method: 'POST', path: '/audit-logs', icon: <Shield className="w-4 h-4" />, category: 'Seguridad',
    bodyFields: [
      { name: 'action', type: 'string', required: true, description: 'Acción realizada' },
      { name: 'entity_type', type: 'string', required: true, description: 'Tipo de entidad afectada' },
      { name: 'entity_id', type: 'string', required: false, description: 'ID de la entidad' },
      { name: 'details', type: 'object', required: false, description: 'Detalles adicionales (JSON)' },
    ],
  },
  {
    id: 'list-login-logs', name: 'Listar Logins', description: 'Obtiene el historial de inicios de sesión',
    toolDescription: 'Lista los registros de inicios de sesión con IP, ubicación y dispositivo.',
    method: 'GET', path: '/login-logs', icon: <Eye className="w-4 h-4" />, category: 'Seguridad',
    queryParams: [
      { name: 'user_id', type: 'string', description: 'Filtrar por ID de usuario' },
      { name: 'limit', type: 'number', description: 'Límite de resultados (default: 50)' },
    ],
  },
  {
    id: 'list-security-blocks', name: 'Listar Bloqueos', description: 'Obtiene los bloqueos de seguridad activos',
    toolDescription: 'Lista todos los bloqueos de seguridad activos en el sistema.',
    method: 'GET', path: '/security-blocks', icon: <Lock className="w-4 h-4" />, category: 'Seguridad',
  },
  {
    id: 'resolve-security-block', name: 'Resolver Bloqueo', description: 'Desactiva un bloqueo de seguridad',
    toolDescription: 'Desactiva un bloqueo de seguridad existente, permitiendo el acceso nuevamente.',
    method: 'PATCH', path: '/security-blocks/{id}', icon: <Lock className="w-4 h-4" />, category: 'Seguridad',
  },
  {
    id: 'list-ip-whitelist', name: 'Listar IPs Permitidas', description: 'Obtiene la lista blanca de IPs',
    toolDescription: 'Lista todas las direcciones IP en la lista blanca de seguridad.',
    method: 'GET', path: '/ip-whitelist', icon: <Globe className="w-4 h-4" />, category: 'Seguridad',
  },
  {
    id: 'add-ip-whitelist', name: 'Añadir IP a Lista Blanca', description: 'Añade una IP a la lista blanca',
    toolDescription: 'Añade una dirección IP a la lista blanca de seguridad.',
    method: 'POST', path: '/ip-whitelist', icon: <Globe className="w-4 h-4" />, category: 'Seguridad',
    bodyFields: [
      { name: 'ip_address', type: 'string', required: true, description: 'Dirección IP' },
      { name: 'reason', type: 'string', required: false, description: 'Motivo' },
    ],
  },

  // ===== ARCHIVOS COMPARTIDOS =====
  {
    id: 'list-shared-files', name: 'Listar Archivos', description: 'Obtiene los archivos compartidos',
    toolDescription: 'Lista los archivos compartidos del equipo. Filtra por carpeta con folder_id.',
    method: 'GET', path: '/shared-files', icon: <FolderOpen className="w-4 h-4" />, category: 'Archivos',
    queryParams: [{ name: 'folder_id', type: 'string', description: 'ID de carpeta (vacío = raíz)' }],
  },
  {
    id: 'list-shared-folders', name: 'Listar Carpetas', description: 'Obtiene las carpetas compartidas',
    toolDescription: 'Lista todas las carpetas compartidas del equipo.',
    method: 'GET', path: '/shared-folders', icon: <FolderOpen className="w-4 h-4" />, category: 'Archivos',
  },
  {
    id: 'create-shared-folder', name: 'Crear Carpeta', description: 'Crea una carpeta compartida',
    toolDescription: 'Crea una nueva carpeta en el sistema de archivos compartidos.',
    method: 'POST', path: '/shared-folders', icon: <FolderOpen className="w-4 h-4" />, category: 'Archivos',
    bodyFields: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la carpeta' },
      { name: 'parent_id', type: 'string', required: false, description: 'ID de carpeta padre (vacío = raíz)' },
      { name: 'color', type: 'string', required: false, description: 'Color hex (ej: #3b82f6)' },
    ],
  },

  // ===== CAMPAÑAS EMAIL =====
  {
    id: 'list-campaigns', name: 'Listar Campañas', description: 'Obtiene las campañas de email',
    toolDescription: 'Lista todas las campañas de email marketing del usuario.',
    method: 'GET', path: '/campaigns', icon: <Mail className="w-4 h-4" />, category: 'Email Marketing',
  },
  {
    id: 'create-campaign', name: 'Crear Campaña', description: 'Crea una nueva campaña de email',
    toolDescription: 'Crea una nueva campaña de email marketing.',
    method: 'POST', path: '/campaigns', icon: <Mail className="w-4 h-4" />, category: 'Email Marketing',
    bodyFields: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la campaña' },
      { name: 'template_id', type: 'string', required: false, description: 'ID de la plantilla' },
      { name: 'status', type: 'string', required: false, description: 'Estado: draft, scheduled, sent' },
    ],
  },
  {
    id: 'list-email-templates', name: 'Listar Plantillas Email', description: 'Obtiene las plantillas de email',
    toolDescription: 'Lista todas las plantillas de email del usuario.',
    method: 'GET', path: '/email-templates', icon: <Mail className="w-4 h-4" />, category: 'Email Marketing',
  },
  {
    id: 'create-email-template', name: 'Crear Plantilla Email', description: 'Crea una plantilla de email',
    toolDescription: 'Crea una nueva plantilla de email reutilizable.',
    method: 'POST', path: '/email-templates', icon: <Mail className="w-4 h-4" />, category: 'Email Marketing',
    bodyFields: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la plantilla' },
      { name: 'subject', type: 'string', required: true, description: 'Asunto del email' },
      { name: 'body', type: 'string', required: true, description: 'Cuerpo HTML del email' },
    ],
  },

  // ===== PLANTILLAS WHATSAPP =====
  {
    id: 'list-message-templates', name: 'Listar Plantillas WhatsApp', description: 'Obtiene las plantillas de mensajes',
    toolDescription: 'Lista todas las plantillas de mensajes predefinidas para WhatsApp.',
    method: 'GET', path: '/message-templates', icon: <MessageSquare className="w-4 h-4" />, category: 'Comunicación',
  },
  {
    id: 'create-message-template', name: 'Crear Plantilla WhatsApp', description: 'Crea una plantilla de mensaje',
    toolDescription: 'Crea una nueva plantilla de mensaje para WhatsApp.',
    method: 'POST', path: '/message-templates', icon: <MessageSquare className="w-4 h-4" />, category: 'Comunicación',
    bodyFields: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la plantilla' },
      { name: 'content', type: 'string', required: true, description: 'Contenido del mensaje' },
      { name: 'category', type: 'string', required: false, description: 'Categoría' },
    ],
  },

  // ===== WHATSAPP CHATS =====
  {
    id: 'list-whatsapp-chats', name: 'Listar Chats WhatsApp', description: 'Obtiene los chats de WhatsApp',
    toolDescription: 'Lista todos los chats de WhatsApp con sus últimos mensajes.',
    method: 'GET', path: '/whatsapp-chats', icon: <MessageSquare className="w-4 h-4" />, category: 'Comunicación',
  },
  {
    id: 'list-whatsapp-messages', name: 'Mensajes WhatsApp', description: 'Obtiene mensajes de un chat de WhatsApp',
    toolDescription: 'Lista los mensajes de un chat específico de WhatsApp.',
    method: 'GET', path: '/whatsapp-messages', icon: <MessageSquare className="w-4 h-4" />, category: 'Comunicación',
    queryParams: [
      { name: 'chat_id', type: 'string', description: 'ID del chat (requerido)' },
      { name: 'limit', type: 'number', description: 'Límite de mensajes (default: 100)' },
    ],
  },

  // ===== PRESUPUESTOS =====
  {
    id: 'list-budget-requests', name: 'Listar Solicitudes Presupuesto', description: 'Obtiene las solicitudes de presupuesto',
    toolDescription: 'Lista todas las solicitudes de presupuesto del usuario.',
    method: 'GET', path: '/budget-requests', icon: <FileText className="w-4 h-4" />, category: 'Presupuestos',
  },
  {
    id: 'list-budgets-received', name: 'Listar Presupuestos Recibidos', description: 'Obtiene los presupuestos recibidos de proveedores',
    toolDescription: 'Lista los presupuestos recibidos de proveedores, filtrable por solicitud.',
    method: 'GET', path: '/budgets-received', icon: <FileText className="w-4 h-4" />, category: 'Presupuestos',
    queryParams: [{ name: 'request_id', type: 'string', description: 'Filtrar por ID de solicitud' }],
  },

  // ===== INFORMES =====
  {
    id: 'list-reports', name: 'Listar Informes', description: 'Obtiene los informes generados',
    toolDescription: 'Lista todos los informes generados por el usuario.',
    method: 'GET', path: '/reports', icon: <BarChart3 className="w-4 h-4" />, category: 'Informes',
  },
  {
    id: 'create-report', name: 'Crear Informe', description: 'Genera un nuevo informe',
    toolDescription: 'Crea un nuevo informe con contenido personalizado.',
    method: 'POST', path: '/reports', icon: <BarChart3 className="w-4 h-4" />, category: 'Informes',
    bodyFields: [
      { name: 'title', type: 'string', required: true, description: 'Título del informe' },
      { name: 'content', type: 'string', required: true, description: 'Contenido del informe' },
      { name: 'report_type', type: 'string', required: false, description: 'Tipo: exit_report, weekly, custom' },
    ],
  },

  // ===== SEO =====
  {
    id: 'list-seo-articles', name: 'Listar Artículos SEO', description: 'Obtiene los artículos SEO generados',
    toolDescription: 'Lista todos los artículos SEO generados por el usuario.',
    method: 'GET', path: '/seo-articles', icon: <Newspaper className="w-4 h-4" />, category: 'SEO',
  },

  // ===== NOTAS TICKETS =====
  {
    id: 'list-ticket-notes', name: 'Notas de Ticket', description: 'Obtiene las notas de un ticket',
    toolDescription: 'Lista las notas de un ticket de soporte específico.',
    method: 'GET', path: '/ticket-notes', icon: <Ticket className="w-4 h-4" />, category: 'Soporte',
    queryParams: [{ name: 'ticket_id', type: 'string', description: 'ID del ticket (requerido)' }],
  },
  {
    id: 'create-ticket-note', name: 'Crear Nota de Ticket', description: 'Añade una nota a un ticket',
    toolDescription: 'Añade una nota/comentario a un ticket de soporte.',
    method: 'POST', path: '/ticket-notes', icon: <Ticket className="w-4 h-4" />, category: 'Soporte',
    bodyFields: [
      { name: 'ticket_id', type: 'string', required: true, description: 'ID del ticket' },
      { name: 'content', type: 'string', required: true, description: 'Contenido de la nota' },
    ],
  },

  // ===== CARPETAS LEADS =====
  {
    id: 'list-lead-folders', name: 'Listar Carpetas de Leads', description: 'Obtiene las carpetas de leads',
    toolDescription: 'Lista todas las carpetas de organización de leads del usuario.',
    method: 'GET', path: '/lead-folders', icon: <FolderOpen className="w-4 h-4" />, category: 'Leads',
  },
  {
    id: 'create-lead-folder', name: 'Crear Carpeta de Leads', description: 'Crea una carpeta para organizar leads',
    toolDescription: 'Crea una nueva carpeta para organizar leads.',
    method: 'POST', path: '/lead-folders', icon: <FolderOpen className="w-4 h-4" />, category: 'Leads',
    bodyFields: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la carpeta' },
      { name: 'color', type: 'string', required: false, description: 'Color hex (ej: #6366f1)' },
    ],
  },

  // ===== IA =====
  {
    id: 'ai-completion', name: 'Completar con IA', description: 'Genera texto con IA',
    toolDescription: 'Envía un prompt a la IA y recibe una respuesta generada. Útil para generar textos, resumir, analizar o responder preguntas.',
    method: 'POST', path: '/ai-completion', icon: <Sparkles className="w-4 h-4" />, category: 'IA',
    bodyFields: [
      { name: 'prompt', type: 'string', required: true, description: 'El prompt o pregunta para la IA' },
      { name: 'model', type: 'string', required: false, description: 'Modelo: google/gemini-2.5-flash (default), openai/gpt-5-mini, etc.' },
      { name: 'system_prompt', type: 'string', required: false, description: 'Instrucciones del sistema para la IA' },
    ],
  },

  // ===== PRESENCIA =====
  {
    id: 'list-online-users', name: 'Usuarios Online', description: 'Obtiene los usuarios conectados',
    toolDescription: 'Lista los usuarios actualmente conectados al sistema.',
    method: 'GET', path: '/user-presence', icon: <Eye className="w-4 h-4" />, category: 'Perfil',
  },
  {
    id: 'list-profiles', name: 'Listar Perfiles', description: 'Obtiene todos los perfiles del equipo',
    toolDescription: 'Lista todos los perfiles de usuarios registrados en el sistema.',
    method: 'GET', path: '/profiles', icon: <Users className="w-4 h-4" />, category: 'Perfil',
  },
];

function generateN8nJson(tool: N8nTool): object {
  const hasBody = tool.bodyFields && tool.bodyFields.length > 0;
  const url = `${BASE_URL_PLACEHOLDER}${tool.path}`;

  const node: any = {
    parameters: {
      toolDescription: tool.toolDescription,
      method: tool.method === 'GET' ? undefined : tool.method,
      url,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      options: {},
    },
    type: 'n8n-nodes-base.httpRequestTool',
    typeVersion: 4.3,
    position: [4000, 2672],
    id: crypto.randomUUID ? crypto.randomUUID() : tool.id,
    name: tool.name,
  };

  // Clean undefined
  if (!node.parameters.method || node.parameters.method === 'GET') delete node.parameters.method;

  if (hasBody) {
    node.parameters.sendBody = true;
    node.parameters.specifyBody = 'json';
    node.parameters.jsonBody = `={{ JSON.stringify($json) }}`;
  }

  return {
    nodes: [node],
    connections: { [tool.name]: { ai_tool: [[]] } },
    pinData: {},
    meta: { templateCredsSetupCompleted: true },
  };
}

export function N8nToolsLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = ['all', ...Array.from(new Set(TOOLS.map(t => t.category)))];

  const filteredTools = TOOLS.filter(t => {
    const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'all' || t.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const copyJson = (tool: N8nTool) => {
    const json = generateN8nJson(tool);
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    toast.success(`JSON de "${tool.name}" copiado. Pégalo en n8n con Ctrl+V`);
  };

  const downloadJson = (tool: N8nTool) => {
    const json = generateN8nJson(tool);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `n8n-tool-${tool.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-600',
    POST: 'bg-blue-500/15 text-blue-600',
    PATCH: 'bg-amber-500/15 text-amber-600',
    DELETE: 'bg-red-500/15 text-red-600',
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Cómo usar con n8n
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Genera una API Key</strong> en la sección de arriba.</li>
            <li>En n8n, crea una credencial de tipo <strong className="text-foreground">Header Auth</strong> con nombre <code className="bg-muted px-1 rounded">Authorization</code> y valor <code className="bg-muted px-1 rounded">Bearer TU_API_KEY</code></li>
            <li><strong className="text-foreground">Copia el JSON</strong> de la herramienta que necesites y pégalo en el canvas de n8n (<kbd className="bg-muted px-1 rounded text-xs">Ctrl+V</kbd>).</li>
            <li>Conecta el nodo HTTP Request Tool a tu <strong className="text-foreground">AI Agent</strong> como herramienta.</li>
            <li>Asigna la credencial Bearer Auth que creaste.</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-3 mt-3 border border-border/50">
            <p className="text-xs font-medium text-foreground mb-1">📌 URL Base de la API:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded flex-1 break-all">{BASE_URL_PLACEHOLDER}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(BASE_URL_PLACEHOLDER); toast.success('URL copiada'); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <ApiKeysManager />

      {/* Tools Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Herramientas disponibles ({TOOLS.length})
          </CardTitle>
          <CardDescription>
            Cada herramienta es un nodo HTTP Request Tool listo para n8n. Copia y pega.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar herramienta..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <Button key={cat} variant={activeCategory === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveCategory(cat)}>
                  {cat === 'all' ? 'Todas' : cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredTools.map(tool => (
              <div key={tool.id} className="border border-border rounded-lg p-3 space-y-2 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {tool.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${methodColors[tool.method] || ''}`} variant="outline">
                    {tool.method}
                  </Badge>
                </div>

                <code className="text-[11px] text-muted-foreground block bg-muted/50 px-2 py-1 rounded break-all">
                  {tool.path}
                </code>

                {tool.bodyFields && (
                  <div className="text-xs space-y-0.5">
                    <span className="font-medium text-muted-foreground">Campos:</span>
                    {tool.bodyFields.map(f => (
                      <div key={f.name} className="flex items-center gap-1 ml-2">
                        <code className="text-primary">{f.name}</code>
                        <span className="text-muted-foreground">({f.type})</span>
                        {f.required && <Badge variant="destructive" className="text-[8px] h-3 px-1">req</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                {tool.queryParams && (
                  <div className="text-xs space-y-0.5">
                    <span className="font-medium text-muted-foreground">Query params:</span>
                    {tool.queryParams.map(p => (
                      <div key={p.name} className="flex items-center gap-1 ml-2">
                        <code className="text-primary">{p.name}</code>
                        <span className="text-muted-foreground">— {p.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => copyJson(tool)}>
                    <Copy className="w-3 h-3" /> Copiar JSON
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => downloadJson(tool)}>
                    <Download className="w-3 h-3" /> .json
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
