import { useState } from 'react';
import { Lead, LeadActivity, LeadStatus } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Monitor,
  MessageSquare,
  Calendar,
  Send,
  Edit,
  Trash2,
  PhoneCall,
  Video
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockActivities } from '@/data/mockLeads';

interface LeadDetailProps {
  lead: Lead;
  onBack: () => void;
  onUpdateStatus: (id: string, status: LeadStatus) => void;
}

export function LeadDetail({ lead, onBack, onUpdateStatus }: LeadDetailProps) {
  const [newNote, setNewNote] = useState('');
  const activities = mockActivities.filter(a => a.leadId === lead.id);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const getActivityIcon = (type: LeadActivity['type']) => {
    switch (type) {
      case 'llamada': return PhoneCall;
      case 'email': return Mail;
      case 'whatsapp': return MessageSquare;
      case 'reunion': return Video;
      case 'visita': return MapPin;
      default: return MessageSquare;
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{lead.companyName}</h1>
            <LeadStatusBadge status={lead.status} size="md" />
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {lead.address ? `${lead.address}, ` : ''}{lead.city}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Card */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Información de Contacto
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lead.contactName && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contacto</p>
                    <p className="font-medium text-foreground">{lead.contactName}</p>
                  </div>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <a href={`mailto:${lead.email}`} className="font-medium text-primary hover:underline">
                      {lead.email}
                    </a>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Teléfono</p>
                    <a href={`tel:${lead.phone}`} className="font-medium text-primary hover:underline">
                      {lead.phone}
                    </a>
                  </div>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Web</p>
                    <a 
                      href={`https://${lead.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="bg-card rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-3">Notas</h2>
              <p className="text-muted-foreground">{lead.notes}</p>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Actividad</h2>
            
            {/* Add Note */}
            <div className="flex gap-3 mb-6">
              <Textarea
                placeholder="Añade una nota o registro de actividad..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[80px]"
              />
              <Button size="icon" className="h-auto">
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay actividad registrada aún
                </p>
              ) : (
                activities.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Acciones Rápidas
            </h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Mail className="w-4 h-4" />
                Enviar Email
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Phone className="w-4 h-4" />
                Llamar
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Calendar className="w-4 h-4" />
                Programar Reunión
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Estado</h2>
            <Select 
              value={lead.status} 
              onValueChange={(v) => onUpdateStatus(lead.id, v as LeadStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nuevo">Nuevo</SelectItem>
                <SelectItem value="contactado">Contactado</SelectItem>
                <SelectItem value="interesado">Interesado</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Details */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Detalles</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Segmento</dt>
                <dd className="font-medium text-foreground capitalize">{lead.segment}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Fuente</dt>
                <dd className="font-medium text-foreground">
                  {lead.source === 'google_maps' ? 'Google Maps' : 
                   lead.source === 'web_scraping' ? 'Web' : 
                   lead.source === 'referido' ? 'Referido' : 'Manual'}
                </dd>
              </div>
              {lead.equipmentCount && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Equipos</dt>
                  <dd className="font-medium text-foreground">{lead.equipmentCount}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Creado</dt>
                <dd className="font-medium text-foreground">{formatDate(lead.createdAt)}</dd>
              </div>
              {lead.lastContactedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Último contacto</dt>
                  <dd className="font-medium text-foreground">{formatDate(lead.lastContactedAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="bg-card rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Etiquetas</h2>
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
