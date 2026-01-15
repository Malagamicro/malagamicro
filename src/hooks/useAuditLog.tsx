import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AuditAction = 
  | 'login'
  | 'logout'
  | 'password_reset_request'
  | 'password_updated'
  | 'lead_created'
  | 'lead_updated'
  | 'lead_deleted'
  | 'lead_status_changed'
  | 'leads_imported'
  | 'lead_geocoded'
  | 'reminder_created'
  | 'reminder_completed'
  | 'reminder_deleted'
  | 'email_sent'
  | 'campaign_created'
  | 'campaign_sent'
  | 'whatsapp_sent';

export type EntityType = 
  | 'user'
  | 'lead'
  | 'reminder'
  | 'email'
  | 'campaign'
  | 'whatsapp';

interface AuditLogEntry {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const { user } = useAuth();

  const log = useCallback(async ({
    action,
    entityType,
    entityId,
    details,
  }: AuditLogEntry) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          user_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId || null,
          details: details ? JSON.parse(JSON.stringify(details)) : null,
          user_agent: navigator.userAgent,
        }] as any);

      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (err) {
      // Silently fail - audit logging should not break the app
      console.error('Audit log error:', err);
    }
  }, [user]);

  // Convenience methods for common actions
  const logLogin = useCallback(() => {
    return log({ action: 'login', entityType: 'user' });
  }, [log]);

  const logLogout = useCallback(() => {
    return log({ action: 'logout', entityType: 'user' });
  }, [log]);

  const logLeadCreated = useCallback((leadId: string, leadName: string) => {
    return log({
      action: 'lead_created',
      entityType: 'lead',
      entityId: leadId,
      details: { company_name: leadName },
    });
  }, [log]);

  const logLeadUpdated = useCallback((leadId: string, changes: Record<string, unknown>) => {
    return log({
      action: 'lead_updated',
      entityType: 'lead',
      entityId: leadId,
      details: { changes },
    });
  }, [log]);

  const logLeadDeleted = useCallback((leadId: string, leadName: string) => {
    return log({
      action: 'lead_deleted',
      entityType: 'lead',
      entityId: leadId,
      details: { company_name: leadName },
    });
  }, [log]);

  const logLeadStatusChanged = useCallback((leadId: string, fromStatus: string, toStatus: string) => {
    return log({
      action: 'lead_status_changed',
      entityType: 'lead',
      entityId: leadId,
      details: { from: fromStatus, to: toStatus },
    });
  }, [log]);

  const logLeadsImported = useCallback((count: number) => {
    return log({
      action: 'leads_imported',
      entityType: 'lead',
      details: { count },
    });
  }, [log]);

  const logEmailSent = useCallback((leadId: string, subject: string) => {
    return log({
      action: 'email_sent',
      entityType: 'email',
      entityId: leadId,
      details: { subject },
    });
  }, [log]);

  const logReminderCreated = useCallback((reminderId: string, leadId: string) => {
    return log({
      action: 'reminder_created',
      entityType: 'reminder',
      entityId: reminderId,
      details: { lead_id: leadId },
    });
  }, [log]);

  return {
    log,
    logLogin,
    logLogout,
    logLeadCreated,
    logLeadUpdated,
    logLeadDeleted,
    logLeadStatusChanged,
    logLeadsImported,
    logEmailSent,
    logReminderCreated,
  };
}
