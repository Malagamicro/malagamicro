import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAISubagents, AISubagent, AISubagentTeam, AVAILABLE_TOOLS } from '@/hooks/useAISubagents';
import { Plus, Trash2, Pencil, Bot, ImageIcon, AudioLines, Power, PowerOff, Users, FolderPlus, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
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
  team_id: string | null;
  tools: string[];
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
  team_id: null,
  tools: [],
};

export function SubagentManager() {
  const { subagents, teams, create, update, remove, createTeam, updateTeam, removeTeam } = useAISubagents();
  const [isOpen, setIsOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [editing, setEditing] = useState<AISubagent | null>(null);
  const [form, setForm] = useState<SubagentFormData>(defaultForm);
  const [customModel, setCustomModel] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamModel, setTeamModel] = useState('openai/gpt-5-nano');
  const [teamCustomModel, setTeamCustomModel] = useState('');
  const [editingTeam, setEditingTeam] = useState<AISubagentTeam | null>(null);
  const [activeTab, setActiveTab] = useState('agents');
  const [expandedToolCategories, setExpandedToolCategories] = useState<string[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');

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
      team_id: agent.team_id,
      tools: agent.tools || [],
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

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return;
    if (editingTeam) {
      await updateTeam.mutateAsync({ id: editingTeam.id, name: teamName, description: teamDescription || null });
    } else {
      await createTeam.mutateAsync({ name: teamName, description: teamDescription || undefined });
    }
    setTeamName('');
    setTeamDescription('');
    setEditingTeam(null);
    setIsTeamOpen(false);
  };

  const toggleToolCategory = (cat: string) => {
    setExpandedToolCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const toggleTool = (toolId: string) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(toolId) ? f.tools.filter(t => t !== toolId) : [...f.tools, toolId],
    }));
  };

  const selectAllToolsInCategory = (category: string) => {
    const catTools = AVAILABLE_TOOLS.filter(t => t.category === category).map(t => t.id);
    const allSelected = catTools.every(t => form.tools.includes(t));
    setForm(f => ({
      ...f,
      tools: allSelected
        ? f.tools.filter(t => !catTools.includes(t))
        : [...new Set([...f.tools, ...catTools])],
    }));
  };

  // Group tools by category
  const toolCategories = AVAILABLE_TOOLS.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_TOOLS>);

  const filteredSubagents = selectedTeamFilter === 'all'
    ? subagents
    : selectedTeamFilter === 'unassigned'
      ? subagents.filter(s => !s.team_id)
      : subagents.filter(s => s.team_id === selectedTeamFilter);

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-7">
            <TabsTrigger value="agents" className="text-xs h-6 px-2">
              <Bot className="h-3 w-3 mr-1" /> Agentes
            </TabsTrigger>
            <TabsTrigger value="teams" className="text-xs h-6 px-2">
              <Users className="h-3 w-3 mr-1" /> Equipos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agents" className="mt-0 space-y-2">
          {/* Filter by team */}
          {teams.length > 0 && (
            <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Filtrar por equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los agentes</SelectItem>
                <SelectItem value="unassigned">Sin equipo</SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex justify-end">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={openNew} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

                  {/* Team assignment */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Equipo</Label>
                    <Select value={form.team_id || 'none'} onValueChange={v => setForm(f => ({ ...f, team_id: v === 'none' ? null : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin equipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin equipo</SelectItem>
                        {teams.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      rows={3}
                    />
                  </div>

                  {/* Tools Assignment */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5" /> Herramientas ({form.tools.length} seleccionadas)
                    </Label>
                    <ScrollArea className="h-48 border rounded-lg p-2">
                      {Object.entries(toolCategories).map(([category, catTools]) => {
                        const isExpanded = expandedToolCategories.includes(category);
                        const selectedCount = catTools.filter(t => form.tools.includes(t.id)).length;
                        return (
                          <div key={category} className="mb-1">
                            <button
                              onClick={() => toggleToolCategory(category)}
                              className="flex items-center justify-between w-full text-xs font-medium py-1.5 px-2 rounded hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span>{category}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {selectedCount > 0 && (
                                  <Badge variant="secondary" className="h-4 text-[10px] px-1.5">{selectedCount}/{catTools.length}</Badge>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); selectAllToolsInCategory(category); }}
                                  className="text-[10px] text-primary hover:underline"
                                >
                                  {catTools.every(t => form.tools.includes(t.id)) ? 'Quitar' : 'Todo'}
                                </button>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="ml-4 space-y-0.5">
                                {catTools.map(tool => (
                                  <label key={tool.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-accent/50 cursor-pointer">
                                    <Checkbox
                                      checked={form.tools.includes(tool.id)}
                                      onCheckedChange={() => toggleTool(tool.id)}
                                      className="h-3.5 w-3.5"
                                    />
                                    <span>{tool.icon}</span>
                                    <span>{tool.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </ScrollArea>
                  </div>

                  {/* Emoji & Color row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Emoji</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {EMOJI_OPTIONS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => setForm(f => ({ ...f, avatar_emoji: emoji }))}
                            className={cn('w-8 h-8 rounded-lg border-2 text-base flex items-center justify-center transition-transform',
                              form.avatar_emoji === emoji ? 'border-primary scale-110' : 'border-border'
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Color</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_OPTIONS.map(color => (
                          <button
                            key={color}
                            onClick={() => setForm(f => ({ ...f, avatar_color: color }))}
                            className={cn('w-6 h-6 rounded-full border-2 transition-transform',
                              form.avatar_color === color ? 'border-foreground scale-110' : 'border-transparent'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSave} className="w-full" disabled={!form.name.trim()}>
                    {editing ? 'Guardar cambios' : 'Crear subagente'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Agents List */}
          {filteredSubagents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No hay subagentes. Añade uno para delegar tareas especializadas.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredSubagents.map(agent => {
                const team = teams.find(t => t.id === agent.team_id);
                return (
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
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-muted-foreground truncate">{agent.model}</p>
                        {team && (
                          <Badge variant="outline" className="h-4 text-[9px] px-1">{team.name}</Badge>
                        )}
                        {agent.tools?.length > 0 && (
                          <span className="text-[9px] text-muted-foreground">🔧{agent.tools.length}</span>
                        )}
                      </div>
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
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-0 space-y-2">
          <div className="flex justify-end">
            <Dialog open={isTeamOpen} onOpenChange={setIsTeamOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingTeam(null); setTeamName(''); setTeamDescription(''); setTeamModel('openai/gpt-5-nano'); setTeamCustomModel(''); }}>
                  <FolderPlus className="h-3 w-3 mr-1" /> Nuevo equipo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{editingTeam ? 'Editar' : 'Nuevo'} Equipo</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre del equipo</Label>
                    <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ej: Equipo Ventas, Equipo Creativo..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descripción (opcional)</Label>
                    <Input value={teamDescription} onChange={e => setTeamDescription(e.target.value)} placeholder="Descripción del equipo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo del orquestador</Label>
                    <Select value={teamModel} onValueChange={setTeamModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Modelo para el orquestador" />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                        <SelectItem value="custom">✏️ Modelo personalizado...</SelectItem>
                      </SelectContent>
                    </Select>
                    {teamModel === 'custom' && (
                      <Input value={teamCustomModel} onChange={e => setTeamCustomModel(e.target.value)} placeholder="provider/model-name" className="mt-1.5" />
                    )}
                  </div>
                  <Button onClick={handleSaveTeam} className="w-full" disabled={!teamName.trim()}>
                    {editingTeam ? 'Guardar' : 'Crear equipo'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {teams.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No hay equipos. Crea uno para agrupar subagentes.
            </p>
          ) : (
            <div className="space-y-2">
              {teams.map(team => {
                const teamAgents = subagents.filter(s => s.team_id === team.id);
                return (
                  <div key={team.id} className="p-2.5 rounded-xl border bg-card">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          {team.name}
                        </p>
                        {team.description && (
                          <p className="text-[10px] text-muted-foreground">{team.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                          setEditingTeam(team);
                          setTeamName(team.name);
                          setTeamDescription(team.description || '');
                          setIsTeamOpen(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTeam.mutateAsync(team.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {teamAgents.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {teamAgents.map(a => (
                          <div key={a.id} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted">
                            <span>{a.avatar_emoji}</span>
                            <span>{a.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Sin agentes asignados</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
