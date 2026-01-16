import { useState } from 'react';
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
  AlertCircle
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
}

export function ProspectingPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('Málaga');
  const [category, setCategory] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingLeadId, setAddingLeadId] = useState<string | null>(null);
  const [isAddingAll, setIsAddingAll] = useState(false);
  
  const { addLead, isAddingLead } = useLeads();

  const handleSearch = async () => {
    if (!location.trim()) {
      toast.error('Por favor, introduce una ubicación');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setError(null);
    setResults([]);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('search-places', {
        body: {
          query: searchQuery,
          location: location,
          category: category,
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

      setResults(data.places || []);
      
      if (data.places?.length === 0) {
        toast.info('No se encontraron resultados para esta búsqueda');
      } else {
        toast.success(`Se encontraron ${data.places.length} empresas`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSearching(false);
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

  const handleAddAllToLeads = () => {
    const toAdd = results.slice(0, 10); // Limit to 10 at a time
    setIsAddingAll(true);
    let added = 0;
    let processed = 0;
    
    toAdd.forEach((place) => {
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
          added++;
          processed++;
          if (processed === toAdd.length) {
            toast.success(`${added} empresas añadidas a leads`);
            setResults(prev => prev.filter(p => !toAdd.some(t => t.id === p.id)));
            setIsAddingAll(false);
          }
        },
        onError: () => {
          processed++;
          if (processed === toAdd.length) {
            if (added > 0) {
              toast.success(`${added} empresas añadidas a leads`);
              setResults(prev => prev.filter(p => !toAdd.some(t => t.id === p.id)));
            }
            setIsAddingAll(false);
          }
        },
      });
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
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

        <div className="flex justify-end mt-6">
          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="gap-2"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Buscando en Google Maps...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Buscar Empresas
              </>
            )}
          </Button>
        </div>
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Resultados {results.length > 0 && `(${results.length})`}
            </h2>
            {results.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleAddAllToLeads}
                disabled={isAddingAll || isAddingLead}
              >
                <Plus className="w-4 h-4" />
                Añadir todos a Leads
              </Button>
            )}
          </div>

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
                  className="bg-card rounded-xl p-5 border border-border shadow-card hover:shadow-lg transition-all animate-slide-up"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
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
                      <div className="flex items-center gap-1 text-sm font-medium text-amber-500 flex-shrink-0">
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
                    {result.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {result.phone}
                      </p>
                    )}
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
