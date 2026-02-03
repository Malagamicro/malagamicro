import { useState } from 'react';
import { Check, X, FileText, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BudgetApprovalData {
  type: 'budget_approval';
  request_id: string;
  prompt: string;
  providers_count: number;
  emails_preview?: Array<{
    to: string;
    subject: string;
    body_preview?: string;
  }>;
  user_email: string;
  created_at: string;
  status?: 'pending' | 'approved' | 'rejected';
}

interface BudgetApprovalMessageProps {
  data: BudgetApprovalData;
  messageId: string;
  onAction?: () => void;
}

export function BudgetApprovalMessage({ data, messageId, onAction }: BudgetApprovalMessageProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionTaken, setActionTaken] = useState<'approved' | 'rejected' | null>(
    data.status === 'approved' ? 'approved' : 
    data.status === 'rejected' ? 'rejected' : null
  );

  const handleApproval = async (approved: boolean) => {
    setIsProcessing(true);
    try {
      const { data: funcData, error } = await supabase.functions.invoke('budget-request', {
        body: {
          action: approved ? 'approve' : 'reject',
          request_id: data.request_id,
        },
      });

      if (error) throw error;

      setActionTaken(approved ? 'approved' : 'rejected');
      toast.success(approved ? 'Solicitud aprobada' : 'Solicitud rechazada');
      
      // Update the message content to reflect the action
      await supabase
        .from('internal_messages')
        .update({
          content: JSON.stringify({
            ...data,
            status: approved ? 'approved' : 'rejected',
          }),
        })
        .eq('id', messageId);

      onAction?.();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Error al procesar la solicitud');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="w-full max-w-md border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-warning" />
            Aprobación de Presupuesto
          </CardTitle>
          {actionTaken && (
            <Badge variant={actionTaken === 'approved' ? 'default' : 'destructive'}>
              {actionTaken === 'approved' ? 'Aprobado' : 'Rechazado'}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(data.created_at)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Request info */}
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">Solicitante:</span> {data.user_email}
          </p>
          <p className="text-sm">
            <span className="font-medium">ID:</span> {data.request_id}
          </p>
          <p className="text-sm">
            <span className="font-medium">Proveedores:</span> {data.providers_count}
          </p>
        </div>

        {/* Prompt summary */}
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-sm font-medium mb-1">Descripción:</p>
          <p className="text-sm text-muted-foreground line-clamp-3">{data.prompt}</p>
        </div>

        {/* Email previews */}
        {data.emails_preview && data.emails_preview.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Correos a enviar:
            </p>
            <ScrollArea className="h-32 rounded-md border">
              <div className="p-2 space-y-2">
                {data.emails_preview.map((email, idx) => (
                  <div key={idx} className="text-xs bg-background rounded p-2">
                    <p className="font-medium truncate">Para: {email.to}</p>
                    <p className="text-muted-foreground truncate">Asunto: {email.subject}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Action buttons */}
        {!actionTaken && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleApproval(true)}
              disabled={isProcessing}
              className="flex-1"
              variant="default"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Aprobar
                </>
              )}
            </Button>
            <Button
              onClick={() => handleApproval(false)}
              disabled={isProcessing}
              variant="destructive"
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Rechazar
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
