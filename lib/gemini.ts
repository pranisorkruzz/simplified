import {
  buildFallbackBrief,
  EmailBrief,
  KanbanPlan,
  KanbanSubtask,
  parseKanbanPlan,
  parseBriefPayload,
  parseEmailBrief,
} from '@/lib/briefs';
import {
  buildAiContextPrompt,
  readUserAiContextFromMetadata,
  UserAiContextResponse,
} from '@/lib/ai-context';
import {
  getSupabaseErrorMessage,
  isMissingColumnError,
  supabase,
} from '@/lib/supabase';

type CreatedBriefResponse = {
  brief: EmailBrief;
  assistantChat: {
    id: string;
    created_at: string;
  };
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

type KanbanGenerationArgs = {
  sourceTask: string;
  brief: EmailBrief;
  responses: UserAiContextResponse[];
};

function buildFallbackKanbanPlan({
  sourceTask,
  brief,
  responses,
}: KanbanGenerationArgs): KanbanPlan {
  const contextLine = responses
    .slice(0, 2)
    .map((response) => response.answer)
    .filter(Boolean)
    .join(' | ');

  const fallbackSteps = [
    `Clarify scope for ${brief.title}`,
    ...brief.actionItems,
    'Review dependencies and blockers',
    'QA the final deliverable',
  ].filter(Boolean);

  const uniqueSteps = Array.from(
    new Set(
      fallbackSteps
        .map((step) => step.trim())
        .filter(Boolean)
        .map((step) => (step.length > 110 ? `${step.slice(0, 107)}...` : step)),
    ),
  ).slice(0, 9);

  const subtasks = uniqueSteps.map((title, index) => {
    const id = `task_${index + 1}`;

    return {
      id,
      title,
      notes: index === 0 && contextLine ? `Context: ${contextLine}` : null,
      column: index === 0 ? 'in_progress' : 'todo',
      order: index === 0 ? 0 : index - 1,
      dependencies:
        index > 0 && index < uniqueSteps.length - 1 ? [`task_${index}`] : [],
      completedAt: null,
    } satisfies KanbanSubtask;
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceTask: sourceTask.trim() || brief.title,
    contextAnswers: responses.slice(0, 5).map((response) => ({
      question: response.question,
      answer: response.answer,
    })),
    subtasks,
  };
}

type SupabaseFunctionErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  context?: {
    status?: number;
  };
};

function isFunctionUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as SupabaseFunctionErrorLike;
  const status = maybeError.context?.status;
  const message = [maybeError.message, maybeError.details, maybeError.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

  return (
    status === 401 ||
    status === 404 ||
    (typeof status === 'number' && status >= 500) ||
    message.includes('404') ||
    message.includes('401') ||
    message.includes('not found') ||
    message.includes('unauthorized') ||
    message.includes('edge function returned a non-2xx status code') ||
    message.includes('failed to send a request to the edge function')
  );
}

async function requestGeminiFromClient(emailText: string): Promise<EmailBrief> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userContextPrompt = buildAiContextPrompt(
    readUserAiContextFromMetadata(user?.user_metadata),
  );

  if (!apiKey) {
    return buildFallbackBrief(emailText);
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

  try {
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
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      try {
        const errorData = JSON.parse(errorText) as GeminiErrorResponse;
        throw new Error(
          errorData.error?.message || `Gemini API error (${response.status})`,
        );
      } catch {
        throw new Error(errorText || `Gemini API error (${response.status})`);
      }
    }

    const data = (await response.json()) as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return parseEmailBrief(raw) ?? buildFallbackBrief(emailText);
  } catch {
    return buildFallbackBrief(emailText);
  }
}

async function insertBriefRows(
  userId: string,
  emailText: string,
  brief: EmailBrief,
) {
  const trimmedEmail = emailText.trim().slice(0, 12000);

  const insertWithPayload = await supabase
    .from('chats')
    .insert([
      {
        user_id: userId,
        message: trimmedEmail,
        role: 'user',
        file_urls: [],
      },
      {
        user_id: userId,
        message: brief.summary,
        role: 'assistant',
        file_urls: [],
        brief_payload: brief,
      },
    ])
    .select('id, created_at, role');

  const fallbackInsert =
    insertWithPayload.error &&
    isMissingColumnError(insertWithPayload.error, 'brief_payload')
      ? await supabase
          .from('chats')
          .insert([
            {
              user_id: userId,
              message: trimmedEmail,
              role: 'user',
              file_urls: [],
            },
            {
              user_id: userId,
              message: JSON.stringify(brief),
              role: 'assistant',
              file_urls: [],
            },
          ])
          .select('id, created_at, role')
      : null;

  const rows = insertWithPayload.data ?? fallbackInsert?.data;
  const writeError = fallbackInsert?.error ?? insertWithPayload.error;

  if (writeError) {
    throw new Error(getSupabaseErrorMessage(writeError, 'Failed to save brief'));
  }

  const assistantChat = rows?.find((row) => row.role === 'assistant');

  if (!assistantChat) {
    throw new Error('Assistant chat was not created');
  }

  return assistantChat;
}

