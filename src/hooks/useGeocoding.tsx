import { supabase } from '@/integrations/supabase/client';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

export async function geocodeAddress(address?: string, city?: string): Promise<GeocodeResult | null> {
  if (!address && !city) {
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { address, city },
    });

    if (error) {
      console.error('Geocoding error:', error);
      return null;
    }

    if (data?.latitude && data?.longitude) {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        formattedAddress: data.formattedAddress,
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding failed:', error);
    return null;
  }
}
