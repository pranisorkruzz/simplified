import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

type EmailBriefPriority = 'high' | 'medium' | 'low';

type EmailBriefQuestion = {
  id: string;
  question: string;
  options: string[];
  otherLabel: string;
};

type EmailBrief = {
  title: string;
  summary: string;
  timeLabel: string;
  deadlineAt: string | null;
  priority: EmailBriefPriority;
  actionItems: string[];
  suggestedFollowUpQuestions?: EmailBriefQuestion[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GeminiErrorResponse = {
  error?: {
    message?: string;
  };
};

type UserAiContextResponse = {
  question?: string;
  answer?: string;
};

type UserAiContext = {
  responses?: UserAiContextResponse[];
};

type PostgrestErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as PostgrestErrorLike;
  const haystack = [maybeError.message, maybeError.details, maybeError.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  const target = columnName.toLowerCase();

  return (
    maybeError.code === 'PGRST204' ||
    haystack.includes(`'${target}'`) ||
    haystack.includes(`"${target}"`) ||
    haystack.includes(target)
  ) && (
    haystack.includes('schema cache') ||
    haystack.includes('does not exist') ||
    haystack.includes('could not find') ||
    haystack.includes('column')
  );
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

  const suggestedFollowUpQuestions = Array.isArray(
    parsed.suggestedFollowUpQuestions
  )
    ? parsed.suggestedFollowUpQuestions
        .map((q) => {
          if (typeof q !== 'object' || !q) return null;
          const question = q.question?.trim();
          const options = Array.isArray(q.options)
            ? q.options
                .filter((o): o is string => typeof o === 'string')
                .map((o) => o.trim())
                .filter(Boolean)
            : [];

          if (!question || options.length === 0) return null;

          return {
            id: q.id?.trim() || `q_${Math.random().toString(36).slice(2, 9)}`,
            question,
            options: options.slice(0, 4),
            otherLabel: q.otherLabel?.trim() || 'Other',
          };
        })
        .filter((q): q is NonNullable<typeof q> => Boolean(q))
        .slice(0, 3)
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
    suggestedFollowUpQuestions:
      suggestedFollowUpQuestions.length > 0
        ? suggestedFollowUpQuestions
        : undefined,
  };
}

function parseEmailBrief(raw: string): EmailBrief | null {
  try {
    return normalizeEmailBrief(
      JSON.parse(sanitizeJsonBlock(raw)) as Partial<EmailBrief>
    );
  } catch {
    return null;
  }
}

function readUserAiContextFromMetadata(metadata: unknown): UserAiContext | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const aiContext = (metadata as { ai_context?: unknown }).ai_context;

  if (!aiContext || typeof aiContext !== 'object') {
    return null;
  }

  const responses = (aiContext as UserAiContext).responses;

  if (!Array.isArray(responses) || responses.length === 0) {
    return null;
  }

  return {
    responses: responses.filter(
      (response) =>
        Boolean(response?.question?.trim()) && Boolean(response?.answer?.trim()),
    ),
  };
}

function buildAiContextPrompt(context: UserAiContext | null) {
  if (!context?.responses?.length) {
    return '';
  }

  const lines = context.responses
    .map((response) => `- ${response.question}: ${response.answer}`)
    .join('\n');

  return `\nUser-specific context to respect:\n${lines}\n`;
}

async function requestGemini(
  emailText: string,
  userContext: UserAiContext | null,
): Promise<EmailBrief> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const userContextPrompt = buildAiContextPrompt(userContext);

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const prompt = `You turn email content into one clear task card for a mobile app.

Reference date/time: ${new Date().toISOString()}

Return strict JSON only with this exact shape:
{
  "title": "short label for the whole email brief",
  "summary": "1-2 sentence summary of what matters",
  "timeLabel": "explicit meeting time if present, otherwise No set time",
  "deadlineAt": "ISO 8601 datetime if a clear deadline exists, otherwise null",
  "priority": "high" | "medium" | "low",
  "actionItems": ["small step", "small step", "small step"],
  "suggestedFollowUpQuestions": [
    {
      "id": "unique_id_string",
      "question": "Specific question about the context of this email",
      "options": ["Option A", "Option B", "Option C"],
      "otherLabel": "Other"
    }
  ]
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
- suggestedFollowUpQuestions must contain 3 to 4 questions that help Clarix understand the user's specific context, preferences, or stakes related to THIS EMAIL.
- Questions should be probing but helpful (e.g., "How critical is this client to your current quarterly goals?" or "What is your preferred tone for this type of follow-up?").
${userContextPrompt}

Email:
${emailText}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    try {
      const errorData = JSON.parse(errorText) as GeminiErrorResponse;
      throw new Error(
        errorData.error?.message ||
          `Gemini API error (${response.status})`
      );
    } catch {
      throw new Error(errorText || `Gemini API error (${response.status})`);
    }
  }

  const data = (await response.json()) as GeminiResponse;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  return parseEmailBrief(raw) ?? buildFallbackBrief(emailText);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = request.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
    return json(401, { error: 'Unauthorized' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json(401, { error: 'Unauthorized' });
  }

  const { emailText } = (await request.json().catch(() => ({}))) as {
    emailText?: unknown;
  };

  if (typeof emailText !== 'string' || !emailText.trim()) {
    return json(400, { error: 'emailText is required' });
  }

  const trimmedEmail = emailText.trim().slice(0, 12000);
  const userContext = readUserAiContextFromMetadata(user.user_metadata);

  try {
    const brief = await requestGemini(trimmedEmail, userContext);
    const assistantMessage = JSON.stringify(brief);
    const insertWithBriefPayload = await supabase
      .from('chats')
      .insert([
        {
          user_id: user.id,
          message: trimmedEmail,
          role: 'user',
          file_urls: [],
        },
        {
          user_id: user.id,
          message: brief.summary,
          role: 'assistant',
          file_urls: [],
          brief_payload: brief,
        },
      ])
      .select('id, created_at, role');

    const fallbackInsert =
      insertWithBriefPayload.error &&
      isMissingColumnError(insertWithBriefPayload.error, 'brief_payload')
        ? await supabase
            .from('chats')
            .insert([
              {
                user_id: user.id,
                message: trimmedEmail,
                role: 'user',
                file_urls: [],
              },
              {
                user_id: user.id,
                message: assistantMessage,
                role: 'assistant',
                file_urls: [],
              },
            ])
            .select('id, created_at, role')
        : null;

    const data = insertWithBriefPayload.data ?? fallbackInsert?.data;
    const error = fallbackInsert?.error ?? insertWithBriefPayload.error;

    if (error) {
      throw new Error(error.message);
    }

    const assistantChat = data?.find((row) => row.role === 'assistant');

    if (!assistantChat) {
      throw new Error('Assistant chat was not created');
    }

    return json(200, {
      brief,
      assistantChat,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to summarize email';

    return json(500, { error: message });
  }
});
