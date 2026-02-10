import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: Date;
}

export interface EmailCampaign {
  id: string;
  name: string;
  templateId: string | null;
  status: string;
  totalRecipients: number | null;
  totalSent: number | null;
  totalOpened: number | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  template?: EmailTemplate;
}

function mapRowToTemplate(row: any): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at),
  };
}

function mapRowToCampaign(row: any): EmailCampaign {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    status: row.status,
    totalRecipients: row.total_recipients,
    totalSent: row.total_sent,
    totalOpened: row.total_opened,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    createdAt: new Date(row.created_at),
    template: row.email_templates ? mapRowToTemplate(row.email_templates) : undefined,
  };
}

export function useEmailTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map(mapRowToTemplate);
    },
    enabled: !!user,
  });

  const addTemplate = useMutation({
    mutationFn: async (template: { name: string; subject: string; body: string }) => {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name: template.name,
          subject: template.subject,
          body: template.body,
          user_id: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Plantilla creada', description: 'La plantilla ha sido guardada.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear la plantilla.', variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...template }: { id: string; name?: string; subject?: string; body?: string }) => {
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: template.name,
          subject: template.subject,
          body: template.body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Plantilla actualizada' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar la plantilla.', variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Plantilla eliminada' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar la plantilla.', variant: 'destructive' });
    },
  });

  return {
    templates,
    isLoading,
    addTemplate: addTemplate.mutate,
    updateTemplate: updateTemplate.mutate,
    deleteTemplate: deleteTemplate.mutate,
    isAddingTemplate: addTemplate.isPending,
  };
}

export function useEmailCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*, email_templates(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map(mapRowToCampaign);
    },
    enabled: !!user,
  });

  const createCampaign = useMutation({
    mutationFn: async ({ name, templateId, leadIds, profileId }: { name: string; templateId: string; leadIds: string[]; profileId?: string }) => {
      // Create campaign
      const { data: campaign, error: campaignError } = await (supabase as any)
        .from('email_campaigns')
        .insert({
          name,
          template_id: templateId,
          user_id: user?.id,
          status: 'draft',
          total_recipients: leadIds.length,
          profile_id: profileId || null,
        })
        .select()
        .single();
      
      if (campaignError) throw campaignError;

      // Create campaign_emails for each lead
      const campaignEmails = leadIds.map(leadId => ({
        campaign_id: campaign.id,
        lead_id: leadId,
        status: 'pending',
      }));

      const { error: emailsError } = await supabase
        .from('campaign_emails')
        .insert(campaignEmails);

      if (emailsError) throw emailsError;

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaña creada', description: 'La campaña está lista para enviar.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const sendCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        body: { campaignId },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ 
        title: data.completed ? 'Campaña completada' : 'Emails enviados',
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaña eliminada' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar la campaña.', variant: 'destructive' });
    },
  });

  return {
    campaigns,
    isLoading,
    createCampaign: createCampaign.mutate,
    sendCampaign: sendCampaign.mutate,
    deleteCampaign: deleteCampaign.mutate,
    isCreatingCampaign: createCampaign.isPending,
    isSendingCampaign: sendCampaign.isPending,
  };
}
