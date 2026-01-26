import { useState, useMemo } from 'react';
import { Lead, LeadStatus, LeadSegment } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
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
  MessageSquare,
  Loader2,
  FolderOpen,
  Trash2,
  AlertTriangle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { exportToCSV, exportToExcel } from '@/lib/exportLeads';
import { toast } from 'sonner';
import { WhatsAppBulkModal } from './WhatsAppBulkModal';
import { useLeadFolders, type LeadFolder } from '@/hooks/useLeadFolders';
import { useLeads } from '@/hooks/useLeads';

type SortOption = 'recent' | 'score' | 'name';

interface LeadsListProps {
  leads: Lead[];
  totalCount?: number;
  onViewLead: (id: string) => void;
  onAddLead: () => void;
  onImportLeads: () => void;
  onImportFromGoogleSheets: () => void;
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
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Floating bulk action bar */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-lg rounded-xl px-4 py-3 flex items-center gap-4 animate-slide-up">
          <span className="text-sm font-medium text-foreground">
            {selectedLeadIds.length} leads seleccionados
          </span>
          <div className="h-6 w-px bg-border" />
          <Button 
            onClick={() => setShowWhatsAppModal(true)} 
            size="sm"
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </Button>
          <Button 
            onClick={() => setShowDeleteConfirm(true)} 
            size="sm"
            variant="destructive"
            className="gap-2"
            disabled={isBulkDeleting}
          >
            {isBulkDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Eliminar
          </Button>
          <Button 
            onClick={() => setSelectedLeadIds([])} 
            size="sm"
            variant="ghost"
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedLeads.length} de {leads.length} leads
            {selectedLeadIds.length > 0 && (
              <span className="text-primary ml-2">
                ({selectedLeadIds.length} seleccionados)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={leads.length === 0}>
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Importar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onImportLeads}>
                <Upload className="w-4 h-4 mr-2" />
                Importar Excel/CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImportFromGoogleSheets}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Importar desde Google Sheets
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

        {/* Folder Filter */}
        <Select value={folderFilter} onValueChange={setFolderFilter}>
          <SelectTrigger className="w-40">
            <FolderOpen className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Carpeta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las carpetas</SelectItem>
            <SelectItem value="none">Sin carpeta</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: folder.color }}
                  />
                  {folder.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-36">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Por Score</SelectItem>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="name">Por nombre</SelectItem>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedLeads.map((lead) => (
              <div key={lead.id} className="relative">
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    checked={selectedLeadIds.includes(lead.id)}
                    onCheckedChange={() => toggleLeadSelection(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <LeadCard lead={lead} onClick={() => onViewLead(lead.id)} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={selectAllLeads}
                  />
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Score</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Contacto</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Teléfono</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Segmento</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedLeadIds.includes(lead.id)}
                      onCheckedChange={() => toggleLeadSelection(lead.id)}
                    />
                  </td>
                  <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
                    <span className="font-medium text-foreground">{lead.companyName}</span>
                  </td>
                  <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
                    <LeadScoreBadge score={lead.score ?? 0} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" onClick={() => onViewLead(lead.id)}>
                    {lead.contactName || '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" onClick={() => onViewLead(lead.id)}>
                    {lead.phone || '-'}
                  </td>
                  <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3" onClick={() => onViewLead(lead.id)}>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Eliminar {selectedLeadIds.length} leads
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente los {selectedLeadIds.length} leads seleccionados junto con todas sus actividades y recordatorios asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar {selectedLeadIds.length} leads
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
