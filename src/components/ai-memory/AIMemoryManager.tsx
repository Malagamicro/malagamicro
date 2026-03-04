import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Brain, Plus, Search, Trash2, Edit2, FileText, Image, Upload,
  Loader2, Filter, Calendar, Tag, X, Save, Eye, Globe, Lock, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AIMemory {
  id: string;
  user_id: string;
  lead_id: string | null;
  memory_key: string;
  memory_value: any;
  category: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  { value: 'preference', label: 'Preferencia', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  { value: 'interaction', label: 'Interacción', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  { value: 'note', label: 'Nota', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { value: 'document', label: 'Documento', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' },
  { value: 'image', label: 'Imagen', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400' },
];

export function AIMemoryManager() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('shared');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<AIMemory | null>(null);
  const [viewingMemory, setViewingMemory] = useState<AIMemory | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formLeadId, setFormLeadId] = useState('');
  const [formIsShared, setFormIsShared] = useState(true);
  const fetchMemories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('ai_memory' as any)
        .select('*')
        .order('updated_at', { ascending: false });

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      setMemories((data || []) as unknown as AIMemory[]);
    } catch (err) {
      console.error('Error fetching memories:', err);
      toast.error('Error al cargar memorias');
    } finally {
      setLoading(false);
    }
  }, [user, filterCategory]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const filteredMemories = memories.filter(m => {
    // Filter by tab
    if (activeTab === 'shared' && !m.is_shared) return false;
    if (activeTab === 'personal' && (m.is_shared || m.user_id !== user?.id)) return false;
    
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.memory_key.toLowerCase().includes(q) ||
      JSON.stringify(m.memory_value).toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  const handleSave = async () => {
    if (!user || !formKey.trim()) {
      toast.error('La clave es obligatoria');
      return;
    }

    try {
      let memoryValue: any;
      try {
        memoryValue = JSON.parse(formValue);
      } catch {
        memoryValue = { text: formValue };
      }

      if (editingMemory) {
        const { error } = await (supabase
          .from('ai_memory' as any)
          .update({
            memory_key: formKey,
            memory_value: memoryValue,
            category: formCategory,
            lead_id: null,
            is_shared: formIsShared,
          })
          .eq('id', editingMemory.id) as any);
        if (error) throw error;
        toast.success('Memoria actualizada');
      } else {
        const { error } = await (supabase
          .from('ai_memory' as any)
          .insert({
            user_id: user.id,
            memory_key: formKey,
            memory_value: memoryValue,
            category: formCategory,
            lead_id: null,
            is_shared: formIsShared,
          }) as any);
        if (error) throw error;
        toast.success('Memoria añadida');
      }

      resetForm();
      fetchMemories();
    } catch (err) {
      console.error('Error saving memory:', err);
      toast.error('Error al guardar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase
        .from('ai_memory' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
      setMemories(prev => prev.filter(m => m.id !== id));
      toast.success('Memoria eliminada');
    } catch (err) {
      console.error('Error deleting memory:', err);
      toast.error('Error al eliminar');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:...;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractDocumentText = async (file: File): Promise<string | null> => {
    try {
      toast.info(`Extrayendo texto de "${file.name}"... esto puede tardar unos segundos`);
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: { file_base64: base64, file_type: file.type, file_name: file.name },
      });
      if (error) throw error;
      return data?.text || null;
    } catch (err) {
      console.error('Text extraction error:', err);
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 20MB limit
    if (file.size > 20 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (máx 20MB)');
      return;
    }

    setUploading(true);
    try {
      const isImage = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || /\.(md|txt|csv|json|xml|yaml|yml|log|ini|cfg|conf)$/i.test(file.name);
      const isBinaryDoc = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(file.name) || 
        ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/rtf'].includes(file.type);

      // Upload to storage first (for all file types)
      const path = `ai-memory/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('shared-files')
        .getPublicUrl(path);

      let extractedContent: string | null = null;

      if (isText) {
        // Read text directly
        extractedContent = (await file.text()).slice(0, 100000);
      } else if (isBinaryDoc) {
        // Use AI to extract text from PDF, DOCX, etc.
        extractedContent = await extractDocumentText(file);
      }
      // For images, no text extraction needed - AI sees the URL directly

      const memValue: any = {
        source: 'file_upload',
        file_name: file.name,
        file_type: file.type,
        file_url: urlData.publicUrl,
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
      };

      if (extractedContent) {
        memValue.content = extractedContent.slice(0, 100000);
      }

      const category = isImage ? 'image' : 'document';
      const prefix = isImage ? 'img' : 'doc';

      const { error } = await (supabase
        .from('ai_memory' as any)
        .insert({
          user_id: user.id,
          memory_key: `${prefix}_${file.name}`,
          memory_value: memValue,
          category,
          lead_id: formLeadId || null,
          is_shared: formIsShared,
        }) as any);
      if (error) throw error;

      const hasContent = !!extractedContent;
      toast.success(
        hasContent 
          ? `"${file.name}" añadido con texto extraído (${extractedContent!.length.toLocaleString()} caracteres)`
          : `"${file.name}" añadido a la memoria IA`
      );

      fetchMemories();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const resetForm = () => {
    setFormKey('');
    setFormValue('');
    setFormCategory('general');
    setFormLeadId('');
    setFormIsShared(activeTab === 'shared');
    setIsAddOpen(false);
    setEditingMemory(null);
  };

  const openEdit = (memory: AIMemory) => {
    setEditingMemory(memory);
    setFormKey(memory.memory_key);
    setFormValue(
      typeof memory.memory_value === 'string'
        ? memory.memory_value
        : JSON.stringify(memory.memory_value, null, 2)
    );
    setFormCategory(memory.category);
    setFormLeadId(memory.lead_id || '');
    setFormIsShared(memory.is_shared);
    setIsAddOpen(true);
  };

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return (
      <Badge variant="outline" className={cat?.color || ''}>
        {cat?.label || category}
      </Badge>
    );
  };

  const getMemoryPreview = (value: any): string => {
    if (typeof value === 'string') return value.slice(0, 120);
    if (value?.text) return String(value.text).slice(0, 120);
    if (value?.content) return String(value.content).slice(0, 120);
    if (value?.file_name) return `📎 ${value.file_name}`;
    return JSON.stringify(value).slice(0, 120);
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shared" className="gap-2">
            <Globe className="h-4 w-4" />
            Compartida
          </TabsTrigger>
          <TabsTrigger value="personal" className="gap-2">
            <Lock className="h-4 w-4" />
            Personal
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar memorias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Añadir texto</span>
          </Button>
          <label>
            <Button variant="outline" className="gap-2 cursor-pointer" asChild disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="hidden sm:inline">Subir archivo</span>
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.json,.xml,.rtf,.odt,.ods,.odp,.yaml,.yml"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: memories.length, icon: Brain },
          { label: 'Documentos', count: memories.filter(m => m.category === 'document').length, icon: FileText },
          { label: 'Imágenes', count: memories.filter(m => m.category === 'image').length, icon: Image },
          { label: 'Notas', count: memories.filter(m => ['general', 'note', 'preference', 'interaction'].includes(m.category)).length, icon: Tag },
        ].map(s => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-2">
              <s.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{s.count}</p>
          </Card>
        ))}
      </div>

      {/* Memory list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredMemories.length === 0 ? (
        <Card className="p-8 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No hay memorias almacenadas</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Añade texto o sube archivos para que Micro los recuerde
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredMemories.map(memory => (
            <Card key={memory.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium text-sm truncate">{memory.memory_key}</h4>
                      {getCategoryBadge(memory.category)}
                      {memory.is_shared ? (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          <Globe className="h-3 w-3 mr-1" />Compartida
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 dark:text-orange-400">
                          <Lock className="h-3 w-3 mr-1" />Personal
                        </Badge>
                      )}
                      {memory.user_id !== user?.id && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />Otro usuario
                        </Badge>
                      )}
                      {memory.lead_id && (
                        <Badge variant="secondary" className="text-xs">Lead vinculado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {getMemoryPreview(memory.memory_value)}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(memory.updated_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewingMemory(memory)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {memory.user_id === user?.id && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(memory)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(memory.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg bg-background border shadow-lg [&>*]:bg-transparent">
          <DialogHeader>
            <DialogTitle>{editingMemory ? 'Editar memoria' : 'Añadir memoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Clave / Nombre</Label>
              <Input
                placeholder="ej: preferencia_horario, datos_empresa..."
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
              />
            </div>
            <div>
              <Label>Contenido</Label>
              <Textarea
                placeholder="Escribe el contenido de la memoria... (texto o JSON)"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                rows={6}
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Input
                placeholder="ej: general, nota, preferencia..."
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  {formIsShared ? <Globe className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-orange-600" />}
                  {formIsShared ? 'Memoria compartida' : 'Memoria personal'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formIsShared ? 'Todos los usuarios podrán ver esta memoria' : 'Solo tú podrás ver esta memoria'}
                </p>
              </div>
              <Switch checked={formIsShared} onCheckedChange={setFormIsShared} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              {editingMemory ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingMemory} onOpenChange={(open) => { if (!open) setViewingMemory(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-background border shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {viewingMemory?.memory_key}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3">
              <div className="flex gap-2">
                {viewingMemory && getCategoryBadge(viewingMemory.category)}
                {viewingMemory?.lead_id && (
                  <Badge variant="secondary">Lead: {viewingMemory.lead_id}</Badge>
                )}
              </div>
              {viewingMemory?.memory_value?.file_url && (
                <div className="border rounded-lg overflow-hidden">
                  {viewingMemory.memory_value.file_type?.startsWith('image/') ? (
                    <img
                      src={viewingMemory.memory_value.file_url}
                      alt={viewingMemory.memory_value.file_name}
                      className="max-w-full max-h-96 object-contain mx-auto"
                    />
                  ) : (
                    <a
                      href={viewingMemory.memory_value.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="h-6 w-6 text-primary" />
                      <span>{viewingMemory.memory_value.file_name}</span>
                    </a>
                  )}
                </div>
              )}
              <pre className="bg-muted/50 rounded-lg p-4 text-sm overflow-auto whitespace-pre-wrap break-words">
                {typeof viewingMemory?.memory_value === 'string'
                  ? viewingMemory.memory_value
                  : JSON.stringify(viewingMemory?.memory_value, null, 2)}
              </pre>
              {viewingMemory && (
                <p className="text-xs text-muted-foreground">
                  Actualizado: {format(new Date(viewingMemory.updated_at), "d MMM yyyy, HH:mm:ss", { locale: es })}
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
