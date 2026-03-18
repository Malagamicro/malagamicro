import { Lead } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MessageSquare,
  Loader2,
  Trash2,
  AlertTriangle,
  X,
  Mail,
  MessageCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* ───── Floating Bulk Action Bar ───── */

interface BulkActionBarProps {
  count: number;
  isBulkDeleting: boolean;
  onWhatsApp: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, isBulkDeleting, onWhatsApp, onDelete, onClear }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-lg rounded-xl px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-2 md:gap-4 animate-slide-up max-w-[calc(100vw-2rem)]">
      <span className="text-xs md:text-sm font-medium text-foreground whitespace-nowrap">
        {count} seleccionados
      </span>
      <div className="h-5 w-px bg-border hidden md:block" />
      <Button
        onClick={onWhatsApp}
        size="sm"
        className="gap-1.5 md:gap-2 bg-success hover:bg-success/90 h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm"
      >
        <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4" />
        <span className="hidden sm:inline">WhatsApp</span>
      </Button>
      <Button
        onClick={onDelete}
        size="sm"
        variant="destructive"
        className="gap-1.5 md:gap-2 h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm"
        disabled={isBulkDeleting}
      >
        {isBulkDeleting ? (
          <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
        )}
        <span className="hidden sm:inline">Eliminar</span>
      </Button>
      <Button onClick={onClear} size="sm" variant="ghost" className="h-8 md:h-9 px-2 md:px-3">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

/* ───── List View Table ───── */

interface LeadsTableViewProps {
  leads: Lead[];
  selectedIds: string[];
  allSelected: boolean;
  onSelectAll: () => void;
  onToggle: (id: string) => void;
  onViewLead: (id: string) => void;
  onQuickWhatsApp?: (phone: string) => void;
  onQuickEmail?: (email: string) => void;
}

export function LeadsTableView({
  leads,
  selectedIds,
  allSelected,
  onSelectAll,
  onToggle,
  onViewLead,
  onQuickWhatsApp,
  onQuickEmail,
}: LeadsTableViewProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-12 px-4 py-3">
              <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Empresa</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Score</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Contacto</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Teléfono</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Estado</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Segmento</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.includes(lead.id)}
                  onCheckedChange={() => onToggle(lead.id)}
                />
              </td>
              <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
                <span className="font-medium text-foreground">{lead.companyName}</span>
              </td>
              <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
                <LeadScoreBadge score={lead.score ?? 0} />
              </td>
              <td className="px-4 py-3 text-muted-foreground" onClick={() => onViewLead(lead.id)}>
                {lead.contactName || '-'}
              </td>
              <td className="px-4 py-3 text-muted-foreground" onClick={() => onViewLead(lead.id)}>
                {lead.phone || '-'}
              </td>
              <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
                <LeadStatusBadge status={lead.status} />
              </td>
              <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {lead.segment}
                </span>
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {onQuickWhatsApp && (lead.phone || lead.mobilePhone) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                      onClick={() => {
                        const phone = lead.mobilePhone || lead.phone?.replace(/\D/g, '') || '';
                        onQuickWhatsApp(phone);
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {onQuickEmail && lead.email && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary hover:bg-primary/10"
                      onClick={() => onQuickEmail(lead.email!)}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───── Delete Confirmation Dialog ───── */

interface DeleteLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isBulkDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteLeadsDialog({ open, onOpenChange, count, isBulkDeleting, onConfirm }: DeleteLeadsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Eliminar {count} leads
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminarán permanentemente los {count} leads seleccionados junto con todas sus actividades y recordatorios asociados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isBulkDeleting}
          >
            {isBulkDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar {count} leads
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
