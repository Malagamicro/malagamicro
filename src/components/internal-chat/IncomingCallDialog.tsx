import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';

interface IncomingCallDialogProps {
  open: boolean;
  callerName: string;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallDialog({ open, callerName, isVideo, onAccept, onReject }: IncomingCallDialogProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!open) return;

    // 1. Vibrate on mobile
    if ('vibrate' in navigator) {
      const vibrateLoop = () => {
        if (!open) return;
        navigator.vibrate([400, 200, 400, 200, 400, 1000]);
      };
      vibrateLoop();
      const vibrateInterval = setInterval(vibrateLoop, 2600);
      
      // 2. Play ringtone using Audio element (works better on mobile than AudioContext)
      const audio = new Audio();
      // Generate a simple ringtone as data URI using an oscillator via OfflineAudioContext
      try {
        const offCtx = new OfflineAudioContext(1, 44100 * 4, 44100);
        // Ring pattern: two tones alternating
        for (let i = 0; i < 4; i++) {
          const osc = offCtx.createOscillator();
          const gain = offCtx.createGain();
          osc.connect(gain);
          gain.connect(offCtx.destination);
          osc.frequency.value = i % 2 === 0 ? 440 : 520;
          gain.gain.value = 0.3;
          osc.start(i * 0.8);
          osc.stop(i * 0.8 + 0.4);
        }
        offCtx.startRendering().then(buffer => {
          const audioCtx = new AudioContext();
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(audioCtx.destination);
          source.start();
          audioRef.current = { pause: () => { source.stop(); audioCtx.close(); } } as any;
        }).catch(() => {});
      } catch {
        // Fallback: simple beep
      }

      // 3. Show persistent toast for mobile (in case dialog is obscured)
      toastIdRef.current = toast(
        isVideo ? '📹 Videollamada entrante' : '📞 Llamada entrante',
        {
          description: `${callerName} te está llamando`,
          duration: 30000,
          action: {
            label: 'Contestar',
            onClick: onAccept,
          },
          cancel: {
            label: 'Rechazar',
            onClick: onReject,
          },
        }
      );

      // 4. System notification for background
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification(
            isVideo ? '📹 Videollamada entrante' : '📞 Llamada entrante',
            {
              body: `${callerName} te está llamando`,
              tag: 'incoming-call',
              requireInteraction: true,
              vibrate: [400, 200, 400, 200, 400],
            } as NotificationOptions
          );
          notif.onclick = () => {
            window.focus();
            notif.close();
          };

          return () => {
            clearInterval(vibrateInterval);
            navigator.vibrate?.(0);
            audioRef.current?.pause();
            audioRef.current = null;
            notif.close();
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          };
        } catch { /* not supported */ }
      }

      return () => {
        clearInterval(vibrateInterval);
        navigator.vibrate?.(0);
        audioRef.current?.pause();
        audioRef.current = null;
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
      };
    }

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    };
  }, [open, callerName, isVideo, onAccept, onReject]);

  const initials = callerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onReject()}>
      <DialogContent className="max-w-sm mx-auto p-0 overflow-hidden border-0 rounded-2xl z-[9999]">
        <DialogTitle className="sr-only">Llamada entrante de {callerName}</DialogTitle>
        <div className="bg-gradient-to-b from-primary/90 to-primary flex flex-col items-center py-10 px-6 text-primary-foreground">
          {/* Pulsing avatar */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping" />
            <Avatar className="h-20 w-20 border-4 border-primary-foreground/30 relative z-10">
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <h3 className="text-xl font-semibold mb-1">{callerName}</h3>
          <p className="text-sm opacity-80 mb-2">
            {isVideo ? '📹 Videollamada entrante...' : '📞 Llamada entrante...'}
          </p>
          <p className="text-xs opacity-60 mb-8">
            {isVideo ? 'Se activará tu cámara y micrófono' : 'Se activará tu micrófono'}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-8">
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="h-14 w-14 rounded-full bg-destructive flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <PhoneOff className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs opacity-80">Rechazar</span>
            </button>

            <button
              onClick={onAccept}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="h-14 w-14 rounded-full bg-green-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform animate-bounce">
                {isVideo ? <Video className="h-6 w-6 text-white" /> : <Phone className="h-6 w-6 text-white" />}
              </div>
              <span className="text-xs opacity-80">Aceptar</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
