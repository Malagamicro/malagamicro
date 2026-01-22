import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Improved regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Multiple phone formats: international, with spaces, dashes, parentheses
const PHONE_REGEX = /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

// Spanish-specific patterns
const SPANISH_PHONE_REGEX = /(?:\+34|0034)?[\s.-]?[6-9][\s.-]?\d{2}[\s.-]?\d{2,3}[\s.-]?\d{2,3}[\s.-]?\d{2,3}/g;

// WhatsApp patterns
const WHATSAPP_URL_REGEX = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)\/?\+?(\d{7,15})/g;

// Invalid email extensions to filter out
const INVALID_EMAIL_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.css', '.js'];

// Common placeholder emails to filter
const PLACEHOLDER_EMAILS = ['usuario@dominio.com', 'email@ejemplo.com', 'correo@ejemplo.com', 'test@test.com', 'example@example.com'];

function cleanHtml($: cheerio.CheerioAPI): string {
  // Remove non-content elements
  $('script, style, svg, path, noscript, iframe, canvas, video, audio, object, embed, applet, meta, link, head').remove();
  
  // Remove hidden elements
  $('[style*="display:none"], [style*="display: none"], [hidden], .hidden').remove();
  
  // Get clean text from body
  const text = $('body').text();
  
  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}

function extractFromHrefAttributes($: cheerio.CheerioAPI): { emails: string[], phones: string[], whatsapp: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  const whatsapp: string[] = [];

  // Extract emails from mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && EMAIL_REGEX.test(email)) {
        emails.push(email);
      }
    }
  });

  // Extract phones from tel: links
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      let phone = href.replace('tel:', '').replace(/\s/g, '');
      // Clean common prefixes
      phone = phone.replace(/^(\+34|0034)/, '+34');
      if (phone.length >= 9) {
        phones.push(phone);
      }
    }
  });

  // Extract WhatsApp links
  $('a[href*="wa.me"], a[href*="whatsapp.com"], a[href*="api.whatsapp"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    
    // Extract number from wa.me/NUMBER or whatsapp.com/send?phone=NUMBER
    const waMatch = href.match(/(?:wa\.me\/|phone=)(\+?\d{7,15})/);
    if (waMatch && waMatch[1]) {
      whatsapp.push(waMatch[1].replace(/\D/g, ''));
    }
  });

  return { emails, phones, whatsapp };
}

function extractFromText(text: string): { emails: string[], phones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];

  // Extract emails
  const emailMatches = text.match(EMAIL_REGEX) || [];
  emails.push(...emailMatches.map(e => e.toLowerCase()));

  // Extract phones with general regex
  const phoneMatches = text.match(PHONE_REGEX) || [];
  phones.push(...phoneMatches);

  // Also try Spanish-specific patterns
  const spanishPhoneMatches = text.match(SPANISH_PHONE_REGEX) || [];
  phones.push(...spanishPhoneMatches);

  return { emails, phones };
}

function cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure + is only at the start
  if (cleaned.includes('+') && !cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/\+/g, '');
  }
  
  return cleaned;
}

function filterEmails(emails: string[]): string[] {
  return [...new Set(emails)]
    .filter(email => {
      const lower = email.toLowerCase();
      
      // Filter out invalid extensions
      if (INVALID_EMAIL_EXTENSIONS.some(ext => lower.endsWith(ext))) {
        return false;
      }
      
      // Filter out placeholders
      if (PLACEHOLDER_EMAILS.includes(lower)) {
        return false;
      }
      
      // Must have valid structure
      if (!lower.includes('@') || !lower.includes('.')) {
        return false;
      }
      
      // Filter out very short local parts (likely false positives)
      const localPart = lower.split('@')[0];
      if (localPart.length < 2) {
        return false;
      }
      
      // Filter out emails that are clearly file references
      if (lower.match(/@\d+x\d+/)) {
        return false;
      }
      
      return true;
    });
}

function filterPhones(phones: string[]): string[] {
  const cleaned = phones.map(cleanPhoneNumber);
  
  return [...new Set(cleaned)]
    .filter(phone => {
      const digits = phone.replace(/\D/g, '');
      
      // Must have between 9 and 15 digits (standard phone range)
      if (digits.length < 9 || digits.length > 15) {
        return false;
      }
      
      // Filter out numbers that are clearly not phones (all same digit, sequential)
      if (/^(\d)\1+$/.test(digits)) {
        return false; // All same digit like 111111111
      }
      
      // Filter out numbers starting with 0 followed by many zeros
      if (/^0{3,}/.test(digits)) {
        return false;
      }
      
      // For Spanish phones, should start with 6, 7, 8, 9 (or 34 prefix)
      const withoutPrefix = digits.replace(/^34/, '');
      if (withoutPrefix.length === 9) {
        if (!/^[6-9]/.test(withoutPrefix)) {
          return false;
        }
      }
      
      return true;
    })
    .map(phone => {
      // Format for display
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 9 && /^[6-9]/.test(digits)) {
        // Spanish format without prefix
        return digits;
      }
      if (digits.startsWith('34') && digits.length === 11) {
        // Spanish with prefix
        return '+' + digits;
      }
      return phone.startsWith('+') ? phone : digits;
    });
}

function filterWhatsApp(numbers: string[], phones: string[]): string[] {
  // Combine WhatsApp-specific finds with phones that could be WhatsApp
  const allWa = [...new Set([...numbers])];
  
  return allWa
    .map(num => num.replace(/\D/g, ''))
    .filter(num => num.length >= 9 && num.length <= 15);
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

    // Parse with Cheerio
    const $ = cheerio.load(html);

    // Step 1: Extract from href attributes (most reliable)
    const hrefData = extractFromHrefAttributes($);
    console.log('From href:', { emails: hrefData.emails.length, phones: hrefData.phones.length, whatsapp: hrefData.whatsapp.length });

    // Step 2: Clean HTML and extract from visible text
    const cleanText = cleanHtml($);
    const textData = extractFromText(cleanText);
    console.log('From text:', { emails: textData.emails.length, phones: textData.phones.length });

    // Step 3: Combine and filter results
    const allEmails = [...hrefData.emails, ...textData.emails];
    const allPhones = [...hrefData.phones, ...textData.phones];
    const allWhatsapp = hrefData.whatsapp;

    const emails = filterEmails(allEmails);
    const phones = filterPhones(allPhones);
    const whatsapp = filterWhatsApp(allWhatsapp, phones);

    console.log('Final results:', { emails: emails.length, phones: phones.length, whatsapp: whatsapp.length });

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
