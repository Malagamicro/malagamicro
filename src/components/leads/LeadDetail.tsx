import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lead, LeadStatus } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { ActivityTimeline } from './ActivityTimeline';
import { EmailComposeModal } from './EmailComposeModal';
import { WhatsAppComposeModal } from './WhatsAppComposeModal';
import { ReminderModal } from './ReminderModal';
import { RemindersList } from './RemindersList';
import { Button } from '@/components/ui/button';
import { buildExternalUrl, formatUrlForDisplay } from '@/lib/urlUtils';
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Phone,
  Mail, 
  Globe, 
  MessageSquare,
  Bell,
  Edit,
  Trash2,
  MapPinned,
  Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface LeadDetailProps {
  lead: Lead;
  onBack: () => void;
  onUpdateStatus: (id: string, status: LeadStatus, previousStatus?: LeadStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onGeocode: (id: string, address?: string, city?: string) => void;
  isGeocoding?: boolean;
}

export function LeadDetail({ lead, onBack, onUpdateStatus, onEdit, onDelete, onGeocode, isGeocoding = false }: LeadDetailProps) {
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const refreshActivities = () => {
    queryClient.invalidateQueries({ queryKey: ['lead-activities', lead.id] });
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
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
            <LeadScoreBadge score={lead.score ?? 0} size="md" showLabel />
            <LeadStatusBadge status={lead.status} size="md" />
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {lead.address ? `${lead.address}, ` : ''}{lead.city}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onEdit}>
            <Edit className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente el lead "{lead.companyName}" y toda su información.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              {/* Phone - hidden as per TAREA 1.2 */}
              {/* {lead.phone && (
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
              )} */}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Teléfono</p>
                    <p className="font-medium text-foreground">{lead.phone}</p>
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
                      href={buildExternalUrl(lead.website)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {formatUrlForDisplay(lead.website)}
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
          <ActivityTimeline leadId={lead.id} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Acciones Rápidas
            </h2>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => setIsEmailModalOpen(true)}
                disabled={!lead.email}
              >
                <Mail className="w-4 h-4" />
                Enviar Email
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => setIsWhatsAppModalOpen(true)}
                disabled={!lead.phone}
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </Button>
              {/* Botón Llamar - OCULTO por TAREA 1.2 */}
              {/* <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => lead.phone && window.open(`tel:${lead.phone}`, '_self')}
                disabled={!lead.phone}
              >
                <Phone className="w-4 h-4" />
                Llamar
              </Button> */}
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => setIsReminderModalOpen(true)}
              >
                <Bell className="w-4 h-4" />
                Programar Recordatorio
              </Button>
              {!lead.latitude && !lead.longitude && (lead.address || lead.city) && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => onGeocode(lead.id, lead.address, lead.city)}
                  disabled={isGeocoding}
                >
                  {isGeocoding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPinned className="w-4 h-4" />
                  )}
                  {isGeocoding ? 'Obteniendo ubicación...' : 'Obtener Coordenadas'}
                </Button>
              )}
              {lead.latitude && lead.longitude && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <MapPinned className="w-4 h-4 text-green-500" />
                  <span>Ubicación disponible</span>
                </div>
              )}
            </div>
          </div>

          {/* Reminders List */}
          <RemindersList leadId={lead.id} />

          {/* Status */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Estado</h2>
            <Select 
              value={lead.status} 
              onValueChange={(v) => onUpdateStatus(lead.id, v as LeadStatus, lead.status)}
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

      {/* Email Modal */}
      <EmailComposeModal
        open={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
        lead={lead}
        onEmailSent={refreshActivities}
      />

      {/* WhatsApp Modal */}
      <WhatsAppComposeModal
        open={isWhatsAppModalOpen}
        onOpenChange={setIsWhatsAppModalOpen}
        lead={lead}
        onMessageSent={refreshActivities}
      />

      {/* Reminder Modal */}
      <ReminderModal
        open={isReminderModalOpen}
        onOpenChange={setIsReminderModalOpen}
        lead={lead}
      />
    </div>
  );
}
