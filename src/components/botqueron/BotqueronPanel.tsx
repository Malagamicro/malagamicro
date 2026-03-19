import { useState } from 'react';
import { format, parseISO, isToday, isTomorrow, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, Calendar, Plus, ChevronLeft, ChevronRight, Clock, Trash2, Edit2, Phone, Mail, FileText, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useBotqueronAppointments, BotqueronAppointment } from '@/hooks/useBotqueronAppointments';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { BotqueronN8nTools } from './BotqueronN8nTools';

const SERVICES = ['Consulta Agente IA', 'Demo Agente', 'Configuración Bot', 'Soporte Técnico', 'Plan Personalizado'];
const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmada: 'bg-sky-100 text-sky-800 border-sky-300',
  completada: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelada: 'bg-red-100 text-red-800 border-red-300',
};

const HOURS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 9;
  return [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`];
}).flat();

export function BotqueronPanel() {
  const { user } = useAuth();
  const { appointments, isLoading, addAppointment, updateAppointment, deleteAppointment } = useBotqueronAppointments();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingAppt, setEditingAppt] = useState<BotqueronAppointment | null>(null);
  const [activeView, setActiveView] = useState<'calendar' | 'tools'>('calendar');

  // Form state
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    appointment_date: format(new Date(), 'yyyy-MM-dd'),
    appointment_time: '10:00',
    duration_minutes: 30,
    service: 'Consulta Agente IA',
    notes: '',
    status: 'pendiente',
  });

  const resetForm = () => {
    setFormData({
      client_name: '',
      client_email: '',
      client_phone: '',
      appointment_date: format(selectedDate, 'yyyy-MM-dd'),
      appointment_time: '10:00',
      duration_minutes: 30,
      service: 'Consulta Agente IA',
      notes: '',
      status: 'pendiente',
    });
    setEditingAppt(null);
  };

  const openNewForm = () => {
    resetForm();
    setFormData(prev => ({ ...prev, appointment_date: format(selectedDate, 'yyyy-MM-dd') }));
    setShowForm(true);
  };

  const openEditForm = (appt: BotqueronAppointment) => {
    setEditingAppt(appt);
    setFormData({
      client_name: appt.client_name,
      client_email: appt.client_email || '',
      client_phone: appt.client_phone || '',
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      duration_minutes: appt.duration_minutes,
      service: appt.service,
      notes: appt.notes || '',
      status: appt.status,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.client_name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    if (editingAppt) {
      updateAppointment.mutate({ id: editingAppt.id, ...formData });
    } else {
      addAppointment.mutate({ ...formData, created_by: user?.id || null });
    }
    setShowForm(false);
    resetForm();
  };

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7; // Monday start

  const dayAppointments = (date: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.appointment_date), date));

  const selectedDayAppts = dayAppointments(selectedDate)
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    return format(date, "EEEE d 'de' MMMM", { locale: es });
  };

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b-2" style={{ background: 'linear-gradient(135deg, #0369a1, #0ea5e9)', borderColor: '#f97316' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f97316' }}>
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">BOTQUERÓN</h1>
              <p className="text-sky-100 text-xs">Panel de gestión · Agentes IA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeView === 'calendar' ? 'default' : 'outline'}
              onClick={() => setActiveView('calendar')}
              className={activeView === 'calendar'
                ? 'text-white border-white/30'
                : 'text-white border-white/40 hover:bg-white/20'}
              style={activeView === 'calendar' ? { background: '#f97316' } : { background: 'transparent' }}
            >
              <Calendar className="w-4 h-4 mr-1" /> Citas
            </Button>
            <Button
              size="sm"
              variant={activeView === 'tools' ? 'default' : 'outline'}
              onClick={() => setActiveView('tools')}
              className={activeView === 'tools'
                ? 'text-white border-white/30'
                : 'text-white border-white/40 hover:bg-white/20'}
              style={activeView === 'tools' ? { background: '#f97316' } : { background: 'transparent' }}
            >
              <ExternalLink className="w-4 h-4 mr-1" /> n8n Tools
            </Button>
          </div>
        </div>
      </div>

      {activeView === 'tools' ? (
        <div className="flex-1 overflow-auto p-4 sm:p-6" style={{ background: '#f0f9ff' }}>
          <BotqueronN8nTools />
        </div>
      ) : (
        <div className="flex-1 overflow-auto flex flex-col lg:flex-row" style={{ background: '#f0f9ff' }}>
          {/* Calendar */}
          <div className="lg:w-[380px] p-4 border-b lg:border-b-0 lg:border-r" style={{ borderColor: '#bae6fd' }}>
            <div className="flex items-center justify-between mb-3">
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="hover:bg-sky-100" style={{ color: '#0369a1' }}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold capitalize" style={{ color: '#0369a1' }}>
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="hover:bg-sky-100" style={{ color: '#0369a1' }}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium mb-1" style={{ color: '#64748b' }}>
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const count = dayAppointments(day).length;
                const isSelected = isSameDay(day, selectedDate);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`relative p-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'text-white shadow-md'
                        : today
                        ? 'font-bold'
                        : 'hover:bg-sky-100'
                    }`}
                    style={{
                      background: isSelected ? '#0369a1' : undefined,
                      color: isSelected ? 'white' : today ? '#f97316' : '#334155',
                    }}
                  >
                    {format(day, 'd')}
                    {count > 0 && (
                      <span
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ background: isSelected ? 'white' : '#f97316' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <Button onClick={openNewForm} className="w-full mt-4 text-white font-semibold" style={{ background: '#f97316' }}>
              <Plus className="w-4 h-4 mr-2" /> Nueva Cita
            </Button>
          </div>

          {/* Day view */}
          <div className="flex-1 p-4 sm:p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold capitalize" style={{ color: '#0369a1' }}>
                {getDateLabel(selectedDate)}
              </h2>
              <Badge variant="outline" style={{ borderColor: '#0ea5e9', color: '#0369a1' }}>
                {selectedDayAppts.length} cita{selectedDayAppts.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {selectedDayAppts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-3" style={{ color: '#bae6fd' }} />
                <p className="text-sm" style={{ color: '#64748b' }}>Sin citas para este día</p>
                <Button onClick={openNewForm} variant="outline" size="sm" className="mt-3"
                  style={{ borderColor: '#f97316', color: '#f97316' }}>
                  <Plus className="w-3 h-3 mr-1" /> Agendar cita
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayAppts.map(appt => (
                  <Card key={appt.id} className="p-4 border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: '#f97316', background: 'white' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-3.5 h-3.5" style={{ color: '#0369a1' }} />
                          <span className="font-semibold text-sm" style={{ color: '#0369a1' }}>{appt.appointment_time}</span>
                          <span className="text-xs" style={{ color: '#64748b' }}>{appt.duration_minutes} min</span>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[appt.status] || ''}`}>
                            {appt.status}
                          </Badge>
                        </div>
                        <p className="font-semibold" style={{ color: '#1e293b' }}>{appt.client_name}</p>
                        <p className="text-xs" style={{ color: '#f97316' }}>{appt.service}</p>
                        <div className="flex gap-3 mt-1">
                          {appt.client_phone && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#64748b' }}>
                              <Phone className="w-3 h-3" /> {appt.client_phone}
                            </span>
                          )}
                          {appt.client_email && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#64748b' }}>
                              <Mail className="w-3 h-3" /> {appt.client_email}
                            </span>
                          )}
                        </div>
                        {appt.notes && (
                          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#94a3b8' }}>
                            <FileText className="w-3 h-3" /> {appt.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditForm(appt)}
                          className="h-7 w-7 hover:bg-sky-100" style={{ color: '#0369a1' }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteAppointment.mutate(appt.id)}
                          className="h-7 w-7 hover:bg-red-100" style={{ color: '#ef4444' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md" style={{ borderTop: '4px solid #f97316' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#0369a1' }}>
              {editingAppt ? 'Editar Cita' : 'Nueva Cita'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label style={{ color: '#334155' }}>Nombre del cliente *</Label>
              <Input value={formData.client_name} onChange={e => setFormData(p => ({ ...p, client_name: e.target.value }))}
                placeholder="Nombre completo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: '#334155' }}>Email</Label>
                <Input value={formData.client_email} onChange={e => setFormData(p => ({ ...p, client_email: e.target.value }))}
                  placeholder="email@ejemplo.com" type="email" />
              </div>
              <div>
                <Label style={{ color: '#334155' }}>Teléfono</Label>
                <Input value={formData.client_phone} onChange={e => setFormData(p => ({ ...p, client_phone: e.target.value }))}
                  placeholder="+34..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: '#334155' }}>Fecha</Label>
                <Input type="date" value={formData.appointment_date}
                  onChange={e => setFormData(p => ({ ...p, appointment_date: e.target.value }))} />
              </div>
              <div>
                <Label style={{ color: '#334155' }}>Hora</Label>
                <Select value={formData.appointment_time} onValueChange={v => setFormData(p => ({ ...p, appointment_time: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: '#334155' }}>Servicio</Label>
                <Select value={formData.service} onValueChange={v => setFormData(p => ({ ...p, service: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: '#334155' }}>Duración (min)</Label>
                <Select value={String(formData.duration_minutes)} onValueChange={v => setFormData(p => ({ ...p, duration_minutes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90].map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingAppt && (
              <div>
                <Label style={{ color: '#334155' }}>Estado</Label>
                <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pendiente', 'confirmada', 'completada', 'cancelada'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label style={{ color: '#334155' }}>Notas</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Observaciones..." rows={2} />
            </div>
            <Button onClick={handleSubmit} className="w-full text-white font-semibold" style={{ background: '#f97316' }}
              disabled={addAppointment.isPending || updateAppointment.isPending}>
              {editingAppt ? 'Guardar Cambios' : 'Crear Cita'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
