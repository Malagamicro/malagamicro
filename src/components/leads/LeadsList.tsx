import { useState, useMemo } from 'react';
import { Lead, LeadStatus, LeadSegment } from '@/types/lead';
import { LeadCard } from './LeadCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Plus, 
  Building2, 
  Grid3X3,
  List,
  Upload,
  Download,
  ArrowUpDown,
  Loader2,
  FolderOpen,
  FileSpreadsheet,
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
import { WhatsAppBulkModal } from './WhatsAppBulkModal';
import { useLeadFolders } from '@/hooks/useLeadFolders';
import { useLeads } from '@/hooks/useLeads';
import { BulkActionBar, LeadsTableView, DeleteLeadsDialog } from './LeadsListSubComponents';

type SortOption = 'recent' | 'score' | 'name';

interface LeadsListProps {
  leads: Lead[];
  totalCount?: number;
  onViewLead: (id: string) => void;
  onAddLead: () => void;
  onImportLeads: () => void;
  onImportFromGoogleSheets: () => void;
  onQuickWhatsApp?: (phone: string) => void;
  onQuickEmail?: (email: string) => void;
  // Pagination props
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function LeadsList({ 
  leads, 
  totalCount,
  onViewLead, 
  onAddLead, 
  onImportLeads,
  onImportFromGoogleSheets,
  onQuickWhatsApp,
  onQuickEmail,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: LeadsListProps) {
  const { folders } = useLeadFolders();
  const { bulkDeleteLeads, isBulkDeleting } = useLeads();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [segmentFilter, setSegmentFilter] = useState<LeadSegment | 'all'>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredAndSortedLeads = useMemo(() => {
    const filtered = leads.filter((lead) => {
      const matchesSearch = 
        lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesSegment = segmentFilter === 'all' || lead.segment === segmentFilter;
      const matchesFolder = folderFilter === 'all' || 
        (folderFilter === 'none' ? !lead.folderId : lead.folderId === folderFilter);
      
      return matchesSearch && matchesStatus && matchesSegment && matchesFolder;
    });

    // Sort the filtered leads
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return (b.score ?? 0) - (a.score ?? 0);
        case 'name':
          return a.companyName.localeCompare(b.companyName);
        case 'recent':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  }, [leads, searchTerm, statusFilter, segmentFilter, folderFilter, sortBy]);

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.length === filteredAndSortedLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredAndSortedLeads.map(lead => lead.id));
    }
  };

  const selectedLeads = leads.filter(lead => selectedLeadIds.includes(lead.id));
  const allSelected = selectedLeadIds.length === filteredAndSortedLeads.length && filteredAndSortedLeads.length > 0;

  // Bulk delete handler
  const handleBulkDelete = () => {
    bulkDeleteLeads(selectedLeadIds, {
      onSuccess: () => {
        setSelectedLeadIds([]);
        setShowDeleteConfirm(false);
      },
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 animate-fade-in">
      <BulkActionBar
        count={selectedLeadIds.length}
        isBulkDeleting={isBulkDeleting}
        onWhatsApp={() => setShowWhatsAppModal(true)}
        onDelete={() => setShowDeleteConfirm(true)}
        onClear={() => setSelectedLeadIds([])}
      />

      {/* Header - more compact on mobile */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Leads</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              {filteredAndSortedLeads.length} de {leads.length} leads
              {selectedLeadIds.length > 0 && (
                <span className="text-primary ml-2">
                  ({selectedLeadIds.length} selec.)
                </span>
              )}
            </p>
          </div>
          {/* Main action button always visible */}
          <Button onClick={onAddLead} size="sm" className="gap-1.5 md:gap-2 shrink-0 h-9 md:h-10">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Lead</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
        
        {/* Secondary actions - horizontal scroll on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 md:h-9 text-xs md:text-sm shrink-0" disabled={leads.length === 0}>
                <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => {
                exportToCSV(filteredAndSortedLeads);
                toast.success(`${filteredAndSortedLeads.length} leads exportados a CSV`);
              }}>
                Exportar a CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                await exportToExcel(filteredAndSortedLeads);
                toast.success(`${filteredAndSortedLeads.length} leads exportados a Excel`);
              }}>
                Exportar a Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 md:h-9 text-xs md:text-sm shrink-0">
                <Upload className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Importar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onImportLeads}>
                <Upload className="w-4 h-4 mr-2" />
                Importar Excel/CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImportFromGoogleSheets}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Google Sheets
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters - scrollable on mobile */}
      <div className="space-y-3">
        {/* Search always visible */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa, contacto o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 md:h-10 text-sm"
          />
        </div>
        
        {/* Filter row - horizontal scroll on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')}>
            <SelectTrigger className="w-[120px] md:w-[140px] h-8 md:h-9 text-xs md:text-sm shrink-0">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nuevo">Nuevo</SelectItem>
              <SelectItem value="contactado">Contactado</SelectItem>
              <SelectItem value="interesado">Interesado</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v as LeadSegment | 'all')}>
            <SelectTrigger className="w-[110px] md:w-[130px] h-8 md:h-9 text-xs md:text-sm shrink-0">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="franquicia">Franquicia</SelectItem>
              <SelectItem value="pyme">PYME</SelectItem>
            </SelectContent>
          </Select>

          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="w-[130px] md:w-[150px] h-8 md:h-9 text-xs md:text-sm shrink-0">
              <FolderOpen className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Carpeta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="none">Sin carpeta</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[100px] md:w-[120px] h-8 md:h-9 text-xs md:text-sm shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Score</SelectItem>
              <SelectItem value="recent">Recientes</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg overflow-hidden shrink-0 ml-auto">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9"
              onClick={() => setViewMode('list')}
            >
              <List className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Leads Grid/List */}
      {filteredAndSortedLeads.length === 0 ? (
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
        <div className="space-y-4">
          {/* Select all for grid */}
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={selectAllLeads}
            />
            <span className="text-sm text-muted-foreground">
              Seleccionar todos
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {filteredAndSortedLeads.map((lead) => (
              <div key={lead.id} className="relative">
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    checked={selectedLeadIds.includes(lead.id)}
                    onCheckedChange={() => toggleLeadSelection(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <LeadCard lead={lead} onClick={() => onViewLead(lead.id)} onQuickWhatsApp={onQuickWhatsApp} onQuickEmail={onQuickEmail} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <LeadsTableView
          leads={filteredAndSortedLeads}
          selectedIds={selectedLeadIds}
          allSelected={allSelected}
          onSelectAll={selectAllLeads}
          onToggle={toggleLeadSelection}
          onViewLead={onViewLead}
          onQuickWhatsApp={onQuickWhatsApp}
          onQuickEmail={onQuickEmail}
        />
      )}

      {/* Load More Button */}
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="gap-2"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                Cargar más ({totalCount ? `${leads.length} de ${totalCount}` : 'más leads'})
              </>
            )}
          </Button>
        </div>
      )}

      {/* WhatsApp Bulk Modal */}
      <WhatsAppBulkModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        selectedLeads={selectedLeads}
        onComplete={() => {
          setSelectedLeadIds([]);
          setShowWhatsAppModal(false);
        }}
      />

      <DeleteLeadsDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        count={selectedLeadIds.length}
        isBulkDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
