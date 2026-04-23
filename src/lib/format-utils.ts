/**
 * Shared formatting utilities for Forma Flow UI.
 */

/**
 * Format bytes to human-readable size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 1 ? 1 : 0)} ${units[i] || 'TB'}`;
}

/**
 * Format a date string to relative time (e.g., "2h ago", "3d ago").
 */
export function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Map numeric health score (0-100) to label and Badge variant.
 */
export function getHealthLabel(score: number): { label: string; variant: 'success' | 'warning' | 'error' } {
  if (score >= 80) return { label: 'Good', variant: 'success' };
  if (score >= 60) return { label: 'Fair', variant: 'warning' };
  return { label: 'Poor', variant: 'error' };
}
