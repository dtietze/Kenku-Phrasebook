/**
 * src/stt/stt.web.ts
 *
 * Speech-to-text for the web platform using the browser's built-in
 * Web Speech API (window.SpeechRecognition / webkitSpeechRecognition).
 *
 * Browser support (as of 2025):
 *   - Chrome / Edge: full support
 *   - Safari: supported (webkit-prefixed)
 *   - Firefox: partial support (may require flag)
 *
 * Audio is processed locally by the browser engine — no external requests.
 *
 * Metro resolves .web.ts before .ts, so this file is ONLY bundled for web.
 */

import { STTInterface } from './types';

// ---------------------------------------------------------------------------
// Type shim for browsers that use the webkit prefix
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a web STT controller backed by the Web Speech API.
 * Returns a plain object matching STTInterface — the hook wraps this.
 */
export function createNativeSTT(): STTInterface {
  // Get the speech recognition constructor, preferring the unprefixed version
  const SpeechRecognitionImpl =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : null;

  let recognition: SpeechRecognition | null = null;
  let _onResult: ((text: string) => void) | null = null;
  let _onError:  ((error: string) => void) | null = null;
  let _onEnd:    (() => void) | null = null;

  return {
    async start(locale = 'en-US') {
      if (!SpeechRecognitionImpl) {
        _onError?.('Web Speech API is not supported in this browser.');
        return;
      }

      recognition = new SpeechRecognitionImpl();
      recognition.lang = locale;
      recognition.continuous = true;       // Keep listening until stop() is called
      recognition.interimResults = true;   // Show partial results as the user speaks

      recognition.onresult = (event) => {
        // Concatenate all final results from this session
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) _onResult?.(transcript.trim());
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          _onError?.(event.error ?? 'Speech recognition error');
        }
      };

      recognition.onend = () => {
        _onEnd?.();
      };

      recognition.start();
    },

    async stop() {
      recognition?.stop();
    },

    async cancel() {
      recognition?.abort();
    },

    async destroy() {
      recognition?.abort();
      recognition = null;
      _onResult = null;
      _onError  = null;
      _onEnd    = null;
    },

    onResult(callback) { _onResult = callback; },
    onError(callback)  { _onError  = callback; },
    onEnd(callback)    { _onEnd    = callback; },
  };
}
