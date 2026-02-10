import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { 
  Plus, Pencil, Trash2, Building2, Mail, Phone, Tags, 
  Loader2, Check, X, Search, Globe, FileSpreadsheet, History
} from 'lucide-react';
import { useProviders, Provider } from '@/hooks/useProviders';

const ProvidersManager = () => {
  const { providers, loading, createProvider, updateProvider, deleteProvider } = useProviders();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    especialidad: [] as string[],
    notas: '',
    activo: true,
    razon_social: '',
    cif_nif: '',
    direccion_fiscal: '',
    contacto_principal: '',
    web: '',
    categoria: '',
    condiciones_pago: '',
  });
  const [newEspecialidad, setNewEspecialidad] = useState('');

  const resetForm = () => {
    setFormData({
      nombre: '', email: '', telefono: '', especialidad: [], notas: '', activo: true,
      razon_social: '', cif_nif: '', direccion_fiscal: '', contacto_principal: '',
      web: '', categoria: '', condiciones_pago: '',
    });
    setNewEspecialidad('');
  };

  const openCreate = () => { resetForm(); setIsCreateOpen(true); };

  const openEdit = (provider: Provider) => {
    setFormData({
      nombre: provider.nombre,
      email: provider.email,
      telefono: provider.telefono || '',
      especialidad: provider.especialidad || [],
      notas: provider.notas || '',
      activo: provider.activo,
      razon_social: (provider as any).razon_social || '',
      cif_nif: (provider as any).cif_nif || '',
      direccion_fiscal: (provider as any).direccion_fiscal || '',
      contacto_principal: (provider as any).contacto_principal || '',
      web: (provider as any).web || '',
      categoria: (provider as any).categoria || '',
      condiciones_pago: (provider as any).condiciones_pago || '',
    });
    setEditingProvider(provider);
  };

  const handleAddEspecialidad = () => {
    if (newEspecialidad.trim() && !formData.especialidad.includes(newEspecialidad.trim())) {
      setFormData(prev => ({ ...prev, especialidad: [...prev.especialidad, newEspecialidad.trim()] }));
      setNewEspecialidad('');
    }
  };

  const handleRemoveEspecialidad = (esp: string) => {
    setFormData(prev => ({ ...prev, especialidad: prev.especialidad.filter(e => e !== esp) }));
  };

  const handleSubmit = async () => {
    if (!formData.nombre || !formData.email) return;
    if (editingProvider) {
      await updateProvider(editingProvider.id, formData);
      setEditingProvider(null);
    } else {
      await createProvider(formData);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteProvider(id);
    setDeleteConfirm(null);
  };

  const filteredProviders = providers.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.especialidad.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const ProviderForm = ({ onClose }: { onClose: () => void }) => (
    <ScrollArea className="max-h-[70vh]">
      <div className="space-y-4 py-4 pr-4">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre comercial *</Label>
            <Input placeholder="Nombre del proveedor" value={formData.nombre} onChange={e => setFormData(prev => ({ ...prev, nombre: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" placeholder="email@proveedor.com" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Razón social</Label>
            <Input placeholder="Razón social" value={formData.razon_social} onChange={e => setFormData(prev => ({ ...prev, razon_social: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>CIF/NIF</Label>
            <Input placeholder="B12345678" value={formData.cif_nif} onChange={e => setFormData(prev => ({ ...prev, cif_nif: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Dirección fiscal</Label>
          <Input placeholder="Calle, Nº, CP, Ciudad" value={formData.direccion_fiscal} onChange={e => setFormData(prev => ({ ...prev, direccion_fiscal: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Contacto principal</Label>
            <Input placeholder="Nombre del contacto" value={formData.contacto_principal} onChange={e => setFormData(prev => ({ ...prev, contacto_principal: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input placeholder="+34 600 000 000" value={formData.telefono} onChange={e => setFormData(prev => ({ ...prev, telefono: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Web</Label>
            <Input placeholder="https://proveedor.com" value={formData.web} onChange={e => setFormData(prev => ({ ...prev, web: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Input placeholder="Ej: Material eléctrico" value={formData.categoria} onChange={e => setFormData(prev => ({ ...prev, categoria: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Condiciones de pago</Label>
          <Input placeholder="Ej: 30 días, transferencia" value={formData.condiciones_pago} onChange={e => setFormData(prev => ({ ...prev, condiciones_pago: e.target.value }))} />
        </div>

        {/* Especialidades */}
        <div className="space-y-2">
          <Label>Especialidades</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.especialidad.map(esp => (
              <Badge key={esp} variant="secondary" className="pl-2 pr-1 py-1">
                {esp}
                <button onClick={() => handleRemoveEspecialidad(esp)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Añadir especialidad..." value={newEspecialidad} onChange={e => setNewEspecialidad(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddEspecialidad())} />
            <Button variant="secondary" size="icon" onClick={handleAddEspecialidad}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea placeholder="Notas adicionales..." value={formData.notas} onChange={e => setFormData(prev => ({ ...prev, notas: e.target.value }))} rows={3} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="activo" checked={formData.activo}
            onChange={e => setFormData(prev => ({ ...prev, activo: e.target.checked }))} className="rounded" />
          <Label htmlFor="activo">Proveedor activo</Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!formData.nombre || !formData.email}>
            <Check className="h-4 w-4 mr-1" />{editingProvider ? 'Guardar cambios' : 'Añadir proveedor'}
          </Button>
        </DialogFooter>
      </div>
    </ScrollArea>
  );

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Catálogo de Proveedores
            </CardTitle>
            <CardDescription>Gestiona tu lista de proveedores para solicitudes de presupuesto</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Añadir Proveedor</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nuevo Proveedor</DialogTitle>
                  <DialogDescription>Añade un nuevo proveedor a tu catálogo</DialogDescription>
                </DialogHeader>
                <ProviderForm onClose={() => setIsCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, email o especialidad..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>

        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CIF/NIF</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProviders.map(provider => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p>{provider.nombre}</p>
                        {(provider as any).razon_social && <p className="text-xs text-muted-foreground">{(provider as any).razon_social}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {(provider as any).contacto_principal && <p>{(provider as any).contacto_principal}</p>}
                      {provider.telefono && <p className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{provider.telefono}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {provider.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{(provider as any).cif_nif || '-'}</TableCell>
                  <TableCell>
                    {(provider as any).categoria ? (
                      <Badge variant="outline" className="text-xs">{(provider as any).categoria}</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {provider.especialidad.slice(0, 2).map(esp => (
                          <Badge key={esp} variant="outline" className="text-xs">{esp}</Badge>
                        ))}
                        {provider.especialidad.length > 2 && <Badge variant="secondary" className="text-xs">+{provider.especialidad.length - 2}</Badge>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={provider.activo ? 'default' : 'secondary'}>
                      {provider.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(provider as any).web && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={(provider as any).web} target="_blank" rel="noopener noreferrer"><Globe className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => {
                        window.location.href = `mailto:${provider.email}`;
                      }}><Mail className="h-4 w-4" /></Button>

                      <Dialog open={editingProvider?.id === provider.id} onOpenChange={open => !open && setEditingProvider(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(provider)}><Pencil className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Editar Proveedor</DialogTitle>
                            <DialogDescription>Modifica los datos del proveedor</DialogDescription>
                          </DialogHeader>
                          <ProviderForm onClose={() => setEditingProvider(null)} />
                        </DialogContent>
                      </Dialog>

                      <Dialog open={deleteConfirm === provider.id} onOpenChange={open => !open && setDeleteConfirm(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(provider.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Eliminar Proveedor</DialogTitle>
                            <DialogDescription>¿Seguro que quieres eliminar a {provider.nombre}? Esta acción no se puede deshacer.</DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={() => handleDelete(provider.id)}>Eliminar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProviders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores aún. Añade el primero.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ProvidersManager;
