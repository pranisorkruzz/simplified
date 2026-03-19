import { EmailBrief } from '@/lib/briefs';

export function getPriorityColors(priority: EmailBrief['priority'] | undefined) {
  switch (priority) {
    case 'high':
      return { background: '#FFE0DB', text: '#A62C1B' };
    case 'low':
      return { background: '#E3F4EA', text: '#1F6A45' };
    case 'medium':
    default:
      return { background: '#FFF1D6', text: '#8A5A00' };
  }
}

export function formatDateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function formatCreatedLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatTimeLeft(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);

  if (abs < 1000 * 60 * 60) {
    const minutes = Math.max(1, Math.round(abs / (1000 * 60)));
    return diff >= 0 ? `${minutes}m left` : `${minutes}m overdue`;
  }

  if (abs < 1000 * 60 * 60 * 24) {
    const hours = Math.max(1, Math.round(abs / (1000 * 60 * 60)));
    return diff >= 0 ? `${hours}h left` : `${hours}h overdue`;
  }

  const days = Math.max(1, Math.round(abs / (1000 * 60 * 60 * 24)));
  return diff >= 0 ? `${days}d left` : `${days}d overdue`;
}

export function getDeadlineTone(deadlineAt: string | null) {
  if (!deadlineAt) {
    return { background: '#E9E1D3', text: '#6A6257' };
  }
  return new Date(deadlineAt).getTime() < Date.now()
    ? { background: '#FFE0DB', text: '#A62C1B' }
    : { background: '#F7E8CC', text: '#7B5410' };
}

export function formatDeadlineInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function parseManualDeadlineInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 0).toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(trimmed)) {
    const [datePart, timePart] = trimmed.split(/\s+/);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0).toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
