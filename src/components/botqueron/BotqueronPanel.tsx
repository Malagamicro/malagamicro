import { useState } from 'react';
import { format, parseISO, isToday, isTomorrow, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, Calendar, Plus, ChevronLeft, ChevronRight, Clock, Trash2, Edit2, Phone, Mail, FileText, ExternalLink, BookOpen } from 'lucide-react';
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
import { BotqueronKnowledgeBase } from './BotqueronKnowledgeBase';

const SERVICES = ['Consulta Agente IA', 'Demo Agente', 'Configuración Bot', 'Soporte Técnico', 'Plan Personalizado'];
const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  confirmada: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  completada: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelada: 'bg-red-500/10 text-red-500 border-red-500/20',
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
  const [activeView, setActiveView] = useState<'calendar' | 'tools' | 'knowledge'>('calendar');

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7; 

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
    <div className="h-full flex flex-col bg-slate-950 font-sans text-slate-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shadow-inner">
              <Bot className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">BOT<span className="text-orange-500">QUERÓN</span></h1>
              <p className="text-slate-400 text-sm">Centro de control para agentes IA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setActiveView('calendar')}
              className={`transition-colors ${activeView === 'calendar'
                ? 'bg-orange-500 hover:bg-orange-600 text-white border-transparent'
                : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'}`}
              variant={activeView === 'calendar' ? 'default' : 'outline'}
            >
              <Calendar className="w-4 h-4 mr-2" /> Citas
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveView('knowledge')}
              className={`transition-colors ${activeView === 'knowledge'
                ? 'bg-orange-500 hover:bg-orange-600 text-white border-transparent'
                : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'}`}
              variant={activeView === 'knowledge' ? 'default' : 'outline'}
            >
              <BookOpen className="w-4 h-4 mr-2" /> RAG
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveView('tools')}
              className={`transition-colors ${activeView === 'tools'
                ? 'bg-orange-500 hover:bg-orange-600 text-white border-transparent'
                : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'}`}
              variant={activeView === 'tools' ? 'default' : 'outline'}
            >
              <ExternalLink className="w-4 h-4 mr-2" /> n8n Tools
            </Button>
          </div>
        </div>
      </div>

      {activeView === 'tools' ? (
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <BotqueronN8nTools />
        </div>
      ) : (
        <div className="flex-1 overflow-auto flex flex-col lg:flex-row">
          {/* Calendar Sidebar */}
          <div className="lg:w-[380px] p-6 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/30">
            <div className="flex items-center justify-between mb-6">
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 h-8 w-8 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="font-semibold text-slate-200 capitalize tracking-wide">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 h-8 w-8 rounded-lg">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => <div key={d}>{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const count = dayAppointments(day).length;
                const isSelected = isSameDay(day, selectedDate);
                const today = isToday(day);
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`relative h-10 w-full rounded-xl text-sm font-medium transition-all flex items-center justify-center
                      ${isSelected 
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' 
                        : today 
                          ? 'bg-slate-800 text-orange-400' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }
                    `}
                  >
                    <span>{format(day, 'd')}</span>
                    {count > 0 && (
                      <span className={`absolute bottom-1.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            <Button 
              onClick={openNewForm} 
              className="w-full mt-8 bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 rounded-xl font-medium h-12"
            >
              <Plus className="w-5 h-5 mr-2" /> Agendar Nueva Cita
            </Button>
          </div>

          {/* Appointments View */}
          <div className="flex-1 p-6 lg:p-8 overflow-auto relative">
            <div className="flex items-center justify-between mb-8 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white capitalize break-words">
                {getDateLabel(selectedDate)}
              </h2>
              <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-300 px-3 py-1 text-sm font-medium rounded-full">
                {selectedDayAppts.length} cita{selectedDayAppts.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="max-w-4xl mx-auto">
              {selectedDayAppts.length === 0 ? (
                <div className="text-center py-20 px-6 border border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No hay citas programadas</h3>
                  <p className="text-sm text-slate-500 mb-6">El día está completamente libre de compromisos.</p>
                  <Button onClick={openNewForm} variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:text-orange-400 rounded-xl">
                    <Plus className="w-4 h-4 mr-2" /> Programar una cita
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedDayAppts.map(appt => (
                    <Card key={appt.id} className="p-5 bg-slate-900 border-slate-800 hover:border-slate-700 transition-all shadow-none flex flex-col sm:flex-row gap-4 relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
                      
                      <div className="flex-1 min-w-0 pl-2">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <div className="flex items-center text-slate-300 font-medium bg-slate-950 px-2 py-1 rounded-md text-sm border border-slate-800">
                            <Clock className="w-4 h-4 mr-1.5 text-orange-500" />
                            {appt.appointment_time}
                            <span className="text-slate-500 ml-2 font-normal">({appt.duration_minutes}m)</span>
                          </div>
                          <Badge variant="outline" className={`border ${STATUS_COLORS[appt.status] || ''}`}>
                            {appt.status}
                          </Badge>
                        </div>
                        
                        <h3 className="text-lg font-bold text-white mb-1 truncate">{appt.client_name}</h3>
                        <p className="text-sm text-orange-400 font-medium mb-4">{appt.service}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                          {appt.client_phone && (
                            <span className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
                              <Phone className="w-3.5 h-3.5" /> {appt.client_phone}
                            </span>
                          )}
                          {appt.client_email && (
                            <span className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
                              <Mail className="w-3.5 h-3.5" /> {appt.client_email}
                            </span>
                          )}
                        </div>
                        
                        {appt.notes && (
                          <div className="mt-4 pt-4 border-t border-slate-800 text-sm text-slate-500 flex items-start gap-2">
                            <FileText className="w-4 h-4 mt-0.5 shrink-0" /> 
                            <p className="leading-relaxed">{appt.notes}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <Button size="sm" variant="outline" onClick={() => openEditForm(appt)}
                          className="flex-1 sm:flex-none bg-slate-950 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
                          <Edit2 className="w-4 h-4 mr-2 sm:mr-0" /> <span className="sm:hidden">Editar</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteAppointment.mutate(appt.id)}
                          className="flex-1 sm:flex-none bg-slate-950 border-red-900/50 text-red-500 hover:bg-red-500/10 hover:border-red-500/50">
                          <Trash2 className="w-4 h-4 mr-2 sm:mr-0" /> <span className="sm:hidden">Eliminar</span>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px] border-slate-800 bg-slate-950 text-slate-200 shadow-2xl p-0 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-orange-500 to-amber-500" />
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                {editingAppt ? (
                  <><Edit2 className="w-5 h-5 text-orange-500" /> Editar Cita</>
                ) : (
                  <><Plus className="w-5 h-5 text-orange-500" /> Nueva Cita</>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Nombre del cliente <span className="text-red-500">*</span></Label>
                <Input value={formData.client_name} onChange={e => setFormData(p => ({ ...p, client_name: e.target.value }))}
                  placeholder="Ej: Laura Méndez" className="bg-slate-900 border-slate-800 focus-visible:ring-orange-500 text-white placeholder:text-slate-600 h-11" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Email</Label>
                  <Input value={formData.client_email} onChange={e => setFormData(p => ({ ...p, client_email: e.target.value }))}
                    placeholder="laura@ejemplo.com" type="email" className="bg-slate-900 border-slate-800 focus-visible:ring-orange-500 text-white placeholder:text-slate-600 h-11" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Teléfono</Label>
                  <Input value={formData.client_phone} onChange={e => setFormData(p => ({ ...p, client_phone: e.target.value }))}
                    placeholder="+34 ..." className="bg-slate-900 border-slate-800 focus-visible:ring-orange-500 text-white placeholder:text-slate-600 h-11" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Fecha</Label>
                  <Input type="date" value={formData.appointment_date}
                    onChange={e => setFormData(p => ({ ...p, appointment_date: e.target.value }))} 
                    className="bg-slate-900 border-slate-800 focus-visible:ring-orange-500 text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert h-11" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Hora</Label>
                  <Select value={formData.appointment_time} onValueChange={v => setFormData(p => ({ ...p, appointment_time: v }))}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 focus:ring-orange-500 text-white h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {HOURS.map(h => <SelectItem key={h} value={h} className="focus:bg-slate-800 focus:text-white">{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Servicio</Label>
                  <Select value={formData.service} onValueChange={v => setFormData(p => ({ ...p, service: v }))}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 focus:ring-orange-500 text-white h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {SERVICES.map(s => <SelectItem key={s} value={s} className="focus:bg-slate-800 focus:text-white">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Duración</Label>
                  <Select value={String(formData.duration_minutes)} onValueChange={v => setFormData(p => ({ ...p, duration_minutes: Number(v) }))}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 focus:ring-orange-500 text-white h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {[15, 30, 45, 60, 90].map(d => <SelectItem key={d} value={String(d)} className="focus:bg-slate-800 focus:text-white">{d} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {editingAppt && (
                <div>
                  <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Estado</Label>
                  <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 focus:ring-orange-500 text-white h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {['pendiente', 'confirmada', 'completada', 'cancelada'].map(s => (
                        <SelectItem key={s} value={s} className="focus:bg-slate-800 focus:text-white capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Notas Adicionales</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Detalles sobre la consulta..." rows={3} 
                  className="bg-slate-900 border-slate-800 focus-visible:ring-orange-500 text-white placeholder:text-slate-600 resize-none" />
              </div>
              
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium"
                  disabled={addAppointment.isPending || updateAppointment.isPending}>
                  {editingAppt ? 'Guardar Cambios' : 'Agendar Cita'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