export async function generateKanbanPlan({
  sourceTask,
  brief,
  responses,
}: KanbanGenerationArgs): Promise<KanbanPlan> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return buildFallbackKanbanPlan({ sourceTask, brief, responses });
  }

  const prompt = `You are generating a kanban flowchart for a mobile app.

Reference date/time: ${new Date().toISOString()}

Main user task: ${sourceTask}
Brief title: ${brief.title}
Brief summary: ${brief.summary}

Original action items:
${brief.actionItems.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Follow-up answers:
${responses
  .map((response, index) => `${index + 1}. ${response.question}: ${response.answer}`)
  .join('\n')}

Return STRICT JSON only in this exact shape:
{
  "generatedAt": "ISO 8601 datetime",
  "sourceTask": "string",
  "contextAnswers": [
    { "question": "string", "answer": "string" }
  ],
  "nodes": [
    {
      "id": "snake_case_id",
      "title": "short atomic subtask title",
      "notes": "optional 1 short sentence or null",
      "type": "step" | "decision",
      "column": "todo" | "in_progress" | "done",
      "order": 0,
      "completedAt": null
    }
  ],
  "edges": [
    { "from": "id_of_source_node", "to": "id_of_target_node" }
  ]
}

Rules:
- Generate 7 to 12 nodes.
- "nodes" are the tasks/steps.
- "type" must be "step" for regular actions or "decision" for choices/splits.
- "edges" define the flow between nodes.
- Every node except the first one should have at least one incoming edge.
- The flow must have a logical start and end.
- Decisions (diamonds) should lead to at least two different paths or a confirmation step.
- Make subtasks atomic and execution-ready.
- Keep almost all tasks in todo and at most 1 in in_progress.
- Keep done empty unless explicitly implied as already completed.
- "order" is the vertical/logical sequence, starting at 0.
- Do not include markdown fences or any commentary.`;

  try {
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
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      try {
        const errorData = JSON.parse(errorText) as GeminiErrorResponse;
        throw new Error(
          errorData.error?.message || `Gemini API error (${response.status})`,
        );
      } catch {
        throw new Error(errorText || `Gemini API error (${response.status})`);
      }
    }

    const data = (await response.json()) as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseKanbanPlan(
      raw ? JSON.parse(sanitizeJsonBlock(raw)) : null,
    );

    if (parsed) {
      return parsed;
    }

    return buildFallbackKanbanPlan({ sourceTask, brief, responses });
  } catch {
    return buildFallbackKanbanPlan({ sourceTask, brief, responses });
  }
}

export async function createBriefFromEmail(
  emailText: string
): Promise<CreatedBriefResponse> {
  const trimmedEmail = emailText.trim();

  if (!trimmedEmail) {
    throw new Error('emailText is required');
  }

  const { data, error } = await supabase.functions.invoke('summarize-email', {
    body: {
      emailText: trimmedEmail,
    },
  });

  if (error) {
    if (!isFunctionUnavailableError(error)) {
      throw new Error(getSupabaseErrorMessage(error, 'Failed to summarize email'));
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('You must be signed in to create briefs');
    }

    const brief = await requestGeminiFromClient(trimmedEmail);
    const assistantChat = await insertBriefRows(user.id, trimmedEmail, brief);

    return {
      brief,
      assistantChat: {
        id: assistantChat.id,
        created_at: assistantChat.created_at,
      },
    };
  }

  const brief = parseBriefPayload(data?.brief);
  const assistantChatId = data?.assistantChat?.id;
  const assistantChatCreatedAt = data?.assistantChat?.created_at;

  if (!brief || !assistantChatId || !assistantChatCreatedAt) {
    throw new Error('Invalid summarize-email response');
  }

  return {
    brief,
    assistantChat: {
      id: assistantChatId,
      created_at: assistantChatCreatedAt,
    },
  };
}
