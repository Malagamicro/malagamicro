import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  Plus, 
  Check, 
  AlertCircle,
  ExternalLink,
  Clock,
  Loader2,
  Trash2,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { 
  useGoogleSheetsConfigs, 
  useGoogleSheetsSync,
  LEAD_FIELDS,
  type CustomColumnMapping,
  type GoogleSheetConfig 
} from '@/hooks/useGoogleSheetsSync';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function SheetConfigItem({ config }: { config: GoogleSheetConfig }) {
  const { updateConfig, deleteConfig } = useGoogleSheetsConfigs();
  const { sync, isSyncing, lastResult, detectedHeaders, fetchHeaders } = useGoogleSheetsSync(config.id);
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumnMapping[]>(config.custom_columns || []);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);

  const handleLoadHeaders = async () => {
    setLoadingHeaders(true);
    try {
      const headers = await fetchHeaders(config.spreadsheet_id, config.sheet_name);
      setAvailableHeaders(headers);
    } catch (err: any) {
      console.error('Error loading headers:', err);
    } finally {
      setLoadingHeaders(false);
    }
  };

  const handleAddCustomColumn = () => {
    setCustomColumns([...customColumns, { sheetColumn: '', leadField: '' }]);
  };

  const handleRemoveCustomColumn = (index: number) => {
    setCustomColumns(customColumns.filter((_, i) => i !== index));
  };

  const handleUpdateCustomColumn = (index: number, field: 'sheetColumn' | 'leadField', value: string) => {
    const updated = [...customColumns];
    updated[index] = { ...updated[index], [field]: value };
    setCustomColumns(updated);
  };

  const handleSaveColumns = () => {
    updateConfig.mutate({ id: config.id, custom_columns: customColumns });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{config.name}</p>
            <p className="text-xs text-muted-foreground">{config.sheet_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => sync()}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {config.last_sync_at && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Última sync: {format(new Date(config.last_sync_at), "d MMM HH:mm", { locale: es })}
        </p>
      )}

      {lastResult && (
        <div className="flex items-center gap-2 flex-wrap">
          {lastResult.inserted > 0 && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
              +{lastResult.inserted} nuevos
            </Badge>
          )}
          {lastResult.updated > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
              {lastResult.updated} actualizados
            </Badge>
          )}
        </div>
      )}

      {expanded && (
        <div className="space-y-4 pt-3 border-t">
          {/* Auto-sync */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Sync</Label>
              <p className="text-xs text-muted-foreground">
                Cada {config.auto_sync_interval} minutos
              </p>
            </div>
            <Switch
              checked={config.auto_sync_enabled}
              onCheckedChange={(checked) => updateConfig.mutate({ id: config.id, auto_sync_enabled: checked })}
            />
          </div>

          {config.auto_sync_enabled && (
            <div className="space-y-2">
              <Label>Intervalo (minutos)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={config.auto_sync_interval}
                onChange={(e) => updateConfig.mutate({ id: config.id, auto_sync_interval: parseInt(e.target.value) || 10 })}
              />
            </div>
          )}

          {/* Custom Columns */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mapeo de columnas personalizadas</Label>
              <Button size="sm" variant="outline" onClick={handleLoadHeaders} disabled={loadingHeaders}>
                {loadingHeaders ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Detectar columnas'}
              </Button>
            </div>
            
            {customColumns.map((col, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {availableHeaders.length > 0 ? (
                  <Select
                    value={col.sheetColumn}
                    onValueChange={(v) => handleUpdateCustomColumn(idx, 'sheetColumn', v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Columna del Sheet" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Columna del Sheet"
                    value={col.sheetColumn}
                    onChange={(e) => handleUpdateCustomColumn(idx, 'sheetColumn', e.target.value)}
                    className="flex-1"
                  />
                )}
                <span className="text-muted-foreground">→</span>
                <Select
                  value={col.leadField}
                  onValueChange={(v) => handleUpdateCustomColumn(idx, 'leadField', v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Campo del Lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_FIELDS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => handleRemoveCustomColumn(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAddCustomColumn}>
                <Plus className="h-3 w-3 mr-1" />
                Añadir columna
              </Button>
              {customColumns.length > 0 && (
                <Button size="sm" onClick={handleSaveColumns}>
                  Guardar mapeo
                </Button>
              )}
            </div>
          </div>

          {/* Link to sheet */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`https://docs.google.com/spreadsheets/d/${config.spreadsheet_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Sheet
              </a>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta configuración?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la conexión con "{config.name}". Los leads importados no se eliminarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfig.mutate(config.id)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function GoogleSheetsCard() {
  const { configs, isLoading, createConfig } = useGoogleSheetsConfigs();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSpreadsheetId, setNewSpreadsheetId] = useState('');
  const [newSheetName, setNewSheetName] = useState('Hoja 1');

  const extractSpreadsheetId = (input: string): string => {
    const urlMatch = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) return urlMatch[1];
    return input.trim();
  };

  const handleCreate = () => {
    createConfig.mutate({
      name: newName || 'Mi hoja de cálculo',
      spreadsheet_id: extractSpreadsheetId(newSpreadsheetId),
      sheet_name: newSheetName || 'Hoja 1',
      auto_sync_enabled: false,
      auto_sync_interval: 10,
      custom_columns: [],
    }, {
      onSuccess: () => {
        setShowAddDialog(false);
        setNewName('');
        setNewSpreadsheetId('');
        setNewSheetName('Hoja 1');
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Sheets Sync</CardTitle>
              <CardDescription>
                Importa y sincroniza leads desde hojas de cálculo de Google
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Añadir
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay hojas de cálculo conectadas</p>
            <p className="text-sm">Añade una para empezar a importar leads</p>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map(config => (
              <SheetConfigItem key={config.id} config={config} />
            ))}
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Tu hoja de Google debe ser pública. 
            Ve a <em>Archivo → Compartir → Publicar en la web</em> o comparte 
            con "Cualquier persona con el enlace puede ver".
          </AlertDescription>
        </Alert>
      </CardContent>

      {/* Add Sheet Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir hoja de cálculo</DialogTitle>
            <DialogDescription>
              Conecta una hoja de Google Sheets para importar leads
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre (para identificar)</Label>
              <Input
                id="name"
                placeholder="Ej: Leads Marketing"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="spreadsheet-id">URL o ID de la hoja</Label>
              <Input
                id="spreadsheet-id"
                placeholder="Pega la URL completa o el ID"
                value={newSpreadsheetId}
                onChange={(e) => setNewSpreadsheetId(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sheet-name">Nombre de la pestaña</Label>
              <Input
                id="sheet-name"
                placeholder="Hoja 1"
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newSpreadsheetId || createConfig.isPending}>
              {createConfig.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
