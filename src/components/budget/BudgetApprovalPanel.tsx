import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ClipboardList, Check, X, ChevronDown, ChevronUp, 
  Clock, User, Mail, Package, Loader2 
} from 'lucide-react';
import { useBudgetRequests, BudgetRequest } from '@/hooks/useBudgetRequests';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const BudgetApprovalPanel = () => {
  const { requests, approveRequest, loading } = useBudgetRequests();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingRequests = requests.filter(r => 
    r.status === 'pending' || r.status === 'pending_approval'
  );

  const handleApprove = async (requestId: string, approved: boolean) => {
    setProcessingId(requestId);
    await approveRequest(requestId, approved);
    setProcessingId(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendiente' },
      pending_approval: { variant: 'default', label: 'Esperando aprobación' },
      approved: { variant: 'default', label: 'Aprobado' },
      rejected: { variant: 'destructive', label: 'Rechazado' },
      completed: { variant: 'outline', label: 'Completado' },
      error: { variant: 'destructive', label: 'Error' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Solicitudes Pendientes de Aprobación
        </CardTitle>
        <CardDescription>
          {pendingRequests.length === 0 
            ? 'No hay solicitudes pendientes' 
            : `${pendingRequests.length} solicitud(es) esperando tu aprobación`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay solicitudes pendientes</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  expanded={expandedId === request.id}
                  onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
                  onApprove={(approved) => handleApprove(request.request_id, approved)}
                  processing={processingId === request.request_id}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

interface RequestCardProps {
  request: BudgetRequest;
  expanded: boolean;
  onToggle: () => void;
  onApprove: (approved: boolean) => void;
  processing: boolean;
  getStatusBadge: (status: string) => React.ReactNode;
}

const RequestCard = ({ 
  request, expanded, onToggle, onApprove, processing, getStatusBadge 
}: RequestCardProps) => {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {request.request_id}
            </span>
            {getStatusBadge(request.status)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(new Date(request.created_at), "dd MMM yyyy HH:mm", { locale: es })}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {(request.status === 'pending' || request.status === 'pending_approval') && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => onApprove(false)}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Rechazar
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => onApprove(true)}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Aprobar
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-sm line-clamp-2">{request.prompt}</p>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Mail className="h-3 w-3" />
          {request.emails.length} proveedor(es)
        </div>
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          {request.products.length} producto(s)
        </div>
      </div>

      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full">
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar detalles
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver detalles
              </>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          {/* Emails */}
          <div>
            <h4 className="text-xs font-medium uppercase text-muted-foreground mb-2">
              Proveedores
            </h4>
            <div className="flex flex-wrap gap-1">
              {request.emails.map((email, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {email}
                </Badge>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-xs font-medium uppercase text-muted-foreground mb-2">
              Productos
            </h4>
            <div className="space-y-1">
              {request.products.map((product, i) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <span className="font-medium">{product.nombre}</span>
                  <span className="text-muted-foreground">
                    {product.cantidad} {product.unidad}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Email Preview */}
          {request.emails_preview && (
            <div>
              <h4 className="text-xs font-medium uppercase text-muted-foreground mb-2">
                Vista previa de correos
              </h4>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <pre className="whitespace-pre-wrap font-sans">
                  {typeof request.emails_preview === 'string' 
                    ? request.emails_preview 
                    : JSON.stringify(request.emails_preview, null, 2)
                  }
                </pre>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default BudgetApprovalPanel;
