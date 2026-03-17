import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  FolderPlus, Upload, Trash2, FileText, Image as ImageIcon, File,
  ChevronRight, FolderOpen, Folder, ArrowLeft, Eye, Pencil,
  ChevronLeft, ChevronRight as ChevronRightIcon, Download, X,
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  icon: string;
  sort_order: number;
  created_by: string;
  created_at: string;
}

interface WorkspaceFile {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number;
  description: string | null;
  uploaded_by: string;
  created_at: string;
}

interface WorkspaceFilesProps {
  workspaceId: string;
  userRole: 'owner' | 'editor' | 'reader';
}

export function WorkspaceFiles({ workspaceId, userRole }: WorkspaceFilesProps) {
  const { user } = useAuth();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Archivos' }]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = userRole === 'owner' || userRole === 'editor';
  const canDelete = userRole === 'owner';

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    const [foldersRes, filesRes] = await Promise.all([
      supabase.from('workspace_folders').select('*').eq('workspace_id', workspaceId).order('sort_order'),
      supabase.from('workspace_files').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    ]);
    setFolders((foldersRes.data as any[]) || []);
    setFiles((filesRes.data as any[]) || []);
  }, [workspaceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`ws-files-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_files', filter: `workspace_id=eq.${workspaceId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_folders', filter: `workspace_id=eq.${workspaceId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, fetchData]);

  const currentFolders = folders.filter(f => f.parent_id === currentFolderId);
  const currentFiles = files.filter(f => f.folder_id === currentFolderId);

  const navigateToFolder = (folderId: string | null, folderName: string) => {
    if (folderId === null) {
      setCurrentFolderId(null);
      setFolderPath([{ id: null, name: 'Archivos' }]);
    } else {
      setCurrentFolderId(folderId);
      const existingIndex = folderPath.findIndex(p => p.id === folderId);
      if (existingIndex >= 0) {
        setFolderPath(folderPath.slice(0, existingIndex + 1));
      } else {
        setFolderPath([...folderPath, { id: folderId, name: folderName }]);
      }
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const { error } = await supabase.from('workspace_folders').insert({
      workspace_id: workspaceId,
      parent_id: currentFolderId,
      name: newFolderName.trim(),
      created_by: user.id,
    } as any);
    if (error) toast.error('Error creando carpeta');
    else { toast.success('Carpeta creada'); setNewFolderName(''); setShowNewFolder(false); fetchData(); }
  };

  const deleteFolder = async (folderId: string) => {
    const { error } = await supabase.from('workspace_folders').delete().eq('id', folderId);
    if (error) toast.error('Error eliminando carpeta');
    else { toast.success('Carpeta eliminada'); fetchData(); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles || !user) return;
    setUploading(true);
    for (const file of Array.from(uploadFiles)) {
      const ext = file.name.split('.').pop();
      const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('workspace-files').upload(path, file);
      if (uploadError) { toast.error(`Error subiendo ${file.name}`); continue; }
      const { error: dbError } = await supabase.from('workspace_files').insert({
        workspace_id: workspaceId,
        folder_id: currentFolderId,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
        uploaded_by: user.id,
      } as any);
      if (dbError) toast.error(`Error registrando ${file.name}`);
    }
    toast.success('Archivos subidos');
    setUploading(false);
    fetchData();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteFile = async (fileId: string, filePath: string) => {
    await supabase.storage.from('workspace-files').remove([filePath]);
    const { error } = await supabase.from('workspace_files').delete().eq('id', fileId);
    if (error) toast.error('Error eliminando archivo');
    else { toast.success('Archivo eliminado'); fetchData(); }
  };

  const renameFile = async (fileId: string) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from('workspace_files').update({ file_name: renameValue.trim() } as any).eq('id', fileId);
    if (error) toast.error('Error renombrando');
    else { toast.success('Renombrado'); setRenamingId(null); fetchData(); }
  };

  const renameFolder = async (folderId: string) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from('workspace_folders').update({ name: renameValue.trim() } as any).eq('id', folderId);
    if (error) toast.error('Error renombrando');
    else { toast.success('Renombrado'); setRenamingId(null); fetchData(); }
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('workspace-files').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File className="h-5 w-5 text-muted-foreground" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (type === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (type === 'text/markdown' || type === 'text/plain') return <FileText className="h-5 w-5 text-green-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {folderPath.map((p, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <button
              onClick={() => navigateToFolder(p.id, p.name)}
              className={cn(
                'text-sm px-1.5 py-0.5 rounded hover:bg-muted transition-colors',
                i === folderPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {p.name}
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mb-4">
        {canEdit && (
          <>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowNewFolder(true)}>
              <FolderPlus className="h-3.5 w-3.5" /> Nueva carpeta
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Subiendo...' : 'Subir archivos'}
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex items-center gap-2 mb-4">
          <Input
            autoFocus
            placeholder="Nombre de la carpeta..."
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
            className="h-8 text-sm max-w-xs"
          />
          <Button size="sm" onClick={createFolder} disabled={!newFolderName.trim()}>Crear</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>Cancelar</Button>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {/* Folders */}
          {currentFolders.map(folder => (
            <div key={folder.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
              <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => navigateToFolder(folder.id, folder.name)}>
                <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
                {renamingId === `folder-${folder.id}` ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameFolder(folder.id); if (e.key === 'Escape') setRenamingId(null); }}
                    onBlur={() => renameFolder(folder.id)}
                    className="h-6 text-sm max-w-[200px]"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-sm font-medium truncate">{folder.name}</span>
                )}
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canDelete && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setRenamingId(`folder-${folder.id}`); setRenameValue(folder.name); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFolder(folder.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Files */}
          {currentFiles.map(file => (
            <div key={file.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
              <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setPreviewFile(file)}>
                {getFileIcon(file.file_type)}
                {renamingId === `file-${file.id}` ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameFile(file.id); if (e.key === 'Escape') setRenamingId(null); }}
                    onBlur={() => renameFile(file.id)}
                    className="h-6 text-sm max-w-[200px]"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div className="min-w-0">
                    <p className="text-sm truncate">{file.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(file.file_size)}</p>
                  </div>
                )}
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewFile(file)}>
                  <Eye className="h-3 w-3" />
                </Button>
                <a href={getFileUrl(file.file_path)} download={file.file_name} onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-3 w-3" />
                  </Button>
                </a>
                {canDelete && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setRenamingId(`file-${file.id}`); setRenameValue(file.file_name); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteFile(file.id, file.file_path); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {currentFolders.length === 0 && currentFiles.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Esta carpeta está vacía</p>
              {canEdit && <p className="text-xs mt-1">Sube archivos o crea subcarpetas</p>}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* File Preview Dialog */}
      {previewFile && (
        <FilePreviewDialog
          file={previewFile}
          fileUrl={getFileUrl(previewFile.file_path)}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

// --- File Preview ---

function FilePreviewDialog({ file, fileUrl, onClose }: { file: WorkspaceFile; fileUrl: string; onClose: () => void }) {
  const isImage = file.file_type?.startsWith('image/');
  const isPdf = file.file_type === 'application/pdf';
  const isMd = file.file_name.endsWith('.md') || file.file_type === 'text/markdown';
  const isText = file.file_type?.startsWith('text/') || file.file_name.endsWith('.txt');

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base truncate">{file.file_name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {isImage && <ImagePreview url={fileUrl} alt={file.file_name} />}
          {isPdf && <PdfPreview url={fileUrl} />}
          {(isMd || isText) && <MarkdownPreview url={fileUrl} isMd={isMd} />}
          {!isImage && !isPdf && !isMd && !isText && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <File className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Vista previa no disponible para este tipo de archivo</p>
              <a href={fileUrl} download={file.file_name}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" /> Descargar
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <img src={url} alt={alt} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
    </div>
  );
}

function PdfPreview({ url }: { url: string }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [useIframe, setUseIframe] = useState(true);

  // Use iframe with page parameter for simplicity and reliability
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-3 py-2 border-b border-border/50">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {currentPage}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPage(p => p + 1)}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
        <a href={url} download target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Descargar PDF
          </Button>
        </a>
      </div>
      <div className="flex-1 min-h-[500px]">
        <iframe
          src={`${url}#page=${currentPage}`}
          className="w-full h-full min-h-[500px] border-0 rounded-lg"
          title="PDF Preview"
        />
      </div>
    </div>
  );
}

function MarkdownPreview({ url, isMd }: { url: string; isMd: boolean }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(r => r.text())
      .then(text => { setContent(text); setLoading(false); })
      .catch(() => { setContent('Error cargando archivo'); setLoading(false); });
  }, [url]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Cargando...</div>;

  if (isMd) {
    return (
      <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <pre className="p-4 text-sm font-mono whitespace-pre-wrap text-foreground bg-muted/30 rounded-lg overflow-auto max-h-[70vh]">
      {content}
    </pre>
  );
}
