import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function analyzeSpanishPhone(phone: string): 'mobile' | 'landline' | 'unknown' {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('34')) clean = clean.substring(2);
  if (clean.length === 9) {
    const first = clean[0];
    if (first === '6' || first === '7') return 'mobile';
    if (first === '8' || first === '9') return 'landline';
  }
  return 'unknown';
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  timeoutMs = 3000
): Promise<{ phone?: string; website?: string; phoneType?: 'mobile' | 'landline' | 'unknown' }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'formatted_phone_number,website,international_phone_number');
    url.searchParams.set('key', apiKey);
    const response = await fetch(url.toString(), { signal: controller.signal });
    const data = await response.json();
    if (data.status === 'OK' && data.result) {
      let website = data.result.website;
      if (website) website = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const phone = data.result.formatted_phone_number || data.result.international_phone_number;
      return {
        phone,
        website,
        phoneType: phone ? analyzeSpanishPhone(phone) : undefined,
      };
    }
    return {};
  } catch {
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}

// Recursive fetch: gets all pages (up to maxPages) automatically
async function fetchAllPages(
  baseUrl: URL,
  apiKey: string,
  maxPages: number
): Promise<{ results: any[]; totalPages: number }> {
  const allResults: any[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const url = new URL(baseUrl.toString());
    if (pageToken) {
      url.searchParams.set('pagetoken', pageToken);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      break;
    }

    const results = data.results || [];
    allResults.push(...results);
    pageCount++;

    if (!data.next_page_token) break;

    // Google requires a short delay before using next_page_token
    pageToken = data.next_page_token;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return { results: allResults, totalPages: pageCount };
}

// Map sector values to Google Place types
const SECTOR_TO_GOOGLE_TYPE: Record<string, string> = {
  'restaurant': 'restaurant',
  'retail': 'store',
  'health': 'health',
  'professional': 'accounting',
  'franchise': 'shopping_mall',
  'gym': 'gym',
  'beauty': 'beauty_salon',
  'automotive': 'car_repair',
  'education': 'school',
  'hotel': 'lodging',
  'tech': 'electronics_store',
  'construction': 'general_contractor',
  'real_estate': 'real_estate_agency',
  'supermarket': 'supermarket',
  'pharmacy': 'pharmacy',
  'bakery': 'bakery',
  'dentist': 'dentist',
  'veterinary': 'veterinary_care',
  'laundry': 'laundry',
  'gas_station': 'gas_station',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { query, location, category, pageToken, lat, lng, radiusKm, googleType, recursive } = await req.json();

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search query
    let searchQuery = query || '';
    if (category && category !== 'all' && !googleType) {
      const categoryMap: Record<string, string> = {
        'restaurant': 'restaurante',
        'retail': 'tienda',
        'health': 'clinica OR farmacia OR médico',
        'professional': 'abogados OR consultoría OR asesoría',
        'franchise': 'franquicia',
        'gym': 'gimnasio',
        'beauty': 'peluquería OR estética OR spa',
        'automotive': 'taller mecánico OR concesionario',
        'education': 'academia OR colegio',
        'hotel': 'hotel OR alojamiento',
        'tech': 'informática OR tecnología',
        'construction': 'construcción OR reformas',
        'real_estate': 'inmobiliaria',
      };
      searchQuery = categoryMap[category] || searchQuery;
    }

    const useCoordinates = lat && lng && !location?.trim();
    const isGlobalSearch = !location?.trim() && !useCoordinates;

    let fullQuery: string;
    if (useCoordinates) {
      fullQuery = searchQuery || 'empresa';
    } else if (isGlobalSearch) {
      fullQuery = searchQuery || 'empresa';
    } else {
      fullQuery = `${searchQuery} en ${location}`;
    }

    console.log('Search:', fullQuery, googleType ? `type=${googleType}` : '', recursive ? 'RECURSIVE' : '');

    // Build Text Search URL
    const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    textSearchUrl.searchParams.set('query', fullQuery);
    textSearchUrl.searchParams.set('key', apiKey);
    textSearchUrl.searchParams.set('language', 'es');
    textSearchUrl.searchParams.set('region', 'es');

    // Apply Google Place type filter
    if (googleType && SECTOR_TO_GOOGLE_TYPE[googleType]) {
      textSearchUrl.searchParams.set('type', SECTOR_TO_GOOGLE_TYPE[googleType]);
    }

    if (useCoordinates) {
      textSearchUrl.searchParams.set('location', `${lat},${lng}`);
      textSearchUrl.searchParams.set('radius', String(Math.min((radiusKm || 5) * 1000, 50000)));
    }

    let rawResults: any[];
    let nextPageTokenOut: string | null = null;

    if (recursive) {
      // Recursive mode: fetch all pages (max 3 = up to 60 results)
      const { results } = await fetchAllPages(textSearchUrl, apiKey, 3);
      rawResults = results;
    } else if (pageToken) {
      // Manual pagination with existing token
      textSearchUrl.searchParams.set('pagetoken', pageToken);
      const response = await fetch(textSearchUrl.toString());
      const data = await response.json();
      rawResults = data.results || [];
      nextPageTokenOut = data.next_page_token || null;
    } else {
      // Single page
      const response = await fetch(textSearchUrl.toString());
      const data = await response.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return new Response(
          JSON.stringify({ error: `Google Places API error: ${data.status}`, details: data.error_message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      rawResults = data.results || [];
      nextPageTokenOut = data.next_page_token || null;
    }

    // Deduplicate by place_id
    const seen = new Set<string>();
    const uniqueResults = rawResults.filter((r: any) => {
      if (seen.has(r.place_id)) return false;
      seen.add(r.place_id);
      return true;
    });

    // Fetch details in parallel (limit to 20 at a time for rate limits)
    const BATCH_SIZE = 20;
    const places: PlaceResult[] = [];

    for (let i = 0; i < uniqueResults.length; i += BATCH_SIZE) {
      const batch = uniqueResults.slice(i, i + BATCH_SIZE);
      const detailsResults = await Promise.allSettled(
        batch.map((place: any) => fetchPlaceDetails(place.place_id, apiKey))
      );

      batch.forEach((place: any, idx: number) => {
        const detailsResult = detailsResults[idx];
        const details = detailsResult.status === 'fulfilled' ? detailsResult.value : {};
        places.push({
          id: place.place_id,
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          category: place.types?.[0] || 'business',
          googleTypes: place.types || [],
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          phone: details.phone,
          phoneType: details.phoneType,
          website: details.website,
          location: place.geometry?.location ? {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          } : undefined,
        });
      });
    }

    console.log('Returning', places.length, 'places');

    return new Response(
      JSON.stringify({
        places,
        nextPageToken: nextPageTokenOut,
        totalFetched: uniqueResults.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-places:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
