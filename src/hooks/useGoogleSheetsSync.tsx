import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CustomColumnMapping {
  sheetColumn: string;
  leadField: string;
}

export interface GoogleSheetConfig {
  id: string;
  user_id: string;
  name: string;
  spreadsheet_id: string;
  sheet_name: string;
  auto_sync_enabled: boolean;
  auto_sync_interval: number;
  last_sync_at: string | null;
  custom_columns: CustomColumnMapping[];
  created_at: string;
  updated_at: string;
}

interface SheetRow {
  [key: string]: string;
}

export interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Phone normalization for Spanish numbers
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  
  let cleaned = phone.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  if (cleaned.length === 9 && /^[6789]/.test(cleaned)) {
    cleaned = '34' + cleaned;
  }
  
  if (cleaned.startsWith('34') && cleaned.length === 11) {
    return cleaned;
  }
  
  return cleaned || null;
}

function detectPhoneType(phone: string): 'mobile' | 'landline' | 'unknown' {
  if (!phone) return 'unknown';
  
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

// Default column mappings
const DEFAULT_COLUMN_MAPPINGS: { [key: string]: string } = {
  'empresa': 'company_name',
  'nombre empresa': 'company_name',
  'company': 'company_name',
  'company name': 'company_name',
  'negocio': 'company_name',
  'razón social': 'company_name',
  'razon social': 'company_name',
  'contacto': 'contact_name',
  'nombre contacto': 'contact_name',
  'contact': 'contact_name',
  'contact name': 'contact_name',
  'nombre': 'contact_name',
  'name': 'contact_name',
  'teléfono': 'phone',
  'telefono': 'phone',
  'phone': 'phone',
  'tel': 'phone',
  'móvil': 'phone',
  'movil': 'phone',
  'mobile': 'phone',
  'email': 'email',
  'correo': 'email',
  'e-mail': 'email',
  'mail': 'email',
  'correo electrónico': 'email',
  'correo electronico': 'email',
  'dirección': 'address',
  'direccion': 'address',
  'address': 'address',
  'domicilio': 'address',
  'ciudad': 'city',
  'city': 'city',
  'localidad': 'city',
  'población': 'city',
  'poblacion': 'city',
  'web': 'website',
  'website': 'website',
  'sitio web': 'website',
  'página web': 'website',
  'pagina web': 'website',
  'url': 'website',
  'notas': 'notes',
  'notes': 'notes',
  'comentarios': 'notes',
  'observaciones': 'notes',
  'mensaje': 'notes',
  'qué busca': 'notes',
  'que busca': 'notes',
  'segmento': 'segment',
  'segment': 'segment',
  'tipo': 'segment',
  'estado': 'status',
  'status': 'status',
  'tags': 'tags',
  'etiquetas': 'tags',
};

export const LEAD_FIELDS = [
  { value: 'company_name', label: 'Empresa' },
  { value: 'contact_name', label: 'Contacto' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'email', label: 'Email' },
  { value: 'address', label: 'Dirección' },
  { value: 'city', label: 'Ciudad' },
  { value: 'website', label: 'Web' },
  { value: 'notes', label: 'Notas' },
  { value: 'segment', label: 'Segmento' },
  { value: 'status', label: 'Estado' },
  { value: 'tags', label: 'Etiquetas' },
];

function mapColumns(headers: string[], customMappings: CustomColumnMapping[]): { [originalHeader: string]: string } {
  const mapping: { [key: string]: string } = {};
  
  // First apply custom mappings
  customMappings.forEach(cm => {
    if (cm.sheetColumn && cm.leadField) {
      mapping[cm.sheetColumn] = cm.leadField;
    }
  });
  
  // Then apply default mappings for unmapped columns
  headers.forEach(header => {
    if (!mapping[header]) {
      const normalized = header.toLowerCase().trim();
      if (DEFAULT_COLUMN_MAPPINGS[normalized]) {
        mapping[header] = DEFAULT_COLUMN_MAPPINGS[normalized];
      }
    }
  });
  
  return mapping;
}

export function useGoogleSheetsConfigs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['google-sheets-configs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('google_sheets_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(config => ({
        ...config,
        custom_columns: (Array.isArray(config.custom_columns) ? config.custom_columns : []) as unknown as CustomColumnMapping[],
      })) as GoogleSheetConfig[];
    },
    enabled: !!user?.id,
  });

  const createConfig = useMutation({
    mutationFn: async (data: Omit<GoogleSheetConfig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_sync_at'>) => {
      if (!user?.id) throw new Error('No autenticado');
      
      const { data: result, error } = await supabase
        .from('google_sheets_configs')
        .insert([{
          user_id: user.id,
          name: data.name,
          spreadsheet_id: data.spreadsheet_id,
          sheet_name: data.sheet_name,
          auto_sync_enabled: data.auto_sync_enabled,
          auto_sync_interval: data.auto_sync_interval,
          custom_columns: JSON.stringify(data.custom_columns),
        }])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-configs'] });
      toast.success('Hoja de cálculo añadida');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al añadir hoja');
    },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, ...data }: Partial<GoogleSheetConfig> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.spreadsheet_id !== undefined) updateData.spreadsheet_id = data.spreadsheet_id;
      if (data.sheet_name !== undefined) updateData.sheet_name = data.sheet_name;
      if (data.auto_sync_enabled !== undefined) updateData.auto_sync_enabled = data.auto_sync_enabled;
      if (data.auto_sync_interval !== undefined) updateData.auto_sync_interval = data.auto_sync_interval;
      if (data.custom_columns !== undefined) updateData.custom_columns = JSON.stringify(data.custom_columns);
      if (data.last_sync_at !== undefined) updateData.last_sync_at = data.last_sync_at;
      
      const { error } = await supabase
        .from('google_sheets_configs')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-configs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al actualizar');
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('google_sheets_configs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-configs'] });
      toast.success('Hoja eliminada');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al eliminar');
    },
  });

  return {
    configs,
    isLoading,
    createConfig,
    updateConfig,
    deleteConfig,
  };
}

