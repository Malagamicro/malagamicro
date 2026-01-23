import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  MapPin, 
  Globe, 
  Building2, 
  Loader2,
  ExternalLink,
  Plus,
  Sparkles,
  Phone,
  Star,
  AlertCircle,
  Zap,
  Info,
  Smartphone,
  PhoneCall
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { analyzeSpanishPhone, PhoneType } from '@/lib/phoneEnrichment';
import { Badge } from '@/components/ui/badge';

const businessCategories = [
  { value: 'all', label: 'Todas las categorías' },
  { value: 'restaurant', label: 'Restaurantes' },
  { value: 'retail', label: 'Comercio minorista' },
  { value: 'health', label: 'Salud (clínicas, farmacias)' },
  { value: 'professional', label: 'Servicios profesionales' },
  { value: 'franchise', label: 'Franquicias' },
  { value: 'gym', label: 'Gimnasios' },
  { value: 'beauty', label: 'Peluquerías y estética' },
  { value: 'automotive', label: 'Automoción' },
];

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  website?: string;
  phone?: string;
  category: string;
  rating?: number;
  userRatingsTotal?: number;
  placeId: string;
  location?: {
    lat: number;
    lng: number;
  };
  // Computed phone type
  phoneType?: PhoneType;
}

// Helper to get phone type indicator
function getPhoneIndicator(phone?: string): { icon: React.ReactNode; label: string; color: string; type: PhoneType } {
  if (!phone) return { icon: <Phone className="w-4 h-4" />, label: 'Sin teléfono', color: 'text-muted-foreground', type: 'unknown' };
  
  const type = analyzeSpanishPhone(phone);
  
  switch (type) {
    case 'mobile':
      return { 
        icon: <Smartphone className="w-4 h-4" />, 
        label: 'Móvil (WhatsApp potencial)', 
        color: 'text-green-600', 
        type 
      };
    case 'landline':
      return { 
        icon: <PhoneCall className="w-4 h-4" />, 
        label: 'Fijo (sin WhatsApp)', 
        color: 'text-amber-600', 
        type 
      };
    default:
      return { 
        icon: <Phone className="w-4 h-4" />, 
        label: 'Tipo desconocido', 
        color: 'text-muted-foreground', 
        type 
      };
  }
}

