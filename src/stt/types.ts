/**
 * src/stt/types.ts
 *
 * Shared interface that both stt.native.ts and stt.web.ts must implement.
 * The useSTT hook depends only on this interface, keeping it platform-agnostic.
 */

export interface STTInterface {
  /** Start listening.  @param locale BCP-47 language tag, default "en-US". */
  start(locale?: string): Promise<void>;
  /** Gracefully stop listening and emit the final result. */
  stop(): Promise<void>;
  /** Immediately cancel without emitting a result. */
  cancel(): Promise<void>;
  /** Release all resources.  Call in cleanup (useEffect return). */
  destroy(): Promise<void>;

  /** Register a callback for (possibly partial) transcript updates. */
  onResult(callback: (text: string) => void): void;
  /** Register a callback for errors. */
  onError(callback: (error: string) => void): void;
  /** Register a callback for when recognition ends (naturally or via stop). */
  onEnd(callback: () => void): void;
}
