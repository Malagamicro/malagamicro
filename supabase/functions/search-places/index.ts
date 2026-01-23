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
  category: string;
  rating?: number;
  userRatingsTotal?: number;
  placeId: string;
  location?: {
    lat: number;
    lng: number;
  };
}

// Fetch place details with timeout
async function fetchPlaceDetails(
  placeId: string, 
  apiKey: string, 
  timeoutMs = 3000
): Promise<{ phone?: string; website?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', placeId);
    detailsUrl.searchParams.set('fields', 'formatted_phone_number,website,international_phone_number');
    detailsUrl.searchParams.set('key', apiKey);
    
    const response = await fetch(detailsUrl.toString(), { signal: controller.signal });
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      let website = data.result.website;
      if (website) {
        website = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
      }
      return {
        phone: data.result.formatted_phone_number || data.result.international_phone_number,
        website,
      };
    }
    return {};
  } catch (error) {
    // Timeout or network error - return empty details
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
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
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Please log in' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const { query, location, category, pageToken } = await req.json();
    
    console.log('Search request:', { query, location, category, pageToken: pageToken ? 'yes' : 'no' });
    
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the search query
    let searchQuery = query || '';
    if (category && category !== 'all') {
      const categoryMap: Record<string, string> = {
        'restaurant': 'restaurante',
        'retail': 'tienda',
        'health': 'clinica OR farmacia OR médico',
        'professional': 'abogados OR consultoría OR asesoría',
        'franchise': 'franquicia',
        'gym': 'gimnasio',
        'beauty': 'peluquería OR estética OR spa',
        'automotive': 'taller mecánico OR concesionario',
      };
      searchQuery = categoryMap[category] || searchQuery;
    }
    
    // Add location to query
    const fullQuery = `${searchQuery} en ${location || 'Málaga'}`;
    
    console.log('Searching for:', fullQuery);

    // Build Text Search URL
    const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    textSearchUrl.searchParams.set('query', fullQuery);
    textSearchUrl.searchParams.set('key', apiKey);
    textSearchUrl.searchParams.set('language', 'es');
    textSearchUrl.searchParams.set('region', 'es');
    
    // If we have a page token, use it to get next page
    if (pageToken) {
      textSearchUrl.searchParams.set('pagetoken', pageToken);
    }

    const textSearchResponse = await fetch(textSearchUrl.toString());
    const textSearchData = await textSearchResponse.json();
    
    console.log('Text search status:', textSearchData.status);
    console.log('Results count:', textSearchData.results?.length || 0);
    console.log('Has next page:', !!textSearchData.next_page_token);

    if (textSearchData.status !== 'OK' && textSearchData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', textSearchData.status, textSearchData.error_message);
      return new Response(
        JSON.stringify({ 
          error: `Google Places API error: ${textSearchData.status}`,
          details: textSearchData.error_message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process up to 20 results
    const placesToProcess = (textSearchData.results || []).slice(0, 20);
    
    // OPTIMIZATION: Fetch all place details in PARALLEL with Promise.allSettled
    console.log(`Fetching details for ${placesToProcess.length} places in parallel...`);
    
    const detailsPromises = placesToProcess.map((place: any) => 
      fetchPlaceDetails(place.place_id, apiKey)
    );
    
    const detailsResults = await Promise.allSettled(detailsPromises);
    
    // Build places array with details
    const places: PlaceResult[] = placesToProcess.map((place: any, index: number) => {
      const detailsResult = detailsResults[index];
      const details = detailsResult.status === 'fulfilled' ? detailsResult.value : {};
      
      return {
        id: place.place_id,
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        category: place.types?.[0] || 'business',
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        phone: details.phone,
        website: details.website,
        location: place.geometry?.location ? {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        } : undefined,
      };
    });

    console.log('Returning', places.length, 'places with details');
    
    return new Response(
      JSON.stringify({ 
        places,
        nextPageToken: textSearchData.next_page_token || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-places function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
