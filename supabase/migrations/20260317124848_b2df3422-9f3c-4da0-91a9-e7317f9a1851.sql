
-- Create workspace_folders table
CREATE TABLE public.workspace_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.workspace_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace folders" ON public.workspace_folders
  FOR SELECT TO authenticated
  USING (can_view_workspace(workspace_id, auth.uid()));

CREATE POLICY "Owners and editors can create folders" ON public.workspace_folders
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid()) OR 
    EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND created_by = auth.uid())
  );

CREATE POLICY "Owners can update folders" ON public.workspace_folders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = workspace_folders.workspace_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
    ) OR EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND created_by = auth.uid())
  );

CREATE POLICY "Owners can delete folders" ON public.workspace_folders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = workspace_folders.workspace_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
    ) OR EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND created_by = auth.uid())
  );

-- Create workspace_files table
CREATE TABLE public.workspace_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.workspace_folders(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace files" ON public.workspace_files
  FOR SELECT TO authenticated
  USING (can_view_workspace(workspace_id, auth.uid()));

CREATE POLICY "Owners and editors can upload files" ON public.workspace_files
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid()) OR 
    EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND created_by = auth.uid())
  );

CREATE POLICY "Owners and editors can update files" ON public.workspace_files
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = workspace_files.workspace_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'editor')
    ) OR EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND created_by = auth.uid())
  );

CREATE POLICY "Owners can delete files" ON public.workspace_files
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = workspace_files.workspace_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
    ) OR EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND created_by = auth.uid())
  );

-- Create storage bucket for workspace files
INSERT INTO storage.buckets (id, name, public) VALUES ('workspace-files', 'workspace-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for workspace-files bucket
CREATE POLICY "Authenticated users can upload workspace files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-files');

CREATE POLICY "Anyone can view workspace files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-files');

CREATE POLICY "Authenticated users can delete workspace files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-files');

-- Enable realtime for workspace_folders and workspace_files
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_files;
