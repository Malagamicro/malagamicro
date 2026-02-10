import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Mic, MicOff, Video, VideoOff, 
  PhoneOff, Maximize2, Minimize2,
  MonitorUp
} from 'lucide-react';
import { toast } from 'sonner';
import Peer, { MediaConnection } from 'peerjs';

interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  displayName: string;
  isVideoCall: boolean;
  /** The PeerJS ID of the remote user to call (only for the caller) */
  remotePeerId?: string;
  /** Whether this user is answering an incoming call */
  isReceiver?: boolean;
}

export function VideoCallModal({ 
  open, onClose, roomName, displayName, isVideoCall, 
  remotePeerId, isReceiver = false 
}: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoCall);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Generate a deterministic peer ID from roomName + role
  const myPeerId = `${roomName}-${isReceiver ? 'receiver' : 'caller'}`;

  useEffect(() => {
    if (!open) return;

    let destroyed = false;

    const setup = async () => {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideoCall,
        });

        if (destroyed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create PeerJS instance
        const peer = new Peer(myPeerId, {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ]
          }
        });

        peerRef.current = peer;

        peer.on('open', () => {
          if (destroyed) return;
          console.log('PeerJS connected as:', peer.id);

          // If we're the caller, call the remote peer
          if (!isReceiver && remotePeerId) {
            const targetId = `${roomName}-receiver`;
            console.log('Calling peer:', targetId);
            const call = peer.call(targetId, stream);
            handleCall(call);
          }
        });

        // If we're the receiver, listen for incoming calls
        peer.on('call', (call) => {
          if (destroyed) return;
          console.log('Received call from:', call.peer);
          call.answer(stream);
          handleCall(call);
        });

        peer.on('error', (err) => {
          console.error('PeerJS error:', err);
          if (err.type === 'peer-unavailable') {
            toast.error('El otro usuario aún no se ha conectado');
          }
        });

      } catch (err) {
        console.error('Media error:', err);
        toast.error('No se pudo acceder a cámara/micrófono');
        onCloseRef.current();
      }
    };

    setup();

    return () => {
      destroyed = true;
      cleanupCall();
    };
  }, [open, myPeerId, isVideoCall, isReceiver, remotePeerId, roomName]);

  const handleCall = (call: MediaConnection) => {
    callRef.current = call;

    call.on('stream', (remoteStream) => {
      console.log('Got remote stream');
      setIsConnecting(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      // Start timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    });

    call.on('close', () => {
      onCloseRef.current();
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      toast.error('Error en la llamada');
      onCloseRef.current();
    });
  };

  const cleanupCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    callRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.destroy();
    peerRef.current = null;
    localStreamRef.current = null;
    callRef.current = null;
    setCallDuration(0);
    setIsConnecting(true);
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      
      const sender = callRef.current?.peerConnection
        ?.getSenders()
        .find(s => s.track?.kind === 'video');

      if (sender) {
        sender.replaceTrack(screenTrack);
        screenTrack.onended = () => {
          const camTrack = localStreamRef.current?.getVideoTracks()[0];
          if (camTrack) sender.replaceTrack(camTrack);
        };
      }
    } catch {
      // User cancelled screen share
    }
  };

  const hangUp = () => {
    cleanupCall();
    onCloseRef.current();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && hangUp()}>
      <DialogContent 
        className={`p-0 overflow-hidden border-0 gap-0 ${
          isFullscreen 
            ? 'max-w-[100vw] max-h-[100vh] w-screen h-screen rounded-none' 
            : 'max-w-[95vw] max-h-[90vh] w-[800px] h-[600px] sm:rounded-lg'
        }`}
      >
        <DialogTitle className="sr-only">Llamada en curso</DialogTitle>
        <div className="relative w-full h-full bg-[#111] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 z-10">
            <div className="flex items-center gap-2 text-white">
              <div className={`h-2 w-2 rounded-full ${isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-sm font-medium">
                {isConnecting ? 'Conectando...' : formatDuration(callDuration)}
              </span>
            </div>
            <Button 
              variant="ghost" size="icon" 
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Video area */}
          <div className="flex-1 min-h-0 relative bg-[#111]">
            {/* Remote video (full) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {isConnecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111]">
                <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-white/70 text-sm">Esperando al otro participante...</p>
              </div>
            )}

            {/* Local video (PIP) */}
            <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-40 sm:h-30 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 bg-black/80 z-10">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full h-12 w-12 ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {isVideoCall && (
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full h-12 w-12 ${isVideoOff ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
                onClick={toggleVideo}
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 bg-white/10 text-white hover:bg-white/20 hidden sm:inline-flex"
              onClick={toggleScreenShare}
            >
              <MonitorUp className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 bg-red-600 text-white hover:bg-red-700 ml-4"
              onClick={hangUp}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}