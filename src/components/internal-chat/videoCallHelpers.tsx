import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  displayName: string;
  isVideoCall: boolean;
  isReceiver?: boolean;
  initialStream?: MediaStream | null;
}

export interface RemotePeer {
  peerId: string;
  displayName: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  isScreenSharing: boolean;
}

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function formatCallDuration(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export function getGridClass(totalParticipants: number, hasScreenShare: boolean): string {
  if (hasScreenShare) return 'grid-cols-1 grid-rows-[2fr_1fr]';
  if (totalParticipants <= 1) return 'grid-cols-1';
  if (totalParticipants === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (totalParticipants <= 4) return 'grid-cols-2';
  if (totalParticipants <= 6) return 'grid-cols-2 sm:grid-cols-3';
  return 'grid-cols-3 sm:grid-cols-4';
}

export function VideoTile({ stream, label, isScreenShare = false }: { stream: MediaStream | null; label: string; isScreenShare?: boolean }) {
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
