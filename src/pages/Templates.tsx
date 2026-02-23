import { useState, useMemo } from 'react';
import { useMessageTemplates, MessageTemplate } from '@/hooks/useMessageTemplates';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { 
  FileText, Plus, Loader2, MoreVertical, Pencil, Trash2,
  Copy, MessageSquare, Search, Tag, Sparkles, Send, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

interface TemplateFormData {
  name: string;
  content: string;
  category: string;
  is_admin_only: boolean;
}

const TEMPLATE_CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-slate-500' },
  { value: 'ventas', label: 'Ventas', color: 'bg-green-500' },
  { value: 'soporte', label: 'Soporte', color: 'bg-blue-500' },
  { value: 'bienvenida', label: 'Bienvenida', color: 'bg-purple-500' },
  { value: 'seguimiento', label: 'Seguimiento', color: 'bg-amber-500' },
  { value: 'otros', label: 'Otros', color: 'bg-gray-500' },
];

const defaultFormData: TemplateFormData = {
  name: '',
  content: '',
  category: 'general',
  is_admin_only: false,
};

function getCategoryInfo(category: string) {
  return TEMPLATE_CATEGORIES.find(c => c.value === category) || TEMPLATE_CATEGORIES[0];
}

export default function Templates() {
  const { 
    templates, isLoading, createTemplate, updateTemplate, deleteTemplate, isCreating, isUpdating,
  } = useMessageTemplates();
  const { isAdmin } = useUserRole();

  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [showAiInModal, setShowAiInModal] = useState(false);

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = 
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchTerm, categoryFilter]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, MessageTemplate[]> = {};
    filteredTemplates.forEach(template => {
      const cat = template.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(template);
    });
    return groups;
  }, [filteredTemplates]);

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
      is_admin_only: template.isAdminOnly,
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
        is_admin_only: formData.is_admin_only,
      });
    } else {
      createTemplate({
        name: formData.name.trim(),
        content: formData.content.trim(),
        category: formData.category,
        is_admin_only: formData.is_admin_only,
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

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'write',
          messages: [{ 
            role: 'user', 
            content: `Genera una plantilla de mensaje de WhatsApp profesional para: ${aiPrompt.trim()}. 
Solo devuelve el contenido del mensaje, sin explicaciones. Usa variables como {{companyName}}, {{contactName}} donde sea apropiado. 
El mensaje debe ser breve (máximo 3-4 párrafos), directo y profesional. Incluye emojis apropiados.` 
          }],
        }),
      });
      if (!resp.ok) throw new Error('Error de IA');
      
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let result = '';
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) result += delta;
          } catch {}
        }
      }
      
      setFormData(prev => ({ ...prev, content: result.trim() }));
      setShowAiInModal(false);
      toast.success('Plantilla generada con IA');
    } catch {
      toast.error('Error al generar con IA');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const isSaving = isCreating || isUpdating;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0" />
              <span className="truncate">Plantillas</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Plantillas para mensajes de WhatsApp
            </p>
          </div>
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 h-9 shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva Plantilla</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar plantillas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm">
              <Tag className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {TEMPLATE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                    {cat.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 md:py-12 px-4">
            <MessageSquare className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground mb-3 md:mb-4" />
            <h3 className="text-base md:text-lg font-medium mb-1">No hay plantillas</h3>
            <p className="text-xs md:text-sm text-muted-foreground text-center mb-4">
              {searchTerm || categoryFilter !== 'all' 
                ? 'Intenta cambiar los filtros de búsqueda'
                : 'Crea tu primera plantilla para agilizar tus mensajes'}
            </p>
            {!searchTerm && categoryFilter === 'all' && (
              <Button onClick={handleOpenCreate} variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Crear plantilla
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
            const catInfo = getCategoryInfo(category);
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${catInfo.color}`} />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {catInfo.label}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {categoryTemplates.length}
                  </Badge>
                </div>
                <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryTemplates.map((template) => (
                    <Card key={template.id} className="group hover:shadow-md transition-all duration-200">
                      <CardHeader className="pb-2 p-3 md:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CardTitle className="text-sm md:text-base truncate">{template.name}</CardTitle>
                            {template.isAdminOnly && (
                              <Badge variant="outline" className="text-[10px] shrink-0 gap-0.5">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
                      <CardContent className="p-3 md:p-4 pt-0">
                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {template.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg mx-4 md:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingTemplate 
                ? 'Modifica los datos de la plantilla'
                : 'Crea una nueva plantilla de mensaje'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 md:py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Saludo inicial"
                  disabled={isSaving}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm">Categoría</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                  disabled={isSaving}
                >
                  <SelectTrigger id="category" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Admin-only toggle */}
            {isAdmin && (
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Solo administradores
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Solo los administradores podrán ver esta plantilla
                  </p>
                </div>
                <Switch
                  checked={formData.is_admin_only}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_admin_only: v }))}
                  disabled={isSaving}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content" className="text-sm">Contenido *</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowAiInModal(!showAiInModal)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {showAiInModal ? 'Ocultar IA' : 'Escribir con IA'}
                </Button>
              </div>
              
              {showAiInModal && (
                <div className="flex gap-2 p-2 bg-muted rounded-lg">
                  <Input
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generateWithAi()}
                    placeholder="Ej: saludo de bienvenida para nuevo cliente..."
                    className="h-8 text-xs"
                    disabled={isGeneratingAi}
                  />
                  <Button size="sm" className="h-8 text-xs shrink-0" onClick={generateWithAi} disabled={isGeneratingAi || !aiPrompt.trim()}>
                    {isGeneratingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              )}
              
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Escribe el contenido de tu plantilla...&#10;&#10;Puedes usar variables como {{companyName}}, {{contactName}}, etc."
                rows={6}
                disabled={isSaving}
                className="text-sm"
              />
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Variables: {'{{companyName}}'}, {'{{contactName}}'}, {'{{phone}}'}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowModal(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
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
