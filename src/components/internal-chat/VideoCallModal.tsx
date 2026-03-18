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
import { 
  VideoCallModalProps, ICE_SERVERS, 
  formatCallDuration, getGridClass, VideoTile 
} from './videoCallHelpers';

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
  const announceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const retryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const connectedPeersRef = useRef<Set<string>>(new Set());
  const iceCandidateBufferRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
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
    connectedPeersRef.current.delete(peerId);
    const retryTimer = retryTimersRef.current.get(peerId);
    if (retryTimer) { clearTimeout(retryTimer); retryTimersRef.current.delete(peerId); }
    setRemotePeers(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const createPeerConnection = useCallback((remotePeerId: string, remoteDisplayName: string): RTCPeerConnection => {
    // Check if we already have a healthy connection
    const existingPc = peersRef.current.get(remotePeerId);
    if (existingPc) {
      const state = existingPc.connectionState;
      if (state === 'connected') {
        console.log('[WebRTC] Already connected to', remotePeerId);
        return existingPc;
      }
      // Close stale/failed connections
      console.log('[WebRTC] Closing stale PC for', remotePeerId, 'state:', state);
      existingPc.close();
      peersRef.current.delete(remotePeerId);
      connectedPeersRef.current.delete(remotePeerId);
    }

    console.log('[WebRTC] Creating new PC for', remotePeerId);
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
      console.log('[WebRTC] ontrack from', remotePeerId, 'streams:', e.streams.length);
      if (e.streams[0]) {
        connectedPeersRef.current.add(remotePeerId);
        updateRemotePeer(remotePeerId, { stream: e.streams[0], displayName: remoteDisplayName });
        setIsConnecting(false);
        // Clear retry timer since we got the stream
        const rt = retryTimersRef.current.get(remotePeerId);
        if (rt) { clearTimeout(rt); retryTimersRef.current.delete(remotePeerId); }
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
      console.log('[WebRTC] Connection state for', remotePeerId, ':', pc.connectionState);
      if (pc.connectionState === 'connected') {
        connectedPeersRef.current.add(remotePeerId);
        setIsConnecting(false);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log('[WebRTC] Connection lost to', remotePeerId, '- will retry');
        connectedPeersRef.current.delete(remotePeerId);
        removeRemotePeer(remotePeerId);
        // Re-announce to trigger reconnection
        if (!destroyedRef.current) {
          setTimeout(() => {
            if (destroyedRef.current) return;
            channelRef.current?.send({
              type: 'broadcast',
              event: 'peer-join',
              payload: { peerId: myPeerIdRef.current, displayName },
            });
          }, 1000);
        }
      }
    };

    return pc;
  }, [updateRemotePeer, removeRemotePeer, displayName]);

  // Send an SDP offer with retry logic
  const sendOfferWithRetry = useCallback(async (remotePeerId: string, remoteDisplayName: string) => {
    if (destroyedRef.current) return;
    const myPeerId = myPeerIdRef.current;
    
    // Don't send if already connected
    if (connectedPeersRef.current.has(remotePeerId)) return;

    const pc = createPeerConnection(remotePeerId, remoteDisplayName);
    
    // Don't create offer if already in progress or connected
    if (pc.connectionState === 'connected') return;
    if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') return;

    // If we already have a local offer, don't create another
    if (pc.signalingState === 'have-local-offer') {
      console.log('[WebRTC] Already have local offer for', remotePeerId, '- resending');
      if (pc.localDescription) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'sdp-offer',
          payload: { sdp: pc.localDescription, from: myPeerId, to: remotePeerId, displayName },
        });
      }
    } else {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'sdp-offer',
          payload: { sdp: offer, from: myPeerId, to: remotePeerId, displayName },
        });
        console.log('[WebRTC] Offer sent to', remotePeerId);
      } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
        return;
      }
    }

    // Set retry: if no ontrack in 5s, recreate PC and resend offer
    const existingRetry = retryTimersRef.current.get(remotePeerId);
    if (existingRetry) clearTimeout(existingRetry);

    const retryTimer = setTimeout(() => {
      retryTimersRef.current.delete(remotePeerId);
      if (destroyedRef.current) return;
      if (connectedPeersRef.current.has(remotePeerId)) return;
      
      console.log('[WebRTC] No stream from', remotePeerId, 'after 5s - retrying offer');
      // Close old PC and recreate
      const oldPc = peersRef.current.get(remotePeerId);
      if (oldPc) { oldPc.close(); peersRef.current.delete(remotePeerId); }
      sendOfferWithRetry(remotePeerId, remoteDisplayName);
    }, 5000);
    retryTimersRef.current.set(remotePeerId, retryTimer);
  }, [createPeerConnection, displayName]);

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
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true, 
              video: isVideoCall ? { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                frameRate: { ideal: 24 }
              } : false 
            });
          } catch (mediaErr) {
            if (isVideoCall) {
              console.warn('[WebRTC] Video failed, retrying...', mediaErr);
              await new Promise(r => setTimeout(r, 500));
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
              } catch {
                console.warn('[WebRTC] Video retry failed, falling back to audio only');
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                toast.info('No se pudo activar la cámara, conectando solo con audio');
              }
            } else {
              throw mediaErr;
            }
          }
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
        // Both peers see the join, but only the one with the LOWER peerId sends the offer
        channel.on('broadcast', { event: 'peer-join' }, async ({ payload }) => {
          if (destroyedRef.current || payload.peerId === myPeerId) return;
          
          // If already connected, just ignore
          if (connectedPeersRef.current.has(payload.peerId)) {
            return;
          }

          console.log('[WebRTC] Peer joined:', payload.peerId);
          
          // The peer with the lower ID sends the offer to avoid glare
          if (myPeerId < payload.peerId) {
            console.log('[WebRTC] I have lower ID, sending offer to', payload.peerId);
            await sendOfferWithRetry(payload.peerId, payload.displayName);
          } else {
            console.log('[WebRTC] I have higher ID, waiting for offer from', payload.peerId);
            // Pre-create the PC so we're ready to receive the offer
            createPeerConnection(payload.peerId, payload.displayName);
          }
        });

        // Handle SDP offer
        channel.on('broadcast', { event: 'sdp-offer' }, async ({ payload }) => {
          if (destroyedRef.current || payload.to !== myPeerId) return;
          console.log('[WebRTC] Received offer from:', payload.from, 'signalingState:', peersRef.current.get(payload.from)?.signalingState);
          
          // If already connected with stream, ignore duplicate offers
          if (connectedPeersRef.current.has(payload.from)) {
            console.log('[WebRTC] Already connected to', payload.from, '- ignoring offer');
            return;
          }

          let pc = peersRef.current.get(payload.from);
          
          // If PC is in have-local-offer (glare), the higher ID peer rolls back
          if (pc && pc.signalingState === 'have-local-offer') {
            if (myPeerId > payload.from) {
              // I'm polite (higher ID), I rollback
              console.log('[WebRTC] Glare: rolling back as polite peer');
              try {
                await pc.setLocalDescription({ type: 'rollback' });
              } catch (e) {
                console.warn('[WebRTC] Rollback failed, recreating PC:', e);
                pc.close();
                peersRef.current.delete(payload.from);
                pc = null;
              }
            } else {
              // I'm impolite (lower ID), ignore their offer
              console.log('[WebRTC] Glare: ignoring offer as impolite peer');
              return;
            }
          }
          
          if (!pc || pc.signalingState === 'closed') {
            if (pc) { peersRef.current.delete(payload.from); }
            pc = createPeerConnection(payload.from, payload.displayName);
          }
          
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            // Flush buffered ICE candidates
            const buffered = iceCandidateBufferRef.current.get(payload.from) || [];
            for (const candidate of buffered) {
              try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
            }
            iceCandidateBufferRef.current.delete(payload.from);
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'sdp-answer',
              payload: { sdp: answer, from: myPeerId, to: payload.from, displayName },
            });
            console.log('[WebRTC] Answer sent to', payload.from);
          } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
          }
        });

        // Handle SDP answer
        channel.on('broadcast', { event: 'sdp-answer' }, async ({ payload }) => {
          if (destroyedRef.current || payload.to !== myPeerId) return;
          console.log('[WebRTC] Received answer from:', payload.from);
          const pc = peersRef.current.get(payload.from);
          if (pc && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              // Flush buffered ICE candidates
              const buffered = iceCandidateBufferRef.current.get(payload.from) || [];
              for (const candidate of buffered) {
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
              }
              iceCandidateBufferRef.current.delete(payload.from);
              updateRemotePeer(payload.from, { displayName: payload.displayName });
            } catch (err) {
              console.error('[WebRTC] Error setting answer:', err);
            }
          }
        });

        // Handle ICE candidates - buffer if remoteDescription not yet set
        channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (destroyedRef.current || payload.to !== myPeerId) return;
          const pc = peersRef.current.get(payload.from);
          if (pc && pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
          } else {
            // Buffer the candidate for later
            const buffer = iceCandidateBufferRef.current.get(payload.from) || [];
            buffer.push(payload.candidate);
            iceCandidateBufferRef.current.set(payload.from, buffer);
          }
        });

        // Handle peer leaving
        channel.on('broadcast', { event: 'peer-leave' }, ({ payload }) => {
          if (destroyedRef.current || payload.peerId === myPeerId) return;
          console.log('[WebRTC] Peer left:', payload.peerId);
          removeRemotePeer(payload.peerId);
          toast.info(`${payload.displayName || 'Un usuario'} abandonó la llamada`);
          
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

        // Re-announce at staggered intervals for reliability
        announceTimersRef.current.forEach(t => clearTimeout(t));
        announceTimersRef.current = [];
        const announceTimes = [500, 2000, 5000, 12000];
        for (const delay of announceTimes) {
          const timer = setTimeout(() => {
            if (destroyedRef.current) return;
            // Only re-announce if we haven't connected to anyone yet, or always for group calls
            channel.send({
              type: 'broadcast',
              event: 'peer-join',
              payload: { peerId: myPeerId, displayName },
            });
          }, delay);
          announceTimersRef.current.push(timer);
        }

        // 4. Reconnection watchdog: if no peers after 8s, force a full re-announce cycle
        const watchdog = setTimeout(() => {
          if (destroyedRef.current) return;
          if (connectedPeersRef.current.size === 0) {
            console.log('[WebRTC] Watchdog: no connections after 8s, re-announcing');
            // Clear all existing PCs
            peersRef.current.forEach((pc, id) => { pc.close(); });
            peersRef.current.clear();
            channel.send({
              type: 'broadcast',
              event: 'peer-join',
              payload: { peerId: myPeerId, displayName },
            });
          }
        }, 8000);
        announceTimersRef.current.push(watchdog);

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
  }, [open, roomName, isVideoCall, isReceiver, displayName, initialStream, createPeerConnection, updateRemotePeer, removeRemotePeer, sendOfferWithRetry]);

  const cleanup = () => {
    // Clear announce timers
    announceTimersRef.current.forEach(t => clearTimeout(t));
    announceTimersRef.current = [];
    // Clear retry timers
    retryTimersRef.current.forEach(t => clearTimeout(t));
    retryTimersRef.current.clear();
    connectedPeersRef.current.clear();
    iceCandidateBufferRef.current.clear();

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

  // Build participants list for grid
  const remoteEntries = Array.from(remotePeers.entries());
  const totalParticipants = remoteEntries.length + 1;
  
  const screenSharer = remoteEntries.find(([, p]) => p.isScreenSharing);
  const isSelfSharing = isScreenSharing;
  const hasScreenShare = !!screenSharer || isSelfSharing;

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
                  {isConnecting ? 'Conectando...' : formatCallDuration(callDuration)}
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
          <div className={cn('flex-1 min-h-0 grid gap-1 p-1', getGridClass(totalParticipants, hasScreenShare))}>
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

            <div className={cn(
              hasScreenShare 
                ? 'flex gap-1 overflow-x-auto col-span-full' 
                : 'contents'
            )}>
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
