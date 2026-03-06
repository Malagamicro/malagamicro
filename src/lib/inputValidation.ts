/**
 * Input validation and sanitization utilities to prevent SQL injection,
 * XSS, and other injection attacks.
 */

// Patterns commonly used in SQL injection attempts
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|TRUNCATE|GRANT|REVOKE)\b)/i,
  /(--|;|\/\*|\*\/|xp_|sp_)/i,
  /('|")\s*(OR|AND)\s*('|")/i,
  /(\bOR\b\s+\d+\s*=\s*\d+)/i,
  /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  /(CHAR\s*\(|CONCAT\s*\(|0x[0-9a-fA-F]+)/i,
  /(WAITFOR\s+DELAY|BENCHMARK\s*\(|SLEEP\s*\()/i,
];

// Patterns for common XSS attempts
const XSS_PATTERNS = [
  /<script[^>]*>/i,
  /javascript\s*:/i,
  /on(load|error|click|mouseover|focus|blur|submit|change|input|keyup|keydown)\s*=/i,
  /data\s*:\s*text\/html/i,
  /expression\s*\(/i,
  /vbscript\s*:/i,
];

/**
 * Check if a string contains SQL injection patterns
 */
export function containsSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check if a string contains XSS patterns
 */
export function containsXss(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize a search query by removing dangerous characters
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== 'string') return '';
  // Remove SQL special characters but keep spaces, letters, numbers, basic punctuation
  return input
    .replace(/[;'"`\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .trim()
    .slice(0, 200); // Limit length
}

/**
 * Validate and sanitize a UUID
 */
export function isValidUuid(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

/**
 * Sanitize text input by removing control characters and limiting length
 */
export function sanitizeTextInput(input: string, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Validate a phone number (basic format)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  return /^[+]?[\d\s\-()]{6,20}$/.test(phone);
}

/**
 * Sanitize object keys and values recursively for safe database insertion
 */
export function sanitizeObjectForDb(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const allowedKeyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  for (const [key, value] of Object.entries(obj)) {
    // Only allow safe key names
    if (!allowedKeyPattern.test(key)) continue;
    
    if (typeof value === 'string') {
      // Check for injection patterns
      if (containsSqlInjection(value) || containsXss(value)) {
        sanitized[key] = sanitizeTextInput(value);
      } else {
        sanitized[key] = value;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeTextInput(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObjectForDb(value as Record<string, unknown>);
    }
  }

  return sanitized;
}

/**
 * Rate limiter for client-side actions
 */
export class ClientRateLimiter {
  private actions: Map<string, number[]> = new Map();

  canPerform(action: string, maxPerMinute: number): boolean {
    const now = Date.now();
    const timestamps = this.actions.get(action) || [];
    const recent = timestamps.filter(t => now - t < 60000);
    
    if (recent.length >= maxPerMinute) return false;
    
    recent.push(now);
    this.actions.set(action, recent);
    return true;
  }

  reset(action: string): void {
    this.actions.delete(action);
  }
}

// Global rate limiter instance
export const rateLimiter = new ClientRateLimiter();
