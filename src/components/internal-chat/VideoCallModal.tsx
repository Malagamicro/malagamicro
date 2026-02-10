import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Mic, MicOff, Video, VideoOff, 
  PhoneOff, Maximize2, Minimize2,
  MonitorUp, MonitorOff, Crown, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  displayName: string;
  isVideoCall: boolean;
  isReceiver?: boolean;
  initialStream?: MediaStream | null;
}

interface RemotePeer {
  peerId: string;
  displayName: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  isScreenSharing: boolean;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function VideoCallModal({ 
  open, onClose, roomName, displayName, isVideoCall, isReceiver = false, initialStream = null 
}: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoCall);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remotePeers, setRemotePeers] = useState<Map<string, { stream: MediaStream | null; displayName: string; isScreenSharing: boolean }>>(new Map());

  const myPeerIdRef = useRef(`peer-${Math.random().toString(36).slice(2, 10)}`);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onCloseRef = useRef(onClose);
  const destroyedRef = useRef(false);
  onCloseRef.current = onClose;

  const updateRemotePeer = useCallback((peerId: string, update: Partial<{ stream: MediaStream | null; displayName: string; isScreenSharing: boolean }>) => {
    setRemotePeers(prev => {
      const next = new Map(prev);
      const existing = next.get(peerId) || { stream: null, displayName: 'Usuario', isScreenSharing: false };
      next.set(peerId, { ...existing, ...update });
      return next;
    });
  }, []);

  const removeRemotePeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) { pc.close(); peersRef.current.delete(peerId); }
    setRemotePeers(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const createPeerConnection = useCallback((remotePeerId: string, remoteDisplayName: string) => {
    if (peersRef.current.has(remotePeerId)) return peersRef.current.get(remotePeerId)!;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(remotePeerId, pc);

    // Add local tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    // Handle remote stream
    pc.ontrack = (e) => {
      if (destroyedRef.current) return;
      if (e.streams[0]) {
        updateRemotePeer(remotePeerId, { stream: e.streams[0], displayName: remoteDisplayName });
        setIsConnecting(false);
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
        }
      }
    };

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: e.candidate.toJSON(), from: myPeerIdRef.current, to: remotePeerId },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removeRemotePeer(remotePeerId);
      }
    };

    return pc;
  }, [updateRemotePeer, removeRemotePeer]);

  useEffect(() => {
    if (!open) return;
    destroyedRef.current = false;
    const myPeerId = myPeerIdRef.current;

    const setup = async () => {
      try {
        // 1. Get local media
        let stream: MediaStream;
        if (initialStream && initialStream.getTracks().length > 0) {
          stream = initialStream;
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoCall });
        }
        if (destroyedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 2. Set up signaling channel
        const channelName = `call-signal-${roomName}`;
        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        // Handle new peer joining
        channel.on('broadcast', { event: 'peer-join' }, async ({ payload }) => {
          if (destroyedRef.current || payload.peerId === myPeerId) return;
          console.log('[GroupCall] Peer joined:', payload.peerId);
          
          // Create PC and send offer to the new peer
          const pc = createPeerConnection(payload.peerId, payload.displayName);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'sdp-offer',
            payload: { sdp: offer, from: myPeerId, to: payload.peerId, displayName },
          });
        });

        // Handle SDP offer
        channel.on('broadcast', { event: 'sdp-offer' }, async ({ payload }) => {
          if (destroyedRef.current || payload.to !== myPeerId) return;
          console.log('[GroupCall] Received offer from:', payload.from);
          
          const pc = createPeerConnection(payload.from, payload.displayName);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'sdp-answer',
            payload: { sdp: answer, from: myPeerId, to: payload.from, displayName },
          });
        });

        // Handle SDP answer
        channel.on('broadcast', { event: 'sdp-answer' }, async ({ payload }) => {
          if (destroyedRef.current || payload.to !== myPeerId) return;
          console.log('[GroupCall] Received answer from:', payload.from);
          const pc = peersRef.current.get(payload.from);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            updateRemotePeer(payload.from, { displayName: payload.displayName });
          }
        });

        // Handle ICE candidates
        channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (destroyedRef.current || payload.to !== myPeerId) return;
          const pc = peersRef.current.get(payload.from);
          if (pc) {
            try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
          }
        });

        // Handle peer leaving
        channel.on('broadcast', { event: 'peer-leave' }, ({ payload }) => {
          if (destroyedRef.current || payload.peerId === myPeerId) return;
          console.log('[GroupCall] Peer left:', payload.peerId);
          removeRemotePeer(payload.peerId);
          toast.info(`${payload.displayName || 'Un usuario'} abandonó la llamada`);
          
          // If no more peers, end call
          if (peersRef.current.size === 0) {
            setTimeout(() => {
              if (peersRef.current.size === 0 && !destroyedRef.current) {
                toast.info('Todos se fueron, finalizando llamada');
                cleanup();
                onCloseRef.current();
              }
            }, 2000);
          }
        });

        // Handle screen share announcements
        channel.on('broadcast', { event: 'screen-share' }, ({ payload }) => {
          if (destroyedRef.current || payload.peerId === myPeerId) return;
          updateRemotePeer(payload.peerId, { isScreenSharing: payload.isSharing });
        });

        await channel.subscribe();

        // 3. Announce ourselves
        channel.send({
          type: 'broadcast',
          event: 'peer-join',
          payload: { peerId: myPeerId, displayName },
        });

        // Re-announce periodically for late joiners
        const announceInterval = setInterval(() => {
          if (destroyedRef.current) { clearInterval(announceInterval); return; }
          channel.send({
            type: 'broadcast',
            event: 'peer-join',
            payload: { peerId: myPeerId, displayName },
          });
        }, 3000);
        setTimeout(() => clearInterval(announceInterval), 20000);

      } catch (err) {
        console.error('Call setup error:', err);
        toast.error('No se pudo acceder a cámara/micrófono');
        onCloseRef.current();
      }
    };

    setup();

    return () => {
      destroyedRef.current = true;
      cleanup();
    };
  }, [open, roomName, isVideoCall, isReceiver, displayName, initialStream, createPeerConnection, updateRemotePeer, removeRemotePeer]);

  const cleanup = () => {
    // Announce leave
    channelRef.current?.send({
      type: 'broadcast',
      event: 'peer-leave',
      payload: { peerId: myPeerIdRef.current, displayName },
    });

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    
    // Close all peer connections
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCallDuration(0);
    setIsConnecting(true);
    setRemotePeers(new Map());
    setIsScreenSharing(false);
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
    if (isScreenSharing) {
      // Stop screen share, restore camera
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && camTrack) sender.replaceTrack(camTrack);
      });
      setIsScreenSharing(false);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'screen-share',
        payload: { peerId: myPeerIdRef.current, isSharing: false },
      });
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screen.getVideoTracks()[0];
        screenStreamRef.current = screen;
        
        // Replace video track in all peer connections
        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          screenStreamRef.current = null;
          const camTrack = localStreamRef.current?.getVideoTracks()[0];
          peersRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender && camTrack) sender.replaceTrack(camTrack);
          });
          setIsScreenSharing(false);
          channelRef.current?.send({
            type: 'broadcast',
            event: 'screen-share',
            payload: { peerId: myPeerIdRef.current, isSharing: false },
          });
        };

        setIsScreenSharing(true);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'screen-share',
          payload: { peerId: myPeerIdRef.current, isSharing: true },
        });
      } catch { /* cancelled */ }
    }
  };

  const hangUp = () => {
    cleanup();
    onCloseRef.current();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // Build participants list for grid
  const remoteEntries = Array.from(remotePeers.entries());
  const totalParticipants = remoteEntries.length + 1; // +1 for self
  
  // Find if anyone is screen sharing (they get featured)
  const screenSharer = remoteEntries.find(([, p]) => p.isScreenSharing);
  const isSelfSharing = isScreenSharing;
  const hasScreenShare = !!screenSharer || isSelfSharing;

  // Grid layout classes based on participant count
  const getGridClass = () => {
    if (hasScreenShare) return 'grid-cols-1 grid-rows-[2fr_1fr]';
    if (totalParticipants <= 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-2 sm:grid-cols-3';
    return 'grid-cols-3 sm:grid-cols-4';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && hangUp()}>
      <DialogContent 
        className={cn(
          'p-0 overflow-hidden border-0 gap-0',
          isFullscreen 
            ? 'max-w-[100vw] max-h-[100vh] w-screen h-screen rounded-none' 
            : 'max-w-[95vw] max-h-[90vh] w-[900px] h-[650px] sm:rounded-lg'
        )}
      >
        <DialogTitle className="sr-only">Llamada en curso</DialogTitle>
        <div className="relative w-full h-full bg-[#0a0a0a] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-white">
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
                )} />
                <span className="text-sm font-medium">
                  {isConnecting ? 'Conectando...' : fmt(callDuration)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-white/60">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">{totalParticipants}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Video grid */}
          <div className={cn('flex-1 min-h-0 grid gap-1 p-1', getGridClass())}>
            {/* Screen share featured area */}
            {hasScreenShare && (
              <div className="relative rounded-lg overflow-hidden bg-[#1a1a1a] col-span-full">
                {isSelfSharing ? (
                  <>
                    <video
                      ref={el => { if (el && screenStreamRef.current) el.srcObject = screenStreamRef.current; }}
                      autoPlay playsInline className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-primary/90 text-primary-foreground px-2 py-1 rounded-full text-xs font-medium">
                      <Crown className="h-3 w-3" />
                      Tú - Compartiendo pantalla
                    </div>
                  </>
                ) : screenSharer ? (
                  <>
                    <VideoTile
                      stream={screenSharer[1].stream}
                      label={`${screenSharer[1].displayName} - Pantalla`}
                      isScreenShare
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-primary/90 text-primary-foreground px-2 py-1 rounded-full text-xs font-medium">
                      <Crown className="h-3 w-3" />
                      {screenSharer[1].displayName} - Compartiendo
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* Participant tiles */}
            <div className={cn(
              hasScreenShare 
                ? 'flex gap-1 overflow-x-auto col-span-full' 
                : 'contents'
            )}>
              {/* Self tile */}
              <div className={cn(
                'relative rounded-lg overflow-hidden bg-[#1a1a1a]',
                hasScreenShare ? 'min-w-[120px] w-[120px] h-[90px] sm:min-w-[160px] sm:w-[160px] sm:h-[120px] flex-shrink-0' : 'min-h-0'
              )}>
                <video
                  ref={localVideoRef}
                  autoPlay playsInline muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
                  Tú {isMuted && '🔇'}
                </div>
                {isVideoOff && (
                  <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-lg font-bold">
                      {displayName[0]?.toUpperCase() || 'U'}
                    </div>
                  </div>
                )}
              </div>

              {/* Remote peers */}
              {remoteEntries.map(([peerId, peer]) => (
                <div
                  key={peerId}
                  className={cn(
                    'relative rounded-lg overflow-hidden bg-[#1a1a1a]',
                    hasScreenShare ? 'min-w-[120px] w-[120px] h-[90px] sm:min-w-[160px] sm:w-[160px] sm:h-[120px] flex-shrink-0' : 'min-h-0'
                  )}
                >
                  <VideoTile stream={peer.stream} label={peer.displayName} />
                  {peer.isScreenSharing && (
                    <div className="absolute top-1.5 right-1.5">
                      <Crown className="h-4 w-4 text-yellow-400 drop-shadow" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Connecting overlay */}
            {isConnecting && remoteEntries.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/80 z-10">
                <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-white/70 text-sm">Esperando participantes...</p>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 px-4 py-3 bg-black/80 z-10">
            <Button variant="ghost" size="icon"
              className={cn(
                'rounded-full h-11 w-11 sm:h-12 sm:w-12',
                isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
              )}
              onClick={toggleMute}>
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            {isVideoCall && (
              <Button variant="ghost" size="icon"
                className={cn(
                  'rounded-full h-11 w-11 sm:h-12 sm:w-12',
                  isVideoOff ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                )}
                onClick={toggleVideo}>
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon"
              className={cn(
                'rounded-full h-11 w-11 sm:h-12 sm:w-12 hidden sm:inline-flex',
                isScreenSharing ? 'bg-primary/30 text-primary hover:bg-primary/40' : 'bg-white/10 text-white hover:bg-white/20'
              )}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Dejar de compartir' : 'Compartir pantalla'}>
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon"
              className="rounded-full h-11 w-11 sm:h-12 sm:w-12 bg-red-600 text-white hover:bg-red-700 ml-2 sm:ml-4"
              onClick={hangUp}>
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Video tile sub-component
function VideoTile({ stream, label, isScreenShare = false }: { stream: MediaStream | null; label: string; isScreenShare?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-lg font-bold">
          {label[0]?.toUpperCase() || 'U'}
        </div>
        <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
          {label}
        </div>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        autoPlay playsInline
        className={cn('w-full h-full', isScreenShare ? 'object-contain' : 'object-cover')}
      />
      <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
        {label}
      </div>
    </>
  );
}
