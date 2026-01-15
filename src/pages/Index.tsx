import { useState } from 'react';
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
import { useLeads } from '@/hooks/useLeads';
import { Lead, LeadStatus } from '@/types/lead';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  const { 
    leads, 
    isLoading, 
    updateLeadStatus, 
    addLead, 
    updateLead, 
    deleteLead,
    importLeads,
    geocodeLead,
    bulkGeocode,
    isAddingLead,
    isUpdatingLead,
    isImportingLeads,
    isGeocodingLead,
    isBulkGeocoding,
  } = useLeads();

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

  const handleDeleteLead = (id: string) => {
    deleteLead(id);
    if (selectedLeadId === id) {
      handleBackFromDetail();
    }
  };

  const handleFormSubmit = (data: any) => {
    if (editingLead) {
      updateLead({ id: editingLead.id, ...data });
    } else {
      addLead(data);
    }
    setIsFormOpen(false);
    setEditingLead(null);
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
          onDelete={() => handleDeleteLead(selectedLead.id)}
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
            onViewLead={handleViewLead}
            onAddLead={handleAddLead}
            onImportLeads={() => setIsImportOpen(true)}
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
      case 'settings':
        return (
          <div className="p-8">
            <h1 className="text-3xl font-bold text-foreground">Ajustes</h1>
            <p className="text-muted-foreground mt-1">
              Configuración de la aplicación (próximamente)
            </p>
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
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>

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
    </div>
  );
};

export default Index;
