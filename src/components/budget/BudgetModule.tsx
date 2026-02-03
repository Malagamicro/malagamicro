import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, ClipboardList, Inbox, History,
  TrendingUp, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { BudgetChatbot } from './BudgetChatbot';
import BudgetApprovalPanel from './BudgetApprovalPanel';
import BudgetNotificationsPopover from './BudgetNotificationsPopover';
import { useBudgetRequests } from '@/hooks/useBudgetRequests';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const BudgetModule = () => {
  const { user } = useAuth();
  const { requests, budgetsReceived, notifications, unreadCount } = useBudgetRequests();
  const [activeTab, setActiveTab] = useState('chatbot');

  // Check if user is admin/inma
  const isApprover = user?.email?.toLowerCase().includes('inma') || 
                     user?.email === 'administracion@malagamicro.com';

  // Stats
  const thisMonthRequests = requests.filter(r => {
    const date = new Date(r.created_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  
  const pendingApproval = requests.filter(r => 
    r.status === 'pending' || r.status === 'pending_approval'
  );
  
  const pendingBudgets = budgetsReceived.filter(b => !b.selected && !b.invoice_id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Gestión de Presupuestos
          </h1>
          <p className="text-muted-foreground">
            Solicita presupuestos y gestiona las respuestas de proveedores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BudgetNotificationsPopover />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        <StatCard
          title="Solicitudes este mes"
          value={thisMonthRequests.length}
          icon={TrendingUp}
          description="Total de solicitudes"
        />
        <StatCard
          title="Pendientes aprobación"
          value={pendingApproval.length}
          icon={Clock}
          description="Esperando revisión"
          highlight={pendingApproval.length > 0}
        />
        <StatCard
          title="Presupuestos recibidos"
          value={budgetsReceived.length}
          icon={Inbox}
          description="De proveedores"
        />
        <StatCard
          title="Sin facturar"
          value={pendingBudgets.length}
          icon={AlertCircle}
          description="Pendientes de selección"
          highlight={pendingBudgets.length > 0}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 pt-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chatbot" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva Solicitud</span>
            </TabsTrigger>
            {isApprover && (
              <TabsTrigger value="approve" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Aprobaciones</span>
                {pendingApproval.length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {pendingApproval.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="received" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">Recibidos</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Historial</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chatbot" className="flex-1 mt-4 overflow-hidden">
            <div className="h-full max-w-2xl mx-auto">
              <BudgetChatbot />
            </div>
          </TabsContent>

          {isApprover && (
            <TabsContent value="approve" className="flex-1 mt-4 overflow-auto">
              <BudgetApprovalPanel />
            </TabsContent>
          )}

          <TabsContent value="received" className="flex-1 mt-4 overflow-auto">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  Presupuestos Recibidos
                </CardTitle>
                <CardDescription>
                  Presupuestos enviados por los proveedores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgetsReceived.map(budget => (
                        <TableRow key={budget.id}>
                          <TableCell className="font-medium">
                            {budget.proveedor}
                          </TableCell>
                          <TableCell>{budget.email_proveedor}</TableCell>
                          <TableCell>
                            {budget.total ? `${budget.total.toFixed(2)}€` : '-'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(budget.fecha_recepcion), "dd/MM/yyyy", { locale: es })}
                          </TableCell>
                          <TableCell>
                            {budget.selected ? (
                              <Badge variant="default">Seleccionado</Badge>
                            ) : budget.invoice_id ? (
                              <Badge variant="outline">Facturado</Badge>
                            ) : (
                              <Badge variant="secondary">Pendiente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Ver detalles
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {budgetsReceived.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No hay presupuestos recibidos aún
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-4 overflow-auto">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historial de Solicitudes
                </CardTitle>
                <CardDescription>
                  Todas las solicitudes procesadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Proveedores</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map(request => (
                        <TableRow key={request.id}>
                          <TableCell className="font-mono text-xs">
                            {request.request_id}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {request.prompt}
                          </TableCell>
                          <TableCell>{request.emails.length}</TableCell>
                          <TableCell>
                            {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={request.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {requests.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay solicitudes aún
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  highlight?: boolean;
}

const StatCard = ({ title, value, icon: Icon, description, highlight }: StatCardProps) => (
  <Card className={highlight ? 'border-primary' : ''}>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Icon className={`h-8 w-8 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    pending: { variant: 'secondary', label: 'Pendiente' },
    pending_approval: { variant: 'default', label: 'En aprobación' },
    approved: { variant: 'default', label: 'Aprobado' },
    rejected: { variant: 'destructive', label: 'Rechazado' },
    completed: { variant: 'outline', label: 'Completado' },
    error: { variant: 'destructive', label: 'Error' }
  };
  const { variant, label } = config[status] || config.pending;
  return <Badge variant={variant}>{label}</Badge>;
};

export default BudgetModule;
