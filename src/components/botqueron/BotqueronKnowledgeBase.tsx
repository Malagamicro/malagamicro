import { useState } from 'react';
import { Plus, Trash2, Edit2, Search, BookOpen, Tag, FolderOpen, X, Save, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBotqueronKnowledge, KnowledgeDoc } from '@/hooks/useBotqueronKnowledge';
import { useAuth } from '@/hooks/useAuth';

const CATEGORIES = ['general', 'producto', 'precios', 'soporte', 'FAQ', 'legal', 'proceso'];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  producto: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  precios: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  soporte: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  FAQ: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  legal: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  proceso: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

export function BotqueronKnowledgeBase() {
  const { user } = useAuth();
  const { docs, isLoading, addDoc, updateDoc, deleteDoc } = useBotqueronKnowledge();
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [tagInput, setTagInput] = useState('');

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: [] as string[],
  });

  const resetForm = () => {
    setForm({ title: '', content: '', category: 'general', tags: [] });
    setEditingDoc(null);
    setTagInput('');
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = (doc: KnowledgeDoc) => {
    setEditingDoc(doc);
    setForm({ title: doc.title, content: doc.content, category: doc.category, tags: doc.tags || [] });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (editingDoc) {
      updateDoc.mutate({ id: editingDoc.id, ...form });
    } else {
      addDoc.mutate({ ...form, created_by: user?.id || null });
    }
    setShowForm(false);
    resetForm();
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm(p => ({ ...p, tags: [...p.tags, t] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));

  const filtered = docs.filter(d => {
    const matchSearch = !search || `${d.title} ${d.content} ${(d.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || d.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header info */}
      <div className="rounded-xl p-5 bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
        <h3 className="font-bold text-lg mb-2 text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-400" /> Base de Conocimiento RAG
        </h3>
        <p className="text-slate-400 text-sm leading-relaxed relative z-10">
          Añade documentos de conocimiento que el Agente IA podrá consultar mediante RAG (Retrieval-Augmented Generation).
          Cuando el agente reciba una pregunta, buscará información relevante aquí para generar respuestas precisas.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en la base de conocimiento..."
            className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-sky-500"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 text-slate-300">
            <FolderOpen className="w-4 h-4 mr-2 text-slate-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Añadir Documento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Docs', value: docs.length, color: 'text-white' },
          { label: 'Categorías', value: new Set(docs.map(d => d.category)).size, color: 'text-sky-400' },
          { label: 'Con Tags', value: docs.filter(d => d.tags?.length).length, color: 'text-amber-400' },
          { label: 'Resultados', value: filtered.length, color: 'text-emerald-400' },
        ].map(s => (
          <Card key={s.label} className="p-3 bg-slate-900 border-slate-800 text-center shadow-none">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-500">Cargando documentos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No hay documentos</h3>
          <p className="text-sm text-slate-500 mb-4">Añade conocimiento para que el agente IA pueda responder preguntas.</p>
          <Button onClick={openNew} variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
            <Plus className="w-4 h-4 mr-2" /> Crear primer documento
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => (
            <Card key={doc.id} className="p-4 bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors shadow-none group">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-semibold text-white truncate">{doc.title}</h4>
                    <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.general}`}>
                      {doc.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-2">{doc.content}</p>
                  {doc.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {doc.tags.map(t => (
                        <span key={t} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(doc)}
                    className="text-slate-500 hover:text-white hover:bg-slate-800 h-8 w-8">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteDoc.mutate(doc.id)}
                    className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[600px] border-slate-800 bg-slate-950 text-slate-200 shadow-2xl p-0 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-sky-500 to-cyan-500" />
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                {editingDoc ? <><Edit2 className="w-5 h-5 text-sky-400" /> Editar Documento</> : <><Plus className="w-5 h-5 text-sky-400" /> Nuevo Documento</>}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Título <span className="text-red-500">*</span></Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ej: Planes y precios de agentes IA"
                  className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500 text-white placeholder:text-slate-600 h-11" />
              </div>

              <div>
                <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Contenido <span className="text-red-500">*</span></Label>
                <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Escribe aquí toda la información que el agente IA debe conocer sobre este tema..."
                  rows={8}
                  className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500 text-white placeholder:text-slate-600 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Categoría</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Tags</Label>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Ej: pricing"
                      className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-11 focus-visible:ring-sky-500" />
                    <Button type="button" onClick={addTag} size="icon" variant="outline"
                      className="h-11 w-11 bg-slate-900 border-slate-800 text-slate-400 hover:text-sky-400 shrink-0">
                      <Tag className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map(t => (
                    <Badge key={t} variant="outline" className="bg-slate-800 border-slate-700 text-slate-300 pl-2.5 pr-1 py-1 gap-1">
                      #{t}
                      <button onClick={() => removeTag(t)} className="hover:text-red-400 transition-colors ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Button onClick={handleSubmit} disabled={!form.title.trim() || !form.content.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 mt-2 font-medium">
                <Save className="w-4 h-4 mr-2" /> {editingDoc ? 'Guardar Cambios' : 'Añadir a Base de Conocimiento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
