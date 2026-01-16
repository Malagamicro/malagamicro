import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, location, category } = await req.json();
    
    console.log('Search request:', { query, location, category });
    
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

    // First, use Text Search to find places
    const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    textSearchUrl.searchParams.set('query', fullQuery);
    textSearchUrl.searchParams.set('key', apiKey);
    textSearchUrl.searchParams.set('language', 'es');
    textSearchUrl.searchParams.set('region', 'es');

    const textSearchResponse = await fetch(textSearchUrl.toString());
    const textSearchData = await textSearchResponse.json();
    
    console.log('Text search status:', textSearchData.status);
    console.log('Results count:', textSearchData.results?.length || 0);

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

    const places: PlaceResult[] = [];
    
    // Get details for each place (limited to first 10 for performance)
    const placesToProcess = (textSearchData.results || []).slice(0, 10);
    
    for (const place of placesToProcess) {
      // Get place details for phone and website
      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', place.place_id);
      detailsUrl.searchParams.set('fields', 'formatted_phone_number,website,international_phone_number');
      detailsUrl.searchParams.set('key', apiKey);
      
      let phone: string | undefined;
      let website: string | undefined;
      
      try {
        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status === 'OK' && detailsData.result) {
          phone = detailsData.result.formatted_phone_number || detailsData.result.international_phone_number;
          website = detailsData.result.website;
          // Clean up website URL
          if (website) {
            website = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
          }
        }
      } catch (detailError) {
        console.error('Error fetching place details:', detailError);
      }
      
      places.push({
        id: place.place_id,
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        category: place.types?.[0] || 'business',
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        phone,
        website,
        location: place.geometry?.location ? {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        } : undefined,
      });
    }

    console.log('Returning', places.length, 'places with details');
    
    return new Response(
      JSON.stringify({ places }),
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
