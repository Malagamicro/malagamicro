import { useState, useRef, useCallback } from 'react';
import {
  FileText, Folder, FolderPlus, FilePlus, ChevronRight, ChevronDown,
  MoreHorizontal, Trash2, Pencil, Upload, Loader2, FileSpreadsheet,
  Image as ImageIcon, File, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useSharedFolders, useSharedFiles, type SharedFile, type SharedFolder } from '@/hooks/useSharedFiles';
import { toast } from 'sonner';

// ── Types ──
export interface FileTreeFile {
  id: string;
  name: string;
  path: string;
  type: string | null;
  size: number;
  folderId: string | null;
}

interface FileTreeSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenFile: (file: SharedFile) => void;
  activeFileId: string | null;
}

// ── Helpers ──
function getFileIcon(name: string, type: string | null) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['csv', 'xlsx', 'xls', 'tsv'].includes(ext)) return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (['md', 'txt'].includes(ext) || type?.startsWith('text/')) return <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) return <ImageIcon className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Folder Node ──
function FolderNode({
  folder,
  onOpenFile,
  activeFileId,
  depth = 0,
}: {
  folder: SharedFolder;
  onOpenFile: (file: SharedFile) => void;
  activeFileId: string | null;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const { folders: subFolders } = useSharedFolders(folder.id);
  const { files, isLoading } = useSharedFiles(folder.id);
  const { renameFolder, deleteFolder } = useSharedFolders(folder.parent_id);

  const handleRename = () => {
    if (newName.trim() && newName !== folder.name) {
      renameFolder.mutate({ id: folder.id, name: newName.trim() });
    }
    setRenaming(false);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer group hover:bg-muted/50 transition-colors text-sm",
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color || '#6366f1' }} />
        {renaming ? (
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            className="h-5 text-xs px-1 py-0 flex-1"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs truncate flex-1">{folder.name}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity">
              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onClick={e => { e.stopPropagation(); setRenaming(true); setNewName(folder.name); }}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Renombrar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); deleteFolder.mutate(folder.id); }}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && (
        <div>
          {subFolders.map(sf => (
            <FolderNode key={sf.id} folder={sf} onOpenFile={onOpenFile} activeFileId={activeFileId} depth={depth + 1} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-1" style={{ paddingLeft: `${20 + depth * 12}px` }}>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Cargando...</span>
            </div>
          )}
          {files.map(file => (
            <FileNode key={file.id} file={file} onOpenFile={onOpenFile} activeFileId={activeFileId} depth={depth + 1} />
          ))}
          {!isLoading && files.length === 0 && subFolders.length === 0 && (
            <div className="px-4 py-1 text-[10px] text-muted-foreground/50 italic" style={{ paddingLeft: `${20 + depth * 12}px` }}>
              Vacía
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── File Node ──
function FileNode({
  file,
  onOpenFile,
  activeFileId,
  depth = 0,
}: {
  file: SharedFile;
  onOpenFile: (file: SharedFile) => void;
  activeFileId: string | null;
  depth?: number;
}) {
  const isActive = activeFileId === file.id;
  const ext = file.file_name.split('.').pop()?.toLowerCase() || '';
  const canOpen = ['md', 'txt', 'csv', 'tsv'].includes(ext) || file.file_type?.startsWith('text/');

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer group hover:bg-muted/50 transition-colors",
        isActive && "bg-primary/10 text-primary",
        !canOpen && "opacity-60",
      )}
      style={{ paddingLeft: `${20 + depth * 12}px` }}
      onClick={() => {
        if (canOpen) onOpenFile(file);
        else toast.info('Este tipo de archivo no se puede editar aquí');
      }}
      title={`${file.file_name} (${formatSize(file.file_size)})`}
    >
      {getFileIcon(file.file_name, file.file_type)}
      <span className="text-xs truncate flex-1">{file.file_name}</span>
    </div>
  );
}

// ── Main Sidebar ──
export function FileTreeSidebar({ collapsed, onToggle, onOpenFile, activeFileId }: FileTreeSidebarProps) {
  const { folders, isLoading: foldersLoading, createFolder } = useSharedFolders(null);
  const { files, isLoading: filesLoading, uploadFile } = useSharedFiles(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder.mutate({ name: newFolderName.trim() });
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const handleUploadFiles = useCallback((fileList: FileList) => {
    Array.from(fileList).forEach(file => {
      uploadFile.mutate({ file });
    });
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  }, [handleUploadFiles]);

  if (collapsed) {
    return (
      <div className="w-10 border-r bg-card/50 flex flex-col items-center py-2 gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} title="Abrir explorador">
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-56 border-r bg-card/50 flex flex-col transition-all",
        isDragOver && "ring-2 ring-primary/50 ring-inset bg-primary/5",
      )}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Explorador</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewFolder(true)} title="Nueva carpeta">
            <FolderPlus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fileInputRef.current?.click()} title="Subir archivo">
            <Upload className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle} title="Cerrar explorador">
            <PanelLeftClose className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files) handleUploadFiles(e.target.files); e.target.value = ''; }}
      />

      {/* New folder input */}
      {showNewFolder && (
        <div className="px-2 py-1.5 border-b flex gap-1">
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
            placeholder="Nombre de carpeta..."
            className="h-6 text-xs px-2"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCreateFolder}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {(foldersLoading || filesLoading) && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {folders.map(folder => (
            <FolderNode key={folder.id} folder={folder} onOpenFile={onOpenFile} activeFileId={activeFileId} />
          ))}
          {files.map(file => (
            <FileNode key={file.id} file={file} onOpenFile={onOpenFile} activeFileId={activeFileId} />
          ))}
          {!foldersLoading && !filesLoading && folders.length === 0 && files.length === 0 && (
            <div className="text-center py-8 px-4 space-y-2">
              <Folder className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-[10px] text-muted-foreground/50">
                Arrastra archivos aquí o usa los botones de arriba
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Drag overlay hint */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none rounded-lg">
          <div className="text-center space-y-1">
            <Upload className="h-8 w-8 mx-auto text-primary" />
            <p className="text-xs font-medium text-primary">Suelta para subir</p>
          </div>
        </div>
      )}
    </div>
  );
}
