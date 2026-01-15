import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { LeadsList } from '@/components/leads/LeadsList';
import { LeadDetail } from '@/components/leads/LeadDetail';
import { ProspectingPanel } from '@/components/prospecting/ProspectingPanel';
import { mockLeads } from '@/data/mockLeads';
import { Lead, LeadStatus } from '@/types/lead';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>(mockLeads);

  const handleViewLead = (id: string) => {
    setSelectedLeadId(id);
    setActiveTab('lead-detail');
  };

  const handleBackFromDetail = () => {
    setSelectedLeadId(null);
    setActiveTab('leads');
  };

  const handleUpdateLeadStatus = (id: string, status: LeadStatus) => {
    setLeads(prev => 
      prev.map(lead => 
        lead.id === id ? { ...lead, status, updatedAt: new Date() } : lead
      )
    );
  };

  const handleAddLead = () => {
    // TODO: Open add lead modal
    console.log('Add lead clicked');
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  const renderContent = () => {
    if (activeTab === 'lead-detail' && selectedLead) {
      return (
        <LeadDetail 
          lead={selectedLead} 
          onBack={handleBackFromDetail}
          onUpdateStatus={handleUpdateLeadStatus}
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
          />
        );
      case 'prospeccion':
        return <ProspectingPanel />;
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
    </div>
  );
};

export default Index;
