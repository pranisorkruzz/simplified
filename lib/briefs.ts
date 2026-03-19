export type EmailBriefPriority = 'high' | 'medium' | 'low';

export interface EmailBrief {
  title: string;
  summary: string;
  timeLabel: string;
  deadlineAt: string | null;
  priority: EmailBriefPriority;
  actionItems: string[];
}

type BriefRecord = {
  brief_payload?: unknown | null;
  message?: string | null;
};

function detectTimeLabel(text: string): string {
  const match = text.match(
    /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm)|\d{1,2}(?::\d{2})?)\b/
  );

  return match ? match[1].replace(/\s+/g, ' ').trim() : 'No set time';
}

export function buildFallbackBrief(emailText: string): EmailBrief {
  const lines = emailText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] || 'Follow up on email';
  const summary = lines.slice(0, 3).join(' ').slice(0, 180);

  return {
    title: firstLine.slice(0, 72),
    summary: summary || 'Review the email and capture the next action.',
    timeLabel: detectTimeLabel(emailText),
    deadlineAt: null,
    priority: 'medium',
    actionItems: [
      'Review the email details',
      'Prepare the needed response',
      'Send the follow-up',
    ],
  };
}

function sanitizeJsonBlock(raw: string): string {
  const fenced = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');

  if (start >= 0 && end > start) {
    return fenced.slice(start, end + 1);
  }

  return fenced;
}

function normalizeEmailBrief(parsed: Partial<EmailBrief>): EmailBrief | null {
  const title = parsed.title?.trim();
  const summary = parsed.summary?.trim();
  const deadlineAt =
    typeof parsed.deadlineAt === 'string' &&
    !Number.isNaN(Date.parse(parsed.deadlineAt))
      ? new Date(parsed.deadlineAt).toISOString()
      : null;
  const priority =
    parsed.priority === 'high' ||
    parsed.priority === 'medium' ||
    parsed.priority === 'low'
      ? parsed.priority
      : 'medium';
  const actionItems = Array.isArray(parsed.actionItems)
    ? parsed.actionItems
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  if (!title || !summary) {
    return null;
  }

  return {
    title,
    summary,
    timeLabel: parsed.timeLabel?.trim() || 'No set time',
    deadlineAt,
    priority,
    actionItems:
      actionItems.length > 0
        ? actionItems
        : [
            'Review the email details',
            'Prepare the next step',
            'Send the response',
          ],
  };
}

export function parseEmailBrief(raw: string): EmailBrief | null {
  try {
    return normalizeEmailBrief(
      JSON.parse(sanitizeJsonBlock(raw)) as Partial<EmailBrief>
    );
  } catch {
    return null;
  }
}

export function parseBriefPayload(payload: unknown): EmailBrief | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    return parseEmailBrief(payload);
  }

  if (typeof payload === 'object') {
    return normalizeEmailBrief(payload as Partial<EmailBrief>);
  }

  return null;
}

export function readBriefFromRecord(record: BriefRecord): EmailBrief | null {
  return (
    parseBriefPayload(record.brief_payload) ??
    (record.message ? parseEmailBrief(record.message) : null)
  );
}
