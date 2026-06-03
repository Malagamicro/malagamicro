-- Creación de la tabla de Tickets de Soporte
CREATE TABLE IF NOT EXISTS public.crm_support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'abierto', -- abierto, en_progreso, cerrado
    priority TEXT NOT NULL DEFAULT 'media', -- baja, media, alta, urgente
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Creación de la tabla de Mensajes del Ticket
CREATE TABLE IF NOT EXISTS public.crm_support_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES public.crm_support_tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.crm_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_support_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para crm_support_tickets
-- Los usuarios pueden ver todos los tickets (o solo los suyos, dependiendo de si quieres que vean todos o no. Aquí permitiremos que todos vean todos los tickets internos para facilitar colaboración, o puedes cambiarlo).
-- De momento, permitiremos lectura a usuarios autenticados:
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.crm_support_tickets FOR SELECT 
TO authenticated USING (true);

-- Solo el creador puede insertar
CREATE POLICY "Permitir creación a usuarios autenticados" 
ON public.crm_support_tickets FOR INSERT 
TO authenticated WITH CHECK (auth.uid() = user_id);

-- Cualquiera (autenticado) puede actualizar el estado (para poder cerrarlos)
CREATE POLICY "Permitir actualización a usuarios autenticados" 
ON public.crm_support_tickets FOR UPDATE 
TO authenticated USING (true);


-- Políticas para crm_support_messages
-- Leer mensajes: autenticados pueden ver mensajes de los tickets
CREATE POLICY "Permitir lectura de mensajes a usuarios autenticados" 
ON public.crm_support_messages FOR SELECT 
TO authenticated USING (true);

-- Crear mensaje: autenticados pueden insertar
CREATE POLICY "Permitir creación de mensajes" 
ON public.crm_support_messages FOR INSERT 
TO authenticated WITH CHECK (auth.uid() = user_id);

-- Opcional: Crear función para actualizar 'updated_at' en tickets al recibir nuevo mensaje
CREATE OR REPLACE FUNCTION update_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.crm_support_tickets 
  SET updated_at = NOW() 
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_timestamp
AFTER INSERT ON public.crm_support_messages
FOR EACH ROW
EXECUTE FUNCTION update_ticket_updated_at();
