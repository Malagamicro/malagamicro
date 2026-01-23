import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichRequest {
  phone: string;
  website?: string;
  leadId?: string;
}

interface EnrichResult {
  phoneType: 'mobile' | 'landline' | 'unknown';
  mobilePhone?: string;
  whatsappVerified?: boolean;
  source?: string;
}

// Spanish phone number analysis
function analyzeSpanishPhone(phone: string): { type: 'mobile' | 'landline' | 'unknown'; cleanPhone: string } {
  // Remove all non-digits
  let clean = phone.replace(/\D/g, '');
  
  // Remove country code if present
  if (clean.startsWith('34')) {
    clean = clean.substring(2);
  }
  
  // Spanish mobile numbers start with 6 or 7
  // Spanish landlines start with 8 or 9
  if (clean.length === 9) {
    const firstDigit = clean[0];
    if (firstDigit === '6' || firstDigit === '7') {
      return { type: 'mobile', cleanPhone: clean };
    }
    if (firstDigit === '8' || firstDigit === '9') {
      return { type: 'landline', cleanPhone: clean };
    }
  }
  
  return { type: 'unknown', cleanPhone: clean };
}

// Format phone for WAHA (needs +34 prefix)
function formatForWaha(phone: string): string {
  let clean = phone.replace(/\D/g, '');
  if (!clean.startsWith('34') && clean.length === 9) {
    clean = '34' + clean;
  }
  return clean;
}

// Extract mobile phones from HTML content
function extractMobilesFromHtml(html: string): string[] {
  const mobiles: string[] = [];
  
  // Spanish mobile patterns:
  // +34 6XX XXX XXX, +34 7XX XXX XXX
  // 6XX XXX XXX, 7XX XXX XXX
  // 6XX-XXX-XXX, 7XX-XXX-XXX
  // 6XXXXXXXX, 7XXXXXXXX
  
  const patterns = [
    /(?:\+34\s?)?[67]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g,
    /(?:\+34)?[67]\d{8}/g,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    for (const match of matches) {
      const clean = match.replace(/\D/g, '');
      // Normalize to 9 digits (remove 34 prefix if present)
      const normalized = clean.startsWith('34') ? clean.substring(2) : clean;
      if (normalized.length === 9 && (normalized[0] === '6' || normalized[0] === '7')) {
        if (!mobiles.includes(normalized)) {
          mobiles.push(normalized);
        }
      }
    }
  }
  
  return mobiles;
}

// Extract WhatsApp links from HTML
function extractWhatsAppLinks(html: string): string[] {
  const phones: string[] = [];
  
  // wa.me/34XXXXXXXXX or api.whatsapp.com/send?phone=34XXXXXXXXX
  const waPatterns = [
    /wa\.me\/(\d+)/gi,
    /api\.whatsapp\.com\/send\?phone=(\d+)/gi,
    /whatsapp\.com\/send\?phone=(\d+)/gi,
  ];
  
  for (const pattern of waPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let phone = match[1];
      // Normalize
      if (phone.startsWith('34')) {
        phone = phone.substring(2);
      }
      if (phone.length === 9 && (phone[0] === '6' || phone[0] === '7')) {
        if (!phones.includes(phone)) {
          phones.push(phone);
        }
      }
    }
  }
  
  return phones;
}

