import { useState } from 'react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function ApiKeysManager() {
  const { keys, loading, createKey, deleteKey, toggleKey } = useApiKeys();
  const [newKeyName, setNewKeyName] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    await createKey(newKeyName.trim());
    setNewKeyName('');
    setCreating(false);
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API Key copiada al portapapeles');
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => key.slice(0, 6) + '•'.repeat(20) + key.slice(-4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          API Keys
        </CardTitle>
        <CardDescription>
          Genera claves Bearer para autenticar peticiones desde n8n u otras herramientas externas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new key */}
        <div className="flex gap-2">
          <Input
            placeholder="Nombre de la API Key (ej: Agente n8n)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()} size="sm" className="gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Crear
          </Button>
        </div>

        {/* Keys list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tienes API Keys. Crea una para empezar.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{k.name}</span>
                    <Badge variant={k.is_active ? 'default' : 'secondary'} className="text-xs">
                      {k.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={k.is_active} onCheckedChange={(v) => toggleKey(k.id, v)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteKey(k.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                    {visibleKeys.has(k.id) ? k.api_key : maskKey(k.api_key)}
                  </code>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleVisibility(k.id)}>
                    {visibleKeys.has(k.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyKey(k.api_key)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Creada: {format(new Date(k.created_at), 'dd MMM yyyy', { locale: es })}</span>
                  {k.last_used_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Último uso: {format(new Date(k.last_used_at), 'dd MMM yyyy HH:mm', { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
