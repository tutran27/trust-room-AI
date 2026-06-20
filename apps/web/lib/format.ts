export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(
      diffMinutes,
      'minute',
    );
  }

  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(
      diffHours,
      'hour',
    );
  }

  const diffDays = Math.round(diffMs / 86_400_000);
  return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(diffDays, 'day');
}

export function formatAmount(value: string | number, token?: string): string {
  const amount =
    typeof value === 'number' ? value.toLocaleString('en-US') : trimDecimalZeros(value);
  return token ? `${amount} ${token}` : amount;
}

export function trimDecimalZeros(value: string): string {
  if (!value.includes('.')) return value;
  return value.replace(/\.?0+$/, '');
}

export function titleCaseStatus(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}
