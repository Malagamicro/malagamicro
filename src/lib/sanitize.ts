import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Allows safe HTML tags and attributes for email templates.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'a', 'div', 'span', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'hr', 'center', 'font', 'b', 'i', 'small', 'sub', 'sup'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'style', 'class', 'id',
      'width', 'height', 'border', 'cellpadding', 'cellspacing',
      'align', 'valign', 'bgcolor', 'color', 'face', 'size',
      'target', 'rel', 'title'
    ],
    ALLOW_DATA_ATTR: false,
    // Prevent javascript: URLs
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
}

/**
 * Sanitizes HTML content with minimal allowed tags (for basic text).
 */
export function sanitizeBasicHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
    ALLOW_DATA_ATTR: false
  });
}
