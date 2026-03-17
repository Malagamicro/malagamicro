
-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📋',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace members
CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspace pages (notes, canvas, kanban boards)
CREATE TABLE public.workspace_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sin título',
  content TEXT DEFAULT '',
  page_type TEXT NOT NULL DEFAULT 'note',
  icon TEXT DEFAULT '📄',
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_pages ENABLE ROW LEVEL SECURITY;

-- Workspace tasks
CREATE TABLE public.workspace_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.workspace_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID,
  created_by UUID NOT NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;

-- Helper function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

-- Helper to check workspace visibility
CREATE OR REPLACE FUNCTION public.can_view_workspace(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND (is_public = true OR created_by = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

-- RLS Policies for workspaces
CREATE POLICY "Users can view public workspaces or their own"
ON public.workspaces FOR SELECT
USING (is_public = true OR created_by = auth.uid() OR is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can create workspaces"
ON public.workspaces FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their workspaces"
ON public.workspaces FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their workspaces"
ON public.workspaces FOR DELETE
USING (auth.uid() = created_by);

-- RLS Policies for workspace_members
CREATE POLICY "Members can view workspace members"
ON public.workspace_members FOR SELECT
USING (can_view_workspace(workspace_id, auth.uid()));

CREATE POLICY "Workspace creators can manage members"
ON public.workspace_members FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

CREATE POLICY "Workspace creators can update members"
ON public.workspace_members FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

CREATE POLICY "Workspace creators can remove members"
ON public.workspace_members FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()) OR auth.uid() = user_id);

-- RLS Policies for workspace_pages
CREATE POLICY "Members can view workspace pages"
ON public.workspace_pages FOR SELECT
USING (can_view_workspace(workspace_id, auth.uid()));

CREATE POLICY "Members can create pages"
ON public.workspace_pages FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

CREATE POLICY "Members can update pages"
ON public.workspace_pages FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

CREATE POLICY "Members can delete pages"
ON public.workspace_pages FOR DELETE
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

-- RLS Policies for workspace_tasks
CREATE POLICY "Members can view workspace tasks"
ON public.workspace_tasks FOR SELECT
USING (can_view_workspace(workspace_id, auth.uid()));

CREATE POLICY "Members can create tasks"
ON public.workspace_tasks FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

CREATE POLICY "Members can update tasks"
ON public.workspace_tasks FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

CREATE POLICY "Members can delete tasks"
ON public.workspace_tasks FOR DELETE
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspace_pages_updated_at BEFORE UPDATE ON public.workspace_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspace_tasks_updated_at BEFORE UPDATE ON public.workspace_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for collaborative editing
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_pages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_tasks;
