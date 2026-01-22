import { useState } from 'react';
import { useMessageTemplates, MessageTemplate } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'bienvenida', label: 'Bienvenida' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'promocion', label: 'Promoción' },
  { value: 'recordatorio', label: 'Recordatorio' },
  { value: 'despedida', label: 'Despedida' },
];

interface TemplateFormData {
  name: string;
  content: string;
  category: string;
}

const defaultFormData: TemplateFormData = {
  name: '',
  content: '',
  category: 'general',
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
    isDeleting,
  } = useMessageTemplates();

  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

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
      category: template.category || 'general',
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
        category: formData.category,
      });
    } else {
      createTemplate({
        name: formData.name.trim(),
        content: formData.content.trim(),
        category: formData.category,
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

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: 'bg-gray-500/10 text-gray-500',
      bienvenida: 'bg-green-500/10 text-green-500',
      seguimiento: 'bg-blue-500/10 text-blue-500',
      promocion: 'bg-purple-500/10 text-purple-500',
      recordatorio: 'bg-orange-500/10 text-orange-500',
      despedida: 'bg-red-500/10 text-red-500',
    };
    return colors[category] || colors.general;
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredTemplates.length} plantilla{filteredTemplates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No hay plantillas</h3>
            <p className="text-muted-foreground text-center mb-4">
              {selectedCategory === 'all' 
                ? 'Crea tu primera plantilla para agilizar tus mensajes'
                : `No hay plantillas en la categoría "${getCategoryLabel(selectedCategory)}"`}
            </p>
            {selectedCategory === 'all' && (
              <Button onClick={handleOpenCreate} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Crear plantilla
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    <span className={cn(
                      "inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      getCategoryColor(template.category || 'general')
                    )}>
                      {getCategoryLabel(template.category || 'general')}
                    </span>
                  </div>
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
              <Label htmlFor="category">Categoría</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
