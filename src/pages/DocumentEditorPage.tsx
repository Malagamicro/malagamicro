import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { FileTreeSidebar } from '@/components/editor/FileTreeSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { SharedFile } from '@/hooks/useSharedFiles';

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

const DocumentEditorPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [initialContent, setInitialContent] = useState('');
  const [initialTitle, setInitialTitle] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const content = sessionStorage.getItem('editor_file_content');
    const title = sessionStorage.getItem('editor_file_title');
    const id = sessionStorage.getItem('editor_file_id');

    if (content !== null) {
      setInitialContent(content);
      setInitialTitle(title || 'Sin título');
      setFileId(id);
      sessionStorage.removeItem('editor_file_content');
      sessionStorage.removeItem('editor_file_title');
      sessionStorage.removeItem('editor_file_type');
      sessionStorage.removeItem('editor_file_id');
    } else {
      // No file data in sessionStorage — go back to main app
      navigate('/', { replace: true });
      return;
    }
    setReady(true);
  }, [navigate]);

  const handleOpenFile = useCallback(async (file: SharedFile) => {
    try {
      const response = await fetch(file.file_path);
      if (!response.ok) throw new Error('Error al descargar archivo');
      const text = await response.text();
      setInitialContent(text);
      setInitialTitle(file.file_name.replace(/\.\w+$/, ''));
      setFileId(file.id);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo abrir el archivo');
    }
  }, []);

  const handleSaveToCloud = useMemo(() => {
    if (!fileId) return undefined;
    return async (title: string, content: string) => {
      if (!user) return;
      const safeName = sanitizeFileName(title || 'documento');
      const fileName = `${safeName}.md`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const file = new File([blob], fileName, { type: 'text/markdown' });
      const filePath = `${user.id}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('shared-files')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('shared_files')
        .update({
          file_name: `${title || 'documento'}.md`,
          file_path: urlData.publicUrl,
          file_size: blob.size,
        })
        .eq('id', fileId);
      if (dbError) throw dbError;
      toast.success('Archivo actualizado en Cloud');
    };
  }, [fileId, user]);

  if (!ready) return null;

  return (
    <div className="h-screen flex bg-background">
      <FileTreeSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenFile={handleOpenFile}
        activeFileId={fileId}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <DocumentEditor
          key={fileId || 'new'}
          initialContent={initialContent}
          initialTitle={initialTitle}
          onSaveToCloud={handleSaveToCloud}
        />
      </div>
    </div>
  );
};

export default DocumentEditorPage;
