import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // minutes
  lastSyncAt: Date | null;
}

interface SheetRow {
  [key: string]: string;
}

interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const CONFIG_KEY = 'google_sheets_config';

// Phone normalization for Spanish numbers
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  
  // Remove all non-numeric characters
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // If empty after cleaning, return null
  if (!cleaned) return null;
  
  // If starts with 00, remove it (international prefix)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // If it's a 9-digit Spanish number (starts with 6, 7, 8, 9), add 34
  if (cleaned.length === 9 && /^[6789]/.test(cleaned)) {
    cleaned = '34' + cleaned;
  }
  
  // If starts with +34 but we already stripped the +
  if (cleaned.startsWith('34') && cleaned.length === 11) {
    return cleaned;
  }
  
  // Return as-is for other international numbers
  return cleaned || null;
}

// Detect phone type
function detectPhoneType(phone: string): 'mobile' | 'landline' | 'unknown' {
  if (!phone) return 'unknown';
  
  // Remove country code if present
  let localNumber = phone;
  if (phone.startsWith('34') && phone.length === 11) {
    localNumber = phone.substring(2);
  }
  
  const firstDigit = localNumber[0];
  if (firstDigit === '6' || firstDigit === '7') {
    return 'mobile';
  } else if (firstDigit === '8' || firstDigit === '9') {
    return 'landline';
  }
  
  return 'unknown';
}

// Column mapping - tries to match common Spanish/English headers
const COLUMN_MAPPINGS: { [key: string]: string } = {
  // Company name
  'empresa': 'company_name',
  'nombre empresa': 'company_name',
  'company': 'company_name',
  'company name': 'company_name',
  'negocio': 'company_name',
  'razón social': 'company_name',
  'razon social': 'company_name',
  
  // Contact name
  'contacto': 'contact_name',
  'nombre contacto': 'contact_name',
  'contact': 'contact_name',
  'contact name': 'contact_name',
  'nombre': 'contact_name',
  'name': 'contact_name',
  
  // Phone
  'teléfono': 'phone',
  'telefono': 'phone',
  'phone': 'phone',
  'tel': 'phone',
  'móvil': 'phone',
  'movil': 'phone',
  'mobile': 'phone',
  
  // Email
  'email': 'email',
  'correo': 'email',
  'e-mail': 'email',
  'mail': 'email',
  
  // Address
  'dirección': 'address',
  'direccion': 'address',
  'address': 'address',
  'domicilio': 'address',
  
  // City
  'ciudad': 'city',
  'city': 'city',
  'localidad': 'city',
  'población': 'city',
  'poblacion': 'city',
  
  // Website
  'web': 'website',
  'website': 'website',
  'sitio web': 'website',
  'página web': 'website',
  'pagina web': 'website',
  'url': 'website',
  
  // Notes
  'notas': 'notes',
  'notes': 'notes',
  'comentarios': 'notes',
  'observaciones': 'notes',
  
  // Segment
  'segmento': 'segment',
  'segment': 'segment',
  'tipo': 'segment',
  
  // Status
  'estado': 'status',
  'status': 'status',
};

function mapColumns(headers: string[]): { [originalHeader: string]: string } {
  const mapping: { [key: string]: string } = {};
  
  headers.forEach(header => {
    const normalized = header.toLowerCase().trim();
    if (COLUMN_MAPPINGS[normalized]) {
      mapping[header] = COLUMN_MAPPINGS[normalized];
    }
  });
  
  return mapping;
}

