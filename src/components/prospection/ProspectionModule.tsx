import { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Loader2, AlertCircle, Phone, Globe, Star,
  Building2, Plus, ChevronRight, Download, X, CheckCircle2,
  Smartphone, PhoneCall, Zap, Map, UserPlus, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLeads } from '@/hooks/useLeads';
import { Badge } from '@/components/ui/badge';
import ExcelJS from 'exceljs';
import { LeadFinderAgent } from './LeadFinderAgent';
import { ManualLeadEntry } from './ManualLeadEntry';

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  website?: string;
  phone?: string;
  phoneType?: 'mobile' | 'landline' | 'unknown';
  category: string;
  googleTypes?: string[];
  rating?: number;
  userRatingsTotal?: number;
  placeId: string;
  location?: { lat: number; lng: number };
}

const SECTORS = [
  { value: 'all', label: 'Todos los sectores' },
  { value: 'restaurant', label: '🍽️ Restaurantes' },
  { value: 'retail', label: '🏪 Tiendas / Retail' },
  { value: 'health', label: '🏥 Salud / Clínicas' },
  { value: 'professional', label: '💼 Servicios profesionales' },
  { value: 'franchise', label: '🏢 Franquicias' },
  { value: 'gym', label: '💪 Gimnasios' },
  { value: 'beauty', label: '💇 Peluquerías / Estética' },
  { value: 'automotive', label: '🔧 Talleres / Automóvil' },
  { value: 'education', label: '📚 Educación / Academias' },
  { value: 'hotel', label: '🏨 Hoteles / Alojamiento' },
  { value: 'tech', label: '💻 Tecnología / Informática' },
  { value: 'construction', label: '🏗️ Construcción / Reformas' },
  { value: 'real_estate', label: '🏠 Inmobiliarias' },
  { value: 'supermarket', label: '🛒 Supermercados' },
  { value: 'pharmacy', label: '💊 Farmacias' },
  { value: 'bakery', label: '🍞 Panaderías' },
  { value: 'dentist', label: '🦷 Dentistas' },
  { value: 'veterinary', label: '🐾 Veterinarios' },
  { value: 'laundry', label: '👕 Lavanderías' },
  { value: 'gas_station', label: '⛽ Gasolineras' },
];

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 36.7213, lng: -4.4214 };

const LIBRARIES: ("places")[] = ['places'];

function PhoneTypeBadge({ phoneType, phone }: { phoneType?: string; phone?: string }) {
  if (!phone) return null;
  
  if (phoneType === 'mobile') {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
        <Smartphone className="w-2.5 h-2.5 mr-0.5" /> Móvil
      </Badge>
    );
  }
  if (phoneType === 'landline') {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-border">
        <PhoneCall className="w-2.5 h-2.5 mr-0.5" /> Fijo
      </Badge>
    );
  }
  return null;
}

