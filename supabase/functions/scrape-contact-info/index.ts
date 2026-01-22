import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Improved regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_OBFUSCATED_REGEX = /[a-zA-Z0-9._%+-]+\s*[\[\(]?\s*(?:at|@|arroba)\s*[\]\)]?\s*[a-zA-Z0-9.-]+\s*[\[\(]?\s*(?:dot|\.)\s*[\]\)]?\s*[a-zA-Z]{2,}/gi;

// Multiple phone formats
const PHONE_REGEX = /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const SPANISH_PHONE_REGEX = /(?:\+34|0034)?[\s.-]?[6-9][\s.-]?\d{2}[\s.-]?\d{2,3}[\s.-]?\d{2,3}[\s.-]?\d{2,3}/g;

// WhatsApp patterns
const WHATSAPP_URL_REGEX = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)\/?\+?(\d{7,15})/g;

// Invalid email extensions
const INVALID_EMAIL_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.css', '.js'];
const PLACEHOLDER_EMAILS = ['usuario@dominio.com', 'email@ejemplo.com', 'correo@ejemplo.com', 'test@test.com', 'example@example.com'];

// URL Priority Keywords for intelligent navigation
const HIGH_PRIORITY_KEYWORDS = ['contacto', 'contact', 'contact-us', 'contactenos', 'contactanos', 'escribenos'];
const MEDIUM_PRIORITY_KEYWORDS = ['legal', 'aviso-legal', 'politica', 'privacy', 'privacidad', 'terminos', 'condiciones', 'footer'];
const LOW_PRIORITY_KEYWORDS = ['sobre-nosotros', 'about', 'about-us', 'equipo', 'team', 'quienes-somos', 'empresa', 'company'];
const IGNORE_KEYWORDS = ['blog', 'producto', 'product', 'categoria', 'category', 'tienda', 'shop', 'cart', 'carrito', 'login', 'registro', 'search'];

// Social media patterns
const SOCIAL_PATTERNS = {
  facebook: /(?:facebook\.com|fb\.com)\/[a-zA-Z0-9._-]+/gi,
  instagram: /instagram\.com\/[a-zA-Z0-9._-]+/gi,
  linkedin: /linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/gi,
  twitter: /(?:twitter\.com|x\.com)\/[a-zA-Z0-9._-]+/gi,
};

interface ExtractedData {
  emails: string[];
  phones: string[];
  whatsapp: string[];
  socials: string[];
}

interface CrawlResult {
  source_urls_scanned: string[];
  emails: string[];
  phones: string[];
  whatsapp: string[];
  socials: string[];
  scannedAt: string;
}

function getBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      const url = new URL(href);
      const base = new URL(baseUrl);
      // Only include internal links
      if (url.host !== base.host) return null;
      return href;
    }
    
    if (href.startsWith('/')) {
      return `${getBaseUrl(baseUrl)}${href}`;
    }
    
    return `${getBaseUrl(baseUrl)}/${href}`;
  } catch {
    return null;
  }
}

function scoreUrl(url: string, linkText: string): number {
  const combined = `${url.toLowerCase()} ${linkText.toLowerCase()}`;
  
  // Check ignore keywords first
  if (IGNORE_KEYWORDS.some(kw => combined.includes(kw))) {
    return -1;
  }
  
  // Score based on priority
  if (HIGH_PRIORITY_KEYWORDS.some(kw => combined.includes(kw))) {
    return 100;
  }
  if (MEDIUM_PRIORITY_KEYWORDS.some(kw => combined.includes(kw))) {
    return 50;
  }
  if (LOW_PRIORITY_KEYWORDS.some(kw => combined.includes(kw))) {
    return 25;
  }
  
  return 0;
}