export function useGoogleSheetsSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [config, setConfig] = useState<GoogleSheetsConfig>(() => {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          lastSyncAt: parsed.lastSyncAt ? new Date(parsed.lastSyncAt) : null,
        };
      } catch {
        return getDefaultConfig();
      }
    }
    return getDefaultConfig();
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  function getDefaultConfig(): GoogleSheetsConfig {
    return {
      spreadsheetId: '',
      sheetName: 'Hoja 1',
      autoSyncEnabled: false,
      autoSyncInterval: 10,
      lastSyncAt: null,
    };
  }

  // Save config to localStorage
  const saveConfig = useCallback((newConfig: Partial<GoogleSheetsConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Fetch data from Google Sheets using the public CSV export
  const fetchSheetData = async (): Promise<SheetRow[]> => {
    if (!config.spreadsheetId) {
      throw new Error('No se ha configurado el ID de la hoja de cálculo');
    }

    // Use the Google Sheets API v4 with public access
    // Format: https://docs.google.com/spreadsheets/d/{spreadsheetId}/gviz/tq?tqx=out:json
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.sheetName)}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error al acceder a la hoja: ${response.status}. Asegúrate de que la hoja es pública.`);
      }
      
      const text = await response.text();
      
      // Google returns JSONP-like format: google.visualization.Query.setResponse({...})
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
      if (!jsonMatch) {
        throw new Error('Formato de respuesta no válido. Asegúrate de que la hoja es pública.');
      }
      
      const data = JSON.parse(jsonMatch[1]);
      
      if (data.status === 'error') {
        throw new Error(data.errors?.[0]?.detailed_message || 'Error al leer la hoja');
      }
      
      const table = data.table;
      if (!table || !table.rows || table.rows.length === 0) {
        return [];
      }
      
      // Extract headers from first row
      const headers: string[] = table.cols.map((col: any) => col.label || col.id || '');
      
      // If no labels, try to get from first data row
      let dataStartIndex = 0;
      if (headers.every(h => !h || h.match(/^[A-Z]$/))) {
        // Headers are just column letters, use first row as headers
        if (table.rows[0]) {
          const firstRow = table.rows[0].c;
          headers.length = 0;
          firstRow.forEach((cell: any) => {
            headers.push(cell?.v?.toString() || '');
          });
          dataStartIndex = 1;
        }
      }
      
      // Convert rows to objects
      const rows: SheetRow[] = [];
      for (let i = dataStartIndex; i < table.rows.length; i++) {
        const row = table.rows[i];
        if (!row || !row.c) continue;
        
        const obj: SheetRow = {};
        let hasData = false;
        
        row.c.forEach((cell: any, idx: number) => {
          const header = headers[idx];
          if (header) {
            const value = cell?.v?.toString() || '';
            obj[header] = value;
            if (value) hasData = true;
          }
        });
        
        if (hasData) {
          rows.push(obj);
        }
      }
      
      return rows;
    } catch (err: any) {
      if (err.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con Google Sheets. Verifica que la hoja es pública y el ID es correcto.');
      }
      throw err;
    }
  };

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      const rows = await fetchSheetData();
      
      if (rows.length === 0) {
        return { inserted: 0, updated: 0, skipped: 0, errors: ['La hoja está vacía'] };
      }
      
      // Get headers and create mapping
      const headers = Object.keys(rows[0]);
      const columnMapping = mapColumns(headers);
      
      // Check we have at least company_name or phone
      const hasCompany = Object.values(columnMapping).includes('company_name');
      const hasPhone = Object.values(columnMapping).includes('phone');
      
      if (!hasCompany && !hasPhone) {
        throw new Error('No se encontraron columnas reconocibles. Necesitas al menos "Empresa" o "Teléfono".');
      }
      
      const result: SyncResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      
      for (const row of rows) {
        try {
          // Map row data to lead fields
          const leadData: any = {
            user_id: user.id,
            source: 'google_sheets',
          };
          
          for (const [originalHeader, dbField] of Object.entries(columnMapping)) {
            const value = row[originalHeader]?.trim();
            if (value) {
              leadData[dbField] = value;
            }
          }
          
          // Normalize phone
          if (leadData.phone) {
            const normalizedPhone = normalizePhone(leadData.phone);
            if (normalizedPhone) {
              leadData.phone = normalizedPhone;
              leadData.phone_type = detectPhoneType(normalizedPhone);
              
              // If mobile, also set mobile_phone
              if (leadData.phone_type === 'mobile') {
                leadData.mobile_phone = normalizedPhone;
              }
            }
          }
          
          // Default values
          if (!leadData.company_name && leadData.contact_name) {
            leadData.company_name = leadData.contact_name;
          }
          if (!leadData.company_name) {
            leadData.company_name = `Lead ${leadData.phone || 'Sin nombre'}`;
          }
          if (!leadData.city) {
            leadData.city = 'Málaga';
          }
          if (!leadData.segment) {
            leadData.segment = 'pyme';
          }
          if (!leadData.status) {
            leadData.status = 'nuevo';
          }
          
          // Upsert by phone number (if available)
          if (leadData.phone) {
            // Check if lead with this phone exists
            const { data: existing } = await supabase
              .from('leads')
              .select('id')
              .eq('user_id', user.id)
              .eq('phone', leadData.phone)
              .maybeSingle();
            
            if (existing) {
              // Update existing
              const { error } = await supabase
                .from('leads')
                .update({
                  ...leadData,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
              
              if (error) throw error;
              result.updated++;
            } else {
              // Insert new
              const { error } = await supabase
                .from('leads')
                .insert(leadData);
              
              if (error) throw error;
              result.inserted++;
            }
          } else {
            // No phone - check by company name
            const { data: existing } = await supabase
              .from('leads')
              .select('id')
              .eq('user_id', user.id)
              .eq('company_name', leadData.company_name)
              .maybeSingle();
            
            if (existing) {
              const { error } = await supabase
                .from('leads')
                .update({
                  ...leadData,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
              
              if (error) throw error;
              result.updated++;
            } else {
              const { error } = await supabase
                .from('leads')
                .insert(leadData);
              
              if (error) throw error;
              result.inserted++;
            }
          }
        } catch (err: any) {
          result.skipped++;
          result.errors.push(`Fila: ${err.message}`);
        }
      }
      
      return result;
    },
    onSuccess: (result) => {
      setLastResult(result);
      saveConfig({ lastSyncAt: new Date() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
      const message = `Sincronización completada: ${result.inserted} nuevos, ${result.updated} actualizados`;
      if (result.skipped > 0) {
        toast.warning(message + `, ${result.skipped} errores`);
      } else {
        toast.success(message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al sincronizar');
    },
  });

  // Manual sync
  const sync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncMutation.mutateAsync();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncMutation]);

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
      autoSyncIntervalRef.current = null;
    }
    
    if (config.autoSyncEnabled && config.spreadsheetId) {
      const intervalMs = config.autoSyncInterval * 60 * 1000;
      
      autoSyncIntervalRef.current = setInterval(() => {
        console.log('🔄 Auto-sync triggered');
        sync();
      }, intervalMs);
      
      console.log(`⏰ Auto-sync enabled: every ${config.autoSyncInterval} minutes`);
    }
    
    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [config.autoSyncEnabled, config.autoSyncInterval, config.spreadsheetId, sync]);

  return {
    config,
    saveConfig,
    sync,
    isSyncing,
    lastResult,
    isConfigured: !!config.spreadsheetId,
  };
}
