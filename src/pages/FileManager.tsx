import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Clock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface SavedFile {
  id: string;
  name: string;
  folder: string;
  content: string;
  createdAt: string;
  itemCount: number;
}

const STORAGE_KEY = "crm_saved_files";

export default function FileManager() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load files from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFiles(JSON.parse(saved));
      } catch {
        setFiles([]);
      }
    }
  }, []);

  // Get unique folders
  const folders = [...new Set(files.map((f) => f.folder).filter(Boolean))];

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

  const handleDelete = (fileId: string) => {
    const updated = files.filter((f) => f.id !== fileId);
    setFiles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Archivo eliminado");
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("Introduce un nombre para la carpeta");
      return;
    }
    if (folders.includes(newFolderName.trim())) {
      toast.error("Ya existe una carpeta con ese nombre");
      return;
    }
    // Create a placeholder file to create the folder
    const placeholder: SavedFile = {
      id: crypto.randomUUID(),
      name: `.${newFolderName.trim()}_placeholder`,
      folder: newFolderName.trim(),
      content: "",
      createdAt: new Date().toISOString(),
      itemCount: 0,
    };
    const updated = [...files, placeholder];
    setFiles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNewFolderName("");
    setIsDialogOpen(false);
    toast.success(`Carpeta "${newFolderName.trim()}" creada`);
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="h-8 w-8 text-primary" />
              Administrador de Archivos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los archivos de contactos exportados
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al CRM
          </Button>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar archivos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Carpeta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Nueva Carpeta</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="folderName">Nombre de la carpeta</Label>
                      <Input
                        id="folderName"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Ej: Proveedores 2024"
                        onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateFolder}>Crear</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Folders Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Carpetas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                  selectedFolder === null ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-sm">Todos los archivos</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {files.filter((f) => !f.name.startsWith(".")).length}
                </span>
              </button>
                {folders.map((folder) => (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                      selectedFolder === folder ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm truncate">{folder}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {files.filter((f) => f.folder === folder && !f.name.startsWith(".")).length}
                  </span>
                </button>
              ))}
              {folders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay carpetas
                </p>
              )}
            </CardContent>
          </Card>

          {/* Files Grid */}
          <div className="lg:col-span-3">
            {filteredFiles.filter((f) => !f.name.startsWith(".")).length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No hay archivos</p>
                    <p className="text-sm mt-1">
                      Los archivos exportados desde el Scraper aparecerán aquí
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate("/tools/scraper")}
                    >
                      Ir al Scraper
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredFiles
                  .filter((f) => !f.name.startsWith("."))
                  .map((file) => (
                    <Card key={file.id} className="group hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <File className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate" title={file.name}>
                              {file.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(file.createdAt)}</span>
                            </div>
                            {file.folder && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-xs bg-accent px-2 py-0.5 rounded">
                                  <FolderOpen className="h-3 w-3" />
                                  {file.folder}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Descargar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(file.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
