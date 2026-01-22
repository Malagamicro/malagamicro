const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regex patterns for extraction
const EMAIL_REGEX = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;

// Flexible phone patterns for Spain and international
const PHONE_PATTERNS = [
  /(?:\+34|0034|34)?[\s.-]?[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g, // Spanish mobile/landline
  /(?:\+34|0034)?[\s.-]?9[0-8]\d[\s.-]?\d{3}[\s.-]?\d{3}/g, // Spanish landline
  /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, // International format
  /\b\d{9}\b/g, // 9 digits (common Spanish format without prefix)
];

// WhatsApp specific patterns (wa.me links, WhatsApp mentions)
const WHATSAPP_PATTERNS = [
  /wa\.me\/(\d+)/g,
  /api\.whatsapp\.com\/send\?phone=(\d+)/g,
  /whatsapp:\/\/send\?phone=(\d+)/g,
];

function extractEmails(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) || [];
  // Filter out common false positives
  const filtered = matches.filter(email => {
    const lower = email.toLowerCase();
    return !lower.includes('example.com') &&
           !lower.includes('domain.com') &&
           !lower.includes('.png') &&
           !lower.includes('.jpg') &&
           !lower.includes('.gif') &&
           !lower.includes('.css') &&
           !lower.includes('.js');
  });
  return [...new Set(filtered)];
}

function extractPhones(html: string): string[] {
  const phones: string[] = [];
  
  for (const pattern of PHONE_PATTERNS) {
    const matches = html.match(pattern) || [];
    phones.push(...matches);
  }
  
  // Clean and normalize phone numbers
  const cleaned = phones.map(phone => {
    // Remove spaces, dots, dashes
    let clean = phone.replace(/[\s.-]/g, '');
    // Remove parentheses
    clean = clean.replace(/[()]/g, '');
    return clean;
  });
  
  // Filter valid phones (at least 9 digits)
  const valid = cleaned.filter(phone => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  });
  
  return [...new Set(valid)];
}

function extractWhatsApp(html: string): string[] {
  const whatsappNumbers: string[] = [];
  
  for (const pattern of WHATSAPP_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, 'g');
    while ((match = regex.exec(html)) !== null) {
      if (match[1]) {
        whatsappNumbers.push(match[1]);
      }
    }
  }
  
  // Also check for phone numbers near WhatsApp text
  const whatsappContext = html.match(/whatsapp[^<>]{0,50}[\d\s+.-]{9,}/gi) || [];
  for (const context of whatsappContext) {
    const phoneMatch = context.match(/[\d+][\d\s.-]{8,}/);
    if (phoneMatch) {
      const clean = phoneMatch[0].replace(/[\s.-]/g, '');
      if (clean.length >= 9) {
        whatsappNumbers.push(clean);
      }
    }
  }
  
  return [...new Set(whatsappNumbers)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping URL:', formattedUrl);

    // Fetch the page
    const response = await fetch(formattedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    console.log('HTML length:', html.length);

    // Extract contact information
    const emails = extractEmails(html);
    const phones = extractPhones(html);
    const whatsapp = extractWhatsApp(html);

    console.log('Found:', { emails: emails.length, phones: phones.length, whatsapp: whatsapp.length });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          emails,
          phones,
          whatsapp,
          url: formattedUrl,
          scannedAt: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape URL';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
