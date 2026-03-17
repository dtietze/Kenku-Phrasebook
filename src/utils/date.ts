/**
 * src/utils/date.ts
 *
 * Date formatting helpers used across the UI.
 * All functions accept an ISO-8601 date string and return a human-readable string.
 */

/**
 * Format an ISO-8601 date string as a short human-readable date,
 * e.g. "Mar 17, 2026".
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  return date.toLocaleDateString(undefined, {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

/**
 * Format an ISO-8601 date string as a relative human-readable string,
 * e.g. "2 hours ago", "yesterday", "3 days ago".
 */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return formatDate(isoString);

  const now      = new Date();
  const diffMs   = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs  = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSecs < 60)   return 'just now';
  if (diffMins < 60)   return `${diffMins}m ago`;
  if (diffHrs < 24)    return `${diffHrs}h ago`;
  if (diffDays === 1)  return 'yesterday';
  if (diffDays < 7)    return `${diffDays} days ago`;
  if (diffDays < 30)   return `${Math.floor(diffDays / 7)} weeks ago`;

  return formatDate(isoString);
}

/**
 * Format a duration in milliseconds as mm:ss.
 * e.g. 75000 → "1:15"
 */
export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a duration in seconds as mm:ss.
 */
export function formatDurationSecs(seconds: number): string {
  return formatDuration(seconds * 1000);
}
