import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Check, ExternalLink, LayoutGrid, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SidebarCategory, SidebarItem } from '@/hooks/useSidebarConfig';
import { ICON_MAP, ICON_OPTIONS, COLOR_OPTIONS, AVAILABLE_APPS, getIcon } from './sidebarConstants';

// Add Category Dialog
export function AddCategoryDialog({ onAdd }: { onAdd: (name: string, icon: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('FolderPlus');
  const [color, setColor] = useState('text-blue-500');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), icon, color);
    setName('');
    setIcon('FolderPlus');
    setColor('text-blue-500');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors">
          <Plus className="w-4 h-4" />
          <span>Nueva carpeta</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[360px] bg-background">
        <DialogHeader><DialogTitle>Nueva carpeta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la carpeta" />
          <div>
            <label className="text-sm font-medium mb-2 block">Icono</label>
            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto p-1">
              {ICON_OPTIONS.map(ic => {
                const Ic = ICON_MAP[ic];
                return (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn("w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                      icon === ic ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Ic className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("w-8 h-8 rounded-full transition-all", c.replace('text-', 'bg-'),
                    color === c ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                  )}
                />
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={handleAdd} disabled={!name.trim()}>
            <Check className="w-4 h-4 mr-2" /> Crear carpeta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add App Dialog
export function AddAppDialog({ categories, onAdd }: {
  categories: SidebarCategory[];
  onAdd: (categoryId: string, app: SidebarItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');

  const existingIds = new Set(categories.flatMap(c => c.items.map(i => i.id)));
  const filteredApps = AVAILABLE_APPS.filter(app => {
    if (existingIds.has(app.id)) return false;
    if (search) return app.label.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const handleAdd = (app: SidebarItem) => {
    if (!categoryId) return;
    onAdd(categoryId, app);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors">
          <LayoutGrid className="w-4 h-4" />
          <span>Añadir aplicación</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-background">
        <DialogHeader><DialogTitle>Añadir aplicación al sidebar</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Carpeta destino</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una carpeta..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar aplicación..."
              className="mb-2"
            />
            <div className="max-h-[280px] overflow-y-auto space-y-1">
              {filteredApps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {search ? 'No se encontraron aplicaciones' : 'Todas las aplicaciones ya están en el sidebar'}
                </p>
              ) : (
                filteredApps.map(app => {
                  const AppIcon = getIcon(app.icon);
                  return (
                    <button
                      key={app.id}
                      onClick={() => { handleAdd(app); }}
                      disabled={!categoryId}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        categoryId ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <AppIcon className={cn("w-4 h-4 flex-shrink-0", app.color)} />
                      <span className="flex-1 text-left">{app.label}</span>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add External Link Dialog
export function AddLinkDialog({ categories, onAdd }: {
  categories: SidebarCategory[];
  onAdd: (categoryId: string, label: string, url: string, icon: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('ExternalLink');
  const [color, setColor] = useState('text-blue-500');
  const [categoryId, setCategoryId] = useState('');

  const handleAdd = () => {
    if (!label.trim() || !url.trim() || !categoryId) return;
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    onAdd(categoryId, label.trim(), finalUrl, icon, color);
    setLabel('');
    setUrl('');
    setIcon('ExternalLink');
    setColor('text-blue-500');
    setCategoryId('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors">
          <Link className="w-4 h-4" />
          <span>Añadir enlace externo</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px] bg-background">
        <DialogHeader><DialogTitle>Añadir enlace externo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Carpeta destino</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una carpeta..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nombre del enlace</label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Google, Panel de control..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">URL de destino</label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://ejemplo.com" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Icono</label>
            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto p-1">
              {['ExternalLink', 'Link', 'Globe', 'Briefcase', 'FileText', 'MessageSquare', 'Mail', 'Bot', 'Sparkles', 'Cloud', 'Settings', 'Calculator', 'Bell', 'Search', 'Wrench', 'FolderOpen'].map(ic => {
                const Ic = ICON_MAP[ic] || ExternalLink;
                return (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn("w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                      icon === ic ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Ic className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("w-8 h-8 rounded-full transition-all", c.replace('text-', 'bg-'),
                    color === c ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                  )}
                />
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleAdd}
            disabled={!label.trim() || !url.trim() || !categoryId}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> Añadir enlace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
