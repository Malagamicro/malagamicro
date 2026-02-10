import { useState } from 'react';
import { useEmailTemplates, useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { useEmailProfiles } from '@/hooks/useEmailProfiles';
import { sanitizeHtml } from '@/lib/sanitize';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { 
  Mail, 
  Plus, 
  FileText, 
  Send, 
  Trash2, 
  Users,
  Clock,
  CheckCircle,
  Loader2,
  Info,
  Pencil,
  Eye,
  Sparkles,
  Bot,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailTemplateEditor, EmailBlock, generateEmailHtml } from './EmailTemplateEditor';
import { AITemplateChat } from './AITemplateChat';

export function EmailCampaigns() {
  const { templates, addTemplate, deleteTemplate, isAddingTemplate } = useEmailTemplates();
  const { campaigns, createCampaign, sendCampaign, deleteCampaign, isCreatingCampaign, isSendingCampaign } = useEmailCampaigns();
  const { profiles, loading: profilesLoading } = useEmailProfiles();
  const { leads } = useLeads();
  
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [templateMode, setTemplateMode] = useState<'editor' | 'ai'>('editor');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // Template form state
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBlocks, setTemplateBlocks] = useState<EmailBlock[]>([]);
  const [templateHtml, setTemplateHtml] = useState('');
  
  // Campaign form state
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Filter leads with valid email and not unsubscribed
  const eligibleLeads = leads.filter(l => l.email && !l.emailUnsubscribed);

  const previewTemplate = templates.find(t => t.id === previewTemplateId);

  const handleEditorChange = (blocks: EmailBlock[], html: string) => {
    setTemplateBlocks(blocks);
    setTemplateHtml(html);
  };

  const handleCreateTemplate = () => {
    if (!templateName || !templateSubject || !templateHtml) return;
    
    addTemplate(
      { name: templateName, subject: templateSubject, body: templateHtml },
      {
        onSuccess: () => {
          setShowTemplateDialog(false);
          resetTemplateForm();
        },
      }
    );
  };

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateSubject('');
    setTemplateBlocks([]);
    setTemplateHtml('');
    setTemplateMode('editor');
    setEditingTemplateId(null);
  };

  const handleEditTemplate = (template: { id: string; name: string; subject: string; body: string }) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateSubject(template.subject);
    setTemplateHtml(template.body);
    setTemplateMode('ai');
    setShowTemplateDialog(true);
  };

  const handleAIApplyTemplate = (html: string) => {
    setTemplateHtml(html);
    // Switch to editor tab to show preview
  };

  const handleCreateCampaign = () => {
    if (!campaignName || !selectedTemplateId || selectedLeadIds.length === 0) return;
    
    createCampaign(
      { 
        name: campaignName, 
        templateId: selectedTemplateId, 
        leadIds: selectedLeadIds,
        profileId: selectedProfileId || undefined,
      },
      {
        onSuccess: () => {
          setShowCampaignDialog(false);
          setCampaignName('');
          setSelectedTemplateId('');
          setSelectedProfileId('');
          setSelectedLeadIds([]);
        },
      }
    );
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const selectAllLeads = () => {
    setSelectedLeadIds(eligibleLeads.map(l => l.id));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" />Borrador</Badge>;
      case 'sending':
        return <Badge className="bg-amber-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Enviando</Badge>;
      case 'paused':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pausada</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Campañas de Email</h1>
          <p className="text-muted-foreground mt-1">
            Envía emails personalizados a múltiples leads
          </p>
        </div>
      </div>

      {/* Anti-spam notice */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600">Protección anti-spam activa</p>
            <p className="text-muted-foreground">
              Máximo 10 emails por lote con 6 segundos entre envíos. Límite diario: 50 emails. 
              Cada email incluye enlace de desuscripción automático.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCampaignDialog(true)} className="gap-2" disabled={templates.length === 0}>
              <Plus className="w-4 h-4" />
              Nueva Campaña
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay campañas</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {templates.length === 0 
                    ? 'Primero crea una plantilla de email'
                    : 'Crea tu primera campaña de email'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription>
                          Plantilla: {campaign.template?.name || 'No asignada'}
                        </CardDescription>
                      </div>
                      {getStatusBadge(campaign.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {campaign.totalRecipients || 0} destinatarios
                        </span>
                        <span className="flex items-center gap-1">
                          <Send className="w-4 h-4" />
                          {campaign.totalSent || 0} enviados
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {(campaign.status === 'draft' || campaign.status === 'paused') && (
                          <Button 
                            size="sm" 
                            onClick={() => sendCampaign(campaign.id)}
                            disabled={isSendingCampaign}
                          >
                            {isSendingCampaign ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4 mr-1" />
                            )}
                            {campaign.status === 'paused' ? 'Continuar' : 'Enviar'}
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCampaign(campaign.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowTemplateDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Plantilla
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay plantillas</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Crea una plantilla para empezar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <Card key={template.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => handleEditTemplate(template)}
                          title="Editar con IA"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setPreviewTemplateId(template.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive h-8 w-8">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTemplate(template.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <CardDescription>Asunto: {template.subject}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-2"
                      onClick={() => setPreviewTemplateId(template.id)}
                    >
                      <Eye className="w-4 h-4" />
                      Ver plantilla
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Dialog - Editor + AI */}
      <Dialog open={showTemplateDialog} onOpenChange={(open) => {
        setShowTemplateDialog(open);
        if (!open) resetTemplateForm();
      }}>
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
                <Button
                  variant={templateMode === 'editor' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTemplateMode('editor')}
                  className="gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editor
                </Button>
                <Button
                  variant={templateMode === 'ai' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTemplateMode('ai')}
                  className="gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" />
                  Crear con IA
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre de la plantilla</Label>
                <Input
                  placeholder="Ej: Presentación servicios"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Asunto del email</Label>
                <Input
                  placeholder="Ej: {{empresa}} - Propuesta de servicios"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                />
              </div>
            </div>
            
            {templateMode === 'editor' ? (
              <>
                <EmailTemplateEditor onChange={handleEditorChange} />
                {templateHtml && (
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-2">Vista previa del HTML generado:</p>
                    <div 
                      className="border rounded bg-white p-2 max-h-[200px] overflow-auto"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(templateHtml) }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="border rounded-lg h-[500px] overflow-hidden">
                <AITemplateChat 
                  key={editingTemplateId || 'new'}
                  onApplyTemplate={handleAIApplyTemplate} 
                  initialHtml={editingTemplateId ? templateHtml : undefined}
                />
              </div>
            )}

            {templateMode === 'ai' && templateHtml && (
              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="flex items-center gap-3 pt-4">
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700">Plantilla HTML aplicada</p>
                    <p className="text-xs text-muted-foreground">El HTML generado por IA está listo para guardar.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setTemplateHtml('')}>
                    Borrar
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isAddingTemplate || !templateName || !templateSubject || !templateHtml}>
              {isAddingTemplate ? 'Guardando...' : 'Guardar Plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplateId} onOpenChange={(open) => !open && setPreviewTemplateId(null)}>
        <DialogContent className="max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Vista previa: {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Asunto: {previewTemplate?.subject}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div 
              className="border rounded-lg p-4 bg-muted/30"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewTemplate?.body || '') }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Nueva Campaña</DialogTitle>
            <DialogDescription>
              Selecciona una plantilla, perfil de correo y los leads que recibirán el email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre de la campaña</Label>
              <Input
                placeholder="Ej: Campaña Enero 2025"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            {/* Email Profile Selector */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Perfil de correo
              </Label>
              {profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay perfiles de correo configurados. Configura uno en Ajustes.
                </p>
              ) : (
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un perfil de correo" />
                  </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una plantilla" />
                </SelectTrigger>
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
                <Button variant="link" size="sm" onClick={selectAllLeads}>
                  Seleccionar todos
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded-md p-3">
                {eligibleLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay leads con email válido
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eligibleLeads.map((lead) => (
                      <div key={lead.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                        />
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
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateCampaign} 
              disabled={isCreatingCampaign || !campaignName || !selectedTemplateId || selectedLeadIds.length === 0 || !selectedProfileId}
            >
              {isCreatingCampaign ? 'Creando...' : 'Crear Campaña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
