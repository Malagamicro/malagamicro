import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Download, Mail, Phone, MessageCircle, Loader2, FolderOpen, Globe, AlertCircle, ArrowLeft, Save, Plus } from "lucide-react";
import { useFileManager } from "@/hooks/useFileManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ScrapeResult {
  emails: string[];
  phones: string[];
  whatsapp: string[];
  url: string;
  scannedAt: string;
}

interface SelectedItems {
  emails: Set<string>;
  phones: Set<string>;
  whatsapp: Set<string>;
}

export default function Scraper() {
  const navigate = useNavigate();
  const { folders, addFile, addFolder } = useFileManager();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({
    emails: new Set(),
    phones: new Set(),
    whatsapp: new Set(),
  });
  const [folder, setFolder] = useState("none");
  const [newFolderName, setNewFolderName] = useState("");
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);

  const handleScan = async () => {
    if (!url.trim()) {
      toast.error("Introduce una URL válida");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedItems({ emails: new Set(), phones: new Set(), whatsapp: new Set() });

    try {
      const { data, error: fnError } = await supabase.functions.invoke("scrape-contact-info", {
        body: { url: url.trim() },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Error al escanear la URL");
      }

      setResult(data.data);
      
      // Auto-select all found items
      setSelectedItems({
        emails: new Set(data.data.emails),
        phones: new Set(data.data.phones),
        whatsapp: new Set(data.data.whatsapp),
      });

      const total = data.data.emails.length + data.data.phones.length + data.data.whatsapp.length;
      if (total > 0) {
        toast.success(`Encontrados ${total} contactos`);
      } else {
        toast.info("No se encontraron contactos en esta página");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (type: keyof SelectedItems, item: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev[type]);
      if (newSet.has(item)) {
        newSet.delete(item);
      } else {
        newSet.add(item);
      }
      return { ...prev, [type]: newSet };
    });
  };

  const toggleAll = (type: keyof SelectedItems, items: string[]) => {
    setSelectedItems((prev) => {
      const allSelected = items.every((item) => prev[type].has(item));
      const newSet = allSelected ? new Set<string>() : new Set(items);
      return { ...prev, [type]: newSet };
    });
  };

  const handleSaveToFileManager = () => {
    const lines: string[] = [];
    const date = new Date().toISOString().split("T")[0];
    
    lines.push(`# Contactos extraídos de: ${result?.url}`);
    lines.push(`# Fecha: ${date}`);
    lines.push("");

    if (selectedItems.emails.size > 0) {
      lines.push("## EMAILS");
      lines.push(...Array.from(selectedItems.emails));
      lines.push("");
    }

    if (selectedItems.phones.size > 0) {
      lines.push("## TELÉFONOS");
      lines.push(...Array.from(selectedItems.phones));
      lines.push("");
    }

    if (selectedItems.whatsapp.size > 0) {
      lines.push("## WHATSAPP");
      lines.push(...Array.from(selectedItems.whatsapp));
      lines.push("");
    }

    const content = lines.join("\n");
    const filename = `contactos_${date}_${Date.now()}.txt`;
    const folderName = folder === "none" ? "" : folder;

    addFile({
      name: filename,
      folder: folderName,
      content,
      itemCount: totalSelected,
    });

    toast.success(
      folderName 
        ? `Guardado en carpeta "${folderName}"` 
        : "Guardado en Administrador de Archivos",
      {
        action: {
          label: "Ver archivos",
          onClick: () => navigate("/tools/files"),
        },
      }
    );
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("Introduce un nombre para la carpeta");
      return;
    }
    const created = addFolder(newFolderName.trim());
    if (created) {
      setFolder(created.name);
      setNewFolderName("");
      setIsNewFolderDialogOpen(false);
      toast.success(`Carpeta "${created.name}" creada`);
    } else {
      toast.error("Ya existe una carpeta con ese nombre");
    }
  };

  const totalSelected = selectedItems.emails.size + selectedItems.phones.size + selectedItems.whatsapp.size;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Globe className="h-8 w-8 text-primary" />
              Scraper de Contactos
            </h1>
            <p className="text-muted-foreground mt-1">
              Extrae emails, teléfonos y WhatsApp de cualquier página web
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al CRM
          </Button>
        </div>

        {/* Search Input */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="https://ejemplo.com/contacto"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleScan} disabled={isLoading} className="min-w-[120px]">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Escaneando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Escanear
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Emails */}
              <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Emails ({result.emails.length})
                    </CardTitle>
                    {result.emails.length > 0 && (
                      <Checkbox
                        checked={result.emails.every((e) => selectedItems.emails.has(e))}
                        onCheckedChange={() => toggleAll("emails", result.emails)}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {result.emails.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron emails
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {result.emails.map((email) => (
                        <label
                          key={email}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={selectedItems.emails.has(email)}
                            onCheckedChange={() => toggleItem("emails", email)}
                          />
                          <span className="truncate">{email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Phones */}
              <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Teléfonos ({result.phones.length})
                    </CardTitle>
                    {result.phones.length > 0 && (
                      <Checkbox
                        checked={result.phones.every((p) => selectedItems.phones.has(p))}
                        onCheckedChange={() => toggleAll("phones", result.phones)}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {result.phones.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron teléfonos
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {result.phones.map((phone) => (
                        <label
                          key={phone}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={selectedItems.phones.has(phone)}
                            onCheckedChange={() => toggleItem("phones", phone)}
                          />
                          <span className="font-mono">{phone}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* WhatsApp */}
              <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    WhatsApp ({result.whatsapp.length})
                    </CardTitle>
                    {result.whatsapp.length > 0 && (
                      <Checkbox
                        checked={result.whatsapp.every((w) => selectedItems.whatsapp.has(w))}
                        onCheckedChange={() => toggleAll("whatsapp", result.whatsapp)}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {result.whatsapp.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron enlaces WhatsApp
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {result.whatsapp.map((wa) => (
                        <label
                          key={wa}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={selectedItems.whatsapp.has(wa)}
                            onCheckedChange={() => toggleItem("whatsapp", wa)}
                          />
                          <span className="font-mono">{wa}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Save Section */}
            {(result.emails.length > 0 || result.phones.length > 0 || result.whatsapp.length > 0) && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <Select value={folder} onValueChange={setFolder}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sin carpeta" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin carpeta</SelectItem>
                            {folders.map((f) => (
                              <SelectItem key={f.id} value={f.name}>
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Nueva Carpeta</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="newFolderName">Nombre</Label>
                                <Input
                                  id="newFolderName"
                                  value={newFolderName}
                                  onChange={(e) => setNewFolderName(e.target.value)}
                                  placeholder="Ej: Proveedores 2024"
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
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {totalSelected} items seleccionados
                      </span>
                    </div>
                    <Button
                      onClick={handleSaveToFileManager}
                      disabled={totalSelected === 0}
                      className="w-full sm:w-auto"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Guardar en Archivos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Empty State */}
        {!result && !error && !isLoading && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Introduce una URL para comenzar</p>
                <p className="text-sm mt-1">
                  Escanea páginas de contacto, directorios o cualquier web pública
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
