import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Server, Eye, EyeOff, Loader2, Check, Wifi, WifiOff, Star, TestTube } from 'lucide-react';
import { useEmailProfiles, EmailProfileInsert } from '@/hooks/useEmailProfiles';

const INITIAL_FORM: Partial<EmailProfileInsert> = {
  profile_name: '',
  is_default: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  smtp_secure: 'STARTTLS',
  from_email: '',
  from_name: '',
  imap_host: '',
  imap_port: 993,
  imap_user: '',
  imap_password: '',
  imap_secure: true,
  auto_sync_enabled: false,
  auto_sync_interval: 15,
};

export function EmailProfilesManager() {
  const { profiles, loading, createProfile, updateProfile, deleteProfile, testConnection } = useEmailProfiles();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const resetForm = () => { setForm(INITIAL_FORM); setEditingId(null); };

  const openCreate = () => { resetForm(); setIsOpen(true); };

  const openEdit = (profile: any) => {
    setForm({
      profile_name: profile.profile_name,
      is_default: profile.is_default,
      smtp_host: profile.smtp_host,
      smtp_port: profile.smtp_port,
      smtp_user: profile.smtp_user,
      smtp_password: profile.smtp_password,
      smtp_secure: profile.smtp_secure,
      from_email: profile.from_email,
      from_name: profile.from_name || '',
      imap_host: profile.imap_host || '',
      imap_port: profile.imap_port || 993,
      imap_user: profile.imap_user || '',
      imap_password: profile.imap_password || '',
      imap_secure: profile.imap_secure ?? true,
      auto_sync_enabled: profile.auto_sync_enabled,
      auto_sync_interval: profile.auto_sync_interval,
    });
    setEditingId(profile.id);
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.profile_name || !form.smtp_host || !form.smtp_user || !form.from_email) return;
    if (editingId) {
      await updateProfile(editingId, form as any);
    } else {
      await createProfile(form);
    }
    setIsOpen(false);
    resetForm();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    await testConnection(id);
    setTesting(null);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProfile(deleteId);
      setDeleteId(null);
    }
  };

  const f = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Perfiles de Correo</h2>
          <p className="text-sm text-muted-foreground">Gestiona múltiples cuentas SMTP e IMAP</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nuevo Perfil</Button>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Server className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">No hay perfiles configurados</p>
            <p className="text-sm">Añade un perfil de correo para empezar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {profiles.map(profile => (
            <Card key={profile.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${profile.connection_status === 'connected' ? 'bg-green-500' : profile.connection_status === 'error' ? 'bg-red-500' : 'bg-muted-foreground/50'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{profile.profile_name}</span>
                        {profile.is_default && <Badge variant="secondary" className="text-xs"><Star className="h-3 w-3 mr-1" />Predeterminado</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.from_email} · {profile.smtp_host}:{profile.smtp_port}</p>
                      {profile.imap_host && <p className="text-xs text-muted-foreground">IMAP: {profile.imap_host}:{profile.imap_port} {profile.auto_sync_enabled ? `· Sync cada ${profile.auto_sync_interval}min` : ''}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleTest(profile.id)} disabled={testing === profile.id}>
                      {testing === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(profile)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(profile.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Perfil' : 'Nuevo Perfil de Correo'}</DialogTitle>
            <DialogDescription>Configura los datos SMTP e IMAP para este perfil</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del perfil *</Label>
                <Input value={form.profile_name} onChange={e => f('profile_name', e.target.value)} placeholder="Empresa Principal" />
              </div>
              <div className="space-y-2">
                <Label>Email remitente *</Label>
                <Input value={form.from_email} onChange={e => f('from_email', e.target.value)} placeholder="info@empresa.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nombre remitente</Label>
              <Input value={form.from_name || ''} onChange={e => f('from_name', e.target.value)} placeholder="Mi Empresa" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_default} onCheckedChange={v => f('is_default', v)} />
              <Label>Establecer como predeterminado</Label>
            </div>

            {/* SMTP */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Server className="h-4 w-4" /> Servidor SMTP (envío)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Host *</Label><Input value={form.smtp_host} onChange={e => f('smtp_host', e.target.value)} placeholder="smtp.office365.com" /></div>
                <div className="space-y-2"><Label>Puerto *</Label><Input type="number" value={form.smtp_port} onChange={e => f('smtp_port', parseInt(e.target.value))} /></div>
                <div className="space-y-2"><Label>Usuario *</Label><Input value={form.smtp_user} onChange={e => f('smtp_user', e.target.value)} placeholder="user@empresa.com" /></div>
                <div className="space-y-2">
                  <Label>Contraseña *</Label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} value={form.smtp_password} onChange={e => f('smtp_password', e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Seguridad</Label>
                <Select value={form.smtp_secure} onValueChange={v => f('smtp_secure', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STARTTLS">STARTTLS (puerto 587)</SelectItem>
                    <SelectItem value="SSL">SSL/TLS (puerto 465)</SelectItem>
                    <SelectItem value="NONE">Sin cifrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* IMAP */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Wifi className="h-4 w-4" /> Servidor IMAP (recepción)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Host IMAP</Label><Input value={form.imap_host || ''} onChange={e => f('imap_host', e.target.value)} placeholder="imap.office365.com" /></div>
                <div className="space-y-2"><Label>Puerto</Label><Input type="number" value={form.imap_port || 993} onChange={e => f('imap_port', parseInt(e.target.value))} /></div>
                <div className="space-y-2"><Label>Usuario</Label><Input value={form.imap_user || ''} onChange={e => f('imap_user', e.target.value)} placeholder="user@empresa.com" /></div>
                <div className="space-y-2">
                  <Label>Contraseña</Label>
                  <div className="relative">
                    <Input type={showImapPassword ? 'text' : 'password'} value={form.imap_password || ''} onChange={e => f('imap_password', e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowImapPassword(!showImapPassword)}>
                      {showImapPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.imap_secure ?? true} onCheckedChange={v => f('imap_secure', v)} />
                <Label>Usar SSL/TLS</Label>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.auto_sync_enabled} onCheckedChange={v => f('auto_sync_enabled', v)} />
                  <Label>Sincronización automática</Label>
                </div>
                {form.auto_sync_enabled && (
                  <Select value={String(form.auto_sync_interval)} onValueChange={v => f('auto_sync_interval', parseInt(v))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Cada 5 min</SelectItem>
                      <SelectItem value="15">Cada 15 min</SelectItem>
                      <SelectItem value="30">Cada 30 min</SelectItem>
                      <SelectItem value="60">Cada hora</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.profile_name || !form.smtp_host || !form.smtp_user || !form.from_email}>
              <Check className="h-4 w-4 mr-1" />{editingId ? 'Guardar' : 'Crear perfil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar perfil</DialogTitle>
            <DialogDescription>¿Seguro que quieres eliminar este perfil? Se eliminarán también los correos sincronizados.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
