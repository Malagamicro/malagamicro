import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, 
  Smartphone, 
  CheckCircle2, 
  Bell, 
  Wifi, 
  Zap,
  Share,
  Plus,
  MoreVertical,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: Bell,
      title: 'Notificaciones Push',
      description: 'Recibe alertas de nuevos mensajes y recordatorios',
    },
    {
      icon: Wifi,
      title: 'Funciona Offline',
      description: 'Accede a tus datos incluso sin conexión',
    },
    {
      icon: Zap,
      title: 'Acceso Rápido',
      description: 'Abre la app directamente desde tu pantalla de inicio',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* App Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-xl mb-4 ring-2 ring-primary/20">
            <img 
              src="/pwa-icons/icon-192x192.png" 
              alt="MalagaMicro CRM" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MalagaMicro CRM</h1>
          <p className="text-muted-foreground mt-1">Instalar aplicación</p>
        </div>

        {/* Status Card */}
        {isInstalled ? (
          <Card className="mb-8 border-green-500/30 bg-green-500/5">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <h2 className="text-lg font-semibold text-foreground mb-1">
                ¡App Instalada!
              </h2>
              <p className="text-sm text-muted-foreground">
                Puedes abrir MalagaMicro desde tu pantalla de inicio
              </p>
              <Button 
                className="mt-4" 
                onClick={() => navigate('/')}
              >
                Ir al Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardContent className="py-6">
              {/* Chrome/Android install */}
              {deferredPrompt && (
                <div className="text-center">
                  <Smartphone className="h-12 w-12 mx-auto mb-3 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Instalar en tu dispositivo
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Añade MalagaMicro a tu pantalla de inicio para un acceso más rápido
                  </p>
                  <Button onClick={handleInstall} size="lg" className="w-full">
                    <Download className="h-5 w-5 mr-2" />
                    Instalar Aplicación
                  </Button>
                </div>
              )}

              {/* iOS instructions */}
              {isIOS && !deferredPrompt && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
                    Cómo instalar en iPhone/iPad
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">1</span>
                      </div>
                      <div>
                        <p className="font-medium">Toca el botón Compartir</p>
                        <p className="text-sm text-muted-foreground">
                          En Safari, toca <Share className="h-4 w-4 inline mx-1" /> en la barra inferior
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">2</span>
                      </div>
                      <div>
                        <p className="font-medium">Selecciona "Añadir a pantalla de inicio"</p>
                        <p className="text-sm text-muted-foreground">
                          Desliza hacia abajo y toca <Plus className="h-4 w-4 inline mx-1" /> Añadir a pantalla de inicio
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">3</span>
                      </div>
                      <div>
                        <p className="font-medium">Confirma la instalación</p>
                        <p className="text-sm text-muted-foreground">
                          Toca "Añadir" en la esquina superior derecha
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Android Chrome instructions (fallback) */}
              {isAndroid && !deferredPrompt && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
                    Cómo instalar en Android
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">1</span>
                      </div>
                      <div>
                        <p className="font-medium">Abre el menú de Chrome</p>
                        <p className="text-sm text-muted-foreground">
                          Toca <MoreVertical className="h-4 w-4 inline mx-1" /> en la esquina superior derecha
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">2</span>
                      </div>
                      <div>
                        <p className="font-medium">Selecciona "Instalar aplicación"</p>
                        <p className="text-sm text-muted-foreground">
                          O "Añadir a pantalla de inicio"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">3</span>
                      </div>
                      <div>
                        <p className="font-medium">Confirma la instalación</p>
                        <p className="text-sm text-muted-foreground">
                          Toca "Instalar" para añadir la app
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Desktop fallback */}
              {!isIOS && !isAndroid && !deferredPrompt && (
                <div className="text-center">
                  <Smartphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Abre esta página en tu móvil
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Visita <strong>malagamicro.lovable.app/install</strong> desde tu teléfono para instalar la aplicación
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            Ventajas de instalar
          </h3>
          {features.map((feature, index) => (
            <Card key={index} className="bg-card/50">
              <CardContent className="py-4 flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{feature.title}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Back to app */}
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Continuar en el navegador
          </Button>
        </div>
      </div>
    </div>
  );
}
