import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseAudioRecorderOptions {
  onTranscription?: (text: string) => void;
  onAudioBlob?: (blob: Blob) => void;
  maxDurationMs?: number;
}

export function useAudioRecorder({ onTranscription, onAudioBlob, maxDurationMs = 60000 }: UseAudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        if (onAudioBlob) {
          onAudioBlob(blob);
        }
        
        if (onTranscription) {
          setIsTranscribing(true);
          try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]); // Remove data URL prefix
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audio: base64, mimeType: 'audio/webm' },
            });

            if (error) throw error;
            if (data?.transcription) {
              onTranscription(data.transcription);
            } else {
              toast.error('No se pudo transcribir el audio');
            }
          } catch (err) {
            console.error('Transcription error:', err);
            toast.error('Error al transcribir el audio');
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      // Auto-stop after max duration
      timerRef.current = setTimeout(() => stopRecording(), maxDurationMs);
    } catch (err) {
      console.error('Mic access error:', err);
      toast.error('No se pudo acceder al micrófono');
    }
  }, [onTranscription, onAudioBlob, maxDurationMs]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return { isRecording, isTranscribing, startRecording, stopRecording };
}
