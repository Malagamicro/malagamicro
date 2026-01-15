import { useState } from 'react';
import { Lead, LeadStatus, LeadSegment } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadCard } from './LeadCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Plus, 
  Building2, 
  Grid3X3,
  List,
  Upload,
  Download
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToCSV, exportToExcel } from '@/lib/exportLeads';
import { toast } from 'sonner';

interface LeadsListProps {
  leads: Lead[];
  onViewLead: (id: string) => void;
  onAddLead: () => void;
  onImportLeads: () => void;
}

export function LeadsList({ leads, onViewLead, onAddLead, onImportLeads }: LeadsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [segmentFilter, setSegmentFilter] = useState<LeadSegment | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSegment = segmentFilter === 'all' || lead.segment === segmentFilter;
    
    return matchesSearch && matchesStatus && matchesSegment;
  });

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">
            {filteredLeads.length} de {leads.length} leads
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={leads.length === 0}>
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                exportToCSV(filteredLeads);
                toast.success(`${filteredLeads.length} leads exportados a CSV`);
              }}>
                Exportar a CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                exportToExcel(filteredLeads);
                toast.success(`${filteredLeads.length} leads exportados a Excel`);
              }}>
                Exportar a Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={onImportLeads} className="gap-2">
            <Upload className="w-4 h-4" />
            Importar
          </Button>
          <Button onClick={onAddLead} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, contacto o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="nuevo">Nuevo</SelectItem>
            <SelectItem value="contactado">Contactado</SelectItem>
            <SelectItem value="interesado">Interesado</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
          </SelectContent>
        </Select>

        <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v as LeadSegment | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="franquicia">Franquicia</SelectItem>
            <SelectItem value="pyme">PYME</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex border rounded-lg overflow-hidden">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Leads Grid/List */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No hay leads</h3>
          <p className="text-muted-foreground mt-1">
            {searchTerm || statusFilter !== 'all' || segmentFilter !== 'all'
              ? 'Intenta cambiar los filtros de búsqueda'
              : 'Empieza añadiendo tu primer lead'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onViewLead(lead.id)} />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Contacto</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Ciudad</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Segmento</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => onViewLead(lead.id)}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{lead.companyName}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.contactName || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.city}</td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {lead.segment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
