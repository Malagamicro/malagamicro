import { sanitizeHtml } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailTemplateEditor, EmailBlock } from './EmailTemplateEditor';
import { AITemplateChat } from './AITemplateChat';
import { Mail, Pencil, Eye, Bot } from 'lucide-react';
import { Lead } from '@/types/lead';

/* ───── Template Editor/AI Dialog ───── */

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTemplateId: string | null;
  templateName: string;
  setTemplateName: (v: string) => void;
  templateSubject: string;
  setTemplateSubject: (v: string) => void;
  templateHtml: string;
  templateMode: 'editor' | 'ai';
  setTemplateMode: (v: 'editor' | 'ai') => void;
  onEditorChange: (blocks: EmailBlock[], html: string) => void;
  onAIApply: (html: string) => void;
  onSubmit: () => void;
  isAdding: boolean;
  onReset: () => void;
}

export function TemplateDialog({
  open, onOpenChange, editingTemplateId,
  templateName, setTemplateName, templateSubject, setTemplateSubject,
  templateHtml, templateMode, setTemplateMode,
  onEditorChange, onAIApply, onSubmit, isAdding, onReset,
}: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) onReset(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{editingTemplateId ? 'Editar Plantilla' : 'Nueva Plantilla de Email'}</DialogTitle>
              <DialogDescription>
                Usa variables como {`{{nombre}}`}, {`{{empresa}}`}, {`{{ciudad}}`} para personalizar.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={templateMode === 'editor' ? 'default' : 'outline'} size="sm" onClick={() => setTemplateMode('editor')} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Editor
              </Button>
              <Button variant={templateMode === 'ai' ? 'default' : 'outline'} size="sm" onClick={() => setTemplateMode('ai')} className="gap-1.5">
                <Bot className="w-3.5 h-3.5" /> Crear con IA
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la plantilla</Label>
              <Input placeholder="Ej: Presentación servicios" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Asunto del email</Label>
              <Input placeholder="Ej: {{empresa}} - Propuesta de servicios" value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} />
            </div>
          </div>
          {templateMode === 'editor' ? (
            <>
              <EmailTemplateEditor onChange={onEditorChange} />
              {templateHtml && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Vista previa del HTML generado:</p>
                  <div className="border rounded bg-white p-2 max-h-[200px] overflow-auto" dangerouslySetInnerHTML={{ __html: sanitizeHtml(templateHtml) }} />
                </div>
              )}
            </>
          ) : (
            <div className="border rounded-lg h-[600px] overflow-hidden">
              <AITemplateChat key={editingTemplateId || templateHtml || 'new'} onApplyTemplate={onAIApply} initialHtml={templateHtml || undefined} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={isAdding || !templateName || !templateSubject || !templateHtml}>
            {isAdding ? 'Guardando...' : 'Guardar Plantilla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───── Template Preview Dialog ───── */

interface TemplatePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  template: { name: string; subject: string; body: string } | undefined;
}

export function TemplatePreviewDialog({ open, onClose, template }: TemplatePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" /> Vista previa: {template?.name}
          </DialogTitle>
          <DialogDescription>Asunto: {template?.subject}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="border rounded-lg p-4 bg-muted/30" dangerouslySetInnerHTML={{ __html: sanitizeHtml(template?.body || '') }} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ───── Campaign Dialog ───── */

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  setCampaignName: (v: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (v: string) => void;
  selectedProfileId: string;
  setSelectedProfileId: (v: string) => void;
  selectedLeadIds: string[];
  toggleLeadSelection: (id: string) => void;
  selectAllLeads: () => void;
  templates: { id: string; name: string }[];
  profiles: { id: string; profile_name: string; from_email: string; is_default: boolean }[];
  eligibleLeads: Lead[];
  onSubmit: () => void;
  isCreating: boolean;
}

export function CampaignDialog({
  open, onOpenChange, campaignName, setCampaignName,
  selectedTemplateId, setSelectedTemplateId, selectedProfileId, setSelectedProfileId,
  selectedLeadIds, toggleLeadSelection, selectAllLeads,
  templates, profiles, eligibleLeads, onSubmit, isCreating,
}: CampaignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nueva Campaña</DialogTitle>
          <DialogDescription>Selecciona una plantilla, perfil de correo y los leads que recibirán el email.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre de la campaña</Label>
            <Input placeholder="Ej: Campaña Enero 2025" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Perfil de correo</Label>
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay perfiles de correo configurados. Configura uno en Ajustes.</p>
            ) : (
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un perfil de correo" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.profile_name}</span>
                        <span className="text-muted-foreground text-xs">({p.from_email})</span>
                        {p.is_default && <Badge variant="secondary" className="text-[10px] px-1">Default</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Plantilla</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecciona una plantilla" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Destinatarios ({selectedLeadIds.length} seleccionados)</Label>
              <Button variant="link" size="sm" onClick={selectAllLeads}>Seleccionar todos</Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-3">
              {eligibleLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay leads con email válido</p>
              ) : (
                <div className="space-y-2">
                  {eligibleLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center gap-3">
                      <Checkbox checked={selectedLeadIds.includes(lead.id)} onCheckedChange={() => toggleLeadSelection(lead.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={isCreating || !campaignName || !selectedTemplateId || selectedLeadIds.length === 0 || !selectedProfileId}>
            {isCreating ? 'Creando...' : 'Crear Campaña'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
