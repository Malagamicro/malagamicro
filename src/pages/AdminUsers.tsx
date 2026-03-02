import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, Shield, ArrowLeft, Users, KeyRound, ShieldAlert, ShieldCheck, Unlock, Clock, MapPin, Globe, Monitor } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const ADMIN_EMAIL = 'administracion@malagamicro.com';

interface User {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  roles: string[];
}

interface SecurityBlock {
  id: string;
  user_id: string;
  user_email: string;
  ip_address: string | null;
  reason: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  alert_details: any;
}

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('user');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Security blocks state
  const [blocks, setBlocks] = useState<SecurityBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [userBlocks, setUserBlocks] = useState<Record<string, boolean>>({});

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchBlocks();
    }
  }, [isAdmin]);

  const getAuthHeaders = async () => {
    const session = await supabase.auth.getSession();
    return {
      'Authorization': `Bearer ${session.data.session?.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=list`,
        { method: 'GET', headers }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error fetching users');
      
      const userList = result.users || [];
      setUsers(userList);

      // Check blocks for each user
      const blockChecks: Record<string, boolean> = {};
      await Promise.all(userList.map(async (u: User) => {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=check-blocks&userId=${u.id}`,
            { method: 'GET', headers }
          );
          const data = await res.json();
          blockChecks[u.id] = data.blocked || false;
        } catch {
          blockChecks[u.id] = false;
        }
      }));
      setUserBlocks(blockChecks);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBlocks = async () => {
    try {
      setBlocksLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=list-blocks`,
        { method: 'GET', headers }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error fetching blocks');
      setBlocks(result.blocks || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBlocksLoading(false);
    }
  };

  const handleUnblock = async (blockId: string, userId?: string) => {
    try {
      setUnblocking(blockId);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=unblock`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(userId ? { userId } : { blockId }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast({ title: 'Desbloqueado', description: 'El usuario ha sido desbloqueado correctamente.' });
      fetchBlocks();
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUnblocking(null);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      setUnblocking(userId);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=unblock`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast({ title: 'Desbloqueado', description: 'El usuario ha sido desbloqueado.' });
      fetchUsers();
      fetchBlocks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUnblocking(null);
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ title: 'Error', description: 'Email y contraseña son requeridos', variant: 'destructive' });
      return;
    }
    try {
      setCreating(true);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=create`,
        { method: 'POST', headers, body: JSON.stringify({ email: newUserEmail, password: newUserPassword, role: newUserRole }) }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error creating user');
      toast({ title: 'Usuario creado', description: `Usuario ${newUserEmail} creado exitosamente` });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
      setCreateDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      setDeleting(userId);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=delete`,
        { method: 'POST', headers, body: JSON.stringify({ userId }) }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error deleting user');
      toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado exitosamente' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const setUserRole = async (userId: string, role: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=set-role`,
        { method: 'POST', headers, body: JSON.stringify({ userId, role }) }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error updating role');
      toast({ title: 'Rol actualizado', description: 'El rol del usuario ha sido actualizado' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const changePassword = async () => {
    if (!passwordTarget || !newPassword) {
      toast({ title: 'Error', description: 'La contraseña es requerida', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' });
      return;
    }
    try {
      setChangingPassword(true);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=update-password`,
        { method: 'POST', headers, body: JSON.stringify({ userId: passwordTarget.id, password: newPassword }) }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al cambiar contraseña');
      toast({ title: 'Contraseña actualizada', description: `La contraseña de ${passwordTarget.email} ha sido cambiada` });
      setPasswordDialogOpen(false);
      setNewPassword('');
      setPasswordTarget(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const activeBlocks = blocks.filter(b => b.is_active && new Date(b.expires_at) > new Date());
  const resolvedBlocks = blocks.filter(b => !b.is_active || new Date(b.expires_at) <= new Date());

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Users className="h-8 w-8" />
                Gestión de Usuarios
              </h1>
              <p className="text-muted-foreground">Administra usuarios y seguridad</p>
            </div>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>Introduce los datos del nuevo usuario</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="usuario@ejemplo.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
                <Button onClick={createUser} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Usuario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Seguridad
              {activeBlocks.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeBlocks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ===== USERS TAB ===== */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Usuarios Registrados</CardTitle>
                <CardDescription>Lista de todos los usuarios en el sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead>Último Acceso</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id} className={userBlocks[u.id] ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {u.email}
                              {u.email === ADMIN_EMAIL && (
                                <Badge variant="outline" className="text-xs">Admin Principal</Badge>
                              )}
                              {userBlocks[u.id] && (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  <ShieldAlert className="h-3 w-3" />
                                  Bloqueado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.roles[0] || 'user'}
                              onValueChange={(role) => setUserRole(u.id, role)}
                              disabled={u.email === ADMIN_EMAIL}
                            >
                              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Usuario</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {format(new Date(u.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell>
                            {u.last_sign_in_at
                              ? format(new Date(u.last_sign_in_at), 'dd/MM/yyyy HH:mm', { locale: es })
                              : 'Nunca'}
                          </TableCell>
                          <TableCell>
                            {u.email_confirmed_at ? (
                              <span className="text-primary text-sm">✓ Verificado</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Pendiente</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {userBlocks[u.id] && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  title="Desbloquear usuario"
                                  onClick={() => handleUnblockUser(u.id)}
                                  disabled={unblocking === u.id}
                                  className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                >
                                  {unblocking === u.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Unlock className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cambiar contraseña"
                                onClick={() => {
                                  setPasswordTarget({ id: u.id, email: u.email || '' });
                                  setNewPassword('');
                                  setPasswordDialogOpen(true);
                                }}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              {u.email !== ADMIN_EMAIL && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                      {deleting === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente el usuario <strong>{u.email}</strong> y todos sus datos.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteUser(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== SECURITY TAB ===== */}
          <TabsContent value="security" className="space-y-6">
            {/* Active Blocks */}
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  Bloqueos Activos
                  {activeBlocks.length > 0 && (
                    <Badge variant="destructive">{activeBlocks.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>Usuarios bloqueados por actividad sospechosa</CardDescription>
              </CardHeader>
              <CardContent>
                {blocksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : activeBlocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mb-3 text-emerald-500" />
                    <p className="text-lg font-medium">Sin bloqueos activos</p>
                    <p className="text-sm">Todos los usuarios tienen acceso normal</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeBlocks.map((block) => (
                      <div key={block.id} className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4 text-destructive" />
                              <span className="font-semibold">{block.user_email}</span>
                              <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{block.reason}</p>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {block.ip_address && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  IP: {block.ip_address}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(block.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expira: {formatDistanceToNow(new Date(block.expires_at), { addSuffix: true, locale: es })}
                              </span>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="shrink-0 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                                {unblocking === block.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Unlock className="h-4 w-4 mr-1" />
                                )}
                                Desbloquear
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Desbloquear usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se restaurará el acceso de <strong>{block.user_email}</strong>. Asegúrate de que la actividad sospechosa ha sido revisada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleUnblock(block.id)}>
                                  Desbloquear
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resolved Blocks History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Historial de Bloqueos
                </CardTitle>
                <CardDescription>Bloqueos anteriores resueltos o expirados</CardDescription>
              </CardHeader>
              <CardContent>
                {resolvedBlocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin historial de bloqueos</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedBlocks.slice(0, 20).map((block) => (
                        <TableRow key={block.id}>
                          <TableCell className="font-medium">{block.user_email}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{block.reason}</TableCell>
                          <TableCell className="text-sm font-mono">{block.ip_address || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(block.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell>
                            {block.resolved_at ? (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                                Desbloqueado
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Expirado</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Password Change Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cambiar Contraseña</DialogTitle>
              <DialogDescription>
                Nueva contraseña para <strong>{passwordTarget?.email}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <Input id="new-password" type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancelar</Button>
              <Button onClick={changePassword} disabled={changingPassword || newPassword.length < 6}>
                {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cambiar Contraseña
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
