/**
 * src/hooks/useSTT.ts
 *
 * Platform-aware speech-to-text hook.
 * Uses stt.native.ts on iOS/Android and stt.web.ts on web, via Metro's
 * platform extension resolution (no runtime Platform.OS check needed here).
 *
 * If STT is not available (e.g. Expo Go on native without a dev build,
 * or an unsupported browser), the hook returns isAvailable = false and
 * all functions are no-ops.  The UI should degrade gracefully.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createNativeSTT, STTInterface } from '../stt';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSTTResult {
  /** Whether STT is available on this platform/build. */
  isAvailable: boolean;
  isListening: boolean;
  transcript:  string;
  error:       string | null;
  start:       (locale?: string) => Promise<void>;
  stop:        () => Promise<void>;
  clear:       () => void;
}

export function useSTT(): UseSTTResult {
  const sttRef = useRef<STTInterface | null>(null);

  const [isAvailable, setIsAvailable] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript,  setTranscript]  = useState('');
  const [error,       setError]       = useState<string | null>(null);

  // Initialise STT on mount; detect if it's available
  useEffect(() => {
    try {
      const stt = createNativeSTT();
      sttRef.current = stt;

      stt.onResult((text) => {
        setTranscript((prev) =>
          // Append to existing transcript (continuous mode accumulates segments)
          prev ? `${prev} ${text}` : text
        );
      });

      stt.onError((msg) => {
        setError(msg);
        setIsListening(false);
      });

      stt.onEnd(() => {
        setIsListening(false);
      });
    } catch {
      // Failed to create STT (e.g. native module not available in Expo Go)
      setIsAvailable(false);
    }

    return () => {
      sttRef.current?.destroy();
    };
  }, []);

  const start = useCallback(async (locale = 'en-US') => {
    if (!sttRef.current || !isAvailable) return;
    setError(null);
    setTranscript('');
    setIsListening(true);
    await sttRef.current.start(locale);
  }, [isAvailable]);

  const stop = useCallback(async () => {
    if (!sttRef.current) return;
    await sttRef.current.stop();
    setIsListening(false);
  }, []);

  const clear = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { isAvailable, isListening, transcript, error, start, stop, clear };
}
