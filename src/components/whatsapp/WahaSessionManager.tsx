import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const WAHA_API_URL = 'http://localhost:3000';
const WAHA_API_KEY = '12345678';
const SESSION_NAME = 'default';

type SessionStatus = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'NOT_FOUND';

interface SessionInfo {
  name: string;
  status: SessionStatus;
  me?: {
    id: string;
    pushName: string;
  };
}

export function WahaSessionManager() {
  const [status, setStatus] = useState<SessionStatus>('NOT_FOUND');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSessionStatus = useCallback(async () => {
    try {
      const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}`, {
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (response.status === 404) {
        setStatus('NOT_FOUND');
        setSessionInfo(null);
        setQrCode(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Error al obtener estado de sesión');
      }

      const data: SessionInfo = await response.json();
      setSessionInfo(data);
      setStatus(data.status);

      // If status is SCAN_QR_CODE, fetch the QR
      if (data.status === 'SCAN_QR_CODE') {
        await fetchQrCode();
      } else {
        setQrCode(null);
      }
    } catch (error) {
      console.error('Error fetching session status:', error);
      setStatus('NOT_FOUND');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQrCode = async () => {
    try {
      const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}/auth/qr`, {
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (response.ok) {
        // The QR endpoint returns an image
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setQrCode(imageUrl);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    }
  };

  const createSession = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${WAHA_API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': WAHA_API_KEY,
        },
        body: JSON.stringify({
          name: SESSION_NAME,
          start: true,
          config: {
            noweb: {
              store: {
                enabled: true,
                fullSync: false,
              },
            },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear sesión');
      }

      toast.success('Sesión creada correctamente');
      await fetchSessionStatus();
    } catch (error: any) {
      console.error('Error creating session:', error);
      toast.error(error.message || 'Error al crear la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const startSession = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': WAHA_API_KEY,
        },
        body: JSON.stringify({
          config: {
            noweb: {
              store: {
                enabled: true,
                fullSync: false,
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Error al iniciar sesión');
      }

      toast.success('Sesión iniciada');
      await fetchSessionStatus();
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast.error(error.message || 'Error al iniciar la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const stopSession = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}/stop`, {
        method: 'POST',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error('Error al detener sesión');
      }

      toast.success('Sesión detenida');
      await fetchSessionStatus();
    } catch (error: any) {
      console.error('Error stopping session:', error);
      toast.error(error.message || 'Error al detener la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteSession = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}`, {
        method: 'DELETE',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error('Error al eliminar sesión');
      }

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

  const restartSession = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${WAHA_API_URL}/api/sessions/${SESSION_NAME}/restart`, {
        method: 'POST',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error('Error al reiniciar sesión');
      }

      toast.success('Sesión reiniciada');
      await fetchSessionStatus();
    } catch (error: any) {
      console.error('Error restarting session:', error);
      toast.error(error.message || 'Error al reiniciar la sesión');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionStatus();
    
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchSessionStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchSessionStatus]);

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
                onClick={fetchSessionStatus}
                disabled={actionLoading}
                title="Actualizar estado"
              >
                <RefreshCw className={`h-4 w-4 ${actionLoading ? 'animate-spin' : ''}`} />
              </Button>

              {status === 'NOT_FOUND' && (
                <Button
                  size="sm"
                  onClick={createSession}
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
                  onClick={startSession}
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
                    onClick={restartSession}
                    disabled={actionLoading}
                    title="Reiniciar sesión"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reiniciar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteSession}
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
              {qrCode ? (
                <div className="bg-white p-4 rounded-lg">
                  <img 
                    src={qrCode} 
                    alt="WhatsApp QR Code" 
                    className="w-48 h-48 object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                El código se actualiza automáticamente
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
