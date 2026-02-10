import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseAudioRecorderOptions {
  onTranscription?: (text: string) => void;
  onAudioBlob?: (blob: Blob) => void;
  maxDurationMs?: number;
}

/**
 * Convert any audio Blob to WAV (PCM 16-bit, mono, 16kHz) using Web Audio API.
 * This is needed because Voxtral only accepts mp3/wav, not webm.
 */
async function blobToWavBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Downsample to 16kHz mono
  const sampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * sampleRate), sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();

  const samples = rendered.getChannelData(0);
  const wavBuffer = encodeWav(samples, sampleRate);

  await audioCtx.close();

  // Convert to base64
  const bytes = new Uint8Array(wavBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);  // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Convert float samples to 16-bit PCM
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
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
            // Convert webm to WAV (Voxtral only accepts mp3/wav)
            const wavBase64 = await blobToWavBase64(blob);

            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audio: wavBase64, mimeType: 'audio/wav' },
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
