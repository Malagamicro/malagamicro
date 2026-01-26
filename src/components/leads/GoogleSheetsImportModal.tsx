import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  Plus, 
  Loader2,
  Check,
  ExternalLink,
} from 'lucide-react';
import { 
  useGoogleSheetsConfigs, 
  useGoogleSheetsSync,
  type GoogleSheetConfig 
} from '@/hooks/useGoogleSheetsSync';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GoogleSheetsImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleSheetsImportModal({ open, onOpenChange }: GoogleSheetsImportModalProps) {
  const { configs, isLoading, createConfig } = useGoogleSheetsConfigs();
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickSpreadsheetId, setQuickSpreadsheetId] = useState('');
  const [quickSheetName, setQuickSheetName] = useState('Hoja 1');
  
  const selectedConfig = configs.find(c => c.id === selectedConfigId);
  const { sync, isSyncing, lastResult } = useGoogleSheetsSync(selectedConfigId);

  const extractSpreadsheetId = (input: string): string => {
    const urlMatch = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) return urlMatch[1];
    return input.trim();
  };

  const handleQuickAdd = () => {
    if (!quickSpreadsheetId) return;
    
    createConfig.mutate({
      name: `Sheet ${format(new Date(), 'dd/MM HH:mm')}`,
      spreadsheet_id: extractSpreadsheetId(quickSpreadsheetId),
      sheet_name: quickSheetName || 'Hoja 1',
      auto_sync_enabled: false,
      auto_sync_interval: 10,
      custom_columns: [],
    }, {
      onSuccess: (data) => {
        setShowQuickAdd(false);
        setQuickSpreadsheetId('');
        setQuickSheetName('Hoja 1');
        if (data?.id) {
          setSelectedConfigId(data.id);
        }
      },
    });
  };

  const handleSync = async () => {
    if (!selectedConfig) return;
    await sync(selectedConfig);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar desde Google Sheets
          </DialogTitle>
          <DialogDescription>
            Selecciona una hoja de cálculo para sincronizar leads
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 && !showQuickAdd ? (
            <div className="text-center py-6">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No hay hojas configuradas</p>
              <Button onClick={() => setShowQuickAdd(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir hoja
              </Button>
            </div>
          ) : showQuickAdd ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL o ID de la hoja de Google</Label>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/... o el ID"
                  value={quickSpreadsheetId}
                  onChange={(e) => setQuickSpreadsheetId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre de la pestaña</Label>
                <Input
                  placeholder="Hoja 1"
                  value={quickSheetName}
                  onChange={(e) => setQuickSheetName(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Asegúrate de que la hoja sea pública (Archivo → Compartir → Cualquier persona con el enlace)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowQuickAdd(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleQuickAdd} disabled={!quickSpreadsheetId || createConfig.isPending}>
                  {createConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Añadir y seleccionar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sheet selector */}
              <div className="space-y-2">
                <Label>Hoja de cálculo</Label>
                <div className="flex gap-2">
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona una hoja" />
                    </SelectTrigger>
                    <SelectContent>
                      {configs.map(config => (
                        <SelectItem key={config.id} value={config.id}>
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            {config.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setShowQuickAdd(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Selected sheet info */}
              {selectedConfig && (
                <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedConfig.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Pestaña: {selectedConfig.sheet_name}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                    >
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${selectedConfig.spreadsheet_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  
                  {selectedConfig.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Última sincronización: {format(new Date(selectedConfig.last_sync_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                    </p>
                  )}

                  {lastResult && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {lastResult.inserted > 0 && (
                        <Badge variant="default">
                          <Check className="h-3 w-3 mr-1" />
                          {lastResult.inserted} nuevos
                        </Badge>
                      )}
                      {lastResult.updated > 0 && (
                        <Badge variant="secondary">
                          {lastResult.updated} actualizados
                        </Badge>
                      )}
                      {lastResult.skipped > 0 && (
                        <Badge variant="outline">
                          {lastResult.skipped} errores
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {!showQuickAdd && selectedConfig && (
            <Button onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Ahora
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
