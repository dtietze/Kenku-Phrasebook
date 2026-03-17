/**
 * src/utils/uuid.ts
 *
 * Thin wrapper around the `uuid` package.
 * Centralising the import means we can swap the implementation in one place
 * if needed (e.g. to use crypto.randomUUID() on platforms that support it).
 */

/**
 * Generate a new UUID v4 using the platform's native crypto implementation.
 * Available in modern browsers, React Native (Hermes), and Node 14.17+.
 *
 * @example
 *   const id = generateId(); // "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateId(): string {
  return crypto.randomUUID();
}
