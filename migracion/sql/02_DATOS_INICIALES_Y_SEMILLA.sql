-- ==============================================================================
-- SCRIPT SQL DE DATOS INICIALES Y SEMILLA (SEED DATA)
-- CRM MALAGAMICRO
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PLANTILLAS DE MENSAJES INICIALES
-- ------------------------------------------------------------------------------
INSERT INTO public.message_templates (name, content, category, is_admin_only)
VALUES 
('Bienvenida Nuevo Cliente', 'Hola {{contactName}}, ¡bienvenido a MálagaMicro! Estamos encantados de saludarte. ¿En qué podemos ayudarte hoy con la informática de {{companyName}}?', 'bienvenida', false),
('Seguimiento Presupuesto', 'Estimado/a {{contactName}}, te escribimos para consultar si has podido revisar la propuesta que te enviamos para {{companyName}}. Quedamos a tu entera disposición para resolver cualquier duda.', 'seguimiento', false),
('Recordatorio Mantenimiento', 'Hola {{contactName}}, te recordamos que tenemos programada la revisión técnica periódica para {{companyName}}. Por favor indícanos si el horario actual te resulta conveniente.', 'soporte', false)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. CARPETAS DE CLASIFICACIÓN DE LEADS POR DEFECTO
-- ------------------------------------------------------------------------------
-- NOTA: Reemplaza TU_USER_ID con el UUID de tu usuario en auth.users
-- INSERT INTO public.lead_folders (user_id, name, color)
-- VALUES 
-- ('TU_USER_ID', 'Clientes Clave (VIP)', '#ef4444'),
-- ('TU_USER_ID', 'Prospectos Málaga Centro', '#3b82f6'),
-- ('TU_USER_ID', 'Campaña Reformas 2026', '#10b981');

-- ------------------------------------------------------------------------------
-- 3. ASIGNACIÓN MANUAL DE ROL ADMINISTRADOR A UN USUARIO
-- ------------------------------------------------------------------------------
-- Para otorgar permisos de administrador a tu usuario principal, ejecuta:
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('TU_USER_ID_AQUI', 'admin'::public.app_role)
-- ON CONFLICT (user_id, role) DO NOTHING;
