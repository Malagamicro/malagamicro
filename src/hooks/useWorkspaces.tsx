import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface WorkspacePage {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  page_type: string;
  icon: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTask {
  id: string;
  workspace_id: string;
  page_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useWorkspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      toast.error('Error cargando espacios de trabajo');
    } else {
      setWorkspaces((data as any[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const createWorkspace = async (name: string, description?: string, isPublic = false, icon = '📋') => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name, description: description || null, is_public: isPublic, icon, created_by: user.id } as any)
      .select()
      .single();
    if (error) { toast.error('Error creando espacio'); return null; }
    // Add creator as member
    await supabase.from('workspace_members').insert({ workspace_id: (data as any).id, user_id: user.id, role: 'owner' } as any);
    await fetchWorkspaces();
    return data as any as Workspace;
  };

  const deleteWorkspace = async (id: string) => {
    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) { toast.error('Error eliminando espacio'); return; }
    toast.success('Espacio eliminado');
    await fetchWorkspaces();
  };

  const updateWorkspace = async (id: string, updates: Partial<Pick<Workspace, 'name' | 'description' | 'is_public' | 'icon'>>) => {
    const { error } = await supabase.from('workspaces').update(updates as any).eq('id', id);
    if (error) { toast.error('Error actualizando espacio'); return; }
    await fetchWorkspaces();
  };

  return { workspaces, loading, createWorkspace, deleteWorkspace, updateWorkspace, refetch: fetchWorkspaces };
}

export function useWorkspaceDetail(workspaceId: string | null) {
  const { user } = useAuth();
  const [pages, setPages] = useState<WorkspacePage[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const fetchAll = useCallback(async (options?: { showLoader?: boolean }) => {
    if (!workspaceId || !user) return;

    const showLoader = options?.showLoader ?? !hasLoadedRef.current;
    if (showLoader) setLoading(true);

    const [pagesRes, tasksRes, membersRes] = await Promise.all([
      supabase.from('workspace_pages').select('*').eq('workspace_id', workspaceId).order('sort_order'),
      supabase.from('workspace_tasks').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('workspace_members').select('*').eq('workspace_id', workspaceId),
    ]);

    setPages((pagesRes.data as any[]) || []);
    setTasks((tasksRes.data as any[]) || []);
    setMembers((membersRes.data as any[]) || []);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [workspaceId, user]);

  useEffect(() => { fetchAll({ showLoader: true }); }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`workspace-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_pages', filter: `workspace_id=eq.${workspaceId}` }, () => fetchAll({ showLoader: false }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_tasks', filter: `workspace_id=eq.${workspaceId}` }, () => fetchAll({ showLoader: false }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, fetchAll]);

  const createPage = async (title: string, pageType: string = 'note', icon = '📄') => {
    if (!user || !workspaceId) return null;
    const { data, error } = await supabase
      .from('workspace_pages')
      .insert({ workspace_id: workspaceId, title, page_type: pageType, icon, created_by: user.id, content: '' } as any)
      .select()
      .single();
    if (error) { toast.error('Error creando página'); return null; }
    await fetchAll();
    return data as any as WorkspacePage;
  };

  const updatePage = async (pageId: string, updates: Partial<Pick<WorkspacePage, 'title' | 'content' | 'icon' | 'sort_order'>>) => {
    const { error } = await supabase.from('workspace_pages').update(updates as any).eq('id', pageId);
    if (error) toast.error('Error guardando página');
  };

  const deletePage = async (pageId: string) => {
    const { error } = await supabase.from('workspace_pages').delete().eq('id', pageId);
    if (error) { toast.error('Error eliminando página'); return; }
    await fetchAll();
  };

  const createTask = async (title: string, pageId?: string, assignedTo?: string, priority = 'normal') => {
    if (!user || !workspaceId) return null;
    const { data, error } = await supabase
      .from('workspace_tasks')
      .insert({ workspace_id: workspaceId, page_id: pageId || null, title, assigned_to: assignedTo || null, priority, created_by: user.id } as any)
      .select()
      .single();
    if (error) { toast.error('Error creando tarea'); return null; }
    await fetchAll();
    return data as any as WorkspaceTask;
  };

  const updateTask = async (taskId: string, updates: Partial<Pick<WorkspaceTask, 'title' | 'description' | 'status' | 'priority' | 'assigned_to' | 'due_date'>>) => {
    const { error } = await supabase.from('workspace_tasks').update(updates as any).eq('id', taskId);
    if (error) toast.error('Error actualizando tarea');
    else await fetchAll();
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('workspace_tasks').delete().eq('id', taskId);
    if (error) { toast.error('Error eliminando tarea'); return; }
    await fetchAll();
  };

  const addMember = async (userId: string, role = 'editor') => {
    if (!workspaceId) return;
    const { error } = await supabase.from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId, role } as any);
    if (error) { toast.error('Error añadiendo miembro'); return; }
    toast.success('Miembro añadido');
    await fetchAll();
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
    if (error) { toast.error('Error eliminando miembro'); return; }
    await fetchAll();
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    const { error } = await supabase.from('workspace_members').update({ role } as any).eq('id', memberId);
    if (error) { toast.error('Error actualizando rol'); return; }
    toast.success('Rol actualizado');
    await fetchAll();
  };

  return { pages, tasks, members, loading, createPage, updatePage, deletePage, createTask, updateTask, deleteTask, addMember, removeMember, updateMemberRole, refetch: fetchAll };
}
