import { supabase } from '@/integrations/supabase/client';

export type PhoneType = 'mobile' | 'landline' | 'unknown';

export interface EnrichmentResult {
  phoneType: PhoneType;
  mobilePhone?: string;
  whatsappVerified?: boolean;
  source?: string;
}

/**
 * Analyze Spanish phone number type (mobile vs landline)
 * Mobile: starts with 6 or 7
 * Landline: starts with 8 or 9
 */
export function analyzeSpanishPhone(phone: string): PhoneType {
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
      return 'mobile';
    }
    if (firstDigit === '8' || firstDigit === '9') {
      return 'landline';
    }
  }
  
  return 'unknown';
}

/**
 * Get phone type icon and label for UI
 */
export function getPhoneTypeDisplay(phoneType?: PhoneType | null, whatsappVerified?: boolean | null): {
  icon: string;
  label: string;
  color: string;
} {
  if (whatsappVerified === true) {
    return { icon: '✅', label: 'Móvil Verificado', color: 'text-green-600' };
  }
  
  if (whatsappVerified === false) {
    return { icon: '⚠️', label: 'Sin WhatsApp', color: 'text-yellow-600' };
  }
  
  switch (phoneType) {
    case 'mobile':
      return { icon: '📱', label: 'Móvil', color: 'text-blue-600' };
    case 'landline':
      return { icon: '☎️', label: 'Fijo', color: 'text-muted-foreground' };
    default:
      return { icon: '📞', label: 'Teléfono', color: 'text-muted-foreground' };
  }
}

/**
 * Call the edge function to enrich a lead's phone data
 */
export async function enrichLeadPhone(
  phone: string,
  website?: string,
  leadId?: string
): Promise<EnrichmentResult> {
  try {
    const { data, error } = await supabase.functions.invoke('enrich-lead-phone', {
      body: { phone, website, leadId },
    });

    if (error) {
      console.error('Enrichment error:', error);
      throw error;
    }

    return data?.data || { phoneType: 'unknown' };
  } catch (error) {
    console.error('Failed to enrich phone:', error);
    // Return basic analysis as fallback
    return { phoneType: analyzeSpanishPhone(phone) };
  }
}

/**
 * Batch enrich multiple leads
 */
export async function enrichLeadsBatch(
  leads: Array<{ id: string; phone?: string; website?: string }>
): Promise<Map<string, EnrichmentResult>> {
  const results = new Map<string, EnrichmentResult>();
  
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (lead) => {
      if (!lead.phone) {
        results.set(lead.id, { phoneType: 'unknown' });
        return;
      }
      
      try {
        const result = await enrichLeadPhone(lead.phone, lead.website, lead.id);
        results.set(lead.id, result);
      } catch (error) {
        results.set(lead.id, { phoneType: analyzeSpanishPhone(lead.phone) });
      }
    });
    
    await Promise.all(promises);
  }
  
  return results;
}
