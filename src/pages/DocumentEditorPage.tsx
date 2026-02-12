import { useEffect, useState } from 'react';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

const DocumentEditorPage = () => {
  const { user } = useAuth();
  const [initialContent, setInitialContent] = useState('');
  const [initialTitle, setInitialTitle] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const content = sessionStorage.getItem('editor_file_content');
    const title = sessionStorage.getItem('editor_file_title');
    const id = sessionStorage.getItem('editor_file_id');

    if (content !== null) {
      setInitialContent(content);
      setInitialTitle(title || 'Sin título');
      setFileId(id);
      // Clear so refreshing doesn't reload stale data
      sessionStorage.removeItem('editor_file_content');
      sessionStorage.removeItem('editor_file_title');
      sessionStorage.removeItem('editor_file_type');
      sessionStorage.removeItem('editor_file_id');
    }
    setReady(true);
  }, []);

  // When editing a shared file, save overwrites the existing file
  const handleSaveToCloud = fileId ? async (title: string, content: string) => {
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
  } : undefined;

  if (!ready) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <DocumentEditor
        initialContent={initialContent}
        initialTitle={initialTitle}
        onSaveToCloud={handleSaveToCloud}
      />
    </div>
  );
};

export default DocumentEditorPage;