function extractInternalLinks($: cheerio.CheerioAPI, baseUrl: string): { url: string; score: number }[] {
  const links: Map<string, number> = new Map();
  
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const normalized = normalizeUrl(href, baseUrl);
    
    if (normalized) {
      const score = scoreUrl(normalized, text);
      if (score >= 0) {
        const existing = links.get(normalized) || 0;
        links.set(normalized, Math.max(existing, score));
      }
    }
  });
  
  // Sort by score and return top candidates
  return Array.from(links.entries())
    .map(([url, score]) => ({ url, score }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function cleanHtml($: cheerio.CheerioAPI): string {
  $('script, style, svg, path, noscript, iframe, canvas, video, audio, object, embed, applet, meta, link, head').remove();
  $('[style*="display:none"], [style*="display: none"], [hidden], .hidden').remove();
  
  const text = $('body').text();
  return text.replace(/\s+/g, ' ').trim();
}

function extractFromHrefAttributes($: cheerio.CheerioAPI): { emails: string[], phones: string[], whatsapp: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  const whatsapp: string[] = [];

  // mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && EMAIL_REGEX.test(email)) {
        emails.push(email);
      }
    }
  });

  // tel: links
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      let phone = href.replace('tel:', '').replace(/\s/g, '');
      phone = phone.replace(/^(\+34|0034)/, '+34');
      if (phone.length >= 9) {
        phones.push(phone);
      }
    }
  });

  // WhatsApp links
  $('a[href*="wa.me"], a[href*="whatsapp.com"], a[href*="api.whatsapp"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const waMatch = href.match(/(?:wa\.me\/|phone=)(\+?\d{7,15})/);
    if (waMatch && waMatch[1]) {
      whatsapp.push(waMatch[1].replace(/\D/g, ''));
    }
  });

  return { emails, phones, whatsapp };
}

function extractFromMetaTags($: cheerio.CheerioAPI): { emails: string[], phones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  
  // Check meta tags
  $('meta[name*="email"], meta[property*="email"], meta[name*="contact"], meta[property*="contact"]').each((_, el) => {
    const content = $(el).attr('content') || '';
    const emailMatches = content.match(EMAIL_REGEX);
    if (emailMatches) emails.push(...emailMatches);
    
    const phoneMatches = content.match(PHONE_REGEX);
    if (phoneMatches) phones.push(...phoneMatches);
  });
  
  return { emails, phones };
}

function extractFromJsonLd($: cheerio.CheerioAPI): { emails: string[], phones: string[], socials: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  const socials: string[] = [];
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      
      // Check for email in various JSON-LD schemas
      const checkObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.email) {
          const emailMatch = String(obj.email).match(EMAIL_REGEX);
          if (emailMatch) emails.push(...emailMatch);
        }
        if (obj.telephone || obj.phone) {
          const phone = String(obj.telephone || obj.phone);
          const phoneMatch = phone.match(PHONE_REGEX);
          if (phoneMatch) phones.push(...phoneMatch);
        }
        if (obj.sameAs && Array.isArray(obj.sameAs)) {
          socials.push(...obj.sameAs.filter((s: string) => 
            typeof s === 'string' && (s.includes('facebook') || s.includes('instagram') || s.includes('linkedin') || s.includes('twitter') || s.includes('x.com'))
          ));
        }
        if (obj.contactPoint) {
          if (Array.isArray(obj.contactPoint)) {
            obj.contactPoint.forEach(checkObject);
          } else {
            checkObject(obj.contactPoint);
          }
        }
      };
      
      if (Array.isArray(json)) {
        json.forEach(checkObject);
      } else {
        checkObject(json);
      }
    } catch {
      // Invalid JSON, skip
    }
  });
  
  return { emails, phones, socials };
}

function extractSocialLinks($: cheerio.CheerioAPI): string[] {
  const socials: string[] = [];
  
  $('a[href*="facebook.com"], a[href*="fb.com"], a[href*="instagram.com"], a[href*="linkedin.com"], a[href*="twitter.com"], a[href*="x.com"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      // Clean the URL
      try {
        const url = new URL(href);
        socials.push(`${url.host}${url.pathname}`.replace(/\/$/, ''));
      } catch {
        socials.push(href);
      }
    }
  });
  
  return socials;
}

