import { useState } from 'react';
import { useMessageTemplates, MessageTemplate } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit2, Trash2, FileText, Loader2 } from 'lucide-react';
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

interface TemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate?: (content: string) => void;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'saludo', label: 'Saludo' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'cierre', label: 'Cierre' },
];

export function TemplatesModal({ open, onOpenChange, onSelectTemplate }: TemplatesModalProps) {
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
  
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: 'general',
  });

  const resetForm = () => {
    setFormData({ name: '', content: '', category: 'general' });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.content.trim()) return;

    if (editingTemplate) {
      updateTemplate({
        id: editingTemplate.id,
        name: formData.name.trim(),
        content: formData.content.trim(),
        category: formData.category,
      }, {
        onSuccess: resetForm,
      });
    } else {
      createTemplate({
        name: formData.name.trim(),
        content: formData.content.trim(),
        category: formData.category,
      }, {
        onSuccess: resetForm,
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const handleSelect = (content: string) => {
    onSelectTemplate?.(content);
    onOpenChange(false);
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    const cat = template.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, MessageTemplate[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Plantillas de Mensajes
            </DialogTitle>
            <DialogDescription>
              {onSelectTemplate 
                ? 'Selecciona una plantilla para insertar en el mensaje'
                : 'Gestiona tus plantillas de mensajes para WhatsApp'}
            </DialogDescription>
          </DialogHeader>

          {showForm ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nombre</Label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Saludo inicial"
                  disabled={isCreating || isUpdating}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template-category">Categoría</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                  disabled={isCreating || isUpdating}
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
                <Label htmlFor="template-content">Contenido</Label>
                <Textarea
                  id="template-content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Escribe el contenido de la plantilla. Usa {{companyName}}, {{contactName}} para variables."
                  rows={5}
                  disabled={isCreating || isUpdating}
                />
                <p className="text-xs text-muted-foreground">
                  Variables disponibles: {"{{companyName}}"}, {"{{contactName}}"}, {"{{email}}"}, {"{{phone}}"}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForm} disabled={isCreating || isUpdating}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!formData.name.trim() || !formData.content.trim() || isCreating || isUpdating}
                >
                  {(isCreating || isUpdating) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[400px] pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay plantillas creadas</p>
                    <p className="text-sm mt-1">Crea tu primera plantilla para agilizar tus mensajes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {CATEGORIES.map((cat) => {
                      const catTemplates = groupedTemplates[cat.value];
                      if (!catTemplates?.length) return null;
                      
                      return (
                        <div key={cat.value}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            {cat.label}
                          </h4>
                          <div className="space-y-2">
                            {catTemplates.map((template) => (
                              <div
                                key={template.id}
                                className="group border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => onSelectTemplate && handleSelect(template.content)}
                                  >
                                    <p className="font-medium">{template.name}</p>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                      {template.content}
                                    </p>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEdit(template)}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => setDeleteConfirmId(template.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <DialogFooter>
                <Button onClick={() => setShowForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nueva Plantilla
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La plantilla se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
