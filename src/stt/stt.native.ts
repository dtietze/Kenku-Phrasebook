/**
 * src/stt/stt.native.ts
 *
 * Speech-to-text for iOS and Android using @react-native-voice/voice.
 *
 * IMPORTANT: This file is only bundled on native platforms (iOS / Android)
 * because Metro resolves .native.ts before .ts.  Importing Voice on web
 * would crash because the native module is not available in a browser.
 *
 * Requires a DEVELOPMENT BUILD (expo-dev-client).  It will not work in
 * Expo Go.  Run `npx expo run:ios` or `npx expo run:android` to test.
 *
 * Device speech recognition uses:
 *   - iOS:     SFSpeechRecognizer (Apple on-device, available offline)
 *   - Android: SpeechRecognizer (Google, may require network on some devices)
 *
 * Both are free and process audio locally (no data sent to our servers).
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { STTInterface } from './types';

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a native STT controller.
 * Returns a plain object matching STTInterface — the hook wraps this.
 */
export function createNativeSTT(): STTInterface {
  let _onResult: ((text: string) => void) | null = null;
  let _onError:  ((error: string) => void) | null = null;
  let _onEnd:    (() => void) | null = null;

  // Wire up Voice event handlers once
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] ?? '';
    if (text) _onResult?.(text);
  };

  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    _onError?.(e.error?.message ?? 'Speech recognition error');
  };

  Voice.onSpeechEnd = () => {
    _onEnd?.();
  };

  return {
    async start(locale = 'en-US') {
      try {
        await Voice.start(locale);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        _onError?.(msg);
      }
    },

    async stop() {
      try {
        await Voice.stop();
      } catch {
        // Ignore errors on stop — the session may have already ended
      }
    },

    async cancel() {
      try {
        await Voice.cancel();
      } catch {
        // Ignore
      }
    },

    async destroy() {
      try {
        await Voice.destroy();
        Voice.removeAllListeners();
      } catch {
        // Ignore
      }
    },

    onResult(callback) { _onResult = callback; },
    onError(callback)  { _onError  = callback; },
    onEnd(callback)    { _onEnd    = callback; },
  };
}
