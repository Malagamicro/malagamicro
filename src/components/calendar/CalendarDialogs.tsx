import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, CalendarDays, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarEvent } from '@/hooks/useCalendarEvents';
import { COLOR_OPTIONS, REMINDER_OPTIONS } from './CalendarConstants';
import { cn } from '@/lib/utils';

/* ───── Event Detail Dialog ───── */

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

export function EventDetailDialog({ event, onClose, onEdit, onDelete }: EventDetailDialogProps) {
  return (
    <Dialog open={!!event} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        {event && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }} />
                <DialogTitle className="text-lg">{event.title}</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="w-4 h-4" />
                <span className="capitalize">
                  {format(parseISO(event.event_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                </span>
              </div>
              {!event.all_day && event.start_time && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {event.start_time.substring(0, 5)}
                    {event.end_time && ` — ${event.end_time.substring(0, 5)}`}
                  </span>
                </div>
              )}
              {event.all_day && <Badge variant="secondary">Todo el día</Badge>}
              {event.description && (
                <p className="text-sm text-foreground/80 bg-muted/50 rounded-lg p-3">{event.description}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" variant="outline" onClick={() => {
                  onClose();
                  onEdit(event);
                }}>
                  Editar
                </Button>
                <Button variant="destructive" size="icon" onClick={() => onDelete(event.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───── Event Form Dialog ───── */

export interface EventFormData {
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string;
  reminder_minutes: number;
  selectedUsers: { user_id: string; permission: 'view' | 'edit' }[];
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  editingEvent: CalendarEvent | null;
  users: { id: string; full_name: string | null; email: string }[];
  onSubmit: () => void;
  onDelete: (eventId: string) => void;
  toggleUserSelection: (userId: string) => void;
  updateUserPermission: (userId: string, permission: 'view' | 'edit') => void;
}

export function EventFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  editingEvent,
  users,
  onSubmit,
  onDelete,
  toggleUserSelection,
  updateUserPermission,
}: EventFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4 pb-2">
            <div>
              <Label>Título *</Label>
              <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Título del evento" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Información adicional" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={formData.event_date} onChange={e => setFormData(p => ({ ...p, event_date: e.target.value }))} />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-1.5 mt-1">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      className={cn('w-7 h-7 rounded-full transition-all', formData.color === c.value && 'ring-2 ring-offset-2 ring-primary')}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setFormData(p => ({ ...p, color: c.value }))}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.all_day} onCheckedChange={v => setFormData(p => ({ ...p, all_day: v }))} />
              <Label>Todo el día</Label>
            </div>
            {!formData.all_day && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hora inicio</Label>
                  <Input type="time" value={formData.start_time} onChange={e => setFormData(p => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div>
                  <Label>Hora fin</Label>
                  <Input type="time" value={formData.end_time} onChange={e => setFormData(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <Label>Recordatorio</Label>
              <Select value={String(formData.reminder_minutes)} onValueChange={v => setFormData(p => ({ ...p, reminder_minutes: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* User multiselect */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1"><Users className="w-4 h-4" /> Compartir con</Label>
                {users.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const allSelected = users.every(u => formData.selectedUsers.some(s => s.user_id === u.id));
                      if (allSelected) {
                        setFormData(p => ({ ...p, selectedUsers: [] }));
                      } else {
                        setFormData(p => ({
                          ...p,
                          selectedUsers: users.map(u => {
                            const existing = p.selectedUsers.find(s => s.user_id === u.id);
                            return existing || { user_id: u.id, permission: 'view' as const };
                          }),
                        }));
                      }
                    }}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    {users.every(u => formData.selectedUsers.some(s => s.user_id === u.id))
                      ? 'Quitar todos'
                      : 'Compartir con todos'}
                  </Button>
                )}
              </div>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">No hay otros usuarios</p>
              ) : (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                  {users.map(u => {
                    const selected = formData.selectedUsers.find(s => s.user_id === u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={!!selected}
                          onCheckedChange={() => toggleUserSelection(u.id)}
                        />
                        <span className="text-sm flex-1 truncate">{u.full_name || u.email}</span>
                        {selected && (
                          <Select value={selected.permission} onValueChange={(v: 'view' | 'edit') => updateUserPermission(u.id, v)}>
                            <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">Solo ver</SelectItem>
                              <SelectItem value="edit">Editar</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={onSubmit} disabled={!formData.title.trim()}>
                {editingEvent ? 'Guardar cambios' : 'Crear evento'}
              </Button>
              {editingEvent && (
                <Button variant="destructive" onClick={() => onDelete(editingEvent.id)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
