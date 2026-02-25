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
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, Shield, ArrowLeft, Users, KeyRound } from 'lucide-react';
import { format } from 'date-fns';
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
  
  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=list`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error fetching users');
      }

      setUsers(result.users || []);
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

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({
        title: 'Error',
        description: 'Email y contraseña son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            role: newUserRole,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error creating user');
      }

      toast({
        title: 'Usuario creado',
        description: `Usuario ${newUserEmail} creado exitosamente`,
      });

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
      setCreateDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      setDeleting(userId);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=delete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error deleting user');
      }

      toast({
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado exitosamente',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const setUserRole = async (userId: string, role: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=set-role`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, role }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error updating role');
      }

      toast({
        title: 'Rol actualizado',
        description: 'El rol del usuario ha sido actualizado',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=update-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: passwordTarget.id, password: newPassword }),
        }
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

  if (!isAdmin) {
    return null;
  }

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
              <p className="text-muted-foreground">
                Administra los usuarios de la aplicación
              </p>
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
                <DialogDescription>
                  Introduce los datos del nuevo usuario
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createUser} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Usuario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuarios Registrados</CardTitle>
            <CardDescription>
              Lista de todos los usuarios en el sistema
            </CardDescription>
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
                    <TableHead>Fecha de Registro</TableHead>
                    <TableHead>Último Acceso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.email}
                        {u.email === ADMIN_EMAIL && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Admin Principal
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.roles[0] || 'user'}
                          onValueChange={(role) => setUserRole(u.id, role)}
                          disabled={u.email === ADMIN_EMAIL}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
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
                          <span className="text-primary text-sm">
                            ✓ Verificado
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Pendiente
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-1">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                              >
                                {deleting === u.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente
                                  el usuario <strong>{u.email}</strong> y todos sus datos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(u.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancelar
              </Button>
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