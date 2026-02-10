import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Mic, MicOff, Video, VideoOff, 
  PhoneOff, Maximize2, Minimize2,
  MonitorUp
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  displayName: string;
  isVideoCall: boolean;
  isReceiver?: boolean;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function VideoCallModal({ 
  open, onClose, roomName, displayName, isVideoCall, isReceiver = false 
}: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoCall);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    let destroyed = false;

    const setup = async () => {
      try {
        // 1. Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideoCall,
        });
        if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 2. Create RTCPeerConnection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Handle remote stream
        pc.ontrack = (e) => {
          if (destroyed) return;
          console.log('Got remote track:', e.track.kind);
          if (remoteVideoRef.current && e.streams[0]) {
            remoteVideoRef.current.srcObject = e.streams[0];
            setIsConnecting(false);
            if (!timerRef.current) {
              timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
            }
          }
        };

        // 3. Set up Supabase Realtime channel for signaling
        const myRole = isReceiver ? 'receiver' : 'caller';
        const channelName = `call-signal-${roomName}`;
        
        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        // Send ICE candidates via broadcast
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: { candidate: e.candidate.toJSON(), from: myRole },
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('Connection state:', pc.connectionState);
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            toast.error('Llamada desconectada');
            cleanup();
            onCloseRef.current();
          }
        };

        // Listen for signaling messages
        channel.on('broadcast', { event: 'sdp-offer' }, async ({ payload }) => {
          if (destroyed || payload.from === myRole) return;
          console.log('Received SDP offer');
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'sdp-answer',
            payload: { sdp: answer, from: myRole },
          });
        });

        channel.on('broadcast', { event: 'sdp-answer' }, async ({ payload }) => {
          if (destroyed || payload.from === myRole) return;
          console.log('Received SDP answer');
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        });

        channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (destroyed || payload.from === myRole) return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.warn('ICE candidate error:', err);
          }
        });

        channel.on('broadcast', { event: 'hangup' }, () => {
          if (destroyed) return;
          toast.info('El otro usuario colgó');
          cleanup();
          onCloseRef.current();
        });

        await channel.subscribe();

        // 4. If caller, create and send offer after a brief delay to let receiver subscribe
        if (!isReceiver) {
          // Wait a moment for the receiver to join the channel
          await new Promise(r => setTimeout(r, 2000));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'sdp-offer',
            payload: { sdp: offer, from: myRole },
          });
          console.log('Sent SDP offer');

          // Retry sending offer every 3s in case receiver hasn't joined yet
          const retryInterval = setInterval(async () => {
            if (destroyed || pc.connectionState === 'connected') {
              clearInterval(retryInterval);
              return;
            }
            if (pc.localDescription) {
              channel.send({
                type: 'broadcast',
                event: 'sdp-offer',
                payload: { sdp: pc.localDescription, from: myRole },
              });
              console.log('Retrying SDP offer...');
            }
          }, 3000);

          // Clear retry after 30s
          setTimeout(() => clearInterval(retryInterval), 30000);
        }

      } catch (err) {
        console.error('Call setup error:', err);
        toast.error('No se pudo acceder a cámara/micrófono');
        onCloseRef.current();
      }
    };

    setup();

    return () => {
      destroyed = true;
      cleanup();
    };
  }, [open, roomName, isVideoCall, isReceiver]);

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCallDuration(0);
    setIsConnecting(true);
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOff(!track.enabled); }
  };

  const toggleScreenShare = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screen.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
        screenTrack.onended = () => {
          const cam = localStreamRef.current?.getVideoTracks()[0];
          if (cam) sender.replaceTrack(cam);
        };
      }
    } catch { /* cancelled */ }
  };

  const hangUp = () => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'hangup',
      payload: {},
    });
    cleanup();
    onCloseRef.current();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
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
                {isConnecting ? 'Esperando...' : fmt(callDuration)}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Video area */}
          <div className="flex-1 min-h-0 relative bg-[#111]">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {isConnecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111]">
                <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-white/70 text-sm">Esperando al otro participante...</p>
              </div>
            )}
            <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-40 sm:h-30 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-10">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 bg-black/80 z-10">
            <Button variant="ghost" size="icon"
              className={`rounded-full h-12 w-12 ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
              onClick={toggleMute}>
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            {isVideoCall && (
              <Button variant="ghost" size="icon"
                className={`rounded-full h-12 w-12 ${isVideoOff ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
                onClick={toggleVideo}>
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon"
              className="rounded-full h-12 w-12 bg-white/10 text-white hover:bg-white/20 hidden sm:inline-flex"
              onClick={toggleScreenShare}>
              <MonitorUp className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon"
              className="rounded-full h-12 w-12 bg-red-600 text-white hover:bg-red-700 ml-4"
              onClick={hangUp}>
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}