import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

interface UseAICompletionOptions {
  /** Override the default model fallback chain */
  preferredModels?: string[];
  /** System prompt prepended to messages */
  systemPrompt?: string;
}

const AI_COMPLETION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-completion`;

export function useAICompletion(options: UseAICompletionOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const complete = useCallback(
    async ({
      messages,
      onDelta,
      onDone,
      stream = true,
    }: {
      messages: Message[];
      onDelta?: (text: string) => void;
      onDone?: (fullText: string) => void;
      stream?: boolean;
    }) => {
      setIsLoading(true);
      setError(null);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const allMessages: Message[] = options.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(AI_COMPLETION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            messages: allMessages,
            stream,
            preferredModels: options.preferredModels,
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({ error: 'Error desconocido' }));
          const msg = body.error || `Error ${resp.status}`;
          setError(msg);
          toast.error(msg);
          setIsLoading(false);
          return '';
        }

        if (!stream) {
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content || '';
          onDone?.(text);
          setIsLoading(false);
          return text;
        }

        // Streaming
        if (!resp.body) throw new Error('Sin cuerpo de respuesta');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let full = '';

         
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (json === '[DONE]') break;
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                full += content;
                onDelta?.(content);
              }
            } catch {
              buffer = line + '\n' + buffer;
              break;
            }
          }
        }

        onDone?.(full);
        setIsLoading(false);
        return full;
      } catch (e: unknown) {
        if ((e as Error).name === 'AbortError') {
          setIsLoading(false);
          return '';
        }
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        setError(msg);
        toast.error(msg);
        setIsLoading(false);
        return '';
      }
    },
    [options.systemPrompt, options.preferredModels],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { complete, cancel, isLoading, error };
}
