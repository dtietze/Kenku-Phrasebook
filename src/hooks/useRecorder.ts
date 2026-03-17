/**
 * src/hooks/useRecorder.ts
 *
 * Stateful React hook wrapping PhraseRecorder.
 * Manages the recording lifecycle and exposes a clean API to components.
 */

import { useState, useRef, useCallback } from 'react';
import { PhraseRecorder, StopResult } from '../audio/recorder';
import { RecordingStatus } from '../types';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseRecorderResult {
  status:      RecordingStatus;
  durationMs:  number;
  lastResult:  StopResult | null;
  error:       string | null;
  start:       () => Promise<void>;
  stop:        () => Promise<StopResult | null>;
  reset:       () => void;
}

export function useRecorder(): UseRecorderResult {
  const recorderRef = useRef<PhraseRecorder | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status,     setStatus]     = useState<RecordingStatus>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [lastResult, setLastResult] = useState<StopResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setLastResult(null);
    setDurationMs(0);

    try {
      const recorder = new PhraseRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      setStatus('recording');

      // Update duration counter every second
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTime);
      }, 1000);
    } catch (e) {
      setStatus('idle');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const stop = useCallback(async (): Promise<StopResult | null> => {
    if (!recorderRef.current) return null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const result = await recorderRef.current.stop();
      recorderRef.current = null;
      setStatus('stopped');
      setLastResult(result);
      return result;
    } catch (e) {
      setStatus('idle');
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current = null;
    setStatus('idle');
    setDurationMs(0);
    setLastResult(null);
    setError(null);
  }, []);

  return { status, durationMs, lastResult, error, start, stop, reset };
}
