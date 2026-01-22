/**
 * URL Utilities
 * Helper functions for URL normalization and validation
 */

/**
 * Normalizes a URL by:
 * - Removing duplicate protocols (https://https://)
 * - Ensuring a single valid protocol
 * - Handling common URL format issues
 */
export function normalizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove multiple consecutive protocols
  // e.g., "https://https://example.com" -> "https://example.com"
  normalized = normalized.replace(/^(https?:\/\/)+/i, '');
  
  // Remove "www." prefix duplicates
  normalized = normalized.replace(/^(www\.)+/i, '');
  
  // Clean up any remaining protocol issues
  normalized = normalized.replace(/^:\/\//, '');
  
  // If the URL is empty after cleaning, return empty string
  if (!normalized) return '';
  
  // Return the clean URL without protocol (we'll add it when needed)
  return normalized;
}

/**
 * Builds a complete URL with https:// protocol
 * Use this when you need a clickable link
 */
export function buildExternalUrl(url: string | undefined | null): string {
  const normalized = normalizeUrl(url);
  if (!normalized) return '';
  
  return `https://${normalized}`;
}

/**
 * Formats a URL for display (shorter, more readable)
 */
export function formatUrlForDisplay(url: string | undefined | null): string {
  const normalized = normalizeUrl(url);
  
  // Remove trailing slash for cleaner display
  return normalized.replace(/\/$/, '');
}
