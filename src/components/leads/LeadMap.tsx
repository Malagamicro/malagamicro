import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Lead } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { Building2, Phone, Mail, MapPin, Loader2, AlertCircle, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface LeadMapProps {
  leads: Lead[];
  onViewLead: (id: string) => void;
  onBulkGeocode?: (leads: { id: string; address?: string; city?: string }[]) => void;
  isBulkGeocoding?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 36.7213,
  lng: -4.4214, // Málaga, Spain
};

const statusColors: Record<string, string> = {
  nuevo: '#3b82f6',      // blue
  contactado: '#f59e0b', // amber
  interesado: '#8b5cf6', // purple
  cliente: '#10b981',    // green
};

export function LeadMap({ leads, onViewLead, onBulkGeocode, isBulkGeocoding = false }: LeadMapProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Fetch API key from edge function
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        
        if (error) {
          console.error('Error fetching API key:', error);
          setKeyError('No se pudo cargar el mapa');
          return;
        }
        
        if (data?.apiKey) {
          setApiKey(data.apiKey);
        } else {
          setKeyError('API key no configurada');
        }
      } catch (err) {
        console.error('Error:', err);
        setKeyError('Error al conectar con el servidor');
      } finally {
        setIsLoadingKey(false);
      }
    };

    fetchApiKey();
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    
    // Fit bounds to show all leads with location
    const leadsWithLocation = leads.filter(l => l.latitude && l.longitude);
    if (leadsWithLocation.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      leadsWithLocation.forEach(lead => {
        if (lead.latitude && lead.longitude) {
          bounds.extend({ lat: lead.latitude, lng: lead.longitude });
        }
      });
      map.fitBounds(bounds);
      
      // Don't zoom in too much
      const listener = google.maps.event.addListener(map, 'idle', () => {
        const zoom = map.getZoom();
        if (zoom && zoom > 15) {
          map.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, [leads]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const leadsWithLocation = leads.filter(l => l.latitude && l.longitude);
  const leadsWithoutLocation = leads.filter(l => (!l.latitude || !l.longitude) && (l.address || l.city));

  const handleBulkGeocode = () => {
    if (onBulkGeocode && leadsWithoutLocation.length > 0) {
      onBulkGeocode(leadsWithoutLocation.map(l => ({
        id: l.id,
        address: l.address,
        city: l.city,
      })));
    }
  };

  if (isLoadingKey) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (keyError || loadError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-destructive font-medium">{keyError || 'Error al cargar el mapa'}</p>
          <p className="text-sm text-muted-foreground">
            Verifica que la API key de Google Maps esté configurada correctamente
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Inicializando Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative rounded-lg overflow-hidden border border-border">
      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Estado</p>
        <div className="space-y-1.5">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs capitalize">{status}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
          {leadsWithLocation.length} de {leads.length} leads con ubicación
        </p>
        {leadsWithoutLocation.length > 0 && onBulkGeocode && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-3 gap-2 text-xs"
            onClick={handleBulkGeocode}
            disabled={isBulkGeocoding}
          >
            {isBulkGeocoding ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Geocodificando...
              </>
            ) : (
              <>
                <MapPinned className="w-3 h-3" />
                Geocodificar {leadsWithoutLocation.length} leads
              </>
            )}
          </Button>
        )}
      </div>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {leadsWithLocation.map((lead) => (
          <Marker
            key={lead.id}
            position={{ lat: lead.latitude!, lng: lead.longitude! }}
            onClick={() => setSelectedLead(lead)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: statusColors[lead.status] || '#6b7280',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 10,
            }}
          />
        ))}

        {selectedLead && selectedLead.latitude && selectedLead.longitude && (
          <InfoWindow
            position={{ lat: selectedLead.latitude, lng: selectedLead.longitude }}
            onCloseClick={() => setSelectedLead(null)}
          >
            <Card className="border-0 shadow-none min-w-[250px]">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{selectedLead.companyName}</span>
                  </div>
                  <LeadScoreBadge score={selectedLead.score} />
                </div>

                <div className="flex items-center gap-2">
                  <LeadStatusBadge status={selectedLead.status} />
                  <span className="text-xs text-muted-foreground capitalize">
                    {selectedLead.segment}
                  </span>
                </div>

                {selectedLead.contactName && (
                  <p className="text-sm text-muted-foreground">{selectedLead.contactName}</p>
                )}

                <div className="space-y-1 text-xs text-muted-foreground">
                  {selectedLead.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      <span>{selectedLead.phone}</span>
                    </div>
                  )}
                  {selectedLead.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{selectedLead.email}</span>
                    </div>
                  )}
                  {selectedLead.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedLead.address}</span>
                    </div>
                  )}
                </div>

                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => onViewLead(selectedLead.id)}
                >
                  Ver detalle
                </Button>
              </CardContent>
            </Card>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
