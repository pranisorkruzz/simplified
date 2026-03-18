const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiPart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface GeminiErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export type EmailBriefPriority = 'high' | 'medium' | 'low';

export interface EmailBrief {
  title: string;
  summary: string;
  timeLabel: string;
  deadlineAt: string | null;
  priority: EmailBriefPriority;
  actionItems: string[];
}

async function requestGemini(parts: GeminiPart[]): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
  }

  const response = await fetch(
    `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Gemini API error (${response.status})`;

    if (errorText) {
      try {
        const errorData = JSON.parse(errorText) as GeminiErrorResponse;
        if (errorData.error?.message) {
          errorMessage = `Gemini API error (${response.status}): ${errorData.error.message}`;
        } else {
          errorMessage = `Gemini API error (${response.status}): ${errorText}`;
        }
      } catch {
        errorMessage = `Gemini API error (${response.status}): ${errorText}`;
      }
    }

    throw new Error(errorMessage);
  }

  const data: GeminiResponse = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || 'No response';
}

function detectTimeLabel(text: string): string {
  const match = text.match(
    /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm)|\d{1,2}(?::\d{2})?)\b/
  );

  return match ? match[1].replace(/\s+/g, ' ').trim() : 'No set time';
}

function buildFallbackBrief(emailText: string): EmailBrief {
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

export function parseEmailBrief(raw: string): EmailBrief | null {
  try {
    const parsed = JSON.parse(sanitizeJsonBlock(raw)) as Partial<EmailBrief>;
    const title = parsed.title?.trim();
    const summary = parsed.summary?.trim();
    const deadlineAt =
      typeof parsed.deadlineAt === 'string' && !Number.isNaN(Date.parse(parsed.deadlineAt))
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
  } catch {
    return null;
  }
}

export async function sendToGemini(
  message: string,
  fileBase64?: string,
  mimeType?: string
): Promise<string> {
  const parts: GeminiPart[] = [{ text: message }];

  if (fileBase64 && mimeType) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: fileBase64,
      },
    });
  }

  return requestGemini(parts);
}

export async function summarizeEmailToBrief(
  emailText: string
): Promise<EmailBrief> {
  const prompt = `You turn email content into one clear task card for a mobile app.

Reference date/time: ${new Date().toISOString()}

Return strict JSON only with this exact shape:
{
  "title": "short label for the whole email brief",
  "summary": "1-2 sentence summary of what matters",
  "timeLabel": "explicit meeting time if present, otherwise No set time",
  "deadlineAt": "ISO 8601 datetime if a clear deadline exists, otherwise null",
  "priority": "high" | "medium" | "low",
  "actionItems": ["small step", "small step", "small step"]
}

Rules:
- Keep the title under 72 characters.
- Use "No set time" if the email does not include a clear time.
- Set deadlineAt only when the email gives a clear deadline or due date.
- Resolve relative dates like today, tomorrow, next Monday, or end of day using the reference date/time above.
- If the email only mentions a time without a clear day, use null for deadlineAt.
- actionItems must contain 3 to 5 items.
- Each action item must be a small atomic task that one person can complete quickly.
- Break large requests into the smallest useful chunks.
- Start each action item with a verb.
- Do not wrap the JSON in markdown fences.
- Extract the most important next action, not every possible task.

Email:
${emailText}`;

  const raw = await requestGemini([{ text: prompt }]);
  return parseEmailBrief(raw) ?? buildFallbackBrief(emailText);
}

export function extractTasksFromResponse(text: string): string[] {
  const tasks: string[] = [];

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed.match(/^\d+[\.\)]\s/) ||
      trimmed.match(/^[-*]\s/) ||
      trimmed.match(/^\u2022\s/)
    ) {
      const taskText = trimmed
        .replace(/^\d+[\.\)]\s/, '')
        .replace(/^[-*\u2022]\s/, '')
        .trim();

      if (taskText.length > 0) {
        tasks.push(taskText);
      }
    }
  }

  return tasks.length > 0 ? tasks : [text];
}
