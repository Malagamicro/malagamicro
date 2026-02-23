import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Clock, Repeat, StickyNote } from 'lucide-react';
import { useGeneralReminders } from '@/hooks/useGeneralReminders';
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

export function GeneralReminderModal({ open, onOpenChange }: GeneralReminderModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [category, setCategory] = useState('general');
  const [recurrence, setRecurrence] = useState('once');
  const [note, setNote] = useState('');

  const { addReminder, isAddingReminder } = useGeneralReminders();

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
      },
      { onSuccess: () => { onOpenChange(false); resetForm(); } }
    );
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDate(undefined); setTime('09:00');
    setPriority('normal'); setCategory('general'); setRecurrence('once'); setNote('');
  };

  const timeOptions = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
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
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger><div className="flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></div></SelectTrigger>
                <SelectContent className="bg-popover">{timeOptions.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
              </Select>
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
