import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  displayName: string;
  isVideoCall: boolean;
}

export function VideoCallModal({ open, onClose, roomName, displayName, isVideoCall }: VideoCallModalProps) {
  const hasOpened = useRef(false);

  useEffect(() => {
    if (!open || hasOpened.current) return;
    hasOpened.current = true;

    const fullRoomName = `malagamicro-${roomName}`;
    const config = [
      `config.prejoinPageEnabled=false`,
      `config.startWithAudioMuted=false`,
      `config.startWithVideoMuted=${!isVideoCall}`,
      `config.defaultLanguage=es`,
      `config.disableDeepLinking=true`,
      `userInfo.displayName="${encodeURIComponent(displayName)}"`,
    ].join('&');

    const url = `https://meet.jit.si/${fullRoomName}#${config}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    
    toast.info('Llamada abierta en nueva pestaña', { duration: 3000 });
    
    // Reset and close
    setTimeout(() => {
      hasOpened.current = false;
      onClose();
    }, 500);
  }, [open, roomName, displayName, isVideoCall, onClose]);

  // Reset when closed externally
  useEffect(() => {
    if (!open) hasOpened.current = false;
  }, [open]);

  return null;
}