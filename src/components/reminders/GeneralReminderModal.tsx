import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Clock, Repeat, StickyNote, Users } from 'lucide-react';
import { useGeneralReminders } from '@/hooks/useGeneralReminders';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GeneralReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorities = [
  { value: 'low', label: 'Baja', color: 'text-muted-foreground' },
  { value: 'normal', label: 'Normal', color: 'text-foreground' },
  { value: 'high', label: 'Alta', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgente', color: 'text-destructive' },
];

const categories = [
  { value: 'general', label: 'General' },
  { value: 'meeting', label: 'Reunión' },
  { value: 'task', label: 'Tarea' },
  { value: 'call', label: 'Llamada' },
  { value: 'payment', label: 'Pago' },
  { value: 'deadline', label: 'Fecha límite' },
  { value: 'other', label: 'Otro' },
];

const recurrenceOptions = [
  { value: 'once', label: 'Una vez' },
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

interface UserProfile {
  user_id: string;
  full_name: string | null;
}

export function GeneralReminderModal({ open, onOpenChange }: GeneralReminderModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [category, setCategory] = useState('general');
  const [recurrence, setRecurrence] = useState('once');
  const [note, setNote] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const { addReminder, isAddingReminder } = useGeneralReminders();

  // Fetch all users for the picker
  useEffect(() => {
    if (!open) return;
    supabase
      .from('profiles')
      .select('user_id, full_name')
      .then(({ data }) => {
        if (data) setAllUsers(data as UserProfile[]);
      });
  }, [open]);

  const handleSubmit = () => {
    if (!date || !title.trim()) return;

    const [hours, minutes] = time.split(':').map(Number);
    const reminderDate = new Date(date);
    reminderDate.setHours(hours, minutes, 0, 0);

    addReminder(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        reminderDate,
        priority,
        category,
        recurrence_type: recurrence,
        note: note.trim() || undefined,
        target_user_ids: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      },
      { onSuccess: () => { onOpenChange(false); resetForm(); } }
    );
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDate(undefined); setTime('09:00');
    setPriority('normal'); setCategory('general'); setRecurrence('once'); setNote('');
    setSelectedUserIds([]); setShowUserPicker(false);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Free time input - no longer restricted to 30-min intervals

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Recordatorio</DialogTitle>
          <DialogDescription>Programa un recordatorio general para la empresa.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" placeholder="Ej: Revisar facturas pendientes" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Fecha *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP', { locale: es }) : 'Seleccionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">{priorities.map((p) => (<SelectItem key={p.value} value={p.value}><span className={p.color}>{p.label}</span></SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">{categories.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1"><Repeat className="h-3 w-3" /> Repetir</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">{recurrenceOptions.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>

          {/* User Selector */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Destinatarios</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowUserPicker(!showUserPicker)}>
                {showUserPicker ? 'Ocultar' : 'Seleccionar usuarios'}
              </Button>
            </div>
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedUserIds.map(uid => {
                  const u = allUsers.find(u => u.user_id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleUser(uid)}>
                      {u?.full_name || 'Usuario'} ×
                    </Badge>
                  );
                })}
              </div>
            )}
            {selectedUserIds.length === 0 && !showUserPicker && (
              <p className="text-xs text-muted-foreground">Todos los usuarios (por defecto)</p>
            )}
            {showUserPicker && (
              <ScrollArea className="max-h-32 rounded-lg border p-2">
                <div className="space-y-1">
                  {allUsers.map(u => (
                    <label key={u.user_id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent/50 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedUserIds.includes(u.user_id)}
                        onCheckedChange={() => toggleUser(u.user_id)}
                      />
                      {u.full_name || 'Sin nombre'}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Descripción</Label>
            <Textarea placeholder="Añade detalles adicionales..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1"><StickyNote className="h-3 w-3" /> Nota rápida</Label>
            <Input placeholder="Contexto breve para este recordatorio..." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!date || !title.trim() || isAddingReminder}>
            {isAddingReminder ? 'Guardando...' : 'Programar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
