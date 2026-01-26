import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
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
import Inbox from '@/pages/Inbox';
import Templates from '@/pages/Templates';
import { GoogleSheetsImportModal } from '@/components/leads/GoogleSheetsImportModal';
import { PerplexityChatbot } from '@/components/chat/PerplexityChatbot';
import { InternalChatPage } from '@/components/internal-chat/InternalChatPage';
import { useLeads } from '@/hooks/useLeads';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Lead, LeadStatus } from '@/types/lead';
import { Loader2 } from 'lucide-react';

const IndexContent = () => {
  const navigate = useNavigate();
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
        return <Dashboard onViewLead={handleViewLead} />;
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
          <div className="p-8 space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Pipeline</h1>
              <p className="text-muted-foreground mt-1">
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
          <div className="p-8 h-full flex flex-col space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mapa de Leads</h1>
              <p className="text-muted-foreground mt-1">
                Visualiza tus leads en el mapa según su ubicación
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
          <div className="p-8 space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-foreground">WhatsApp</h1>
              <p className="text-muted-foreground mt-1">
                Gestiona tus conversaciones de WhatsApp
              </p>
            </div>
            <WhatsAppPanel />
          </div>
        );
      case 'templates':
        return <Templates />;
      case 'mensajes':
        return (
          <div className="p-8 space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mensajes Internos</h1>
              <p className="text-muted-foreground mt-1">
                Comunícate con tu equipo en tiempo real
              </p>
            </div>
            <InternalChatPage />
          </div>
        );
      case 'chat-ai':
        return (
          <div className="p-8 space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Chat IA</h1>
              <p className="text-muted-foreground mt-1">
                Asistente inteligente con búsqueda en tiempo real
              </p>
            </div>
            <PerplexityChatbot />
          </div>
        );
      case 'settings':
        return (
          <div className="p-8 space-y-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Ajustes</h1>
              <p className="text-muted-foreground mt-1">
                Configuración y registro de actividad
              </p>
            </div>
            <ProfileSettings />
            <ThemeToggleCard />
            
            {/* Integraciones Section */}
            <div className="pt-4">
              <h2 className="text-xl font-semibold text-foreground mb-4">Integraciones</h2>
              <div className="space-y-4">
                <GoogleSheetsCard />
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab === 'lead-detail' ? 'leads' : activeTab} 
        onTabChange={setActiveTab} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <EmailVerificationBanner />
        <main className="flex-1 overflow-auto">
          {renderContent()}
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
  return (
    <NotificationProvider>
      <IndexContent />
    </NotificationProvider>
  );
};

export default Index;
