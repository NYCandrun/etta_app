/**
 * Formatting utilities for Astrolabe UI.
 */

/**
 * Format a number with comma separators.
 * e.g. 12500 -> "12,500"
 */
export function formatXP(xp: number): string {
  return xp.toLocaleString("en-US");
}

/**
 * Format a date string as relative time.
 * e.g. "2 days ago", "just now", "in 3 hours"
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const isFuture = diffMs < 0;
  const absSec = Math.abs(diffSec);
  const absMin = Math.abs(diffMin);
  const absHr = Math.abs(diffHr);
  const absDay = Math.abs(diffDay);

  const prefix = isFuture ? "in " : "";
  const suffix = isFuture ? "" : " ago";

  if (absSec < 60) return "just now";
  if (absMin < 60) return `${prefix}${absMin} min${absMin !== 1 ? "s" : ""}${suffix}`;
  if (absHr < 24) return `${prefix}${absHr} hour${absHr !== 1 ? "s" : ""}${suffix}`;
  if (absDay < 7) return `${prefix}${absDay} day${absDay !== 1 ? "s" : ""}${suffix}`;
  if (absDay < 30) {
    const weeks = Math.floor(absDay / 7);
    return `${prefix}${weeks} week${weeks !== 1 ? "s" : ""}${suffix}`;
  }
  if (absDay < 365) {
    const months = Math.floor(absDay / 30);
    return `${prefix}${months} month${months !== 1 ? "s" : ""}${suffix}`;
  }
  const years = Math.floor(absDay / 365);
  return `${prefix}${years} year${years !== 1 ? "s" : ""}${suffix}`;
}

/**
 * Format a mastery score (0-1) as a percentage string.
 */
export function formatMastery(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Format a duration in minutes to a human-readable string.
 * e.g. 90 -> "1h 30m", 25 -> "25m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a date string as a short date.
 * e.g. "Mar 11, 2026"
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date string as just month and day.
 * e.g. "Mar 11"
 */
export function formatMonthDay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
