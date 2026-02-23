import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { SharedFile, SharedFolder } from './useSharedFiles';

export function useAllSharedFolders() {
  const { user } = useAuth();

  const { data: allFolders = [], isLoading } = useQuery({
    queryKey: ['all-shared-folders'],
    queryFn: async (): Promise<SharedFolder[]> => {
      const { data, error } = await supabase
        .from('shared_folders')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data || []).map(f => f.user_id))];
      if (userIds.length === 0) return data || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(folder => ({
        ...folder,
        owner: profileMap.get(folder.user_id),
      }));
    },
    enabled: !!user,
  });

  // Build tree structure
  const folderTree = buildFolderTree(allFolders);

  return { allFolders, folderTree, isLoading };
}

export interface FolderTreeNode extends SharedFolder {
  children: FolderTreeNode[];
}

function buildFolderTree(folders: SharedFolder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  folders.forEach(f => map.set(f.id, { ...f, children: [] }));

  folders.forEach(f => {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function useGlobalFileSearch(query: string) {
  const { user } = useAuth();

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['global-file-search', query],
    queryFn: async (): Promise<(SharedFile & { folder_name?: string })[]> => {
      if (!query || query.length < 2) return [];

      const { data, error } = await supabase
        .from('shared_files')
        .select('*')
        .or(`file_name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Get folder names
      const folderIds = [...new Set(data.filter(f => f.folder_id).map(f => f.folder_id!))];
      let folderMap = new Map<string, string>();
      if (folderIds.length > 0) {
        const { data: folders } = await supabase
          .from('shared_folders')
          .select('id, name')
          .in('id', folderIds);
        folderMap = new Map(folders?.map(f => [f.id, f.name]) || []);
      }

      // Get uploader profiles
      const userIds = [...new Set(data.map(f => f.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(file => ({
        ...file,
        uploader: profileMap.get(file.user_id),
        folder_name: file.folder_id ? folderMap.get(file.folder_id) : undefined,
      }));
    },
    enabled: !!user && query.length >= 2,
  });

  return { results, isLoading };
}
