import { useState, useEffect, useRef } from 'react';
import { useActiveCalls } from '@/contexts/ActiveCallsContext';
import { IncomingCallDialog } from './IncomingCallDialog';
import { VideoCallModal } from './VideoCallModal';
import { useAuth } from '@/hooks/useAuth';

export function GlobalCallListener() {
  const { user } = useAuth();
  const { incomingCall, acceptCall, rejectCall } = useActiveCalls();
  const [activeCall, setActiveCall] = useState<{
    roomName: string;
    isVideo: boolean;
    conversationId: string;
  } | null>(null);
  const vibrationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Vibration for mobile incoming calls
  useEffect(() => {
    if (incomingCall) {
      // Start vibration pattern
      if ('vibrate' in navigator) {
        // Vibrate immediately
        navigator.vibrate([300, 200, 300, 200, 300]);
        // Repeat every 2 seconds
        vibrationRef.current = setInterval(() => {
          if ('vibrate' in navigator) {
            navigator.vibrate([300, 200, 300, 200, 300]);
          }
        }, 2000);
      }
    } else {
      // Stop vibration
      if (vibrationRef.current) {
        clearInterval(vibrationRef.current);
        vibrationRef.current = null;
      }
      if ('vibrate' in navigator) {
        navigator.vibrate(0); // Cancel any ongoing vibration
      }
    }

    return () => {
      if (vibrationRef.current) {
        clearInterval(vibrationRef.current);
        vibrationRef.current = null;
      }
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      }
    };
  }, [incomingCall]);

  const handleAccept = async () => {
    const call = await acceptCall();
    if (call) {
      setActiveCall({
        roomName: call.room_name,
        isVideo: call.is_video,
        conversationId: call.conversation_id,
      });
    }
  };

  return (
    <>
      <IncomingCallDialog
        open={!!incomingCall}
        callerName={incomingCall?.caller_name || 'Usuario'}
        isVideo={incomingCall?.is_video || false}
        onAccept={handleAccept}
        onReject={rejectCall}
      />

      {activeCall && (
        <VideoCallModal
          open={true}
          onClose={() => setActiveCall(null)}
          roomName={activeCall.roomName}
          displayName={user?.email?.split('@')[0] || 'Usuario'}
          isVideoCall={activeCall.isVideo}
          isReceiver={true}
        />
      )}
    </>
  );
}