function ProspectionMap({ apiKey }: { apiKey: string }) {
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('Málaga');
  const [sector, setSector] = useState('all');
  const [radius, setRadius] = useState([5]);
  const [radiusEnabled, setRadiusEnabled] = useState(true);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [recursiveMode, setRecursiveMode] = useState(false);
  const [totalFetched, setTotalFetched] = useState(0);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const { addLead, leads } = useLeads();

  // Build sets for duplicate detection by placeId and name
  const existingPlaceIds = new Set(
    (leads || []).map((l: any) => l.google_place_id || l.googlePlaceId).filter(Boolean)
  );
  const existingLeadNames = new Set(
    (leads || []).map((l: any) => l.companyName?.toLowerCase().trim()).filter(Boolean)
  );

  const isLeadSaved = (place: PlaceResult) => 
    existingPlaceIds.has(place.placeId) || existingLeadNames.has(place.name?.toLowerCase().trim());

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
    geocoderRef.current = new google.maps.Geocoder();
  }, []);
  const onUnmount = useCallback(() => setMap(null), []);

  const geocodeLocation = useCallback(async (loc: string) => {
    if (!geocoderRef.current || !loc.trim()) return;
    setIsGeocodingLocation(true);
    try {
      const result = await geocoderRef.current.geocode({ address: loc });
      if (result.results?.[0]?.geometry?.location) {
        const pos = {
          lat: result.results[0].geometry.location.lat(),
          lng: result.results[0].geometry.location.lng(),
        };
        setMapCenter(pos);
        map?.panTo(pos);
        if (radiusEnabled) {
          const zoomForRadius = Math.round(14 - Math.log2(radius[0] / 2));
          map?.setZoom(Math.max(8, Math.min(16, zoomForRadius)));
        } else {
          map?.setZoom(13);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsGeocodingLocation(false);
    }
  }, [map, radius, radiusEnabled]);

  const handleSearch = async (pageToken?: string) => {
    setIsSearching(true);
    if (!pageToken && location.trim()) {
      await geocodeLocation(location);
    }
    try {
      const body: any = {
        query: query || undefined,
        location: location.trim() || undefined,
        category: sector,
        pageToken,
        recursive: recursiveMode && !pageToken,
      };

      // Use Google type filter when sector is selected
      if (sector && sector !== 'all') {
        body.googleType = sector;
      }

      if (!location.trim() && radiusEnabled) {
        body.lat = mapCenter.lat;
        body.lng = mapCenter.lng;
        body.radiusKm = radius[0];
      }
      const { data, error } = await supabase.functions.invoke('search-places', { body });

      if (error) throw error;

      const newPlaces = data?.places || [];
      if (pageToken) {
        setPlaces(prev => {
          // Deduplicate by placeId when appending
          const existingIds = new Set(prev.map(p => p.placeId));
          const unique = newPlaces.filter((p: PlaceResult) => !existingIds.has(p.placeId));
          return [...prev, ...unique];
        });
      } else {
        setPlaces(newPlaces);
      }
      setNextPageToken(data?.nextPageToken || null);
      setTotalFetched(data?.totalFetched || newPlaces.length);

      if (newPlaces.length > 0 && map && !pageToken) {
        const bounds = new google.maps.LatLngBounds();
        newPlaces.forEach((p: PlaceResult) => {
          if (p.location) bounds.extend(p.location);
        });
        if (!radiusEnabled) {
          map.fitBounds(bounds);
        }
      }

      if (newPlaces.length === 0 && !pageToken) {
        toast.info('No se encontraron resultados para esta búsqueda');
      } else if (recursiveMode && !pageToken) {
        toast.success(`${newPlaces.length} resultados obtenidos (paginación completa)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al buscar empresas');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAsLead = (place: PlaceResult) => {
    if (isLeadSaved(place)) {
      toast.error(`"${place.name}" ya está guardado como lead`);
      return;
    }
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
      googlePlaceId: place.placeId,
    } as any);
    toast.success(`${place.name} añadido como lead`);
    setTimeout(() => setAddingId(null), 500);
  };

  // Export to Excel
  const handleExport = async () => {
    const toExport = radiusEnabled ? filteredPlaces : places;
    if (toExport.length === 0) {
      toast.error('No hay resultados para exportar');
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Prospección');
      sheet.columns = [
        { header: 'Nombre', key: 'name', width: 30 },
        { header: 'Dirección', key: 'address', width: 40 },
        { header: 'Teléfono', key: 'phone', width: 18 },
        { header: 'Tipo Tel.', key: 'phoneType', width: 10 },
        { header: 'Web', key: 'website', width: 30 },
        { header: 'Valoración', key: 'rating', width: 12 },
        { header: 'Reseñas', key: 'reviews', width: 12 },
        { header: 'Categoría', key: 'category', width: 20 },
        { header: 'Google Place ID', key: 'placeId', width: 30 },
        { header: 'Latitud', key: 'lat', width: 14 },
        { header: 'Longitud', key: 'lng', width: 14 },
      ];
      sheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      });
      toExport.forEach(p => {
        sheet.addRow({
          name: p.name,
          address: p.address,
          phone: p.phone || '',
          phoneType: p.phoneType === 'mobile' ? 'Móvil' : p.phoneType === 'landline' ? 'Fijo' : '',
          website: p.website || '',
          rating: p.rating || '',
          reviews: p.userRatingsTotal || '',
          category: p.category,
          placeId: p.placeId,
          lat: p.location?.lat || '',
          lng: p.location?.lng || '',
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospeccion_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${toExport.length} empresas exportadas`);
    } catch {
      toast.error('Error al exportar');
    }
  };

  const handleExportCSV = () => {
    const toExport = radiusEnabled ? filteredPlaces : places;
    if (toExport.length === 0) {
      toast.error('No hay resultados para exportar');
      return;
    }
    const headers = ['Nombre', 'Dirección', 'Teléfono', 'Tipo Tel.', 'Web', 'Valoración', 'Reseñas', 'Categoría', 'Google Place ID', 'Latitud', 'Longitud'];
    const rows = toExport.map(p => [
      p.name, p.address, p.phone || '',
      p.phoneType === 'mobile' ? 'Móvil' : p.phoneType === 'landline' ? 'Fijo' : '',
      p.website || '', p.rating?.toString() || '', p.userRatingsTotal?.toString() || '',
      p.category, p.placeId, p.location?.lat?.toString() || '', p.location?.lng?.toString() || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospeccion_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${toExport.length} empresas exportadas`);
  };

  // Filter places by radius from center
  const filteredPlaces = !radiusEnabled ? places : places.filter(p => {
    if (!p.location) return true;
    const R = 6371;
    const dLat = (p.location.lat - mapCenter.lat) * Math.PI / 180;
    const dLng = (p.location.lng - mapCenter.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(mapCenter.lat * Math.PI / 180) * Math.cos(p.location.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d <= radius[0];
  });

  const handleCircleDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  };

  // Stats
  const mobileCount = filteredPlaces.filter(p => p.phoneType === 'mobile').length;
  const landlineCount = filteredPlaces.filter(p => p.phoneType === 'landline').length;
  const withPhoneCount = filteredPlaces.filter(p => p.phone).length;

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
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
              <div className="relative">
                <Input
                  placeholder="Ciudad o zona"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="h-9"
                />
                {isGeocodingLocation && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-2.5 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sector (Google Type)</label>
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Radio: {radiusEnabled ? `${radius[0]} km` : 'Sin límite'}
                </label>
                <Switch
                  checked={radiusEnabled}
                  onCheckedChange={setRadiusEnabled}
                  className="scale-75"
                />
              </div>
              <Slider
                value={radius}
                onValueChange={setRadius}
                min={1}
                max={100}
                step={1}
                className="py-2"
                disabled={!radiusEnabled}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={recursiveMode}
                  onCheckedChange={setRecursiveMode}
                  className="scale-75"
                />
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Máx. resultados
                </label>
              </div>
              <Button onClick={() => handleSearch()} disabled={isSearching} className="h-9 w-full">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                {recursiveMode ? 'Buscar todo' : 'Buscar'}
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-9 flex-1" onClick={handleExport} disabled={filteredPlaces.length === 0}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Excel
              </Button>
              <Button variant="outline" size="sm" className="h-9 flex-1" onClick={handleExportCSV} disabled={filteredPlaces.length === 0}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      {filteredPlaces.length > 0 && (
        <div className="flex flex-wrap gap-3 px-1">
          <Badge variant="secondary" className="text-xs">
            {filteredPlaces.length} resultados
          </Badge>
          {withPhoneCount > 0 && (
            <Badge variant="outline" className="text-xs">
              <Phone className="w-3 h-3 mr-1" /> {withPhoneCount} con teléfono
            </Badge>
          )}
          {mobileCount > 0 && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
              <Smartphone className="w-3 h-3 mr-1" /> {mobileCount} móviles
            </Badge>
          )}
          {landlineCount > 0 && (
            <Badge variant="outline" className="text-xs">
              <PhoneCall className="w-3 h-3 mr-1" /> {landlineCount} fijos
            </Badge>
          )}
          {filteredPlaces.filter(p => isLeadSaved(p)).length > 0 && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {filteredPlaces.filter(p => isLeadSaved(p)).length} ya guardados
            </Badge>
          )}
        </div>
      )}

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
              if (e.latLng && radiusEnabled) {
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
            {radiusEnabled && (
              <>
                <Circle
                  center={mapCenter}
                  radius={radius[0] * 1000}
                  draggable
                  onDragEnd={handleCircleDragEnd}
                  options={{
                    fillColor: 'hsl(var(--primary))',
                    fillOpacity: 0.08,
                    strokeColor: 'hsl(var(--primary))',
                    strokeOpacity: 0.3,
                    strokeWeight: 2,
                    clickable: true,
                    draggable: true,
                  }}
                />
                <Marker
                  position={mapCenter}
                  draggable
                  onDragEnd={(e) => {
                    if (e.latLng) {
                      setMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                    }
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: 'hsl(var(--primary))',
                    fillOpacity: 0.6,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                    scale: 8,
                  }}
                />
              </>
            )}
            {filteredPlaces.map(place => place.location && (
              <Marker
                key={place.id}
                position={place.location}
                onClick={() => setSelectedPlace(place)}
                icon={{
                  path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  fillColor: place.phoneType === 'mobile' ? '#22c55e' : '#ef4444',
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
                  {selectedPlace.phone && (
                    <div className="flex items-center gap-1 text-xs">
                      <span>{selectedPlace.phone}</span>
                      <span style={{ 
                        color: selectedPlace.phoneType === 'mobile' ? '#16a34a' : '#666',
                        fontWeight: 500 
                      }}>
                        ({selectedPlace.phoneType === 'mobile' ? '📱 Móvil' : selectedPlace.phoneType === 'landline' ? '☎️ Fijo' : ''})
                      </span>
                    </div>
                  )}
                  {isLeadSaved(selectedPlace) ? (
                    <div className="flex items-center gap-1.5 mt-1 px-3 py-1.5 text-xs rounded" style={{ background: '#16a34a22', color: '#16a34a' }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ya guardado como lead
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddAsLead(selectedPlace)}
                      style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded transition-opacity hover:opacity-90"
                    >
                      + Añadir como lead
                    </button>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          <div className="absolute top-3 left-3 z-10 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border">
            <p className="text-xs font-medium">
              {filteredPlaces.length} resultado{filteredPlaces.length !== 1 ? 's' : ''}{radiusEnabled ? ' en zona' : ''}
            </p>
            {radiusEnabled && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Arrastra el círculo para mover la zona
              </p>
            )}
          </div>
        </div>

        {/* Results list */}
        <div className="border border-border rounded-lg overflow-hidden flex flex-col bg-card">
          <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Empresas encontradas</h3>
              <p className="text-xs text-muted-foreground">{filteredPlaces.length} resultados</p>
            </div>
            {filteredPlaces.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
                <Download className="w-3 h-3" /> Exportar
              </Button>
            )}
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
                <p className="text-sm text-muted-foreground mt-2">
                  {recursiveMode ? 'Obteniendo todos los resultados...' : 'Buscando...'}
                </p>
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
                        {isLeadSaved(place) && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30 shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Guardado
                          </Badge>
                        )}
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
                        <PhoneTypeBadge phoneType={place.phoneType} phone={place.phone} />
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
                    {isLeadSaved(place) ? (
                      <div className="h-7 w-7 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                    ) : (
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
                    )}
                </div>
              </div>
            ))}
          </div>
          {nextPageToken && !recursiveMode && (
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
