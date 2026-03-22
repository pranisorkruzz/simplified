export type EmailBriefPriority = 'high' | 'medium' | 'low';
export type KanbanColumnId = 'todo' | 'in_progress' | 'done';

export interface KanbanSubtask {
  id: string;
  title: string;
  notes: string | null;
  column: KanbanColumnId;
  order: number;
  dependencies: string[];
  completedAt: string | null;
  // Flowchart specific
  type?: 'step' | 'decision';
}

export interface FlowchartEdge {
  from: string;
  to: string;
}

export interface KanbanPlan {
  generatedAt: string;
  sourceTask: string;
  contextAnswers: {
    question: string;
    answer: string;
  }[];
  subtasks: KanbanSubtask[];
  // New flowchart fields
  nodes?: KanbanSubtask[];
  edges?: FlowchartEdge[];
}

export interface EmailBrief {
  title: string;
  summary: string;
  timeLabel: string;
  deadlineAt: string | null;
  priority: EmailBriefPriority;
  actionItems: string[];
  suggestedFollowUpQuestions?: {
    id: string;
    question: string;
    options: string[];
    otherLabel: string;
  }[];
  kanbanPlan?: KanbanPlan;
}

type BriefRecord = {
  brief_payload?: unknown | null;
  message?: string | null;
};

function normalizeKanbanSubtask(
  subtask: unknown,
  index: number,
): KanbanSubtask | null {
  if (!subtask || typeof subtask !== 'object') {
    return null;
  }

  const typed = subtask as Partial<KanbanSubtask>;
  const title =
    typeof typed.title === 'string' ? typed.title.trim().slice(0, 120) : '';

  if (!title) {
    return null;
  }

  const id =
    typeof typed.id === 'string' && typed.id.trim()
      ? typed.id.trim()
      : `subtask_${index + 1}`;

  const column: KanbanColumnId =
    typed.column === 'in_progress' || typed.column === 'done'
      ? typed.column
      : 'todo';

  const dependencies = Array.isArray(typed.dependencies)
    ? typed.dependencies
        .filter((dep): dep is string => typeof dep === 'string')
        .map((dep) => dep.trim())
        .filter(Boolean)
    : [];

  const completedAt =
    typeof typed.completedAt === 'string' &&
    !Number.isNaN(Date.parse(typed.completedAt))
      ? new Date(typed.completedAt).toISOString()
      : null;

  return {
    id,
    title,
    notes:
      typeof typed.notes === 'string' && typed.notes.trim()
        ? typed.notes.trim().slice(0, 240)
        : null,
    column,
    order:
      typeof typed.order === 'number' && Number.isFinite(typed.order)
        ? typed.order
        : index,
    dependencies,
    completedAt,
    type: typed.type === 'decision' ? 'decision' : 'step',
  };
}

export function parseKanbanPlan(value: unknown): KanbanPlan | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const typed = value as Partial<KanbanPlan>;
  const sourceTask =
    typeof typed.sourceTask === 'string' ? typed.sourceTask.trim() : '';

  if (!sourceTask) {
    return null;
  }

  const contextAnswers = Array.isArray(typed.contextAnswers)
    ? typed.contextAnswers
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const typedEntry = entry as {
            question?: unknown;
            answer?: unknown;
          };
          const question =
            typeof typedEntry.question === 'string'
              ? typedEntry.question.trim()
              : '';
          const answer =
            typeof typedEntry.answer === 'string'
              ? typedEntry.answer.trim()
              : '';

          if (!question || !answer) {
            return null;
          }

          return { question, answer };
        })
        .filter((entry): entry is { question: string; answer: string } =>
          Boolean(entry),
        )
        .slice(0, 5)
    : [];

  const subtasks = Array.isArray(typed.subtasks)
    ? typed.subtasks
        .map((subtask, index) => normalizeKanbanSubtask(subtask, index))
        .filter((subtask): subtask is KanbanSubtask => Boolean(subtask))
    : [];

  const subtaskIds = new Set(subtasks.map((task) => task.id));
  const normalizedSubtasks = subtasks.map((task) => ({
    ...task,
    dependencies: task.dependencies.filter((dep) => subtaskIds.has(dep)),
  }));

  const nodes = Array.isArray(typed.nodes)
    ? typed.nodes
        .map((node, index) => normalizeKanbanSubtask(node, index))
        .filter((node): node is KanbanSubtask => Boolean(node))
    : [];

  const edges = Array.isArray(typed.edges)
    ? typed.edges
        .map((edge) => {
          if (!edge || typeof edge !== 'object') return null;
          const typedEdge = edge as Partial<FlowchartEdge>;
          if (
            typeof typedEdge.from === 'string' &&
            typeof typedEdge.to === 'string'
          ) {
            return {
              from: typedEdge.from,
              to: typedEdge.to,
            } satisfies FlowchartEdge;
          }
          return null;
        })
        .filter((edge): edge is FlowchartEdge => Boolean(edge))
    : [];

  return {
    generatedAt:
      typeof typed.generatedAt === 'string' &&
      !Number.isNaN(Date.parse(typed.generatedAt))
        ? new Date(typed.generatedAt).toISOString()
        : new Date().toISOString(),
    sourceTask,
    contextAnswers,
    subtasks: normalizedSubtasks,
    nodes: nodes.length > 0 ? nodes : normalizedSubtasks,
    edges,
  };
}

function detectTimeLabel(text: string): string {
  const match = text.match(
    /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm)|\d{1,2}(?::\d{2})?)\b/,
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
    suggestedFollowUpQuestions: [
      {
        id: 'fallback_detail',
        question: 'What is the most critical detail here?',
        options: ['The deadline', 'The specific request', 'The stakeholders'],
        otherLabel: 'Other',
      },
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
    parsed.suggestedFollowUpQuestions,
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
        .slice(0, 5)
    : [];
  const kanbanPlan = parseKanbanPlan(parsed.kanbanPlan);

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
    kanbanPlan: kanbanPlan ?? undefined,
  };
}

export function parseEmailBrief(raw: string): EmailBrief | null {
  try {
    return normalizeEmailBrief(
      JSON.parse(sanitizeJsonBlock(raw)) as Partial<EmailBrief>,
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