// Scrape website for mobile phones
async function scrapeWebsiteForMobiles(websiteUrl: string): Promise<{ mobiles: string[]; source: string }> {
  const allMobiles: string[] = [];
  let source = '';
  
  try {
    // Normalize URL
    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Fetch homepage
    console.log('Fetching homepage:', url);
    const homeResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (homeResponse.ok) {
      const homeHtml = await homeResponse.text();
      
      // Extract mobiles from homepage
      const homeMobiles = extractMobilesFromHtml(homeHtml);
      const homeWaLinks = extractWhatsAppLinks(homeHtml);
      
      if (homeWaLinks.length > 0) {
        allMobiles.push(...homeWaLinks);
        source = 'whatsapp_link_home';
      }
      
      if (homeMobiles.length > 0) {
        allMobiles.push(...homeMobiles);
        if (!source) source = 'homepage';
      }
      
      // Try to find contact page
      const contactPatterns = [
        '/contacto', '/contact', '/contacta', '/contactanos',
        '/legal', '/aviso-legal', '/privacidad',
        '/sobre-nosotros', '/about', '/quienes-somos',
      ];
      
      const baseUrl = new URL(url);
      
      for (const path of contactPatterns) {
        if (allMobiles.length >= 3) break; // We have enough candidates
        
        try {
          const contactUrl = `${baseUrl.origin}${path}`;
          console.log('Trying contact page:', contactUrl);
          
          const contactResponse = await fetch(contactUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          
          if (contactResponse.ok) {
            const contactHtml = await contactResponse.text();
            const contactMobiles = extractMobilesFromHtml(contactHtml);
            const contactWaLinks = extractWhatsAppLinks(contactHtml);
            
            if (contactWaLinks.length > 0) {
              allMobiles.push(...contactWaLinks);
              if (!source || source === 'homepage') source = `whatsapp_link_${path.replace('/', '')}`;
            }
            
            if (contactMobiles.length > 0) {
              allMobiles.push(...contactMobiles);
              if (!source || source === 'homepage') source = path.replace('/', '');
            }
          }
        } catch {
          // Continue to next page
        }
      }
    }
  } catch (error) {
    console.error('Error scraping website:', error);
  }
  
  // Deduplicate
  const uniqueMobiles = [...new Set(allMobiles)];
  
  return { mobiles: uniqueMobiles, source };
}

// Verify phone with WAHA
async function verifyWithWaha(phone: string): Promise<boolean> {
  const wahaUrl = Deno.env.get('WAHA_API_URL') || Deno.env.get('VITE_WAHA_API_URL');
  const wahaKey = Deno.env.get('WAHA_API_KEY') || Deno.env.get('VITE_WAHA_API_KEY');
  
  if (!wahaUrl) {
    console.log('WAHA not configured, skipping verification');
    return true; // Assume valid if WAHA is not configured
  }
  
  try {
    const formattedPhone = formatForWaha(phone);
    console.log('Verifying phone with WAHA:', formattedPhone);
    
    // Try different WAHA endpoints for number status check
    const endpoints = [
      `/api/checkNumberStatus?phone=${formattedPhone}&session=default`,
      `/api/contacts/check-exists?phone=${formattedPhone}&session=default`,
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${wahaUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'X-Api-Key': wahaKey || '',
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('WAHA response:', data);
          
          // Different response formats depending on WAHA version
          if (data.canReceiveMessage !== undefined) {
            return data.canReceiveMessage === true;
          }
          if (data.numberExists !== undefined) {
            return data.numberExists === true;
          }
          if (data.exists !== undefined) {
            return data.exists === true;
          }
          if (data.isWhatsApp !== undefined) {
            return data.isWhatsApp === true;
          }
          // If we got a successful response, assume it's valid
          return true;
        }
      } catch (e) {
        console.log('WAHA endpoint failed:', endpoint, e);
      }
    }
    
    // If all endpoints fail, return null (unknown)
    return true; // Default to true if we can't verify
  } catch (error) {
    console.error('Error verifying with WAHA:', error);
    return true; // Default to true on error
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, website, leadId }: EnrichRequest = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Enriching lead phone:', { phone, website, leadId });

    const result: EnrichResult = {
      phoneType: 'unknown',
    };

    // Step 1: Analyze the phone number
    const { type, cleanPhone } = analyzeSpanishPhone(phone);
    result.phoneType = type;
    console.log('Phone analysis:', { type, cleanPhone });

    // Step 2: If it's a mobile, verify with WAHA
    if (type === 'mobile') {
      result.mobilePhone = cleanPhone;
      const isVerified = await verifyWithWaha(cleanPhone);
      result.whatsappVerified = isVerified;
      result.source = 'original_phone';
      console.log('Mobile verified:', isVerified);
    }
    
    // Step 3: If it's a landline and we have a website, try to scrape for mobiles
    else if (type === 'landline' && website) {
      console.log('Landline detected, scraping website for mobiles...');
      const { mobiles, source } = await scrapeWebsiteForMobiles(website);
      
      if (mobiles.length > 0) {
        console.log('Found mobiles from website:', mobiles);
        
        // Verify each mobile until we find one that works
        for (const mobile of mobiles) {
          const isVerified = await verifyWithWaha(mobile);
          if (isVerified) {
            result.mobilePhone = mobile;
            result.whatsappVerified = true;
            result.source = source;
            console.log('Verified mobile found:', mobile);
            break;
          }
        }
        
        // If none verified, use first mobile anyway
        if (!result.mobilePhone && mobiles.length > 0) {
          result.mobilePhone = mobiles[0];
          result.whatsappVerified = false;
          result.source = source;
        }
      }
    }

    // Step 4: Update lead in database if leadId provided
    if (leadId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const updateData: Record<string, any> = {
        phone_type: result.phoneType,
      };
      
      if (result.mobilePhone) {
        updateData.mobile_phone = result.mobilePhone;
      }
      
      if (result.whatsappVerified !== undefined) {
        updateData.whatsapp_verified = result.whatsappVerified;
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) {
        console.error('Error updating lead:', error);
      } else {
        console.log('Lead updated successfully');
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enrich-lead-phone:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
