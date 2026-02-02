-- Actualizar política de shared_files para que todos los usuarios autenticados puedan ver los archivos
DROP POLICY IF EXISTS "Users can view their own shared files" ON public.shared_files;

CREATE POLICY "Authenticated users can view all shared files" 
ON public.shared_files 
FOR SELECT 
TO authenticated
USING (true);

-- Actualizar política de shared_folders para que todos los usuarios autenticados puedan ver las carpetas
DROP POLICY IF EXISTS "Users can view their own shared folders" ON public.shared_folders;

CREATE POLICY "Authenticated users can view all shared folders" 
ON public.shared_folders 
FOR SELECT 
TO authenticated
USING (true);