import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, BarChart2, Building2, Bot, Upload
} from 'lucide-react';
import { BudgetChatbot } from './BudgetChatbot';
import BudgetNotificationsPopover from './BudgetNotificationsPopover';
import BudgetDashboard from './BudgetDashboard';
import ProvidersManager from './ProvidersManager';
import ManualBudgetUpload from './ManualBudgetUpload';
import StelOrderBudgetForm from './StelOrderBudgetForm';
import { useAuth } from '@/hooks/useAuth';

const BudgetModule = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('stel');

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
            Crea, gestiona y convierte presupuestos con STEL Order
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BudgetNotificationsPopover />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stel" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">Presupuestos</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              <span className="hidden lg:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden lg:inline">Solicitar</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden lg:inline">Subir</span>
            </TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden lg:inline">Proveedores</span>
            </TabsTrigger>
          </TabsList>

          {/* STEL Budget Form */}
          <TabsContent value="stel" className="flex-1 mt-4 overflow-hidden">
            <StelOrderBudgetForm />
          </TabsContent>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="flex-1 mt-4 overflow-auto">
            <BudgetDashboard />
          </TabsContent>

          {/* Chatbot */}
          <TabsContent value="chatbot" className="flex-1 mt-4 overflow-hidden">
            <div className="h-full max-w-2xl mx-auto">
              <BudgetChatbot />
            </div>
          </TabsContent>

          {/* Manual Upload */}
          <TabsContent value="upload" className="flex-1 mt-4 overflow-auto">
            <ManualBudgetUpload />
          </TabsContent>

          {/* Providers */}
          <TabsContent value="providers" className="flex-1 mt-4 overflow-auto">
            <ProvidersManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BudgetModule;
