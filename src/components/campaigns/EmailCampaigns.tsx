import { useState, useEffect } from 'react';
import { useEmailTemplates, useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { useEmailProfiles } from '@/hooks/useEmailProfiles';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Mail, Plus, FileText, Send, Trash2, Users, Clock, CheckCircle, Loader2, Info, Pencil, Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmailBlock } from './EmailTemplateEditor';
import { TemplateDialog, TemplatePreviewDialog, CampaignDialog } from './EmailCampaignDialogs';

interface EmailCampaignsProps {
  prefillEmail?: string | null;
  onPrefillConsumed?: () => void;
}

export function EmailCampaigns({ prefillEmail, onPrefillConsumed }: EmailCampaignsProps) {
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

  // Handle prefill email from quick action
  useEffect(() => {
    if (prefillEmail) {
      const matchingLead = leads.find(l => l.email === prefillEmail);
      if (matchingLead) {
        setSelectedLeadIds([matchingLead.id]);
      }
      setShowCampaignDialog(true);
      onPrefillConsumed?.();
    }
  }, [prefillEmail, leads]);

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

      <TemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        editingTemplateId={editingTemplateId}
        templateName={templateName}
        setTemplateName={setTemplateName}
        templateSubject={templateSubject}
        setTemplateSubject={setTemplateSubject}
        templateHtml={templateHtml}
        templateMode={templateMode}
        setTemplateMode={setTemplateMode}
        onEditorChange={handleEditorChange}
        onAIApply={handleAIApplyTemplate}
        onSubmit={handleCreateTemplate}
        isAdding={isAddingTemplate}
        onReset={resetTemplateForm}
      />

      <TemplatePreviewDialog
        open={!!previewTemplateId}
        onClose={() => setPreviewTemplateId(null)}
        template={previewTemplate}
      />

      <CampaignDialog
        open={showCampaignDialog}
        onOpenChange={setShowCampaignDialog}
        campaignName={campaignName}
        setCampaignName={setCampaignName}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        selectedProfileId={selectedProfileId}
        setSelectedProfileId={setSelectedProfileId}
        selectedLeadIds={selectedLeadIds}
        toggleLeadSelection={toggleLeadSelection}
        selectAllLeads={selectAllLeads}
        templates={templates}
        profiles={profiles}
        eligibleLeads={eligibleLeads}
        onSubmit={handleCreateCampaign}
        isCreating={isCreatingCampaign}
      />
    </div>
  );
}