function extractFromText(text: string): { emails: string[], phones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];

  // Standard emails
  const emailMatches = text.match(EMAIL_REGEX) || [];
  emails.push(...emailMatches.map(e => e.toLowerCase()));
  
  // Obfuscated emails (user [at] domain [dot] com)
  const obfuscatedMatches = text.match(EMAIL_OBFUSCATED_REGEX) || [];
  obfuscatedMatches.forEach(match => {
    const cleaned = match
      .replace(/\s*[\[\(]?\s*(?:at|arroba)\s*[\]\)]?\s*/gi, '@')
      .replace(/\s*[\[\(]?\s*(?:dot)\s*[\]\)]?\s*/gi, '.')
      .toLowerCase()
      .trim();
    if (EMAIL_REGEX.test(cleaned)) {
      emails.push(cleaned);
    }
  });

  // Extract phones
  const phoneMatches = text.match(PHONE_REGEX) || [];
  phones.push(...phoneMatches);
  
  const spanishPhoneMatches = text.match(SPANISH_PHONE_REGEX) || [];
  phones.push(...spanishPhoneMatches);

  return { emails, phones };
}

function cleanPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.includes('+') && !cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/\+/g, '');
  }
  return cleaned;
}

function filterEmails(emails: string[]): string[] {
  return [...new Set(emails)]
    .filter(email => {
      const lower = email.toLowerCase();
      
      if (INVALID_EMAIL_EXTENSIONS.some(ext => lower.endsWith(ext))) return false;
      if (PLACEHOLDER_EMAILS.includes(lower)) return false;
      if (!lower.includes('@') || !lower.includes('.')) return false;
      
      const localPart = lower.split('@')[0];
      if (localPart.length < 2) return false;
      if (lower.match(/@\d+x\d+/)) return false;
      
      return true;
    });
}

function filterPhones(phones: string[]): string[] {
  const cleaned = phones.map(cleanPhoneNumber);
  
  return [...new Set(cleaned)]
    .filter(phone => {
      const digits = phone.replace(/\D/g, '');
      
      if (digits.length < 9 || digits.length > 15) return false;
      if (/^(\d)\1+$/.test(digits)) return false;
      if (/^0{3,}/.test(digits)) return false;
      
      const withoutPrefix = digits.replace(/^34/, '');
      if (withoutPrefix.length === 9) {
        if (!/^[6-9]/.test(withoutPrefix)) return false;
      }
      
      return true;
    })
    .map(phone => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 9 && /^[6-9]/.test(digits)) {
        return digits;
      }
      if (digits.startsWith('34') && digits.length === 11) {
        return '+' + digits;
      }
      return phone.startsWith('+') ? phone : digits;
    });
}

function filterWhatsApp(numbers: string[]): string[] {
  return [...new Set(numbers)]
    .map(num => num.replace(/\D/g, ''))
    .filter(num => num.length >= 9 && num.length <= 15);
}

function rankEmails(emails: string[]): string[] {
  const priority: Record<string, number> = {
    'info': 100,
    'contacto': 90,
    'contact': 90,
    'admin': 80,
    'hola': 75,
    'hello': 75,
    'ventas': 70,
    'sales': 70,
    'soporte': 60,
    'support': 60,
  };
  
  return emails.sort((a, b) => {
    const localA = a.split('@')[0].toLowerCase();
    const localB = b.split('@')[0].toLowerCase();
    
    let scoreA = 0;
    let scoreB = 0;
    
    for (const [key, value] of Object.entries(priority)) {
      if (localA.includes(key)) scoreA = Math.max(scoreA, value);
      if (localB.includes(key)) scoreB = Math.max(scoreB, value);
    }
    
    return scoreB - scoreA;
  });
}

