import { readBriefFromRecord } from '@/lib/briefs';
import { isMissingColumnError, supabase } from '@/lib/supabase';
import { BriefCardData, Chat, Task, TaskChatRecord, TaskRow } from '@/types/database';

type BriefFeedChatRow = Pick<Chat, 'id' | 'role' | 'message' | 'created_at'> & {
  brief_payload?: unknown | null;
};

type BriefTaskStatusRow = Pick<Task, 'chat_id' | 'completed'>;

type TaskSelectRow = Task & {
  chat: TaskChatRecord | TaskChatRecord[] | null;
};

type ChatBriefPayloadRow = {
  id: string;
  brief_payload: unknown | null;
};

export async function fetchBriefFeed(userId: string) {
  const [chatsQuery, tasksQuery] = await Promise.all([
    supabase
      .from('chats')
      .select('id, role, message, created_at, brief_payload')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('chat_id, completed')
      .eq('user_id', userId),
  ]);

  if (chatsQuery.error) {
    if (isMissingColumnError(chatsQuery.error, 'brief_payload')) {
      // Fallback for when brief_payload column is not yet present
      const fallbackChatsQuery = await supabase
        .from('chats')
        .select('id, role, message, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fallbackChatsQuery.error) {
        throw fallbackChatsQuery.error;
      }

      return {
        chats: (fallbackChatsQuery.data ?? []) as BriefFeedChatRow[],
        tasks: (tasksQuery.data ?? []) as BriefTaskStatusRow[],
      };
    }
    throw chatsQuery.error;
  }

  if (tasksQuery.error) {
    throw tasksQuery.error;
  }

  return {
    chats: (chatsQuery.data ?? []) as BriefFeedChatRow[],
    tasks: (tasksQuery.data ?? []) as BriefTaskStatusRow[],
  };
}

export function buildBriefCards(
  chats: BriefFeedChatRow[],
  linkedTaskIds: Set<string>,
) {
  return chats
    .map((chat) => {
      if (chat.role !== 'assistant') {
        return null;
      }

      const brief = readBriefFromRecord(chat);

      if (!brief) {
        return null;
      }

      return {
        ...brief,
        id: chat.id,
        createdAt: chat.created_at,
        addedToTasks: linkedTaskIds.has(chat.id),
      } satisfies BriefCardData;
    })
    .filter((brief): brief is BriefCardData => Boolean(brief));
}

export function buildTaskStats(tasks: BriefTaskStatusRow[]) {
  return {
    active: tasks.filter((task) => !task.completed).length,
    finished: tasks.filter((task) => task.completed).length,
  };
}

export function buildLinkedTaskIds(tasks: BriefTaskStatusRow[]) {
  return new Set(
    tasks
      .map((task) => task.chat_id)
      .filter((chatId): chatId is string => Boolean(chatId)),
  );
}

export async function insertTasksForBrief(userId: string, brief: BriefCardData) {
  const baseRows = brief.actionItems.map((item, index) => ({
    user_id: userId,
    chat_id: brief.id,
    title: item,
    order_index: index,
    completed: false,
  }));

  if (!brief.deadlineAt) {
    return {
      ...(await supabase.from('tasks').insert(baseRows)),
      insertedWithoutDeadline: false,
    };
  }

  const { error } = await supabase.from('tasks').insert(
    baseRows.map((row) => ({
      ...row,
      deadline_at: brief.deadlineAt,
    })),
  );

  if (!error) {
    return { error: null, insertedWithoutDeadline: false };
  }

  if (!isMissingColumnError(error, 'deadline_at')) {
    return { error, insertedWithoutDeadline: false };
  }

  const retry = await supabase.from('tasks').insert(baseRows);

  return {
    ...retry,
    insertedWithoutDeadline: !retry.error,
  };
}

export async function deleteBriefsByIds(userId: string, briefIds: string[]) {
  if (briefIds.length === 0) {
    return { error: null, data: [] };
  }

  // First fetch the records to get their created_at timestamps
  // This allows us to delete both the assistant record and the preceding user record
  // because they were inserted together and share the exact same timestamp.
  const { data: records, error: fetchError } = await supabase
    .from('chats')
    .select('created_at')
    .eq('user_id', userId)
    .in('id', briefIds);

  if (fetchError || !records || records.length === 0) {
    return { error: fetchError, data: [] };
  }

  const timestamps = Array.from(new Set(records.map((r) => r.created_at)));

  return supabase
    .from('chats')
    .delete()
    .eq('user_id', userId)
    .in('created_at', timestamps)
    .select('id');
}

export async function fetchTaskFeed(userId: string) {
  const tasksWithDeadlineQuery = await supabase
    .from('tasks')
    .select(
      'id, user_id, chat_id, title, order_index, completed, created_at, deadline_at, chat:chats(message)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('order_index', { ascending: true });

  const tasksWithoutDeadlineQuery = isMissingColumnError(
    tasksWithDeadlineQuery.error,
    'deadline_at',
  )
    ? await supabase
        .from('tasks')
        .select(
          'id, user_id, chat_id, title, order_index, completed, created_at, chat:chats(message)',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('order_index', { ascending: true })
    : null;

  const baseTasksError =
    tasksWithDeadlineQuery.error &&
    !isMissingColumnError(tasksWithDeadlineQuery.error, 'deadline_at')
      ? tasksWithDeadlineQuery.error
      : tasksWithoutDeadlineQuery?.error ?? null;

  if (baseTasksError) {
    throw baseTasksError;
  }

  const baseTasks = tasksWithDeadlineQuery.data
    ? (tasksWithDeadlineQuery.data as TaskSelectRow[])
    : ((tasksWithoutDeadlineQuery?.data ?? []).map((task) => ({
        ...task,
        deadline_at: null,
      })) as TaskSelectRow[]);

  const deadlineFeatureAvailable = !isMissingColumnError(
    tasksWithDeadlineQuery.error,
    'deadline_at',
  );

  const chatIds = Array.from(
    new Set(
      baseTasks
        .map((task) => task.chat_id)
        .filter((chatId): chatId is string => Boolean(chatId)),
    ),
  );

  if (chatIds.length === 0) {
    return {
      tasks: baseTasks.map((task) => ({
        ...task,
        chat: null,
        brief: null,
      })) as TaskRow[],
      deadlineFeatureAvailable,
    };
  }

  const briefPayloadQuery = await supabase
    .from('chats')
    .select('id, brief_payload')
    .in('id', chatIds);

  if (
    briefPayloadQuery.error &&
    !isMissingColumnError(briefPayloadQuery.error, 'brief_payload')
  ) {
    throw briefPayloadQuery.error;
  }

  const briefPayloadByChatId = new Map<string, unknown | null>(
    isMissingColumnError(briefPayloadQuery.error, 'brief_payload')
      ? []
      : (briefPayloadQuery.data as ChatBriefPayloadRow[] | null | undefined)?.map(
          (chat) => [chat.id, chat.brief_payload],
        ) ?? [],
  );

  const tasks = baseTasks.map((task) => {
    const chatRecord = Array.isArray(task.chat) ? task.chat[0] : task.chat;
    const enrichedChat = chatRecord
      ? {
          ...chatRecord,
          brief_payload: task.chat_id
            ? briefPayloadByChatId.get(task.chat_id) ?? null
            : null,
        }
      : null;

    return {
      ...task,
      chat: enrichedChat,
      brief: enrichedChat ? readBriefFromRecord(enrichedChat) : null,
    } satisfies TaskRow;
  });

  return {
    tasks,
    deadlineFeatureAvailable,
  };
}
