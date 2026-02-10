import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface IncomingCallDialogProps {
  open: boolean;
  callerName: string;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallDialog({ open, callerName, isVideo, onAccept, onReject }: IncomingCallDialogProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) {
      // Play ringtone using Web Audio oscillator
      const ctx = new AudioContext();
      let stopped = false;

      const playRing = async () => {
        for (let i = 0; i < 30 && !stopped; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = i % 2 === 0 ? 440 : 520;
          gain.gain.value = 0.15;
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
          await new Promise(r => setTimeout(r, 600));
        }
      };
      playRing();

      return () => {
        stopped = true;
        ctx.close();
      };
    }
  }, [open]);

  const initials = callerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onReject()}>
      <DialogContent className="max-w-sm mx-auto p-0 overflow-hidden border-0 rounded-2xl">
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
          <p className="text-sm opacity-80 mb-8">
            {isVideo ? 'Videollamada entrante...' : 'Llamada entrante...'}
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