function rankPhones(phones: string[]): string[] {
  // Prioritize mobile phones (starting with 6, 7) over landlines (starting with 8, 9)
  return phones.sort((a, b) => {
    const digitsA = a.replace(/\D/g, '').replace(/^34/, '');
    const digitsB = b.replace(/\D/g, '').replace(/^34/, '');
    
    const isMobileA = /^[67]/.test(digitsA);
    const isMobileB = /^[67]/.test(digitsB);
    
    if (isMobileA && !isMobileB) return -1;
    if (!isMobileA && isMobileB) return 1;
    return 0;
  });
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function extractFromPage(html: string): Promise<ExtractedData> {
  const $ = cheerio.load(html);
  
  // Extract from various sources
  const hrefData = extractFromHrefAttributes($);
  const metaData = extractFromMetaTags($);
  const jsonLdData = extractFromJsonLd($);
  const socialLinks = extractSocialLinks($);
  const cleanText = cleanHtml($);
  const textData = extractFromText(cleanText);
  
  // Combine all results
  const allEmails = [...hrefData.emails, ...metaData.emails, ...jsonLdData.emails, ...textData.emails];
  const allPhones = [...hrefData.phones, ...metaData.phones, ...jsonLdData.phones, ...textData.phones];
  const allWhatsapp = [...hrefData.whatsapp];
  const allSocials = [...socialLinks, ...jsonLdData.socials];
  
  return {
    emails: allEmails,
    phones: allPhones,
    whatsapp: allWhatsapp,
    socials: allSocials,
  };
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

    console.log('🕷️ Starting multi-page crawl for:', formattedUrl);

    // === STEP 1: Fetch Home Page ===
    const homeResponse = await fetchWithTimeout(formattedUrl, 8000);
    
    if (!homeResponse || !homeResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch home page: ${homeResponse?.status || 'timeout'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const homeHtml = await homeResponse.text();
    const $home = cheerio.load(homeHtml);
    
    // === STEP 2: Extract candidate URLs ===
    const candidateUrls = extractInternalLinks($home, formattedUrl);
    console.log('📍 Found candidate URLs:', candidateUrls.map(c => `${c.url} (score: ${c.score})`));

    // === STEP 3: Parallel fetch of all pages ===
    const urlsToScan = [formattedUrl, ...candidateUrls.map(c => c.url)];
    const scannedUrls: string[] = [];
    const allData: ExtractedData = {
      emails: [],
      phones: [],
      whatsapp: [],
      socials: [],
    };

    // Extract from home page first
    const homeData = await extractFromPage(homeHtml);
    allData.emails.push(...homeData.emails);
    allData.phones.push(...homeData.phones);
    allData.whatsapp.push(...homeData.whatsapp);
    allData.socials.push(...homeData.socials);
    scannedUrls.push(formattedUrl);

    // Fetch and extract from candidate pages in parallel
    if (candidateUrls.length > 0) {
      console.log('🔍 Fetching', candidateUrls.length, 'additional pages...');
      
      const pagePromises = candidateUrls.map(async ({ url: pageUrl }) => {
        try {
          const response = await fetchWithTimeout(pageUrl, 5000);
          if (response && response.ok) {
            const html = await response.text();
            const data = await extractFromPage(html);
            return { url: pageUrl, data, success: true };
          }
          return { url: pageUrl, success: false };
        } catch {
          return { url: pageUrl, success: false };
        }
      });

      const results = await Promise.allSettled(pagePromises);
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          const { url: pageUrl, data } = result.value;
          scannedUrls.push(pageUrl);
          allData.emails.push(...data.emails);
          allData.phones.push(...data.phones);
          allData.whatsapp.push(...data.whatsapp);
          allData.socials.push(...data.socials);
          console.log(`✅ Extracted from ${pageUrl}`);
        }
      });
    }

    // === STEP 4: Consolidate and deduplicate ===
    const emails = rankEmails(filterEmails(allData.emails));
    const phones = rankPhones(filterPhones(allData.phones));
    const whatsapp = filterWhatsApp(allData.whatsapp);
    const socials = [...new Set(allData.socials)].slice(0, 10); // Max 10 social links

    console.log('📊 Final results:', {
      pages_scanned: scannedUrls.length,
      emails: emails.length,
      phones: phones.length,
      whatsapp: whatsapp.length,
      socials: socials.length,
    });

    const result: CrawlResult = {
      source_urls_scanned: scannedUrls,
      emails,
      phones,
      whatsapp,
      socials,
      scannedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error crawling:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to crawl website';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
