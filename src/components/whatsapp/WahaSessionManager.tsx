import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import {
  Loader2, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  RefreshCw, 
  Trash2, 
  Wifi,
  WifiOff,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getConnectionState,
  connectInstance,
  restartInstance,
  logoutInstance,
  type ConnectionState,
} from '@/services/evolutionService';

export function WahaSessionManager() {
  const [status, setStatus] = useState<ConnectionState | 'loading'>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const state = await getConnectionState();
      setStatus(state);
      setLoading(false);

      // If disconnected, try to get QR
      if (state === 'close') {
        const qrData = await connectInstance();
        if (qrData) {
          if (qrData.base64) {
            setQrBase64(qrData.base64);
            setQrCode(null);
          } else if (qrData.code) {
            setQrCode(qrData.code);
            setQrBase64(null);
          }
        }
      } else {
        setQrCode(null);
        setQrBase64(null);
      }
    } catch (error) {
      console.error('Error fetching connection state:', error);
      setStatus('close');
      setLoading(false);
    }
  }, []);

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await restartInstance();
      toast.success('Instancia reiniciada');
      await fetchStatus();
    } catch (error: any) {
      toast.error(error.message || 'Error al reiniciar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await logoutInstance();
      toast.success('Sesión cerrada');
      setStatus('close');
      setQrCode(null);
      setQrBase64(null);
      await fetchStatus();
    } catch (error: any) {
      toast.error(error.message || 'Error al cerrar sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const qrData = await connectInstance();
      if (qrData?.base64) {
        setQrBase64(qrData.base64);
        setQrCode(null);
      } else if (qrData?.code) {
        setQrCode(qrData.code);
        setQrBase64(null);
      } else {
        toast.info('Esperando QR...');
      }
      await fetchStatus();
    } catch (error: any) {
      toast.error(error.message || 'Error al conectar');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const getStatusBadge = () => {
    switch (status) {
      case 'open':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Conectando
          </Badge>
        );
      case 'close':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
            <WifiOff className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Verificando...
          </Badge>
        );
    }
  };

  const renderQrCode = () => {
    if (qrBase64) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <img
            src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
            alt="Código QR de WhatsApp"
            className="w-64 h-64 object-contain"
          />
        </div>
      );
    }

    if (qrCode) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <QRCodeSVG value={qrCode} size={256} level="M" includeMargin={false} />
        </div>
      );
    }

    return (
      <div className="w-64 h-64 bg-muted rounded-lg flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Esperando QR de WhatsApp...</p>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="py-3 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Verificando conexión Evolution API...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="py-3">
        <div className="flex flex-col gap-4">
          {/* Header with status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">WhatsApp (Evolution API)</p>
                <p className="text-xs text-muted-foreground">Instancia: CRM</p>
              </div>
              {getStatusBadge()}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchStatus}
                disabled={actionLoading}
                title="Actualizar estado"
              >
                <RefreshCw className={`h-4 w-4 ${actionLoading ? 'animate-spin' : ''}`} />
              </Button>

              {status === 'close' && (
                <Button
                  size="sm"
                  onClick={handleConnect}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Power className="h-4 w-4 mr-1" />
                  )}
                  Conectar
                </Button>
              )}

              {status === 'open' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestart}
                    disabled={actionLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reiniciar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLogout}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Cerrar Sesión
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* QR Code display */}
          {status === 'close' && (qrCode || qrBase64) && (
            <div className="flex flex-col items-center gap-3 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Escanea este código QR con WhatsApp en tu teléfono
              </p>
              {renderQrCode()}
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={actionLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
                Actualizar QR
              </Button>
              <p className="text-xs text-muted-foreground">
                El estado se actualiza automáticamente cada 8 segundos
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
