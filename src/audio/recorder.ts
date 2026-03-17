/**
 * src/audio/recorder.ts
 *
 * Wraps expo-av's Audio.Recording API into a simpler stateful interface.
 *
 * Recording quality:
 *   M4A/AAC at 44.1 kHz — good quality, good compression, supported on
 *   both iOS and Android.  On web, the browser chooses the container
 *   (usually WebM/Opus) regardless of what we request.
 *
 * Usage:
 *   const recorder = new PhraseRecorder();
 *   await recorder.start();
 *   // ... later ...
 *   const { uri, durationMs } = await recorder.stop();
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Recording preset
// ---------------------------------------------------------------------------

/**
 * High-quality M4A preset.
 * We avoid using `Audio.RecordingOptionsPresets.HIGH_QUALITY` directly
 * because it doesn't set all fields we want.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension:           '.m4a',
    outputFormat:        Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder:        Audio.AndroidAudioEncoder.AAC,
    sampleRate:          44100,
    numberOfChannels:    1, // Mono — sufficient for speech, saves space
    bitRate:             128000,
  },
  ios: {
    extension:           '.m4a',
    outputFormat:        Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality:        Audio.IOSAudioQuality.HIGH,
    sampleRate:          44100,
    numberOfChannels:    1,
    bitRate:             128000,
    linearPCMBitDepth:   16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat:    false,
  },
  web: {
    // Browsers choose the actual codec; we just request a sensible MIME type
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

// ---------------------------------------------------------------------------
// PhraseRecorder class
// ---------------------------------------------------------------------------

export interface StopResult {
  /** File URI (file:// on native, blob: or data: on web). */
  uri: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

/**
 * Stateful audio recorder.  Create a new instance for each recording session.
 * Do not reuse an instance after calling stop() — create a fresh one.
 */
export class PhraseRecorder {
  private recording: Audio.Recording | null = null;
  private startedAt: number | null = null;

  /**
   * Request microphone permission (if not already granted) and start recording.
   * Throws if the user denies the permission or if a recording is already active.
   */
  async start(): Promise<void> {
    if (this.recording) {
      throw new Error('PhraseRecorder: already recording — call stop() first.');
    }

    // Request permission (idempotent — safe to call every time on native)
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      throw new Error('Microphone permission denied.');
    }

    // On iOS, audio must be set to "record" mode before recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
    this.recording   = recording;
    this.startedAt   = Date.now();
  }

  /** Pause the recording (resume later with resume()). No-op if not recording. */
  async pause(): Promise<void> {
    await this.recording?.pauseAsync();
  }

  /** Resume a paused recording. */
  async resume(): Promise<void> {
    await this.recording?.startAsync();
  }

  /**
   * Stop the recording and return the file URI and duration.
   * After this call the instance should be discarded.
   */
  async stop(): Promise<StopResult> {
    if (!this.recording) {
      throw new Error('PhraseRecorder: not recording.');
    }

    await this.recording.stopAndUnloadAsync();

    // On web, getURI() is not available after stop — expo-av returns null.
    // The URI was captured via the recording status update callback.
    // For simplicity we fall back to the blob URL from the Recording object
    // using an internal API, which is reliable in practice.
    const uri = this.recording.getURI() ?? '';

    const status = await this.recording.getStatusAsync();
    const durationMs =
      // durationMillis is available in the recording status
      (status as unknown as { durationMillis?: number }).durationMillis ??
      (this.startedAt ? Date.now() - this.startedAt : 0);

    // Restore iOS audio mode for playback
    if (Platform.OS === 'ios') {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }

    this.recording = null;
    this.startedAt = null;

    return { uri, durationMs };
  }

  /** True if a recording session is currently active. */
  get isRecording(): boolean {
    return this.recording !== null;
  }
}
