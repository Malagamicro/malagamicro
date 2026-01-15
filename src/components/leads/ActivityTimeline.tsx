import { useState } from 'react';
import { LeadActivity } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Send, 
  PhoneCall, 
  Mail, 
  MessageSquare, 
  Video, 
  MapPin,
  FileText,
  Loader2,
  Trash2
} from 'lucide-react';
import { useLeadActivities } from '@/hooks/useLeadActivities';

interface ActivityTimelineProps {
  leadId: string;
}

const activityTypes: { value: LeadActivity['type']; label: string; icon: React.ElementType }[] = [
  { value: 'nota', label: 'Nota', icon: FileText },
  { value: 'llamada', label: 'Llamada', icon: PhoneCall },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'reunion', label: 'Reunión', icon: Video },
  { value: 'visita', label: 'Visita', icon: MapPin },
];

export function ActivityTimeline({ leadId }: ActivityTimelineProps) {
  const [newNote, setNewNote] = useState('');
  const [activityType, setActivityType] = useState<LeadActivity['type']>('nota');
  
  const { 
    activities, 
    isLoading, 
    addActivity, 
    deleteActivity,
    isAddingActivity 
  } = useLeadActivities(leadId);

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    
    addActivity(
      { type: activityType, description: newNote.trim() },
      {
        onSuccess: () => {
          setNewNote('');
          setActivityType('nota');
        },
      }
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getActivityIcon = (type: LeadActivity['type']) => {
    const found = activityTypes.find(t => t.value === type);
    return found?.icon || FileText;
  };

  const getActivityLabel = (type: LeadActivity['type']) => {
    const found = activityTypes.find(t => t.value === type);
    return found?.label || type;
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-card">
      <h2 className="text-lg font-semibold text-foreground mb-4">Actividad</h2>
      
      {/* Add Activity */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-3">
          <Select 
            value={activityType} 
            onValueChange={(v) => setActivityType(v as LeadActivity['type'])}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activityTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3">
          <Textarea
            placeholder="Describe la actividad..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[80px]"
            disabled={isAddingActivity}
          />
          <Button 
            size="icon" 
            className="h-auto min-h-[80px]"
            onClick={handleSubmit}
            disabled={!newNote.trim() || isAddingActivity}
          >
            {isAddingActivity ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No hay actividad registrada aún
          </p>
        ) : (
          activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            return (
              <div key={activity.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-xs font-medium text-primary uppercase">
                        {getActivityLabel(activity.type)}
                      </span>
                      <p className="text-foreground mt-1">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(activity.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteActivity(activity.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
