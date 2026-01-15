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
  Sparkles
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const businessCategories = [
  { value: 'all', label: 'Todas las categorías' },
  { value: 'restaurant', label: 'Restaurantes' },
  { value: 'retail', label: 'Comercio minorista' },
  { value: 'health', label: 'Salud (clínicas, farmacias)' },
  { value: 'professional', label: 'Servicios profesionales' },
  { value: 'franchise', label: 'Franquicias' },
];

interface MockResult {
  id: string;
  name: string;
  address: string;
  website?: string;
  phone?: string;
  category: string;
  rating?: number;
}

const mockResults: MockResult[] = [
  {
    id: '1',
    name: 'Óptica Visually',
    address: 'Calle Larios 15, Málaga',
    website: 'opticavisually.es',
    phone: '+34 952 123 456',
    category: 'retail',
    rating: 4.5,
  },
  {
    id: '2',
    name: 'Clínica Dental Plus',
    address: 'Av. de Andalucía 78, Málaga',
    website: 'clinicadentalplus.com',
    category: 'health',
    rating: 4.8,
  },
  {
    id: '3',
    name: 'Bufete Abogados Málaga',
    address: 'Plaza de la Marina 5, Málaga',
    website: 'bufetemalaga.es',
    phone: '+34 951 234 567',
    category: 'professional',
    rating: 4.2,
  },
  {
    id: '4',
    name: 'Telepizza Teatinos',
    address: 'C/ Louis Pasteur 12, Málaga',
    category: 'franchise',
    rating: 3.9,
  },
];

export function ProspectingPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('Málaga');
  const [category, setCategory] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<MockResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setResults(mockResults);
    setIsSearching(false);
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Prospección</h1>
        <p className="text-muted-foreground mt-1">
          Busca empresas y extrae contactos automáticamente
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
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Ubicación
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ciudad o zona"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
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
                Buscando...
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

      {/* Results */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Resultados {results.length > 0 && `(${results.length})`}
            </h2>
            {results.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2">
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
                      <div>
                        <h3 className="font-semibold text-foreground">{result.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {result.address}
                        </p>
                      </div>
                    </div>
                    {result.rating && (
                      <span className="text-sm font-medium text-amber-500">
                        ★ {result.rating}
                      </span>
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
                        {result.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {result.phone && (
                      <p className="flex items-center gap-2">
                        📞 {result.phone}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gap-1">
                      <Plus className="w-3 h-3" />
                      Añadir a Leads
                    </Button>
                    <Button variant="outline" size="sm">
                      <Globe className="w-4 h-4" />
                    </Button>
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
                Próximamente: Búsqueda avanzada con Google Maps
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Conectaremos con Google Maps y Firecrawl para buscar empresas automáticamente, 
                extraer datos de contacto de sus webs y añadirlos directamente a tu lista de leads.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
