import { useState, useEffect, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';

// Modales y Componentes Estáticos (siempre visibles o de carga inicial)
import { LeadFormModal } from '@/components/leads/LeadFormModal';
import { LeadImportModal } from '@/components/leads/LeadImportModal';
import { GoogleSheetsImportModal } from '@/components/leads/GoogleSheetsImportModal';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';
import { PageHeader } from '@/components/layout/PageHeader';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

// Hooks y Utilidades
import { useLeads } from '@/hooks/useLeads';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Lead, LeadStatus } from '@/types/lead';
import { Loader2, ShieldAlert, Search, Kanban, MapPin, MessageSquare, Ticket, Bell, Settings, Mail, Calendar as CalendarIcon, BarChart3, FolderOpen, FileEdit, Megaphone, MailOpen, FileCode, Activity, Brain, StickyNote, FileText } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';

// --- Lazy Loaded Modules ---
const Dashboard = lazy(() => import('@/components/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const LeadsList = lazy(() => import('@/components/leads/LeadsList').then(m => ({ default: m.LeadsList })));
const LeadDetail = lazy(() => import('@/components/leads/LeadDetail').then(m => ({ default: m.LeadDetail })));
const LeadKanban = lazy(() => import('@/components/leads/LeadKanban').then(m => ({ default: m.LeadKanban })));
const LeadMap = lazy(() => import('@/components/leads/LeadMap').then(m => ({ default: m.LeadMap })));
const ProspectionModule = lazy(() => import('@/components/prospection/ProspectionModule').then(m => ({ default: m.ProspectionModule })));
const EmailCampaigns = lazy(() => import('@/components/campaigns/EmailCampaigns').then(m => ({ default: m.EmailCampaigns })));
const ReportsDashboard = lazy(() => import('@/components/reports/ReportsDashboard').then(m => ({ default: m.ReportsDashboard })));
const SettingsView = lazy(() => import('@/components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const AIMemoryManager = lazy(() => import('@/components/ai-memory/AIMemoryManager').then(m => ({ default: m.AIMemoryManager })));
const SecurityPanel = lazy(() => import('@/components/security/SecurityPanel').then(m => ({ default: m.SecurityPanel })));
const WhatsAppPanel = lazy(() => import('@/components/whatsapp/WhatsAppPanel').then(m => ({ default: m.WhatsAppPanel })));
const Inbox = lazy(() => import('@/pages/Inbox'));
const Templates = lazy(() => import('@/pages/Templates'));
const PerplexityChatbot = lazy(() => import('@/components/chat/PerplexityChatbot').then(m => ({ default: m.PerplexityChatbot })));
const InternalChatPage = lazy(() => import('@/components/internal-chat/InternalChatPage').then(m => ({ default: m.InternalChatPage })));
const SharedFilesPanel = lazy(() => import('@/components/shared-files/SharedFilesPanel').then(m => ({ default: m.SharedFilesPanel })));
const DocumentEditor = lazy(() => import('@/components/editor/DocumentEditor').then(m => ({ default: m.DocumentEditor })));
const EmailModule = lazy(() => import('@/components/email/EmailModule').then(m => ({ default: m.EmailModule })));
const OsTicketPanel = lazy(() => import('@/components/osticket/OsTicketPanel').then(m => ({ default: m.OsTicketPanel })));
const CalendarModule = lazy(() => import('@/components/calendar/CalendarModule').then(m => ({ default: m.CalendarModule })));
const ReportsModule = lazy(() => import('@/components/reports/ReportsModule').then(m => ({ default: m.ReportsModule })));
const AppsHub = lazy(() => import('@/components/apps/AppsHub').then(m => ({ default: m.AppsHub })));
const GeneralRemindersList = lazy(() => import('@/components/reminders/GeneralRemindersList').then(m => ({ default: m.GeneralRemindersList })));
const N8nIntegrationPage = lazy(() => import('@/components/n8n/N8nIntegrationPage').then(m => ({ default: m.N8nIntegrationPage })));
const BotqueronPanel = lazy(() => import('@/components/botqueron/BotqueronPanel').then(m => ({ default: m.BotqueronPanel })));
const WorkspacesModule = lazy(() => import('@/components/workspaces/WorkspacesModule').then(m => ({ default: m.WorkspacesModule })));
const SeoGeneratorInline = lazy(() => import('@/components/seo/SeoGeneratorInline').then(m => ({ default: m.SeoGeneratorInline })));
const PerformanceDashboard = lazy(() => import('@/components/performance/PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard })));
const QuickNotesApp = lazy(() => import('@/components/notes/QuickNotesApp').then(m => ({ default: m.QuickNotesApp })));
const SupportModule = lazy(() => import('@/components/support/SupportModule').then(m => ({ default: m.SupportModule })));


const IndexContent = () => {
  const navigate = useNavigate();
  const { sidebarPosition, setSidebarPosition, categories: sidebarCategories } = useSidebarConfig();
  const { isAdmin, roleLoading } = useUserRole();
  const [localPosition, setLocalPosition] = useState(sidebarPosition);
  const [activeTab, setActiveTab] = useState(roleLoading ? '' : (isAdmin ? 'dashboard' : 'correo'));
  const [openTabs, setOpenTabs] = useState<Array<{ id: string; label: string; icon: string; color: string }>>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGoogleSheetsImportOpen, setIsGoogleSheetsImportOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [pendingWhatsAppPhone, setPendingWhatsAppPhone] = useState<string | null>(null);
  const [pendingCampaignEmail, setPendingCampaignEmail] = useState<string | null>(null);

  const handleQuickWhatsApp = (phone: string) => {
    setPendingWhatsAppPhone(phone);
    setActiveTab('whatsapp');
  };

  const handleQuickEmail = (email: string) => {
    setPendingCampaignEmail(email);
    setActiveTab('campaigns');
  };
  const { trackNavigation, trackLogin } = useInteractionTracking();

  // Track login on mount
  useEffect(() => {
    trackLogin();
  }, [trackLogin]);

  // Track open tabs — skip non-content tabs
  const SKIP_TABS = ['', 'lead-detail', 'apps'];
  useEffect(() => {
    if (activeTab && !SKIP_TABS.includes(activeTab)) {
      trackNavigation(activeTab);
    }
  }, [activeTab, trackNavigation]);
  useEffect(() => {
    if (SKIP_TABS.includes(activeTab)) return;
    setOpenTabs(prev => {
      if (prev.some(t => t.id === activeTab)) return prev;
      // Find tab info from sidebar categories
      const allItems = sidebarCategories.flatMap(c => c.items);
      const found = allItems.find(i => i.id === activeTab);
      const label = found?.label || activeTab;
      const icon = found?.icon || 'LayoutDashboard';
      const color = found?.color || 'text-blue-500';
      return [...prev, { id: activeTab, label, icon, color }];
    });
  }, [activeTab, sidebarCategories]);

  const handleCloseTab = (tabId: string) => {
    setOpenTabs(prev => prev.filter(t => t.id !== tabId));
    // If closing active tab, switch to the previous or dashboard
    if (activeTab === tabId) {
      const remaining = openTabs.filter(t => t.id !== tabId);
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].id : (isAdmin ? 'dashboard' : 'correo'));
    }
  };
  
  const { 
    leads,
    totalCount,
    isLoading, 
    updateLeadStatus, 
    addLead, 
    updateLead, 
    deleteLead,
    importLeads,
    geocodeLead,
    bulkGeocode,
    // Pagination
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    // Loading states
    isAddingLead,
    isUpdatingLead,
    isImportingLeads,
    isGeocodingLead,
    isBulkGeocoding,
  } = useLeads();

  // Set default tab based on role once loaded
  useEffect(() => {
    if (!roleLoading && activeTab === '') {
      setActiveTab(isAdmin ? 'dashboard' : 'correo');
    }
  }, [roleLoading, isAdmin]);

  // Sync localPosition when sidebarPosition loads from DB
  useEffect(() => {
    setLocalPosition(sidebarPosition);
  }, [sidebarPosition]);

  // Session timeout - 30 minutes of inactivity
  const { showWarning, formattedTime, extendSession, logout } = useSessionTimeout({
    onTimeout: () => {
      navigate('/auth', { replace: true });
    },
  });

  const handleViewLead = (id: string) => {
    setSelectedLeadId(id);
    setActiveTab('lead-detail');
  };

  const handleBackFromDetail = () => {
    setSelectedLeadId(null);
    setActiveTab('leads');
  };

  const handleUpdateLeadStatus = (id: string, status: LeadStatus, previousStatus?: LeadStatus) => {
    updateLeadStatus({ id, status, previousStatus });
  };

  const handleAddLead = () => {
    setEditingLead(null);
    setIsFormOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setIsFormOpen(true);
  };

  const handleDeleteLead = (id: string, companyName?: string) => {
    deleteLead({ id, companyName: companyName || 'Unknown' });
    if (selectedLeadId === id) {
      handleBackFromDetail();
    }
  };

  const handleFormSubmit = (data: any) => {
    // Only close the modal when the mutation succeeds.
    if (editingLead) {
      updateLead(
        { id: editingLead.id, ...data },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            setEditingLead(null);
          },
        }
      );
      return;
    }

    addLead(data, {
      onSuccess: () => {
        setIsFormOpen(false);
        setEditingLead(null);
      },
    });
  };

  const handleImportLeads = (leadsData: any[]) => {
    importLeads(leadsData, {
      onSuccess: () => {
        setIsImportOpen(false);
      },
    });
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  const ADMIN_ONLY_TABS = ['dashboard', 'leads', 'lead-detail', 'pipeline', 'campaigns', 'rendimiento', 'ai-memory', 'seguridad'];

  const renderAccessDenied = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <ShieldAlert className="w-16 h-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">Acceso restringido</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          No tienes permisos para acceder a este módulo. Contacta con un administrador.
        </p>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading || roleLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    // Block non-admins from restricted tabs
    if (!isAdmin && ADMIN_ONLY_TABS.includes(activeTab)) {
      return renderAccessDenied();
    }

    if (activeTab === 'lead-detail' && selectedLead) {
      return (
        <LeadDetail 
          lead={selectedLead} 
          onBack={handleBackFromDetail}
          onUpdateStatus={handleUpdateLeadStatus}
          onEdit={() => handleEditLead(selectedLead)}
          onDelete={() => handleDeleteLead(selectedLead.id, selectedLead.companyName)}
          onGeocode={(id, address, city) => geocodeLead({ id, address, city })}
          isGeocoding={isGeocodingLead}
        />
      );
    }

    const goApps = () => setActiveTab('apps');

    switch (activeTab) {
      case 'apps':
        return <AppsHub onOpenApp={setActiveTab} />;
      case 'dashboard':
        return <Dashboard onViewLead={handleViewLead} onTabChange={setActiveTab} />;
      case 'leads':
        return (
          <LeadsList 
            leads={leads}
            totalCount={totalCount}
            onViewLead={handleViewLead}
            onAddLead={handleAddLead}
            onImportLeads={() => setIsImportOpen(true)}
            onImportFromGoogleSheets={() => setIsGoogleSheetsImportOpen(true)}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            onQuickWhatsApp={handleQuickWhatsApp}
            onQuickEmail={handleQuickEmail}
          />
        );
      case 'prospeccion':
        return (
          <div className="flex flex-col gap-0 animate-fade-in h-[calc(100vh-4rem)]">
            <PageHeader
              title="Prospección"
              description="Busca y descubre nuevos clientes potenciales por zona geográfica"
              icon={<Search className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 p-4 sm:p-8">
              <ProspectionModule />
            </div>
          </div>
        );
      case 'pipeline':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Pipeline"
              description="Arrastra los leads entre columnas para cambiar su estado"
              icon={<Kanban className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 p-4 sm:p-8">
              <LeadKanban 
                leads={leads} 
                onViewLead={handleViewLead} 
                onUpdateStatus={handleUpdateLeadStatus}
              />
            </div>
          </div>
        );
      case 'campaigns':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Campañas de Email"
              description="Crea y gestiona campañas de email marketing"
              icon={<Megaphone className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto">
              <EmailCampaigns prefillEmail={pendingCampaignEmail} onPrefillConsumed={() => setPendingCampaignEmail(null)} />
            </div>
          </div>
        );
      case 'mapa':
        return (
          <div className="flex flex-col h-full animate-fade-in">
            <PageHeader
              title="Mapa de Leads"
              description="Visualiza tus leads en el mapa"
              icon={<MapPin className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 p-4 sm:p-8">
              <LeadMap 
                leads={leads} 
                onViewLead={handleViewLead} 
                onBulkGeocode={bulkGeocode}
                isBulkGeocoding={isBulkGeocoding}
              />
            </div>
          </div>
        );
      case 'reports':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Reportes"
              description="Estadísticas y análisis de rendimiento"
              icon={<BarChart3 className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto">
              <ReportsDashboard />
            </div>
          </div>
        );
      case 'inbox':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Bandeja de entrada"
              description="Gestiona tus notificaciones"
              icon={<MailOpen className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto">
              <Inbox />
            </div>
          </div>
        );
      case 'whatsapp':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="WhatsApp"
              description="Gestiona tus conversaciones"
              icon={<MessageSquare className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 p-4 sm:p-8">
              <WhatsAppPanel prefillPhone={pendingWhatsAppPhone} onPrefillConsumed={() => setPendingWhatsAppPhone(null)} />
            </div>
          </div>
        );
      case 'templates':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Plantillas"
              description="Gestiona plantillas de mensajes"
              icon={<FileCode className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto">
              <Templates />
            </div>
          </div>
        );
      case 'mensajes':
        return (
          <div className="animate-fade-in flex-1 min-h-0 flex flex-col">
            <PageHeader
              title="Chat Interno"
              description="Comunicación entre el equipo"
              icon={<MessageSquare className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0">
              <InternalChatPage />
            </div>
          </div>
        );
      case 'shared-files':
        return (
          <div className="flex flex-col h-full animate-fade-in">
            <PageHeader
              title="Archivos Compartidos"
              description="Gestiona archivos del equipo"
              icon={<FolderOpen className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 p-2 sm:p-4 md:p-8">
              <SharedFilesPanel />
            </div>
          </div>
        );
      case 'editor':
        return (
          <div className="flex flex-col h-full animate-fade-in">
            <PageHeader
              title="Editor IA"
              description="Crea documentos con asistencia de inteligencia artificial"
              icon={<FileEdit className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0">
              <DocumentEditor showBackButton={false} />
            </div>
          </div>
        );
      case 'workspaces':
        return <WorkspacesModule onBack={goApps} />;
      case 'correo':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Correo Electrónico"
              description="Gestiona tu email profesional"
              icon={<Mail className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto">
              <EmailModule />
            </div>
          </div>
        );
      case 'osticket':
        return (
          <div className="flex flex-col overflow-hidden animate-fade-in" style={{ height: '100%' }}>
            <PageHeader
              title="Tickets osTicket"
              description="Gestiona y responde tickets con mensajes de WhatsApp"
              icon={<Ticket className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
              <OsTicketPanel />
            </div>
          </div>
        );
      case 'calendario':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Calendario"
              description="Gestiona eventos y citas"
              icon={<CalendarIcon className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto">
              <CalendarModule />
            </div>
          </div>
        );
      case 'informes':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Informes"
              description="Registros de salida y reportes"
              icon={<FileText className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto">
              <ReportsModule />
            </div>
          </div>
        );
      case 'chat-ai':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <div className="flex-1 min-h-0">
              <PerplexityChatbot />
            </div>
          </div>
        );
      case 'reminders':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Recordatorios"
              description="Gestiona recordatorios generales para la empresa"
              icon={<Bell className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 p-4 sm:p-8 max-w-5xl mx-auto w-full">
              <GeneralRemindersList />
            </div>
          </div>
        );
      case 'seo-generator':
        return <SeoGeneratorInline />;
      case 'settings':
        return <SettingsView onBack={goApps} />;
      case 'rendimiento':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Rendimiento"
              description="Métricas de uso, accesos y actividad del sistema"
              icon={<Activity className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-8">
              <PerformanceDashboard />
            </div>
          </div>
        );
      case 'ai-memory':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Memoria IA"
              description="Gestiona el contexto y recuerdos de Micro"
              icon={<Brain className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-8">
              <AIMemoryManager />
            </div>
          </div>
        );
      case 'n8n-integration':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <div className="flex-1 min-h-0 overflow-auto">
              <N8nIntegrationPage />
            </div>
          </div>
        );
      case 'seguridad':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Seguridad"
              description="Bloqueos de acceso, auditoría y gestión de seguridad"
              icon={<ShieldAlert className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-8">
              <SecurityPanel />
            </div>
          </div>
        );
      case 'notas':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Notas"
              description="Tus notas rápidas y apuntes personales"
              icon={<StickyNote className="h-5 w-5 text-amber-500" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-8 max-w-6xl mx-auto w-full">
              <QuickNotesApp />
            </div>
          </div>
        );
      case 'botqueron':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <div className="flex-1 min-h-0">
              <BotqueronPanel />
            </div>
          </div>
        );
      case 'soporte':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <div className="flex-1 min-h-0">
              <SupportModule />
            </div>
          </div>
        );
      default:
        return <Dashboard onViewLead={handleViewLead} />;
    }
  };

    const isHorizontal = localPosition === 'top' || localPosition === 'bottom';
    
    return (
      <div className={cn(
        "h-screen bg-background overflow-hidden",
        isHorizontal ? "flex flex-col" : "flex",
        localPosition === 'right' && "flex-row-reverse",
        localPosition === 'bottom' && "flex-col-reverse",
      )}>
        <Sidebar 
          activeTab={activeTab === 'lead-detail' ? 'leads' : activeTab} 
          onTabChange={setActiveTab}
          position={localPosition}
          onPositionChange={setLocalPosition}
          openTabs={openTabs}
          onCloseTab={handleCloseTab}
        />
        <div className="flex-1 flex flex-col overflow-hidden md:ml-0 min-h-0">
          <EmailVerificationBanner />
          <main className="flex-1 overflow-auto pt-14 md:pt-0 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 flex flex-col">
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="flex-1 flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                }>
                  {renderContent()}
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
        <CommandPalette onNavigate={setActiveTab} />
        <RightSidebar onNavigate={setActiveTab} />

      <LeadFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        lead={editingLead}
        onSubmit={handleFormSubmit}
        isLoading={isAddingLead || isUpdatingLead}
      />

      <LeadImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImportLeads}
        isImporting={isImportingLeads}
      />

      <GoogleSheetsImportModal
        open={isGoogleSheetsImportOpen}
        onOpenChange={setIsGoogleSheetsImportOpen}
      />

      {/* Session timeout warning */}
      <SessionTimeoutWarning
        open={showWarning}
        formattedTime={formattedTime}
        onExtend={extendSession}
        onLogout={logout}
      />
    </div>
  );
};

const Index = () => {
  return <IndexContent />;
};

export default Index;
