import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { LeadsList } from '@/components/leads/LeadsList';
import { LeadDetail } from '@/components/leads/LeadDetail';
import { LeadKanban } from '@/components/leads/LeadKanban';
import { LeadMap } from '@/components/leads/LeadMap';
import { LeadFormModal } from '@/components/leads/LeadFormModal';
import { LeadImportModal } from '@/components/leads/LeadImportModal';
import { ProspectionModule } from '@/components/prospection/ProspectionModule';

import { EmailCampaigns } from '@/components/campaigns/EmailCampaigns';
import { ReportsDashboard } from '@/components/reports/ReportsDashboard';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';
import { AuditLogViewer } from '@/components/settings/AuditLogViewer';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { AppUpdateCard } from '@/components/settings/AppUpdateCard';
import { PasswordChangeCard } from '@/components/settings/PasswordChangeCard';
import { NotificationPreferencesCard } from '@/components/settings/NotificationPreferencesCard';
import { TwoFactorAuthCard } from '@/components/settings/TwoFactorAuthCard';
import { DeleteAccountCard } from '@/components/settings/DeleteAccountCard';
import { ThemeToggleCard } from '@/components/settings/ThemeToggleCard';
import { WhatsAppPanel } from '@/components/whatsapp/WhatsAppPanel';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { GoogleSheetsCard } from '@/components/settings/GoogleSheetsCard';
import { OsTicketConfigCard } from '@/components/settings/OsTicketConfigCard';
import Inbox from '@/pages/Inbox';
import Templates from '@/pages/Templates';
import { GoogleSheetsImportModal } from '@/components/leads/GoogleSheetsImportModal';
import { PerplexityChatbot } from '@/components/chat/PerplexityChatbot';
import { InternalChatPage } from '@/components/internal-chat/InternalChatPage';
import { SharedFilesPanel } from '@/components/shared-files/SharedFilesPanel';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { EmailModule } from '@/components/email/EmailModule';
import { OsTicketHistory } from '@/components/osticket/OsTicketHistory';
import { OsTicketPanel } from '@/components/osticket/OsTicketPanel';
import { CalendarModule } from '@/components/calendar/CalendarModule';
import { ReportsModule } from '@/components/reports/ReportsModule';
import { AppsHub } from '@/components/apps/AppsHub';
import { GeneralRemindersList } from '@/components/reminders/GeneralRemindersList';
import { SeoArticleGenerator } from '@/components/seo/SeoArticleGenerator';
import { N8nIntegrationPage } from '@/components/n8n/N8nIntegrationPage';
import { WorkspacesModule } from '@/components/workspaces/WorkspacesModule';
import { PageHeader } from '@/components/layout/PageHeader';
import { SeoGeneratorInline } from '@/components/seo/SeoGeneratorInline';
import { useLeads } from '@/hooks/useLeads';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Lead, LeadStatus } from '@/types/lead';
import { Loader2, ShieldAlert, FileText, Sparkles, CheckCircle2, LayoutGrid, List, Search, Kanban, MapPin, MessageSquare, Ticket, Bot, Bell, Settings, Mail, Calendar as CalendarIcon, BarChart3, FolderOpen, FileEdit, ArrowLeft, Megaphone, MailOpen, FileCode, Activity, Brain, StickyNote, Workflow } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { PerformanceDashboard } from '@/components/performance/PerformanceDashboard';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';
import { AIMemoryManager } from '@/components/ai-memory/AIMemoryManager';
import { SecurityPanel } from '@/components/security/SecurityPanel';
import { QuickNotesApp } from '@/components/notes/QuickNotesApp';

const SeoGeneratorInline = () => {
  const { articles, loading, generating, generateArticle, deleteArticle } = useSeoArticles();
  const [viewingArticle, setViewingArticle] = useState<SeoArticle | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const completedArticles = articles.filter(a => a.status === 'completed');
  const processingArticles = articles.filter(a => a.status === 'processing' || a.status === 'pending');
  const errorArticles = articles.filter(a => a.status === 'error');

  return (
    <div className="animate-fade-in">
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5 py-1 hidden sm:flex">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {completedArticles.length} completados
              </Badge>
              {processingArticles.length > 0 && (
                <Badge variant="outline" className="gap-1.5 py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {processingArticles.length} en proceso
                </Badge>
              )}
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Sparkles className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Generador SEO</h1>
                  <p className="text-sm text-muted-foreground">Artículos optimizados con IA</p>
                </div>
              </div>
            </div>
            <div>
              <SeoArticleGenerator onGenerate={generateArticle} generating={generating} />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Resultados</h2>
              <p className="text-xs text-muted-foreground">{articles.length} artículo{articles.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('list')}>
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/10">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="h-10 w-10 text-primary/30" />
            </div>
            <h3 className="font-semibold text-xl">Sin artículos aún</h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">Introduce un tema arriba y crea tu primer artículo SEO</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
            {articles.map(article => (
              <SeoArticleCard key={article.id} article={article} onDelete={deleteArticle} onView={setViewingArticle} compact={viewMode === 'list'} />
            ))}
          </div>
        )}
      </div>
      <SeoArticleViewer article={viewingArticle} open={!!viewingArticle} onClose={() => setViewingArticle(null)} />
    </div>
  );
};

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
            <div className="flex-1 min-h-0 p-3 sm:p-6">
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
            <div className="flex-1 min-h-0 p-3 sm:p-6">
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
            <div className="flex-1 min-h-0 p-3 sm:p-6">
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
            <div className="flex-1 min-h-0 p-3 sm:p-6">
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
            <div className="flex-1 min-h-0 p-3 sm:p-6 max-w-5xl mx-auto w-full">
              <GeneralRemindersList />
            </div>
          </div>
        );
      case 'seo-generator':
        return <SeoGeneratorInline />;
      case 'settings':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Ajustes"
              description="Configuración y registro de actividad"
              icon={<Settings className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6 space-y-4">
              <AppUpdateCard />
              <ProfileSettings />
              <ThemeToggleCard />
              <div className="pt-2 sm:pt-4">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Integraciones</h2>
                <div className="space-y-3 sm:space-y-4">
                  <GoogleSheetsCard />
                  <OsTicketConfigCard />
                </div>
              </div>
              <PasswordChangeCard />
              <TwoFactorAuthCard />
              <NotificationPreferencesCard />
              <AuditLogViewer />
              <DeleteAccountCard />
            </div>
          </div>
        );
      case 'rendimiento':
        return (
          <div className="flex flex-col animate-fade-in h-full">
            <PageHeader
              title="Rendimiento"
              description="Métricas de uso, accesos y actividad del sistema"
              icon={<Activity className="h-5 w-5 text-primary" />}
              onBack={goApps}
            />
            <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6">
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
            <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6">
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
            <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6">
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
            <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6 max-w-6xl mx-auto w-full">
              <QuickNotesApp />
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
              {renderContent()}
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
