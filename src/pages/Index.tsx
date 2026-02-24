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
import { SeoArticleCard } from '@/components/seo/SeoArticleCard';
import { SeoArticleViewer } from '@/components/seo/SeoArticleViewer';
import { useSeoArticles, SeoArticle } from '@/hooks/useSeoArticles';
import { useLeads } from '@/hooks/useLeads';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Lead, LeadStatus } from '@/types/lead';
import { Loader2, ShieldAlert, FileText, Sparkles, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

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
  const { sidebarPosition, setSidebarPosition } = useSidebarConfig();
  const { isAdmin, roleLoading } = useUserRole();
  const [localPosition, setLocalPosition] = useState(sidebarPosition);
  const [activeTab, setActiveTab] = useState(roleLoading ? '' : (isAdmin ? 'dashboard' : 'correo'));
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGoogleSheetsImportOpen, setIsGoogleSheetsImportOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
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

  const ADMIN_ONLY_TABS = ['dashboard', 'leads', 'lead-detail', 'pipeline', 'campaigns'];

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
          />
        );
      case 'prospeccion':
        return (
          <div className="p-3 sm:p-8 flex flex-col gap-4 animate-fade-in h-[calc(100vh-4rem)]">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">Prospección</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">Busca y descubre nuevos clientes potenciales por zona geográfica</p>
            </div>
            <div className="flex-1 min-h-0">
              <ProspectionModule />
            </div>
          </div>
        );
      case 'pipeline':
        return (
          <div className="p-3 sm:p-8 space-y-4 sm:space-y-6 animate-fade-in">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">Pipeline</h1>
              <p className="text-xs sm:text-base text-muted-foreground mt-1">
                Arrastra los leads entre columnas para cambiar su estado
              </p>
            </div>
            <LeadKanban 
              leads={leads} 
              onViewLead={handleViewLead} 
              onUpdateStatus={handleUpdateLeadStatus}
            />
          </div>
        );
      case 'campaigns':
        return <EmailCampaigns />;
      case 'mapa':
        return (
          <div className="p-3 sm:p-8 h-full flex flex-col space-y-4 sm:space-y-6 animate-fade-in">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">Mapa de Leads</h1>
              <p className="text-xs sm:text-base text-muted-foreground mt-1">
                Visualiza tus leads en el mapa
              </p>
            </div>
            <LeadMap 
              leads={leads} 
              onViewLead={handleViewLead} 
              onBulkGeocode={bulkGeocode}
              isBulkGeocoding={isBulkGeocoding}
            />
          </div>
        );
      case 'reports':
        return <ReportsDashboard />;
      case 'inbox':
        return <Inbox />;
      case 'whatsapp':
        return (
          <div className="p-3 sm:p-8 space-y-4 sm:space-y-6 animate-fade-in">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">WhatsApp</h1>
              <p className="text-xs sm:text-base text-muted-foreground mt-1">
                Gestiona tus conversaciones
              </p>
            </div>
            <WhatsAppPanel />
          </div>
        );
      case 'templates':
        return <Templates />;
      case 'mensajes':
        return (
          <div className="animate-fade-in h-full">
            <InternalChatPage />
          </div>
        );
      case 'shared-files':
        return (
          <div className="p-2 sm:p-4 md:p-8 h-full animate-fade-in">
            <SharedFilesPanel />
          </div>
        );
      case 'editor':
        return (
          <div className="h-full animate-fade-in">
            <DocumentEditor />
          </div>
        );
      case 'correo':
        return <EmailModule />;
      case 'osticket':
        return (
          <div className="flex flex-col overflow-hidden animate-fade-in" style={{ height: '100%' }}>
            <div className="px-4 sm:px-8 py-3 border-b bg-card flex-shrink-0">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">Tickets osTicket</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gestiona y responde tickets con mensajes de WhatsApp personalizados
              </p>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <OsTicketPanel />
            </div>
          </div>
        );
      case 'calendario':
        return <CalendarModule />;
      case 'informes':
        return <ReportsModule />;
      case 'chat-ai':
        return (
          <div className="p-3 sm:p-8 space-y-4 sm:space-y-6 animate-fade-in w-full max-w-none md:max-w-4xl md:mx-auto">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">Chat IA</h1>
              <p className="text-xs sm:text-base text-muted-foreground mt-1">
                Asistente inteligente con búsqueda en tiempo real
              </p>
            </div>
            <PerplexityChatbot />
          </div>
        );
      case 'reminders':
        return (
          <div className="p-3 sm:p-8 space-y-4 sm:space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">Recordatorios</h1>
              <p className="text-xs sm:text-base text-muted-foreground mt-1">
                Gestiona recordatorios generales para la empresa
              </p>
            </div>
            <GeneralRemindersList />
          </div>
        );
      case 'seo-generator':
        return <SeoGeneratorInline />;
      case 'settings':
        return (
          <div className="p-3 sm:p-8 space-y-4 sm:space-y-6 animate-fade-in">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">Ajustes</h1>
              <p className="text-xs sm:text-base text-muted-foreground mt-1">
                Configuración y registro de actividad
              </p>
            </div>
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
        );
      default:
        return <Dashboard onViewLead={handleViewLead} />;
    }
  };

    const isHorizontal = localPosition === 'top' || localPosition === 'bottom';
    
    return (
      <div className={cn(
        "min-h-screen bg-background",
        isHorizontal ? "flex flex-col" : "flex",
        localPosition === 'right' && "flex-row-reverse",
        localPosition === 'bottom' && "flex-col-reverse",
      )}>
        <Sidebar 
          activeTab={activeTab === 'lead-detail' ? 'leads' : activeTab} 
          onTabChange={setActiveTab}
          position={localPosition}
          onPositionChange={setLocalPosition}
        />
        <div className="flex-1 flex flex-col overflow-hidden md:ml-0" style={{ minHeight: 0 }}>
          <EmailVerificationBanner />
          <main className="flex-1 overflow-auto pt-14 md:pt-0" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {renderContent()}
            </div>
          </main>
        </div>

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