export function ProspectingPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('Málaga');
  const [category, setCategory] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingLeadId, setAddingLeadId] = useState<string | null>(null);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Deep Search Mode
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);
  const [deepSearchProgress, setDeepSearchProgress] = useState(0);
  const [deepSearchStatus, setDeepSearchStatus] = useState('');
  
  const { user } = useAuth();
  const { addLead, importLeads, isAddingLead, isImportingLeads } = useLeads();

  // Toggle selection for a single result
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const handleSearch = async (isLoadMore = false) => {
    if (!location.trim()) {
      toast.error('Por favor, introduce una ubicación');
      return;
    }

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setHasSearched(true);
      setError(null);
      setResults([]);
      setNextPageToken(null);
      setDeepSearchProgress(0);
      setDeepSearchStatus('');
    }
    
    try {
      // If Deep Search is enabled and NOT loading more, do grid search
      if (deepSearchEnabled && !isLoadMore) {
        await handleDeepSearch();
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('search-places', {
        body: {
          query: searchQuery,
          location: location,
          category: category,
          pageToken: isLoadMore ? nextPageToken : undefined,
        },
      });

      if (fnError) {
        console.error('Edge function error:', fnError);
        setError('Error al buscar empresas. Inténtalo de nuevo.');
        return;
      }

      if (data.error) {
        console.error('API error:', data.error, data.details);
        setError(data.details || data.error);
        return;
      }

      const newPlaces = data.places || [];
      
      if (isLoadMore) {
        setResults(prev => [...prev, ...newPlaces]);
        toast.success(`Se cargaron ${newPlaces.length} empresas más`);
      } else {
        setResults(newPlaces);
        if (newPlaces.length === 0) {
          toast.info('No se encontraron resultados para esta búsqueda');
        } else {
          toast.success(`Se encontraron ${newPlaces.length} empresas`);
        }
      }
      
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error('Search error:', err);
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  // Deep Search: Grid Search Strategy (2x2 grid = 4 searches)
  const handleDeepSearch = async () => {
    setDeepSearchProgress(0);
    setDeepSearchStatus('Iniciando búsqueda profunda...');
    
    // Create 4 sub-zone queries by appending directional modifiers
    const subZones = [
      `${location} norte`,
      `${location} sur`,
      `${location} este`,
      `${location} oeste`,
    ];

    const allResults = new Map<string, PlaceResult>();
    let completedZones = 0;

    try {
      // Execute all 4 searches in parallel
      const searchPromises = subZones.map(async (zone, index) => {
        setDeepSearchStatus(`Escaneando cuadrante ${index + 1} de 4...`);
        
        const { data, error: fnError } = await supabase.functions.invoke('search-places', {
          body: {
            query: searchQuery,
            location: zone,
            category: category,
            deepSearch: true,
          },
        });

        completedZones++;
        setDeepSearchProgress((completedZones / 4) * 100);

        if (fnError || data?.error) {
          console.warn(`Error in zone ${zone}:`, fnError || data?.error);
          return [];
        }

        return data?.places || [];
      });

      const resultsArrays = await Promise.allSettled(searchPromises);
      
      // Deduplicate by placeId
      resultsArrays.forEach((result) => {
        if (result.status === 'fulfilled') {
          result.value.forEach((place: PlaceResult) => {
            if (!allResults.has(place.placeId)) {
              allResults.set(place.placeId, place);
            }
          });
        }
      });

      const deduplicatedResults = Array.from(allResults.values());
      setResults(deduplicatedResults);
      
      if (deduplicatedResults.length === 0) {
        toast.info('No se encontraron resultados en la búsqueda profunda');
      } else {
        toast.success(`Búsqueda profunda: ${deduplicatedResults.length} empresas encontradas (4 cuadrantes)`);
      }
      
      setNextPageToken(null); // No pagination in deep search
      setDeepSearchStatus('');
    } catch (err) {
      console.error('Deep search error:', err);
      setError('Error en la búsqueda profunda. Inténtalo de nuevo.');
    } finally {
      setIsSearching(false);
      setDeepSearchProgress(0);
    }
  };

  const handleAddToLeads = (place: PlaceResult) => {
    setAddingLeadId(place.id);
    
    // Extract city from address (usually after last comma)
    const addressParts = place.address.split(',');
    const city = addressParts.length > 1 
      ? addressParts[addressParts.length - 2]?.trim() || 'Málaga'
      : 'Málaga';

    addLead({
      companyName: place.name,
      address: place.address,
      city: city,
      phone: place.phone || undefined,
      website: place.website ? `https://${place.website}` : undefined,
      source: 'google_maps',
      status: 'nuevo',
      segment: 'pyme',
      latitude: place.location?.lat,
      longitude: place.location?.lng,
      notes: place.rating ? `Rating: ${place.rating}/5 (${place.userRatingsTotal || 0} reseñas)` : undefined,
    }, {
      onSuccess: () => {
        toast.success(`${place.name} añadido a leads`);
        setResults(prev => prev.filter(p => p.id !== place.id));
        setAddingLeadId(null);
      },
      onError: () => {
        toast.error('Error al añadir el lead');
        setAddingLeadId(null);
      },
    });
  };

  // OPTIMIZED: Bulk insert using importLeads (single DB call)
  const handleAddAllToLeads = () => {
    // Get selected results, or all results if none selected
    const toAdd = selectedIds.size > 0 
      ? results.filter(r => selectedIds.has(r.id))
      : results;
    
    if (toAdd.length === 0) {
      toast.error('No hay empresas seleccionadas para añadir');
      return;
    }
    
    setIsAddingAll(true);
    
    // Format all leads for bulk insert
    const leadsToInsert = toAdd.map(place => {
      const addressParts = place.address.split(',');
      const city = addressParts.length > 1 
        ? addressParts[addressParts.length - 2]?.trim() || 'Málaga'
        : 'Málaga';
      
      return {
        companyName: place.name,
        address: place.address,
        city: city,
        phone: place.phone || undefined,
        website: place.website ? `https://${place.website}` : undefined,
        source: 'google_maps' as const,
        status: 'nuevo' as const,
        segment: 'pyme' as const,
        latitude: place.location?.lat,
        longitude: place.location?.lng,
        notes: place.rating ? `Rating: ${place.rating}/5 (${place.userRatingsTotal || 0} reseñas)` : undefined,
      };
    });
    
    // Single bulk insert call
    importLeads(leadsToInsert, {
      onSuccess: () => {
        toast.success(`${leadsToInsert.length} empresas añadidas a leads`);
        // Remove added results from the list
        const addedIds = new Set(toAdd.map(p => p.id));
        setResults(prev => prev.filter(p => !addedIds.has(p.id)));
        setSelectedIds(new Set());
        setIsAddingAll(false);
      },
      onError: (error) => {
        console.error('Bulk insert error:', error);
        toast.error('Error al añadir las empresas. Inténtalo de nuevo.');
        setIsAddingAll(false);
      },
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(false);
    }
  };

  const handleLoadMore = () => {
    handleSearch(true);
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Prospección</h1>
        <p className="text-muted-foreground mt-1">
          Busca empresas reales en Google Maps y añádelas a tu lista de leads
        </p>
      </div>

      {/* Search Panel */}
      <div className="bg-card rounded-xl p-6 border border-border shadow-card">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">
            Buscador de Empresas
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              ¿Qué buscas?
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ej: tiendas de ropa, restaurantes, clínicas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Ubicación / Código Postal
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ciudad, zona o CP"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Categoría
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businessCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Deep Search Toggle */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Switch
              id="deep-search"
              checked={deepSearchEnabled}
              onCheckedChange={setDeepSearchEnabled}
            />
            <Label htmlFor="deep-search" className="flex items-center gap-2 cursor-pointer">
              <Zap className={`w-4 h-4 ${deepSearchEnabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className={deepSearchEnabled ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                Búsqueda Profunda (4x)
              </span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Divide la zona en 4 cuadrantes para encontrar hasta 400% más resultados. Consume más cuota de API.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <Button 
            onClick={() => handleSearch(false)} 
            disabled={isSearching}
            className="gap-2"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {deepSearchEnabled ? 'Búsqueda profunda...' : 'Buscando...'}
              </>
            ) : (
              <>
                {deepSearchEnabled ? <Zap className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                {deepSearchEnabled ? 'Búsqueda Profunda' : 'Buscar Empresas'}
              </>
            )}
          </Button>
        </div>
        
        {/* Deep Search Progress */}
        {isSearching && deepSearchEnabled && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{deepSearchStatus}</span>
              <span className="font-medium">{Math.round(deepSearchProgress)}%</span>
            </div>
            <Progress value={deepSearchProgress} className="h-2" />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Error en la búsqueda</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                Resultados {results.length > 0 && `(${results.length})`}
              </h2>
              {selectedIds.size > 0 && (
                <span className="text-sm text-primary font-medium">
                  {selectedIds.size} seleccionados
                </span>
              )}
            </div>
            {results.length > 0 && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleSelectAll}
                  className="gap-2"
                >
                  <Checkbox 
                    checked={selectedIds.size === results.length && results.length > 0}
                    className="pointer-events-none"
                  />
                  {selectedIds.size === results.length ? 'Deseleccionar' : 'Seleccionar'} todos
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleAddAllToLeads}
                  disabled={isAddingAll || isImportingLeads}
                >
                  {isAddingAll || isImportingLeads ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando {selectedIds.size > 0 ? selectedIds.size : results.length}...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Añadir {selectedIds.size > 0 ? `${selectedIds.size} seleccionados` : 'todos'} a Leads
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Phone Quality Summary */}
          {results.length > 0 && (() => {
            const phoneStats = results.reduce((acc, r) => {
              if (!r.phone) {
                acc.noPhone++;
              } else {
                const type = analyzeSpanishPhone(r.phone);
                if (type === 'mobile') acc.mobile++;
                else if (type === 'landline') acc.landline++;
                else acc.unknown++;
              }
              return acc;
            }, { mobile: 0, landline: 0, unknown: 0, noPhone: 0 });
            
            const total = results.length;
            const mobilePercent = Math.round((phoneStats.mobile / total) * 100);
            
            return (
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-green-600">
                    <Smartphone className="w-4 h-4" />
                    <span className="font-medium">{phoneStats.mobile}</span> móviles
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <PhoneCall className="w-4 h-4" />
                    <span className="font-medium">{phoneStats.landline}</span> fijos
                  </span>
                  {phoneStats.noPhone > 0 && (
                    <span className="text-muted-foreground">
                      {phoneStats.noPhone} sin teléfono
                    </span>
                  )}
                </div>
                <div className="text-sm">
                  <span className={`font-medium ${mobilePercent >= 50 ? 'text-green-600' : mobilePercent >= 25 ? 'text-amber-600' : 'text-destructive'}`}>
                    {mobilePercent}% WhatsApp-ready
                  </span>
                </div>
              </div>
            );
          })()}

          {results.length === 0 && !isSearching ? (
            <div className="bg-card rounded-xl p-12 border border-border text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No se encontraron resultados</h3>
              <p className="text-muted-foreground mt-1">
                Intenta con otros términos de búsqueda o ubicación
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((result) => (
                <div
                  key={result.id}
                  className={`bg-card rounded-xl p-5 border shadow-card hover:shadow-lg transition-all animate-slide-up cursor-pointer ${
                    selectedIds.has(result.id) 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-border'
                  }`}
                  onClick={() => toggleSelection(result.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={selectedIds.has(result.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleSelection(result.id)}
                        className="flex-shrink-0"
                      />
                      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{result.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{result.address}</span>
                        </p>
                      </div>
                    </div>
                    {result.rating && (
                      <div className="flex items-center gap-1 text-sm font-medium text-accent flex-shrink-0">
                        <Star className="w-4 h-4 fill-current" />
                        {result.rating}
                        {result.userRatingsTotal && (
                          <span className="text-muted-foreground font-normal">
                            ({result.userRatingsTotal})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
                    {result.website && (
                      <a 
                        href={`https://${result.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Globe className="w-4 h-4" />
                        <span className="truncate">{result.website}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    )}
                    {result.phone && (() => {
                      const phoneInfo = getPhoneIndicator(result.phone);
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className={`flex items-center gap-2 ${phoneInfo.color}`}>
                                {phoneInfo.icon}
                                <span>{result.phone}</span>
                                {phoneInfo.type === 'mobile' && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    📱 WhatsApp
                                  </Badge>
                                )}
                                {phoneInfo.type === 'landline' && (
                                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    ☎️ Fijo
                                  </Badge>
                                )}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{phoneInfo.label}</p>
                              {phoneInfo.type === 'landline' && result.website && (
                                <p className="text-xs text-muted-foreground">
                                  Al añadir, buscaremos móvil en su web
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                    {!result.website && !result.phone && (
                      <p className="text-muted-foreground/60 italic">
                        Sin datos de contacto disponibles
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => handleAddToLeads(result)}
                      disabled={addingLeadId === result.id}
                    >
                      {addingLeadId === result.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Añadir a Leads
                    </Button>
                    {result.website && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        asChild
                      >
                        <a 
                          href={`https://${result.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Load More Button */}
          {results.length > 0 && nextPageToken && (
            <div className="flex justify-center mt-6">
              <Button 
                variant="outline" 
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando más empresas...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Cargar más resultados
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      {!hasSearched && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
              <Search className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Búsqueda con Google Maps
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Busca empresas reales por nombre, categoría, ciudad o código postal. 
                Los resultados incluyen dirección, teléfono, web y valoraciones. 
                Añade las que te interesen directamente a tu lista de leads.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
