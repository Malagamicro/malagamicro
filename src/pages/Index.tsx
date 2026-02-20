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
import { ProspectingPanel } from '@/components/prospecting/ProspectingPanel';
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
import { useLeads } from '@/hooks/useLeads';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Lead, LeadStatus } from '@/types/lead';
import { Loader2 } from 'lucide-react';

const IndexContent = () => {
  const navigate = useNavigate();
  const { sidebarPosition, setSidebarPosition } = useSidebarConfig();
  const [localPosition, setLocalPosition] = useState(sidebarPosition);
  const [activeTab, setActiveTab] = useState('dashboard');
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
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
        return <ProspectingPanel />;
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
      case 'ticket-editor':
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
