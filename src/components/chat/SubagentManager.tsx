import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAISubagents, AISubagent } from '@/hooks/useAISubagents';
import { Plus, Trash2, Pencil, Bot, ImageIcon, AudioLines, Power, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const AGENT_TYPE_OPTIONS = [
  { value: 'text', label: 'Texto', icon: Bot, description: 'Responde con texto' },
  { value: 'image', label: 'Imagen', icon: ImageIcon, description: 'Genera imágenes' },
  { value: 'audio', label: 'Audio', icon: AudioLines, description: 'Genera audio' },
];

const EMOJI_OPTIONS = ['🤖', '🎨', '🎵', '📊', '🧠', '✍️', '🔍', '💡', '🌐', '⚡', '🎭', '📝'];
const COLOR_OPTIONS = ['#6C63FF', '#FF6B6B', '#48DBFB', '#FF9FF3', '#1DD1A1', '#FFA502', '#EE5A24', '#7158E2'];

const POPULAR_MODELS = [
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
  { id: 'openai/gpt-5', name: 'GPT-5' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2' },
];

interface SubagentFormData {
  name: string;
  description: string;
  model: string;
  role_prompt: string;
  agent_type: 'text' | 'image' | 'audio';
  avatar_emoji: string;
  avatar_color: string;
  is_active: boolean;
}

const defaultForm: SubagentFormData = {
  name: '',
  description: '',
  model: 'openai/gpt-5-nano',
  role_prompt: 'Eres un asistente útil y conciso. Responde siempre en español.',
  agent_type: 'text',
  avatar_emoji: '🤖',
  avatar_color: '#6C63FF',
  is_active: true,
};

export function SubagentManager() {
  const { subagents, create, update, remove } = useAISubagents();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<AISubagent | null>(null);
  const [form, setForm] = useState<SubagentFormData>(defaultForm);
  const [customModel, setCustomModel] = useState('');

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm);
    setCustomModel('');
    setIsOpen(true);
  };

  const openEdit = (agent: AISubagent) => {
    setEditing(agent);
    const isPopular = POPULAR_MODELS.some(m => m.id === agent.model);
    setForm({
      name: agent.name,
      description: agent.description || '',
      model: isPopular ? agent.model : 'custom',
      role_prompt: agent.role_prompt,
      agent_type: agent.agent_type,
      avatar_emoji: agent.avatar_emoji,
      avatar_color: agent.avatar_color,
      is_active: agent.is_active,
    });
    setCustomModel(isPopular ? '' : agent.model);
    setIsOpen(true);
  };

  const handleSave = async () => {
    const modelToUse = form.model === 'custom' ? customModel : form.model;
    if (!form.name.trim() || !modelToUse.trim()) return;

    const payload = { ...form, model: modelToUse };

    if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    setIsOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" /> Subagentes IA
        </h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={openNew} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Añadir
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar' : 'Nuevo'} Subagente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Preview */}
              <div className="flex justify-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
                  style={{ backgroundColor: form.avatar_color + '22', border: `2px solid ${form.avatar_color}` }}
                >
                  {form.avatar_emoji}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Artista, Analista, Redactor..." />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs">Descripción (opcional)</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción del agente" />
              </div>

              {/* Agent Type */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <div className="flex gap-2">
                  {AGENT_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, agent_type: opt.value as any }))}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-xs',
                        form.agent_type === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      )}
                    >
                      <opt.icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo (OpenRouter)</Label>
                <Select value={form.model} onValueChange={v => setForm(f => ({ ...f, model: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {POPULAR_MODELS.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                    <SelectItem value="custom">✏️ Modelo personalizado...</SelectItem>
                  </SelectContent>
                </Select>
                {form.model === 'custom' && (
                  <Input
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    placeholder="provider/model-name"
                    className="mt-2"
                  />
                )}
              </div>

              {/* Role prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs">Rol / Prompt del sistema</Label>
                <Textarea
                  value={form.role_prompt}
                  onChange={e => setForm(f => ({ ...f, role_prompt: e.target.value }))}
                  placeholder="Define la personalidad y rol del agente..."
                  rows={4}
                />
              </div>

              {/* Emoji */}
              <div className="space-y-1.5">
                <Label className="text-xs">Emoji</Label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setForm(f => ({ ...f, avatar_emoji: emoji }))}
                      className={cn('w-9 h-9 rounded-lg border-2 text-lg flex items-center justify-center transition-transform',
                        form.avatar_emoji === emoji ? 'border-primary scale-110' : 'border-border'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      onClick={() => setForm(f => ({ ...f, avatar_color: color }))}
                      className={cn('w-7 h-7 rounded-full border-2 transition-transform',
                        form.avatar_color === color ? 'border-foreground scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} className="w-full" disabled={!form.name.trim()}>
                {editing ? 'Guardar cambios' : 'Crear subagente'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {subagents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No hay subagentes. Añade uno para delegar tareas especializadas.
        </p>
      ) : (
        <div className="space-y-2">
          {subagents.map(agent => (
            <div
              key={agent.id}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-xl border transition-all',
                agent.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
              )}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: agent.avatar_color + '22', border: `1.5px solid ${agent.avatar_color}` }}
              >
                {agent.avatar_emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full',
                    agent.agent_type === 'image' ? 'bg-pink-500/10 text-pink-500' :
                    agent.agent_type === 'audio' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-primary/10 text-primary'
                  )}>
                    {agent.agent_type}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{agent.model}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => update.mutateAsync({ id: agent.id, is_active: !agent.is_active })}
                  title={agent.is_active ? 'Desactivar' : 'Activar'}
                >
                  {agent.is_active ? <Power className="h-3.5 w-3.5 text-green-500" /> : <PowerOff className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(agent)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutateAsync(agent.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
