import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, User, RefreshCw } from 'lucide-react';
import { StelClient } from '@/types/stelBudget';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: StelClient[];
  loading: boolean;
  onSelect: (client: StelClient) => void;
  onRefresh?: () => void;
}

export default function ClientSearchModal({ open, onOpenChange, clients, loading, onSelect, onRefresh }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.nombre.toLowerCase().includes(q) || (c.nif && c.nif.toLowerCase().includes(q))
    );
  }, [clients, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Buscar cliente</DialogTitle>
            {onRefresh && (
              <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading} className="h-8 w-8">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o NIF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-auto min-h-0 mt-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">No se encontraron clientes</p>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Actualizar clientes
                </Button>
              )}
            </div>
          ) : (
            filtered.map(client => (
              <button
                key={client.id}
                onClick={() => { onSelect(client); onOpenChange(false); setSearch(''); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/10 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{client.nombre}</p>
                  {client.nif && <p className="text-xs text-muted-foreground">{client.nif}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
