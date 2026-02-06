import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, ClipboardList, Inbox, History, 
  BarChart2, Upload, Building2
} from 'lucide-react';
import { BudgetChatbot } from './BudgetChatbot';
import BudgetApprovalPanel from './BudgetApprovalPanel';
import BudgetNotificationsPopover from './BudgetNotificationsPopover';
import BudgetDashboard from './BudgetDashboard';
import BudgetsReceivedTable from './BudgetsReceivedTable';
import ManualBudgetUpload from './ManualBudgetUpload';
import ProvidersManager from './ProvidersManager';
import { useBudgetRequests } from '@/hooks/useBudgetRequests';
import { useAuth } from '@/hooks/useAuth';

const BudgetModule = () => {
  const { user } = useAuth();
  const { requests, budgetsReceived } = useBudgetRequests();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Check if user is admin/inma
  const isApprover = user?.email?.toLowerCase().includes('inma') || 
                     user?.email === 'administracion@malagamicro.com';

  // Stats
  const pendingApproval = requests.filter(r => 
    r.status === 'pending' || r.status === 'pending_approval'
  );
  
  const pendingBudgets = budgetsReceived.filter(b => {
    const estado = (b as any).estado || 'revision';
    return estado === 'revision';
  });

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
            Solicita presupuestos, gestiona respuestas e integra con STEL Order
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BudgetNotificationsPopover />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              <span className="hidden lg:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">Solicitar</span>
            </TabsTrigger>
            {isApprover && (
              <TabsTrigger value="approve" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden lg:inline">Aprobaciones</span>
                {pendingApproval.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 p-0 flex items-center justify-center">
                    {pendingApproval.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="received" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              <span className="hidden lg:inline">Recibidos</span>
              {pendingBudgets.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 p-0 flex items-center justify-center">
                  {pendingBudgets.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden lg:inline">Subir</span>
            </TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden lg:inline">Proveedores</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden lg:inline">Historial</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="flex-1 mt-4 overflow-auto">
            <BudgetDashboard />
          </TabsContent>

          {/* Chatbot for new requests */}
          <TabsContent value="chatbot" className="flex-1 mt-4 overflow-hidden">
            <div className="h-full max-w-2xl mx-auto">
              <BudgetChatbot />
            </div>
          </TabsContent>

          {/* Approvals (admin only) */}
          {isApprover && (
            <TabsContent value="approve" className="flex-1 mt-4 overflow-auto">
              <BudgetApprovalPanel />
            </TabsContent>
          )}

          {/* Received Budgets */}
          <TabsContent value="received" className="flex-1 mt-4 overflow-auto">
            <BudgetsReceivedTable />
          </TabsContent>

          {/* Manual Upload */}
          <TabsContent value="manual" className="flex-1 mt-4 overflow-auto">
            <ManualBudgetUpload />
          </TabsContent>

          {/* Providers Management */}
          <TabsContent value="providers" className="flex-1 mt-4 overflow-auto">
            <ProvidersManager />
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="flex-1 mt-4 overflow-auto">
            <HistoryTable requests={requests} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// History table component
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BudgetRequest } from '@/hooks/useBudgetRequests';

const HistoryTable = ({ requests }: { requests: BudgetRequest[] }) => {
  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendiente' },
      pending_approval: { variant: 'default', label: 'En aprobación' },
      approved: { variant: 'default', label: 'Aprobado' },
      rejected: { variant: 'destructive', label: 'Rechazado' },
      completed: { variant: 'outline', label: 'Completado' },
      respondido: { variant: 'outline', label: 'Respondido' },
      error: { variant: 'destructive', label: 'Error' }
    };
    const { variant, label } = config[status] || config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Solicitudes
        </CardTitle>
        <CardDescription>
          Todas las solicitudes de presupuesto procesadas
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
                  <TableCell>
                    <Badge variant="outline">{request.emails.length}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(request.status)}
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
  );
};

export default BudgetModule;
