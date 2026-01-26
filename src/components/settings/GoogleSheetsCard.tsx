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
  Settings2, 
  Check, 
  AlertCircle,
  ExternalLink,
  Clock,
  Loader2,
} from 'lucide-react';
import { useGoogleSheetsSync } from '@/hooks/useGoogleSheetsSync';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function GoogleSheetsCard() {
  const { 
    config, 
    saveConfig, 
    sync, 
    isSyncing, 
    lastResult,
    isConfigured,
  } = useGoogleSheetsSync();
  
  const [isOpen, setIsOpen] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState(config.spreadsheetId);
  const [sheetName, setSheetName] = useState(config.sheetName);

  const handleSaveConfig = () => {
    saveConfig({ spreadsheetId, sheetName });
  };

  const extractSpreadsheetId = (input: string): string => {
    // Handle full URL or just ID
    const urlMatch = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    return input.trim();
  };

  const handleSpreadsheetIdChange = (value: string) => {
    const extracted = extractSpreadsheetId(value);
    setSpreadsheetId(extracted);
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
                Importa y sincroniza leads desde una hoja de cálculo de Google
              </CardDescription>
            </div>
          </div>
          {isConfigured && (
            <Badge variant="outline" className="text-primary border-primary">
              <Check className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={sync}
            disabled={!isConfigured || isSyncing}
            className="flex-1"
          >
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
          
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings2 className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Last Sync Info */}
        {config.lastSyncAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Última sincronización: {format(config.lastSyncAt, "d 'de' MMMM 'a las' HH:mm", { locale: es })}
          </div>
        )}

        {/* Last Result */}
        {lastResult && (
          <div className="flex items-center gap-2 flex-wrap">
            {lastResult.inserted > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                +{lastResult.inserted} nuevos
              </Badge>
            )}
            {lastResult.updated > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {lastResult.updated} actualizados
              </Badge>
            )}
            {lastResult.skipped > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {lastResult.skipped} errores
              </Badge>
            )}
          </div>
        )}

        {/* Configuration Panel */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="space-y-4 pt-4 border-t">
            {/* Instructions */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Tu hoja de Google debe ser pública. 
                Ve a <em>Archivo → Compartir → Publicar en la web</em> o comparte 
                con "Cualquier persona con el enlace puede ver".
              </AlertDescription>
            </Alert>

            {/* Spreadsheet ID */}
            <div className="space-y-2">
              <Label htmlFor="spreadsheet-id">ID de la Hoja de Cálculo</Label>
              <Input
                id="spreadsheet-id"
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                value={spreadsheetId}
                onChange={(e) => handleSpreadsheetIdChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pega la URL completa de tu Google Sheet o solo el ID (el código largo en la URL)
              </p>
            </div>

            {/* Sheet Name */}
            <div className="space-y-2">
              <Label htmlFor="sheet-name">Nombre de la Hoja</Label>
              <Input
                id="sheet-name"
                placeholder="Hoja 1"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El nombre de la pestaña dentro del documento (por defecto: "Hoja 1")
              </p>
            </div>

            {/* Auto-Sync */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label>Auto-Sync</Label>
                <p className="text-xs text-muted-foreground">
                  Sincronizar automáticamente cada {config.autoSyncInterval} minutos
                </p>
              </div>
              <Switch
                checked={config.autoSyncEnabled}
                onCheckedChange={(checked) => saveConfig({ autoSyncEnabled: checked })}
                disabled={!isConfigured}
              />
            </div>

            {/* Auto-Sync Interval */}
            {config.autoSyncEnabled && (
              <div className="space-y-2">
                <Label htmlFor="sync-interval">Intervalo (minutos)</Label>
                <Input
                  id="sync-interval"
                  type="number"
                  min={1}
                  max={60}
                  value={config.autoSyncInterval}
                  onChange={(e) => saveConfig({ autoSyncInterval: parseInt(e.target.value) || 10 })}
                />
              </div>
            )}

            {/* Column Mapping Info */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Columnas reconocidas automáticamente:</p>
              <div className="flex flex-wrap gap-1">
                {['Empresa', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Ciudad', 'Web', 'Notas'].map(col => (
                  <Badge key={col} variant="outline" className="text-xs">
                    {col}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Los teléfonos se normalizan automáticamente (ej: "600 123 456" → "34600123456")
              </p>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveConfig} className="flex-1">
                Guardar Configuración
              </Button>
              <Button
                variant="outline"
                size="icon"
                asChild
              >
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir hoja en Google"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
