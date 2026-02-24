import { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Search, Loader2, AlertCircle, MapPin, Phone, Globe, Star,
  Building2, Plus, ExternalLink, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLeads } from '@/hooks/useLeads';

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
  location?: { lat: number; lng: number };
}

const SECTORS = [
  { value: 'all', label: 'Todos los sectores' },
  { value: 'restaurant', label: 'Restaurantes' },
  { value: 'retail', label: 'Tiendas / Retail' },
  { value: 'health', label: 'Salud / Clínicas' },
  { value: 'professional', label: 'Servicios profesionales' },
  { value: 'franchise', label: 'Franquicias' },
  { value: 'gym', label: 'Gimnasios' },
  { value: 'beauty', label: 'Peluquerías / Estética' },
  { value: 'automotive', label: 'Talleres / Automóvil' },
];

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 36.7213, lng: -4.4214 };

function ProspectionMap({ apiKey }: { apiKey: string }) {
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('Málaga');
  const [sector, setSector] = useState('all');
  const [radius, setRadius] = useState([5]); // km
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const { addLead, isAddingLead } = useLeads();

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  const handleSearch = async (pageToken?: string) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-places', {
        body: {
          query: query || undefined,
          location,
          category: sector,
          pageToken,
        },
      });

      if (error) throw error;

      const newPlaces = data?.places || [];
      if (pageToken) {
        setPlaces(prev => [...prev, ...newPlaces]);
      } else {
        setPlaces(newPlaces);
      }
      setNextPageToken(data?.nextPageToken || null);

      // Fit map to results
      if (newPlaces.length > 0 && map && !pageToken) {
        const bounds = new google.maps.LatLngBounds();
        newPlaces.forEach((p: PlaceResult) => {
          if (p.location) bounds.extend(p.location);
        });
        map.fitBounds(bounds);
      }

      if (newPlaces.length === 0 && !pageToken) {
        toast.info('No se encontraron resultados para esta búsqueda');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al buscar empresas');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAsLead = (place: PlaceResult) => {
    setAddingId(place.id);
    addLead({
      companyName: place.name,
      address: place.address,
      city: location || 'Málaga',
      phone: place.phone || '',
      website: place.website || '',
      source: 'google_maps',
      status: 'nuevo',
      segment: 'pyme',
      latitude: place.location?.lat,
      longitude: place.location?.lng,
    } as any);
    toast.success(`${place.name} añadido como lead`);
    setTimeout(() => setAddingId(null), 500);
  };

  // Filter places by radius from center
  const filteredPlaces = places.filter(p => {
    if (!p.location) return true;
    const R = 6371; // Earth's radius in km
    const dLat = (p.location.lat - mapCenter.lat) * Math.PI / 180;
    const dLng = (p.location.lng - mapCenter.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(mapCenter.lat * Math.PI / 180) * Math.cos(p.location.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d <= radius[0];
  });

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg min-h-[400px]">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-destructive font-medium">Error al cargar el mapa</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search controls */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Buscar</label>
              <Input
                placeholder="Ej: clínicas, bares..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
              <Input
                placeholder="Ciudad o zona"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sector</label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Radio: {radius[0]} km</label>
              <Slider
                value={radius}
                onValueChange={setRadius}
                min={1}
                max={50}
                step={1}
                className="py-2"
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={isSearching} className="h-9">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Map + Results */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        {/* Map */}
        <div className="lg:col-span-2 rounded-lg overflow-hidden border border-border relative">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={13}
            onLoad={onLoad}
            onUnmount={onUnmount}
            onClick={(e) => {
              if (e.latLng) {
                setMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }
            }}
            options={{
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
            }}
          >
            <Circle
              center={mapCenter}
              radius={radius[0] * 1000}
              options={{
                fillColor: 'hsl(var(--primary))',
                fillOpacity: 0.08,
                strokeColor: 'hsl(var(--primary))',
                strokeOpacity: 0.3,
                strokeWeight: 2,
              }}
            />
            {filteredPlaces.map(place => place.location && (
              <Marker
                key={place.id}
                position={place.location}
                onClick={() => setSelectedPlace(place)}
                icon={{
                  path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  fillColor: '#ef4444',
                  fillOpacity: 0.9,
                  strokeColor: '#fff',
                  strokeWeight: 1.5,
                  scale: 5,
                }}
              />
            ))}
            {selectedPlace?.location && (
              <InfoWindow
                position={selectedPlace.location}
                onCloseClick={() => setSelectedPlace(null)}
              >
                <div className="min-w-[220px] p-1 space-y-2">
                  <p className="font-semibold text-sm">{selectedPlace.name}</p>
                  <p className="text-xs" style={{ color: '#666' }}>{selectedPlace.address}</p>
                  {selectedPlace.rating && (
                    <div className="flex items-center gap-1 text-xs">
                      <Star className="w-3 h-3" style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                      <span>{selectedPlace.rating}</span>
                      <span style={{ color: '#999' }}>({selectedPlace.userRatingsTotal})</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleAddAsLead(selectedPlace)}
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded transition-opacity hover:opacity-90"
                  >
                    + Añadir como lead
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Results count overlay */}
          <div className="absolute top-3 left-3 z-10 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border">
            <p className="text-xs font-medium">
              {filteredPlaces.length} resultado{filteredPlaces.length !== 1 ? 's' : ''} en zona
            </p>
          </div>
        </div>

        {/* Results list */}
        <div className="border border-border rounded-lg overflow-hidden flex flex-col bg-card">
          <div className="p-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">Empresas encontradas</h3>
            <p className="text-xs text-muted-foreground">{filteredPlaces.length} resultados</p>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-border">
            {filteredPlaces.length === 0 && !isSearching && (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Busca empresas por zona y sector</p>
              </div>
            )}
            {isSearching && places.length === 0 && (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Buscando...</p>
              </div>
            )}
            {filteredPlaces.map(place => (
              <div
                key={place.id}
                className="p-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => {
                  setSelectedPlace(place);
                  if (place.location && map) {
                    map.panTo(place.location);
                    map.setZoom(16);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <p className="text-sm font-medium truncate">{place.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{place.address}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {place.rating && (
                        <div className="flex items-center gap-0.5 text-xs">
                          <Star className="w-3 h-3 text-warning fill-warning" />
                          <span>{place.rating}</span>
                        </div>
                      )}
                      {place.phone && (
                        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <span>{place.phone}</span>
                        </div>
                      )}
                      {place.website && (
                        <a
                          href={`https://${place.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                        >
                          <Globe className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{place.website}</span>
                        </a>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => { e.stopPropagation(); handleAddAsLead(place); }}
                    disabled={addingId === place.id}
                  >
                    {addingId === place.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {nextPageToken && (
            <div className="p-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleSearch(nextPageToken)}
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                Cargar más resultados
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProspectionModule() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        if (error) { setKeyError('No se pudo cargar el mapa'); return; }
        if (data?.apiKey) setApiKey(data.apiKey);
        else setKeyError('API key no configurada');
      } catch { setKeyError('Error al conectar'); }
      finally { setIsLoadingKey(false); }
    };
    fetchApiKey();
  }, []);

  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (keyError || !apiKey) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-destructive font-medium">{keyError}</p>
        </div>
      </div>
    );
  }

  return <ProspectionMap apiKey={apiKey} />;
}
