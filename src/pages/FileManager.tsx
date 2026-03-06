import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  FolderOpen, 
  File, 
  Download, 
  Trash2, 
  Plus,
  Search,
  FileText,
  Clock,
  Globe,
  Copy,
  Scissors,
  Clipboard,
  Edit3,
  MoreVertical,
  FolderInput,
  Check,
  X,
  ChevronRight,
  Home,
  RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useFileManager, SavedFile } from "@/hooks/useFileManager";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";

interface ClipboardItem {
  file: SavedFile;
  operation: "copy" | "cut";
}

export default function FileManager() {
  const navigate = useNavigate();
  const { files, folders, addFile, addFolder, deleteFile, deleteFolder } = useFileManager();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<SavedFile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveDialogFile, setMoveDialogFile] = useState<SavedFile | null>(null);
  const [moveTargetFolder, setMoveTargetFolder] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "file" | "folder"; id: string; name: string; hasContent: boolean } | null>(null);

  // Filter files
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolder ? file.folder === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  const handleDownload = (file: SavedFile) => {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success(`Descargado: ${file.name}`);
  };

  const requestDeleteFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const hasContent = !!(file.content && file.content.trim().length > 0);
    if (hasContent) {
      setDeleteConfirm({ type: "file", id: fileId, name: file.name, hasContent: true });
    } else {
      confirmDeleteFile(fileId);
    }
  };

  const confirmDeleteFile = (fileId: string) => {
    deleteFile(fileId);
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    setDeleteConfirm(null);
    toast.success("Archivo eliminado");
  };

  const requestDeleteFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    const folderFiles = files.filter(f => f.folder === folder.name);
    if (folderFiles.length > 0) {
      setDeleteConfirm({ type: "folder", id: folderId, name: folder.name, hasContent: true });
    } else {
      confirmDeleteFolder(folderId);
    }
  };

  const confirmDeleteFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    deleteFolder(folderId, true);
    if (selectedFolder === folder?.name) {
      setSelectedFolder(null);
    }
    setDeleteConfirm(null);
    toast.success("Carpeta eliminada");
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("Introduce un nombre para la carpeta");
      return;
    }
    const created = addFolder(newFolderName.trim());
    if (created) {
      setNewFolderName("");
      setIsNewFolderDialogOpen(false);
      toast.success(`Carpeta "${created.name}" creada`);
    } else {
      toast.error("Ya existe una carpeta con ese nombre");
    }
  };

  const handleCopy = useCallback((file: SavedFile) => {
    setClipboard({ file, operation: "copy" });
    toast.success("Archivo copiado al portapapeles");
  }, []);

  const handleCut = useCallback((file: SavedFile) => {
    setClipboard({ file, operation: "cut" });
    toast.success("Archivo cortado");
  }, []);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;

    const { file, operation } = clipboard;
    const newName = operation === "copy" 
      ? `${file.name.replace('.txt', '')}_copia.txt`
      : file.name;

    if (operation === "copy") {
      addFile({
        name: newName,
        folder: selectedFolder || "",
        content: file.content,
        itemCount: file.itemCount,
      });
      toast.success("Archivo pegado");
    } else {
      // Cut = move
      deleteFile(file.id);
      addFile({
        name: file.name,
        folder: selectedFolder || "",
        content: file.content,
        itemCount: file.itemCount,
      });
      setClipboard(null);
      toast.success("Archivo movido");
    }
  }, [clipboard, selectedFolder, addFile, deleteFile]);

  const handleRename = (file: SavedFile) => {
    setRenamingFileId(file.id);
    setRenameValue(file.name);
  };

  const confirmRename = (file: SavedFile) => {
    if (!renameValue.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    // Create new file with new name and delete old one
    deleteFile(file.id);
    addFile({
      name: renameValue.trim(),
      folder: file.folder,
      content: file.content,
      itemCount: file.itemCount,
    });
    setRenamingFileId(null);
    setRenameValue("");
    toast.success("Archivo renombrado");
  };

  const handleEdit = (file: SavedFile) => {
    setEditingFile(file);
    setEditContent(file.content);
  };

  const saveEdit = () => {
    if (!editingFile) return;
    deleteFile(editingFile.id);
    addFile({
      name: editingFile.name,
      folder: editingFile.folder,
      content: editContent,
      itemCount: editingFile.itemCount,
    });
    setEditingFile(null);
    setEditContent("");
    toast.success("Archivo guardado");
  };

  const handleMove = (file: SavedFile) => {
    setMoveDialogFile(file);
    setMoveTargetFolder(file.folder || "none");
  };

  const confirmMove = () => {
    if (!moveDialogFile) return;
    const targetFolder = moveTargetFolder === "none" ? "" : moveTargetFolder;
    deleteFile(moveDialogFile.id);
    addFile({
      name: moveDialogFile.name,
      folder: targetFolder,
      content: moveDialogFile.content,
      itemCount: moveDialogFile.itemCount,
    });
    setMoveDialogFile(null);
    toast.success(`Movido a ${targetFolder || "raíz"}`);
  };

  const toggleFileSelection = (fileId: string, ctrlKey: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(ctrlKey ? prev : []);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const FileContextMenu = ({ file, children }: { file: SavedFile; children: React.ReactNode }) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => handleEdit(file)}>
          <Edit3 className="h-4 w-4 mr-2" />
          Editar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleRename(file)}>
          <FileText className="h-4 w-4 mr-2" />
          Renombrar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => handleCopy(file)}>
          <Copy className="h-4 w-4 mr-2" />
          Copiar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCut(file)}>
          <Scissors className="h-4 w-4 mr-2" />
          Cortar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleMove(file)}>
          <FolderInput className="h-4 w-4 mr-2" />
          Mover a...
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => handleDownload(file)}>
          <Download className="h-4 w-4 mr-2" />
          Descargar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => handleDelete(file.id)} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Toolbar */}
      <div className="border-b bg-card px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            CRM
          </Button>
          <div className="h-6 w-px bg-border" />
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setSelectedFolder(null)}
            >
              <Home className="h-4 w-4" />
            </Button>
            {selectedFolder && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedFolder}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewFolderDialogOpen(true)}
              title="Nueva carpeta"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              disabled={!clipboard}
              title="Pegar"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Clipboard indicator */}
      {clipboard && (
        <div className="bg-accent/50 px-4 py-1.5 text-sm flex items-center gap-2">
          <Clipboard className="h-4 w-4" />
          <span>
            {clipboard.operation === "copy" ? "Copiado" : "Cortado"}: {clipboard.file.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 ml-auto"
            onClick={() => setClipboard(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-56 border-r bg-card/50 p-3 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
            Carpetas
          </div>
          <button
            onClick={() => setSelectedFolder(null)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
              selectedFolder === null ? "bg-accent" : "hover:bg-accent/50"
            )}
          >
            <FolderOpen className="h-4 w-4 text-primary" />
            <span>Todos los archivos</span>
            <span className="ml-auto text-xs text-muted-foreground">{files.length}</span>
          </button>
          
          {folders.map((folder) => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => setSelectedFolder(folder.name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors group",
                    selectedFolder === folder.name ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="truncate flex-1">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {files.filter((f) => f.folder === folder.name).length}
                  </span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleDeleteFolder(folder.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar carpeta
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          <button
            onClick={() => setIsNewFolderDialogOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left text-muted-foreground hover:bg-accent/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva carpeta</span>
          </button>
        </div>

        {/* Files Area */}
        <div className="flex-1 p-4 overflow-auto">
          {filteredFiles.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No hay archivos</p>
                <p className="text-sm mt-1">
                  Sube archivos o crea carpetas para organizar tu contenido
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredFiles.map((file) => (
                <FileContextMenu key={file.id} file={file}>
                  <div
                    onClick={(e) => toggleFileSelection(file.id, e.ctrlKey || e.metaKey)}
                    onDoubleClick={() => handleEdit(file)}
                    className={cn(
                      "group relative p-3 rounded-lg border cursor-pointer transition-all",
                      "hover:bg-accent/50 hover:border-primary/30",
                      selectedFiles.has(file.id) && "bg-accent border-primary ring-1 ring-primary/20",
                      clipboard?.file.id === file.id && clipboard.operation === "cut" && "opacity-50"
                    )}
                  >
                    {/* File Icon */}
                    <div className="flex flex-col items-center text-center">
                      <div className="relative">
                        <File className="h-12 w-12 text-primary/70" />
                        {file.folder && (
                          <div className="absolute -bottom-1 -right-1 bg-accent rounded p-0.5">
                            <FolderOpen className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* File Name */}
                      {renamingFileId === file.id ? (
                        <div className="mt-2 w-full" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRename(file);
                              if (e.key === "Escape") setRenamingFileId(null);
                            }}
                            onBlur={() => confirmRename(file)}
                            className="h-6 text-xs text-center"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <p className="mt-2 text-xs font-medium truncate w-full" title={file.name}>
                          {file.name}
                        </p>
                      )}
                      
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {file.itemCount} contactos
                      </p>
                    </div>

                    {/* Quick Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => handleEdit(file)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRename(file)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Renombrar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCopy(file)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCut(file)}>
                          <Scissors className="h-4 w-4 mr-2" />
                          Cortar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMove(file)}>
                          <FolderInput className="h-4 w-4 mr-2" />
                          Mover
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <Download className="h-4 w-4 mr-2" />
                          Descargar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(file.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </FileContextMenu>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-card px-4 py-1.5 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <span>{filteredFiles.length} archivos</span>
          {selectedFiles.size > 0 && (
            <span>{selectedFiles.size} seleccionados</span>
          )}
          {folders.length > 0 && (
            <span>{folders.length} carpetas</span>
          )}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Carpeta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Nombre</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la carpeta"
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={!!moveDialogFile} onOpenChange={() => setMoveDialogFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover archivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Mover "{moveDialogFile?.name}" a:
            </p>
            <Select value={moveTargetFolder} onValueChange={setMoveTargetFolder}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona carpeta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">📁 Raíz (sin carpeta)</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.name}>
                    📁 {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogFile(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmMove}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              {editingFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Contenido del archivo..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>
              <Check className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
