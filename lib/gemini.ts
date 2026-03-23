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
  FollowUpQuestion,
} from '@/lib/ai-context';
import { Alert } from 'react-native';
import {
  getSupabaseErrorMessage,
  isMissingColumnError,
  supabase,
} from '@/lib/supabase';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

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
  return raw.replace(/```json|```/g, '').trim();
}

export type ValidationResult = {
  isValid: boolean;
  reason: string;
};

export async function validateTaskInput(
  input: string,
): Promise<ValidationResult> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const model = 'gemini-2.5-flash-lite';

  if (!apiKey) {
    return { isValid: true, reason: '' };
  }

  const prompt = `You are a strict task validator. YOU MUST ONLY RESPOND WITH RAW JSON. NO OTHER TEXT WHATSOEVER.
Return exactly: {"isValid": true, "reason": "short reason why"} or {"isValid": false, "reason": "short reason why"}

A valid task is an actionable goal a person wants to achieve.
INVALID examples: hello, hi, asdf, 123, what is weather, I love pizza, dog, car
VALID examples: build a mobile app, plan my marketing strategy, learn React Native, write a marketing plan, send an email to the team

Input to validate: ${input}`;

  console.log('--- VALIDATION START ---');
  console.log('Input:', input);

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
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      console.error('Validation API error:', response.status);
      if (response.status === 429) {
        return {
          isValid: false,
          reason: 'Service is busy. Please wait a moment and try again.',
        };
      }
      return { isValid: false, reason: 'Validation failed. Please try again.' };
    }

    const data = (await response.json()) as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log('Raw AI Response:', raw);

    try {
      const clean = sanitizeJsonBlock(raw);
      const parsed = JSON.parse(clean) as ValidationResult;
      console.log('Parsed Result:', parsed);
      console.log('--- VALIDATION END ---');

      return {
        isValid: parsed.isValid ?? true,
        reason: parsed.reason ?? '',
      };
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.log('--- VALIDATION END (PARSE ERROR) ---');
      // If we cant parse, default to INVALID to be safe as requested
      return { isValid: false, reason: 'Could not parse validation response' };
    }
  } catch (error) {
    console.error('Validation Processing Error:', error);
    console.log('--- VALIDATION END (ERROR) ---');
    return { isValid: true, reason: '' };
  }
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
  if (!apiKey) return buildFallbackBrief(emailText);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userContextPrompt = buildAiContextPrompt(
    readUserAiContextFromMetadata(user?.user_metadata),
  );

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
${userContextPrompt}

Email:
${emailText}`;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (response.status === 429) {
        console.warn(`Model ${model} rate limited (429). Retrying with next available model...`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Gemini API error (${response.status})`);
      }

      const data = (await response.json()) as GeminiResponse;
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return parseEmailBrief(raw) ?? buildFallbackBrief(emailText);
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
      if (model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) break;
    }
  }

  return buildFallbackBrief(emailText);
}

export async function generateNextFollowUpQuestion(
  userTask: string,
  questionNumber: number,
  previousAnswers: UserAiContextResponse[],
): Promise<FollowUpQuestion | null> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;

  const stageHints = [
    'Scope/Goal (what exactly do you want to achieve?)',
    'Target Audience or who is it for?',
    'Timeline or deadline?',
    'Resources or constraints available?',
    'Specific requirements or preferences?',
  ];

  const stageInfo = stageHints[questionNumber - 1] || 'Specific requirements';
  const previousContext = previousAnswers.length > 0 
    ? previousAnswers.map(pa => `Q: ${pa.question}\nA: ${pa.answer}`).join('\n\n')
    : 'None yet.';

  const prompt = `You are an expert project consultant. Your job is to ask smart, specific follow up questions about the user's task to gather maximum context for planning.

Rules:
- Ask ONE question at a time
- Each question must be directly related to: ${userTask}
- Questions must follow logical order from broad to specific
- Never repeat similar questions
- Keep questions short and clear
- Sound like a smart human consultant, not a robot

STRICT JSON ONLY:
{
  "id": "q_${questionNumber}",
  "question": "Your single specific question here",
  "options": ["Option 1", "Option 2", "Option 3"],
  "otherLabel": "Other"
}

Current question number: ${questionNumber}
Focus area: ${stageInfo}
Previous answers so far:
${previousContext}

User task: ${userTask}

Ask question number ${questionNumber} now.`;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (response.status === 429) {
        console.warn(`Model ${model} rate limited (429) in generateNextFollowUpQuestion. Retrying...`);
        continue;
      }

      if (!response.ok) return null;

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const clean = sanitizeJsonBlock(raw);
      return JSON.parse(clean) as FollowUpQuestion;
    } catch (error) {
      console.error(`Error in generateNextFollowUpQuestion with ${model}:`, error);
      if (model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) break;
    }
  }

  return null;
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
  if (!apiKey) return buildFallbackKanbanPlan({ sourceTask, brief, responses });

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

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (response.status === 429) {
        console.warn(`Model ${model} rate limited (429) in generateKanbanPlan. Retrying...`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Gemini API error (${response.status})`);
      }

      const data = (await response.json()) as GeminiResponse;
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = parseKanbanPlan(raw ? JSON.parse(sanitizeJsonBlock(raw)) : null);

      if (parsed) return parsed;
    } catch (error) {
      console.error(`Error in generateKanbanPlan with ${model}:`, error);
      if (model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) break;
    }
  }

  return buildFallbackKanbanPlan({ sourceTask, brief, responses });
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