export function useGoogleSheetsSync(configId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);

  const { configs, updateConfig } = useGoogleSheetsConfigs();
  const config = configs.find(c => c.id === configId);

  // Parse CSV text into rows
  const parseCsv = useCallback((csvText: string): { headers: string[]; rows: SheetRow[] } => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: SheetRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const obj: SheetRow = {};
      let hasData = false;
      headers.forEach((h, idx) => {
        if (h) {
          obj[h] = values[idx] || '';
          if (values[idx]) hasData = true;
        }
      });
      if (hasData) rows.push(obj);
    }
    return { headers: headers.filter(h => h), rows };
  }, []);

  const fetchSheetCsv = useCallback(async (spreadsheetId: string, sheetName: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('google-sheets-proxy', {
      body: { spreadsheetId, sheetName },
    });
    if (error) throw new Error('No se pudo acceder a la hoja. Asegúrate de que es pública.');
    if (data?.error) throw new Error(data.error);
    return data.data as string;
  }, []);

  const fetchHeaders = useCallback(async (spreadsheetId: string, sheetName: string): Promise<string[]> => {
    const csvText = await fetchSheetCsv(spreadsheetId, sheetName);
    const { headers } = parseCsv(csvText);
    return headers;
  }, [fetchSheetCsv, parseCsv]);

  // Fetch data from Google Sheets
  const fetchSheetData = async (spreadsheetId: string, sheetName: string): Promise<SheetRow[]> => {
    const csvText = await fetchSheetCsv(spreadsheetId, sheetName);
    const { rows } = parseCsv(csvText);
    return rows;
  };

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (targetConfig: GoogleSheetConfig): Promise<SyncResult> => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      const rows = await fetchSheetData(targetConfig.spreadsheet_id, targetConfig.sheet_name);
      
      if (rows.length === 0) {
        return { inserted: 0, updated: 0, skipped: 0, errors: ['La hoja está vacía'] };
      }
      
      const headers = Object.keys(rows[0]);
      setDetectedHeaders(headers);
      const columnMapping = mapColumns(headers, targetConfig.custom_columns);
      
      const hasCompany = Object.values(columnMapping).includes('company_name');
      const hasPhone = Object.values(columnMapping).includes('phone');
      
      if (!hasCompany && !hasPhone) {
        throw new Error('No se encontraron columnas reconocibles. Necesitas al menos "Empresa" o "Teléfono".');
      }
      
      const result: SyncResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      
      for (const row of rows) {
        try {
          const leadData: any = {
            user_id: user.id,
            source: 'google_sheets',
          };
          
          for (const [originalHeader, dbField] of Object.entries(columnMapping)) {
            const value = row[originalHeader]?.trim();
            if (value) {
              if (dbField === 'tags') {
                leadData[dbField] = value.split(',').map((t: string) => t.trim()).filter(Boolean);
              } else {
                leadData[dbField] = value;
              }
            }
          }
          
          if (leadData.phone) {
            const normalizedPhone = normalizePhone(leadData.phone);
            if (normalizedPhone) {
              leadData.phone = normalizedPhone;
              leadData.phone_type = detectPhoneType(normalizedPhone);
              
              if (leadData.phone_type === 'mobile') {
                leadData.mobile_phone = normalizedPhone;
              }
            }
          }
          
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
          
          if (leadData.phone) {
            const { data: existing } = await supabase
              .from('leads')
              .select('id')
              .eq('user_id', user.id)
              .eq('phone', leadData.phone)
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
              const { error } = await supabase.from('leads').insert(leadData);
              if (error) throw error;
              result.inserted++;
            }
          } else {
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
              const { error } = await supabase.from('leads').insert(leadData);
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
    onSuccess: (result, targetConfig) => {
      setLastResult(result);
      updateConfig.mutate({ 
        id: targetConfig.id, 
        last_sync_at: new Date().toISOString() 
      });
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

  const sync = useCallback(async (targetConfig?: GoogleSheetConfig) => {
    const configToSync = targetConfig || config;
    if (!configToSync || isSyncing) return;
    
    setIsSyncing(true);
    try {
      await syncMutation.mutateAsync(configToSync);
    } finally {
      setIsSyncing(false);
    }
  }, [config, isSyncing, syncMutation]);

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
      autoSyncIntervalRef.current = null;
    }
    
    if (config?.auto_sync_enabled && config?.spreadsheet_id) {
      const intervalMs = config.auto_sync_interval * 60 * 1000;
      
      autoSyncIntervalRef.current = setInterval(() => {
        console.log('🔄 Auto-sync triggered for', config.name);
        sync(config);
      }, intervalMs);
      
      console.log(`⏰ Auto-sync enabled for ${config.name}: every ${config.auto_sync_interval} minutes`);
    }
    
    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [config?.auto_sync_enabled, config?.auto_sync_interval, config?.spreadsheet_id, config?.name]);

  return {
    config,
    sync,
    isSyncing,
    lastResult,
    detectedHeaders,
    fetchHeaders,
  };
}
