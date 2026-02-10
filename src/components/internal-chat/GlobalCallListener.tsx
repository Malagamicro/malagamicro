import { useState } from 'react';
import { useActiveCalls } from '@/hooks/useActiveCalls';
import { IncomingCallDialog } from './IncomingCallDialog';
import { VideoCallModal } from './VideoCallModal';
import { useAuth } from '@/hooks/useAuth';

export function GlobalCallListener() {
  const { user } = useAuth();
  const { incomingCall, acceptCall, rejectCall } = useActiveCalls();
  const [activeCall, setActiveCall] = useState<{
    roomName: string;
    isVideo: boolean;
  } | null>(null);

  const handleAccept = async () => {
    const call = await acceptCall();
    if (call) {
      setActiveCall({
        roomName: call.room_name,
        isVideo: call.is_video,
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
        />
      )}
    </>
  );
}