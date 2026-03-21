import type { UserType } from '@/types/database';

export type FollowUpQuestion = {
  id: string;
  question: string;
  options: string[];
  otherLabel: string;
};

export type UserAiContextResponse = {
  questionId: string;
  question: string;
  answer: string;
  answerSource: 'option' | 'other';
};

export type UserAiContext = {
  version: 1;
  userType: UserType | 'general';
  responses: UserAiContextResponse[];
  updatedAt: string;
};

const STUDENT_QUESTIONS: FollowUpQuestion[] = [
  {
    id: 'student_focus',
    question: 'What are you usually working on?',
    options: ['Assignments', 'Exam prep', 'Group projects'],
    otherLabel: 'Other',
  },
  {
    id: 'student_detail',
    question: 'How should Clarix break things down for you?',
    options: ['Very simple', 'Step by step', 'Detailed explanation'],
    otherLabel: 'Other',
  },
  {
    id: 'student_priority',
    question: 'What should Clarix optimize for first?',
    options: ['Upcoming deadline', 'Most important task', 'Fastest next win'],
    otherLabel: 'Other',
  },
  {
    id: 'student_deadline_type',
    question: 'Which deadlines matter most in your workflow?',
    options: ['Assignment due dates', 'Exam dates', 'Group project checkpoints'],
    otherLabel: 'Other',
  },
  {
    id: 'student_tone',
    question: 'What style of guidance helps you most?',
    options: ['Direct and concise', 'Supportive and clear', 'Detailed and structured'],
    otherLabel: 'Other',
  },
];

const PROFESSIONAL_QUESTIONS: FollowUpQuestion[] = [
  {
    id: 'work_focus',
    question: 'What kind of work do you want help with most?',
    options: ['Email follow-up', 'Project planning', 'Task prioritization'],
    otherLabel: 'Other',
  },
  {
    id: 'work_structure',
    question: 'How should Clarix organize your breakdowns?',
    options: ['Quick actions first', 'Step by step', 'Detailed with context'],
    otherLabel: 'Other',
  },
  {
    id: 'work_optimization',
    question: 'What should Clarix optimize for first?',
    options: ['Speed', 'Accuracy', 'Deadlines and priority'],
    otherLabel: 'Other',
  },
  {
    id: 'work_context',
    question: 'Which context should Clarix emphasize most?',
    options: ['Stakeholders', 'Deadlines', 'Dependencies'],
    otherLabel: 'Other',
  },
  {
    id: 'work_tone',
    question: 'What style of guidance fits your work best?',
    options: ['Direct and concise', 'Strategic and contextual', 'Detailed and structured'],
    otherLabel: 'Other',
  },
];

const GENERIC_QUESTIONS: FollowUpQuestion[] = [
  {
    id: 'generic_goal',
    question: 'What do you want help with most?',
    options: ['Planning work', 'Breaking tasks down', 'Staying on schedule'],
    otherLabel: 'Other',
  },
  {
    id: 'generic_style',
    question: 'How should Clarix present the breakdown?',
    options: ['Very simple', 'Step by step', 'Detailed explanation'],
    otherLabel: 'Other',
  },
  {
    id: 'generic_priority',
    question: 'What should Clarix optimize for first?',
    options: ['Speed', 'Accuracy', 'Deadlines and priority'],
    otherLabel: 'Other',
  },
  {
    id: 'generic_context',
    question: 'What kind of context should Clarix emphasize most?',
    options: ['Deadlines', 'Important details', 'Dependencies and blockers'],
    otherLabel: 'Other',
  },
  {
    id: 'generic_tone',
    question: 'What style of guidance do you prefer?',
    options: ['Direct and concise', 'Supportive and clear', 'Detailed and structured'],
    otherLabel: 'Other',
  },
];

export function getFollowUpQuestions(userType?: UserType | null) {
  if (userType === 'student') {
    return STUDENT_QUESTIONS;
  }

  if (userType === 'professional') {
    return PROFESSIONAL_QUESTIONS;
  }

  return GENERIC_QUESTIONS;
}

export function buildUserAiContext(
  userType: UserType | null | undefined,
  responses: UserAiContextResponse[],
): UserAiContext {
  return {
    version: 1,
    userType: userType ?? 'general',
    responses,
    updatedAt: new Date().toISOString(),
  };
}

export function parseUserAiContext(value: unknown): UserAiContext | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybeContext = value as Partial<UserAiContext>;

  if (!Array.isArray(maybeContext.responses)) {
    return null;
  }

  const responses = maybeContext.responses
    .map((response) => {
      if (!response || typeof response !== 'object') {
        return null;
      }

      const typedResponse = response as Partial<UserAiContextResponse>;
      const answer = typedResponse.answer?.trim();
      const question = typedResponse.question?.trim();
      const questionId = typedResponse.questionId?.trim();

      if (!answer || !question || !questionId) {
        return null;
      }

      return {
        questionId,
        question,
        answer,
        answerSource:
          typedResponse.answerSource === 'other' ? 'other' : 'option',
      } satisfies UserAiContextResponse;
    })
    .filter((response): response is UserAiContextResponse => Boolean(response));

  if (responses.length === 0) {
    return null;
  }

  return {
    version: 1,
    userType:
      maybeContext.userType === 'student' ||
      maybeContext.userType === 'professional'
        ? maybeContext.userType
        : 'general',
    responses,
    updatedAt:
      typeof maybeContext.updatedAt === 'string' && maybeContext.updatedAt
        ? maybeContext.updatedAt
        : new Date(0).toISOString(),
  };
}

export function readUserAiContextFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const aiContext = (metadata as { ai_context?: unknown }).ai_context;
  return parseUserAiContext(aiContext);
}

export function buildAiContextPrompt(context: UserAiContext | null) {
  if (!context || context.responses.length === 0) {
    return '';
  }

  const responseLines = context.responses
    .map((response) => `- ${response.question}: ${response.answer}`)
    .join('\n');

  return `\nUser-specific context to respect:\n${responseLines}\n`;
}
