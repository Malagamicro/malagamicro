import { useState, useRef } from 'react';
import { format } from 'date-fns';
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
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSharedFiles, formatFileSize, SharedFile } from '@/hooks/useSharedFiles';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export function SharedFilesPanel() {
  const { user } = useAuth();
  const { files, isLoading, uploadFile, deleteFile, updateDescription } = useSharedFiles('/');
  const [search, setSearch] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [description, setDescription] = useState('');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = files.filter(file =>
    file.file_name.toLowerCase().includes(search.toLowerCase()) ||
    file.description?.toLowerCase().includes(search.toLowerCase()) ||
    file.uploader?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

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
      });
      setUploadDialogOpen(false);
      setSelectedUploadFile(null);
      setDescription('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (file: SharedFile) => {
    setSelectedFile(file);
    setDescription(file.description || '');
    setEditDialogOpen(true);
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

  const handleDeleteClick = (file: SharedFile) => {
    setSelectedFile(file);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedFile) return;

    try {
      await deleteFile.mutateAsync(selectedFile.id);
      setDeleteDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cloud className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Archivos Compartidos</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Comparte archivos con todo el equipo
                </p>
              </div>
            </div>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Subir Archivo
            </Button>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar archivos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
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
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Cloud className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No hay archivos</p>
              <p className="text-sm">Sube el primero para compartir con tu equipo</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="grid gap-3">
                {filteredFiles.map((file) => {
                  const FileIcon = getFileIcon(file.file_type);
                  const isOwner = file.user_id === user?.id;

                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className={cn(
                        'p-3 rounded-lg',
                        file.file_type?.startsWith('image/') ? 'bg-pink-500/10' :
                        file.file_type?.startsWith('video/') ? 'bg-purple-500/10' :
                        file.file_type?.startsWith('audio/') ? 'bg-orange-500/10' :
                        'bg-blue-500/10'
                      )}>
                        <FileIcon className={cn(
                          'h-6 w-6',
                          file.file_type?.startsWith('image/') ? 'text-pink-500' :
                          file.file_type?.startsWith('video/') ? 'text-purple-500' :
                          file.file_type?.startsWith('audio/') ? 'text-orange-500' :
                          'text-blue-500'
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.file_name}</p>
                        {file.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {file.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>•</span>
                          <span>{format(new Date(file.created_at), "d MMM yyyy", { locale: es })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 mr-2">
                          <Avatar className="h-7 w-7">
                            {file.uploader?.avatar_url && (
                              <AvatarImage src={file.uploader.avatar_url} />
                            )}
                            <AvatarFallback className="text-xs">
                              {getInitials(file.uploader?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground hidden sm:block">
                            {file.uploader?.full_name || 'Usuario'}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={file.file_path} target="_blank" rel="noopener noreferrer" download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>

                        {isOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(file)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar descripción
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(file)}
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

      {/* Edit Dialog */}
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El archivo "{selectedFile?.file_name}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFile.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
