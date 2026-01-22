import { useState } from 'react';
import { useMessageTemplates, MessageTemplate } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FileText, 
  Plus, 
  Loader2, 
  MoreVertical, 
  Pencil, 
  Trash2,
  Copy,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

interface TemplateFormData {
  name: string;
  content: string;
}

const defaultFormData: TemplateFormData = {
  name: '',
  content: '',
};

export default function Templates() {
  const { 
    templates, 
    isLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    isCreating,
    isUpdating,
  } = useMessageTemplates();

  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData(defaultFormData);
    setShowModal(true);
  };

  const handleOpenEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Nombre y contenido son obligatorios');
      return;
    }

    if (editingTemplate) {
      updateTemplate({
        id: editingTemplate.id,
        name: formData.name.trim(),
        content: formData.content.trim(),
      });
    } else {
      createTemplate({
        name: formData.name.trim(),
        content: formData.content.trim(),
      });
    }

    setShowModal(false);
    setFormData(defaultFormData);
    setEditingTemplate(null);
  };

  const handleDelete = (template: MessageTemplate) => {
    if (confirm(`¿Eliminar plantilla "${template.name}"?`)) {
      deleteTemplate(template.id);
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Contenido copiado al portapapeles');
  };

  const isSaving = isCreating || isUpdating;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Plantillas de Mensajes
          </h1>
          <p className="text-muted-foreground mt-1">
            Crea y gestiona plantillas para tus mensajes de WhatsApp
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No hay plantillas</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crea tu primera plantilla para agilizar tus mensajes
            </p>
            <Button onClick={handleOpenCreate} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Crear plantilla
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate flex-1">{template.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCopyContent(template.content)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar contenido
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenEdit(template)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(template)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {template.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? 'Modifica los datos de la plantilla'
                : 'Crea una nueva plantilla de mensaje'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Saludo inicial"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Escribe el contenido de tu plantilla...&#10;&#10;Puedes usar variables como {{companyName}}, {{contactName}}, etc."
                rows={6}
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles: {'{{companyName}}'}, {'{{contactName}}'}, {'{{phone}}'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editingTemplate ? (
                'Guardar cambios'
              ) : (
                'Crear plantilla'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
