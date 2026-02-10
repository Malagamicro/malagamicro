import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video, VideoOff, Maximize2, Minimize2 } from 'lucide-react';

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!open || !jitsiContainerRef.current) return;

    // Load Jitsi Meet API script
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => {
      if (!jitsiContainerRef.current) return;
      
      const api = new (window as any).JitsiMeetExternalAPI('meet.jit.si', {
        roomName: `malagamicro-${roomName}`,
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: !isVideoCall,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          defaultLanguage: 'es',
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#1a1a2e',
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'chat',
            'raisehand', 'participants-pane', 'tileview',
            'hangup',
          ],
        },
        userInfo: {
          displayName: displayName,
        },
      });

      api.addEventListener('readyToClose', () => {
        onClose();
      });

      apiRef.current = api;
    };

    document.body.appendChild(script);

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
      script.remove();
    };
  }, [open, roomName, displayName, isVideoCall, onClose]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent 
        className={`p-0 overflow-hidden border-0 ${
          isFullscreen 
            ? 'max-w-[100vw] max-h-[100vh] w-screen h-screen rounded-none' 
            : 'max-w-[90vw] max-h-[85vh] w-[900px] h-[600px]'
        }`}
      >
        <div className="relative w-full h-full bg-black">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-50 bg-black/50 hover:bg-black/70 text-white h-8 w-8"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <div ref={jitsiContainerRef} className="w-full h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
