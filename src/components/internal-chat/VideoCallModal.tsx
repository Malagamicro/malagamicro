import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Mic, MicOff, Video, VideoOff, 
  Maximize2, Minimize2, PhoneOff, 
  MonitorUp, Users, MessageSquare,
  Hand, LayoutGrid, Copy, Share2
} from 'lucide-react';
import { toast } from 'sonner';

interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  displayName: string;
  isVideoCall: boolean;
}

export function VideoCallModal({ open, onClose, roomName, displayName, isVideoCall }: VideoCallModalProps) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoCall);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(1);

  const fullRoomName = `malagamicro-${roomName}`;

  useEffect(() => {
    if (!open || !jitsiContainerRef.current) return;

    // If script already loaded, reuse it
    const existingScript = document.querySelector('script[src="https://meet.jit.si/external_api.js"]');
    
    const initJitsi = () => {
      if (!jitsiContainerRef.current || apiRef.current) return;
      
      const api = new (window as any).JitsiMeetExternalAPI('meet.jit.si', {
        roomName: fullRoomName,
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: !isVideoCall,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          defaultLanguage: 'es',
          toolbarButtons: [],
          hideConferenceSubject: true,
          hideConferenceTimer: false,
          disableProfile: true,
          notifications: [],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#0f0f17',
          TOOLBAR_BUTTONS: [],
          FILM_STRIP_MAX_HEIGHT: 120,
          DISABLE_FOCUS_INDICATOR: true,
          DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
          HIDE_INVITE_MORE_HEADER: true,
        },
        userInfo: {
          displayName: displayName,
        },
      });

      api.addEventListener('readyToClose', () => onCloseRef.current());
      api.addEventListener('videoConferenceJoined', () => setIsLoading(false));
      api.addEventListener('participantJoined', () => {
        setParticipantCount(prev => prev + 1);
      });
      api.addEventListener('participantLeft', () => {
        setParticipantCount(prev => Math.max(1, prev - 1));
      });
      api.addEventListener('audioMuteStatusChanged', (e: any) => setIsMuted(e.muted));
      api.addEventListener('videoMuteStatusChanged', (e: any) => setIsVideoOff(e.muted));

      apiRef.current = api;
    };

    setIsLoading(true);

    if (existingScript && (window as any).JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = initJitsi;
      document.body.appendChild(script);
    }

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
      setIsLoading(true);
      setParticipantCount(1);
    };
  }, [open, fullRoomName, displayName, isVideoCall]);

  const toggleMute = () => apiRef.current?.executeCommand('toggleAudio');
  const toggleVideo = () => apiRef.current?.executeCommand('toggleVideo');
  const toggleScreenShare = () => apiRef.current?.executeCommand('toggleShareScreen');
  const toggleChat = () => apiRef.current?.executeCommand('toggleChat');
  const toggleRaiseHand = () => apiRef.current?.executeCommand('toggleRaiseHand');
  const toggleTileView = () => apiRef.current?.executeCommand('toggleTileView');
  const inviteParticipants = () => apiRef.current?.executeCommand('toggleParticipantsPane');

  const hangUp = () => {
    apiRef.current?.executeCommand('hangup');
    onClose();
  };

  const copyInviteLink = () => {
    const link = `https://meet.jit.si/${fullRoomName}`;
    navigator.clipboard.writeText(link);
    toast.success('Enlace copiado al portapapeles');
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent 
        className={`p-0 overflow-hidden border-0 gap-0 ${
          isFullscreen 
            ? 'max-w-[100vw] max-h-[100vh] w-screen h-screen rounded-none' 
            : 'max-w-[95vw] max-h-[90vh] w-[960px] h-[640px]'
        }`}
      >
        <div className="relative w-full h-full bg-[#0f0f17] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 z-10">
            <div className="flex items-center gap-2 text-white">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">
                {isLoading ? 'Conectando...' : 'En llamada'}
              </span>
              <span className="text-xs text-white/60 hidden sm:inline">
                · {participantCount} participante{participantCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8" onClick={copyInviteLink} title="Copiar enlace">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Jitsi container */}
          <div className="flex-1 min-h-0 relative">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#0f0f17]">
                <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-white/70 text-sm">Conectando a la sala...</p>
              </div>
            )}
            <div ref={jitsiContainerRef} className="w-full h-full" />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 px-4 py-3 bg-black/80 z-10">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full h-11 w-11 ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
              onClick={toggleMute}
              title={isMuted ? 'Activar micrófono' : 'Silenciar'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full h-11 w-11 ${isVideoOff ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
              onClick={toggleVideo}
              title={isVideoOff ? 'Activar cámara' : 'Desactivar cámara'}
            >
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 bg-white/10 text-white hover:bg-white/20 hidden sm:inline-flex" onClick={toggleScreenShare} title="Compartir pantalla">
              <MonitorUp className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 bg-white/10 text-white hover:bg-white/20" onClick={inviteParticipants} title="Participantes / Invitar">
              <Users className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 bg-white/10 text-white hover:bg-white/20 hidden sm:inline-flex" onClick={toggleChat} title="Chat">
              <MessageSquare className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 bg-white/10 text-white hover:bg-white/20 hidden sm:inline-flex" onClick={toggleRaiseHand} title="Levantar mano">
              <Hand className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 bg-white/10 text-white hover:bg-white/20 hidden sm:inline-flex" onClick={toggleTileView} title="Vista mosaico">
              <LayoutGrid className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-11 w-11 bg-red-600 text-white hover:bg-red-700 ml-2"
              onClick={hangUp}
              title="Colgar"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
