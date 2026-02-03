import { useState, useRef, useMemo } from 'react';
import { format, isAfter, isBefore, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Cloud,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Video,
  Music,
  Download,
  Trash2,
  Loader2,
  Search,
  MoreVertical,
  Edit,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  X,
  Eye,
  ArrowLeft,
  Calendar,
  User,
  Filter,
  FileUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSharedFiles, useSharedFolders, formatFileSize, SharedFile, SharedFolder } from '@/hooks/useSharedFiles';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TEMPLATE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'soporte', label: 'Soporte' },
  { value: 'bienvenida', label: 'Bienvenida' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'otros', label: 'Otros' },
];

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.startsWith('image/')) return ImageIcon;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text')) return FileText;
  return File;
}

function getInitials(name: string | null | undefined) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function canPreview(fileType: string | null): boolean {
  if (!fileType) return false;
  return fileType.startsWith('image/') || fileType === 'application/pdf';
}

// Breadcrumb type
interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export function SharedFilesPanel() {
  const { user } = useAuth();
  const { createTemplate, isCreating: isCreatingTemplate } = useMessageTemplates();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'Inicio' }]);
  
  const { files, isLoading: filesLoading, uploadFile, deleteFile, updateDescription } = useSharedFiles(currentFolderId);
  const { folders, isLoading: foldersLoading, createFolder, deleteFolder, renameFolder } = useSharedFolders(currentFolderId);
  
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'file' | 'folder'>('file');
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [createTemplateDialogOpen, setCreateTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('general');
  
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<SharedFolder | null>(null);
  const [description, setDescription] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = filesLoading || foldersLoading;


  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const usersMap = new Map<string, { id: string; name: string; avatar?: string }>();
    files.forEach(file => {
      if (file.user_id && !usersMap.has(file.user_id)) {
        usersMap.set(file.user_id, {
          id: file.user_id,
          name: file.uploader?.full_name || 'Usuario',
          avatar: file.uploader?.avatar_url || undefined,
        });
      }
    });
    folders.forEach(folder => {
      if (folder.user_id && !usersMap.has(folder.user_id)) {
        usersMap.set(folder.user_id, {
          id: folder.user_id,
          name: folder.owner?.full_name || 'Usuario',
          avatar: folder.owner?.avatar_url || undefined,
        });
      }
    });
    return Array.from(usersMap.values());
  }, [files, folders]);

  // Filter files
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // Search filter
      const matchesSearch = 
        file.file_name.toLowerCase().includes(search.toLowerCase()) ||
        file.description?.toLowerCase().includes(search.toLowerCase()) ||
        file.uploader?.full_name?.toLowerCase().includes(search.toLowerCase());
      
      // Date filter
      let matchesDate = true;
      const fileDate = startOfDay(new Date(file.created_at));
      const today = startOfDay(new Date());
      
      if (dateFilter === 'today') {
        matchesDate = fileDate.getTime() === today.getTime();
      } else if (dateFilter === 'week') {
        matchesDate = isAfter(fileDate, subDays(today, 7));
      } else if (dateFilter === 'month') {
        matchesDate = isAfter(fileDate, subDays(today, 30));
      }
      
      // User filter
      const matchesUser = userFilter === 'all' || file.user_id === userFilter;
      
      return matchesSearch && matchesDate && matchesUser;
    });
  }, [files, search, dateFilter, userFilter]);

  const filteredFolders = useMemo(() => {
    return folders.filter(folder => {
      const matchesSearch = folder.name.toLowerCase().includes(search.toLowerCase());
      const matchesUser = userFilter === 'all' || folder.user_id === userFilter;
      
      // Date filter for folders
      let matchesDate = true;
      const folderDate = startOfDay(new Date(folder.created_at));
      const today = startOfDay(new Date());
      
      if (dateFilter === 'today') {
        matchesDate = folderDate.getTime() === today.getTime();
      } else if (dateFilter === 'week') {
        matchesDate = isAfter(folderDate, subDays(today, 7));
      } else if (dateFilter === 'month') {
        matchesDate = isAfter(folderDate, subDays(today, 30));
      }
      
      return matchesSearch && matchesDate && matchesUser;
    });
  }, [folders, search, dateFilter, userFilter]);

  // Check if any filters are active
  const hasActiveFilters = dateFilter !== 'all' || userFilter !== 'all';
  const clearFilters = () => {
    setDateFilter('all');
    setUserFilter('all');
  };

  const navigateToFolder = (folder: SharedFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const goBack = () => {
    if (breadcrumbs.length > 1) {
      navigateToBreadcrumb(breadcrumbs.length - 2);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (máx. 50MB)');
      return;
    }

    setSelectedUploadFile(file);
    setDescription('');
    setUploadDialogOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedUploadFile) return;

    try {
      await uploadFile.mutateAsync({
        file: selectedUploadFile,
        description: description || undefined,
        folderId: currentFolderId,
      });
      setUploadDialogOpen(false);
      setSelectedUploadFile(null);
      setDescription('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder.mutateAsync({
        name: newFolderName.trim(),
        parentId: currentFolderId,
      });
      setCreateFolderDialogOpen(false);
      setNewFolderName('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleRenameFolder = async () => {
    if (!selectedFolder || !newFolderName.trim()) return;

    try {
      await renameFolder.mutateAsync({
        id: selectedFolder.id,
        name: newFolderName.trim(),
      });
      setRenameFolderDialogOpen(false);
      setSelectedFolder(null);
      setNewFolderName('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (file: SharedFile) => {
    setSelectedFile(file);
    setDescription(file.description || '');
    setEditDialogOpen(true);
  };

  const handlePreview = (file: SharedFile) => {
    setSelectedFile(file);
    setPreviewDialogOpen(true);
  };

  const handleUpdateDescription = async () => {
    if (!selectedFile) return;

    try {
      await updateDescription.mutateAsync({
        fileId: selectedFile.id,
        description,
      });
      setEditDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteFileClick = (file: SharedFile) => {
    setSelectedFile(file);
    setDeleteType('file');
    setDeleteDialogOpen(true);
  };

  const handleDeleteFolderClick = (folder: SharedFolder) => {
    setSelectedFolder(folder);
    setDeleteType('folder');
    setDeleteDialogOpen(true);
  };

  const handleRenameFolderClick = (folder: SharedFolder) => {
    setSelectedFolder(folder);
    setNewFolderName(folder.name);
    setRenameFolderDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteType === 'file' && selectedFile) {
        await deleteFile.mutateAsync(selectedFile.id);
      } else if (deleteType === 'folder' && selectedFolder) {
        await deleteFolder.mutateAsync(selectedFolder.id);
      }
      setDeleteDialogOpen(false);
      setSelectedFile(null);
      setSelectedFolder(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateTemplateFromFile = (file: SharedFile) => {
    setSelectedFile(file);
    setTemplateName(file.file_name.replace(/\.[^/.]+$/, '')); // Remove extension
    setTemplateCategory('general');
    setCreateTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!selectedFile || !templateName.trim()) return;
    
    // Create template with file URL as content
    const content = `📎 Archivo adjunto: ${selectedFile.file_name}\n\n🔗 ${selectedFile.file_path}`;
    
    createTemplate({
      name: templateName.trim(),
      content,
      category: templateCategory,
    });
    
    setCreateTemplateDialogOpen(false);
    setSelectedFile(null);
    setTemplateName('');
  };

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 md:pb-4 px-3 md:px-6">
          {/* Header - responsive layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 shrink-0">
                <Cloud className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base md:text-lg">Archivos Compartidos</CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                  Comparte archivos con todo el equipo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 sm:flex-none text-xs md:text-sm h-9 md:h-10"
                onClick={() => setCreateFolderDialogOpen(true)}
              >
                <FolderPlus className="h-4 w-4 mr-1.5 md:mr-2 shrink-0" />
                <span className="truncate">Nueva Carpeta</span>
              </Button>
              <Button 
                size="sm"
                className="flex-1 sm:flex-none text-xs md:text-sm h-9 md:h-10"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1.5 md:mr-2 shrink-0" />
                <span className="truncate">Subir</span>
              </Button>
            </div>
          </div>

          {/* Breadcrumbs - scrollable on mobile */}
          <div className="flex items-center gap-1 mt-3 text-xs md:text-sm overflow-x-auto pb-1 -mx-1 px-1">
            {breadcrumbs.length > 1 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 mr-1" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id || 'root'} className="flex items-center shrink-0">
                {index > 0 && <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground mx-0.5 md:mx-1" />}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={cn(
                    'px-1.5 md:px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-1 whitespace-nowrap',
                    index === breadcrumbs.length - 1 && 'font-medium text-foreground'
                  )}
                >
                  {index === 0 && <Home className="h-3 w-3 md:h-3.5 md:w-3.5" />}
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="space-y-2 mt-2 md:mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar archivos y carpetas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 md:h-10 text-sm"
              />
            </div>
            
            {/* Filter row - scrollable on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[100px] md:w-[120px] h-8 text-xs md:text-sm shrink-0">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                </SelectContent>
              </Select>

              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[110px] md:w-[140px] h-8 text-xs md:text-sm shrink-0">
                  <User className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="truncate">{u.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Limpiar
                </Button>
              )}

              {(filteredFiles.length > 0 || filteredFolders.length > 0) && (
                <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                  {filteredFolders.length + filteredFiles.length} items
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden px-3 md:px-6 pb-3 md:pb-6">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="*/*"
          />

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground px-4 text-center">
              <Cloud className="h-10 w-10 md:h-12 md:w-12 mb-3 opacity-30" />
              <p className="font-medium text-sm md:text-base">Esta carpeta está vacía</p>
              <p className="text-xs md:text-sm">Sube archivos o crea carpetas para organizar</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)] md:h-[calc(100vh-340px)]">
              <div className="grid gap-2 md:gap-3">
                {/* Folders */}
                {filteredFolders.map((folder) => {
                  const isOwner = folder.user_id === user?.id;

                  return (
                    <div
                      key={folder.id}
                      className="flex items-center gap-2 md:gap-4 p-2.5 md:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigateToFolder(folder)}
                    >
                      <div className="p-2 md:p-3 rounded-lg bg-amber-500/10 shrink-0">
                        <Folder className="h-5 w-5 md:h-6 md:w-6 text-amber-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm md:text-base">{folder.name}</p>
                        <div className="flex items-center gap-2 md:gap-3 mt-0.5 md:mt-1 text-[10px] md:text-xs text-muted-foreground">
                          <span>{format(new Date(folder.created_at), "d MMM yyyy", { locale: es })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        <Avatar className="h-6 w-6 md:h-7 md:w-7 hidden sm:flex">
                          {folder.owner?.avatar_url && (
                            <AvatarImage src={folder.owner.avatar_url} />
                          )}
                          <AvatarFallback className="text-[10px] md:text-xs">
                            {getInitials(folder.owner?.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        {isOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameFolderClick(folder); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Renombrar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); handleDeleteFolderClick(folder); }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Files */}
                {filteredFiles.map((file) => {
                  const FileIcon = getFileIcon(file.file_type);
                  const isOwner = file.user_id === user?.id;
                  const showPreview = canPreview(file.file_type);

                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 md:gap-4 p-2.5 md:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className={cn(
                        'p-2 md:p-3 rounded-lg shrink-0',
                        file.file_type?.startsWith('image/') ? 'bg-pink-500/10' :
                        file.file_type?.startsWith('video/') ? 'bg-purple-500/10' :
                        file.file_type?.startsWith('audio/') ? 'bg-orange-500/10' :
                        file.file_type?.includes('pdf') ? 'bg-red-500/10' :
                        'bg-blue-500/10'
                      )}>
                        <FileIcon className={cn(
                          'h-5 w-5 md:h-6 md:w-6',
                          file.file_type?.startsWith('image/') ? 'text-pink-500' :
                          file.file_type?.startsWith('video/') ? 'text-purple-500' :
                          file.file_type?.startsWith('audio/') ? 'text-orange-500' :
                          file.file_type?.includes('pdf') ? 'text-red-500' :
                          'text-blue-500'
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm md:text-base">{file.file_name}</p>
                        {file.description && (
                          <p className="text-xs md:text-sm text-muted-foreground truncate mt-0.5 hidden sm:block">
                            {file.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 md:gap-3 mt-0.5 md:mt-1.5 text-[10px] md:text-xs text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>•</span>
                          <span>{format(new Date(file.created_at), "d MMM yyyy", { locale: es })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 md:gap-2 shrink-0">
                        {/* Avatar - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-2 mr-2">
                          <Avatar className="h-7 w-7">
                            {file.uploader?.avatar_url && (
                              <AvatarImage src={file.uploader.avatar_url} />
                            )}
                            <AvatarFallback className="text-xs">
                              {getInitials(file.uploader?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground hidden lg:block">
                            {file.uploader?.full_name || 'Usuario'}
                          </span>
                        </div>

                        {showPreview && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 md:h-9 md:w-9"
                            onClick={() => handlePreview(file)}
                            title="Vista previa"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 md:h-9 md:w-9"
                          onClick={() => window.open(file.file_path, '_blank')}
                          title="Descargar archivo"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        {isOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleCreateTemplateFromFile(file)}>
                                <FileUp className="h-4 w-4 mr-2" />
                                Crear plantilla
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(file)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar descripción
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteFileClick(file)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Archivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUploadFile && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedUploadFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedUploadFile.size)}
                  </p>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade una descripción para el archivo..."
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={uploadFile.isPending}
            >
              {uploadFile.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Carpeta</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Nombre de la carpeta</label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Mi carpeta..."
              className="mt-1.5"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateFolder}
              disabled={createFolder.isPending || !newFolderName.trim()}
            >
              {createFolder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar Carpeta</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Nuevo nombre</label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta..."
              className="mt-1.5"
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRenameFolder}
              disabled={renameFolder.isPending || !newFolderName.trim()}
            >
              {renameFolder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Description Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Descripción</DialogTitle>
          </DialogHeader>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción del archivo..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateDescription}
              disabled={updateDescription.isPending}
            >
              {updateDescription.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="truncate">{selectedFile?.file_name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedFile?.file_type?.startsWith('image/') ? (
              <img 
                src={selectedFile.file_path} 
                alt={selectedFile.file_name}
                className="max-w-full h-auto mx-auto rounded-lg"
              />
            ) : selectedFile?.file_type === 'application/pdf' ? (
              <iframe
                src={selectedFile.file_path}
                className="w-full h-[70vh] rounded-lg border"
                title={selectedFile.file_name}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Vista previa no disponible
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={() => selectedFile && window.open(selectedFile.file_path, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {deleteType === 'folder' ? 'carpeta' : 'archivo'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'folder' 
                ? `Esta acción no se puede deshacer. La carpeta "${selectedFolder?.name}" y todo su contenido serán eliminados permanentemente.`
                : `Esta acción no se puede deshacer. El archivo "${selectedFile?.file_name}" será eliminado permanentemente.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(deleteFile.isPending || deleteFolder.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Template from File Dialog */}
      <Dialog open={createTemplateDialogOpen} onOpenChange={setCreateTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              Crear plantilla desde archivo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedFile && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileText className="h-6 w-6 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium truncate">{selectedFile.file_name}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre de la plantilla</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nombre de la plantilla"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría</label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateTemplateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveTemplate} disabled={!templateName.trim() || isCreatingTemplate}>
              {isCreatingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
