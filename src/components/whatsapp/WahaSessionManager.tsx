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
  Plus,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSessionStatus,
  getSessionQrCode,
  createSession,
  startSession,
  stopSession,
  restartSession,
  deleteSession,
  type SessionStatus,
  type SessionInfo,
} from '@/services/wahaService';

export function WahaSessionManager() {
  const [status, setStatus] = useState<SessionStatus>('NOT_FOUND');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getSessionStatus();
      
      if (!data) {
        setStatus('NOT_FOUND');
        setSessionInfo(null);
        setQrCode(null);
        setLoading(false);
        return;
      }

      console.log('📱 Session data:', data);
      setSessionInfo(data);
      setStatus(data.status);
      setLoading(false);

      // If status is SCAN_QR_CODE, obtain the WhatsApp login QR.
      // Some WAHA versions return it directly in `qr`, others require calling /auth/qr.
      if (data.status === 'SCAN_QR_CODE') {
        const directQr =
          typeof (data as any).qr === 'string'
            ? ((data as any).qr as string)
            : ((data as any).qr?.value as string | undefined) ||
              ((data as any).qr?.data as string | undefined) ||
              null;

        if (directQr) {
          console.log('📲 QR from session response:', directQr.substring(0, 50) + '...');
          setQrCode(directQr);
          return;
        }

        const qr = await getSessionQrCode();
        setQrCode(qr);
        return;
      }

      setQrCode(null);
    } catch (error) {
      console.error('Error fetching session status:', error);
      setStatus('NOT_FOUND');
      setLoading(false);
    }
  }, []);

  const handleCreateSession = async () => {
    setActionLoading(true);
    try {
      await createSession();
      toast.success('Sesión creada correctamente');
      await fetchStatus();
    } catch (error: any) {
      console.error('Error creating session:', error);
      toast.error(error.message || 'Error al crear la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartSession = async () => {
    setActionLoading(true);
    try {
      await startSession();
      toast.success('Sesión iniciada');
      await fetchStatus();
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast.error(error.message || 'Error al iniciar la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopSession = async () => {
    setActionLoading(true);
    try {
      await stopSession();
      toast.success('Sesión detenida');
      await fetchStatus();
    } catch (error: any) {
      console.error('Error stopping session:', error);
      toast.error(error.message || 'Error al detener la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    setActionLoading(true);
    try {
      await deleteSession();
      toast.success('Sesión eliminada');
      setStatus('NOT_FOUND');
      setSessionInfo(null);
      setQrCode(null);
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(error.message || 'Error al eliminar la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestartSession = async () => {
    setActionLoading(true);
    try {
      await restartSession();
      toast.success('Sesión reiniciada');
      await fetchStatus();
    } catch (error: any) {
      console.error('Error restarting session:', error);
      toast.error(error.message || 'Error al reiniciar la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const getStatusBadge = () => {
    switch (status) {
      case 'WORKING':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'SCAN_QR_CODE':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <QrCode className="h-3 w-3 mr-1" />
            Escanear QR
          </Badge>
        );
      case 'STARTING':
        return (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Iniciando
          </Badge>
        );
      case 'STOPPED':
        return (
          <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">
            <WifiOff className="h-3 w-3 mr-1" />
            Detenido
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case 'NOT_FOUND':
      default:
        return (
          <Badge className="bg-muted text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Sin sesión
          </Badge>
        );
    }
  };

  const renderQrCode = () => {
    if (!qrCode) {
      return (
        <div className="w-64 h-64 bg-muted rounded-lg flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Esperando QR de WhatsApp...</p>
        </div>
      );
    }

    // Some fetch paths return an image blob (we prefix it with image: in the service)
    if (qrCode.startsWith('image:')) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <img
            src={qrCode.replace('image:', '')}
            alt="Código QR de inicio de sesión de WhatsApp"
            className="w-64 h-64 object-contain"
          />
        </div>
      );
    }

    // Otherwise it's raw QR data, render with qrcode.react
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <QRCodeSVG value={qrCode} size={256} level="M" includeMargin={false} />
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="py-3 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Verificando conexión WAHA...</span>
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
                <p className="text-sm font-medium">Sesión WAHA</p>
                {sessionInfo?.me?.pushName && (
                  <p className="text-xs text-muted-foreground">
                    {sessionInfo.me.pushName}
                  </p>
                )}
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

              {status === 'NOT_FOUND' && (
                <Button
                  size="sm"
                  onClick={handleCreateSession}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Crear Sesión
                </Button>
              )}

              {status === 'STOPPED' && (
                <Button
                  size="sm"
                  onClick={handleStartSession}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Iniciar
                </Button>
              )}

              {(status === 'WORKING' || status === 'SCAN_QR_CODE' || status === 'FAILED') && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestartSession}
                    disabled={actionLoading}
                    title="Reiniciar sesión"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reiniciar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSession}
                    disabled={actionLoading}
                    title="Eliminar sesión"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* QR Code display */}
          {status === 'SCAN_QR_CODE' && (
            <div className="flex flex-col items-center gap-3 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Escanea este código QR con WhatsApp en tu teléfono
              </p>
              {renderQrCode()}
              <p className="text-xs text-muted-foreground">
                El código se actualiza automáticamente cada 5 segundos
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
