import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  ArrowRight,
  CheckCheck,
  Clock3,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { createBriefFromEmail } from '@/lib/gemini';
import { EmailBrief, readBriefFromRecord } from '@/lib/briefs';
import {
  getSupabaseErrorMessage,
  isMissingColumnError,
  supabase,
} from '@/lib/supabase';

import BriefCardItem, { BriefCardType as BriefCard } from '@/components/BriefCard';
import BriefsHero from '@/components/BriefsHero';
import BriefComposer from '@/components/BriefComposer';

async function fetchBriefsData(userId: string) {
  const baseChatsQuery = await supabase
    .from('chats')
    .select('id, role, message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const tasksQuery = await supabase
    .from('tasks')
    .select('chat_id, completed')
    .eq('user_id', userId);

  if (baseChatsQuery.error) {
    return {
      chatsData: null,
      chatsError: baseChatsQuery.error,
      tasksData: tasksQuery.data,
    };
  }

  const briefPayloadQuery = await supabase
    .from('chats')
    .select('id, brief_payload')
    .eq('user_id', userId);

  const briefPayloadById = isMissingColumnError(
    briefPayloadQuery.error,
    'brief_payload'
  )
    ? new Map<string, unknown | null>()
    : new Map(
        (briefPayloadQuery.data ?? []).map((chat) => [chat.id, chat.brief_payload])
      );

  const chatsData = (baseChatsQuery.data ?? []).map((chat) => ({
    ...chat,
    brief_payload: briefPayloadById.get(chat.id) ?? null,
  }));
  const chatsError =
    briefPayloadQuery.error &&
    !isMissingColumnError(briefPayloadQuery.error, 'brief_payload')
      ? briefPayloadQuery.error
      : null;
  const tasksData = tasksQuery.data;

  return { chatsData, chatsError, tasksData };
}

function mapBriefCards(
  chatsData: {
    id: string;
    role: string;
    message: string;
    brief_payload?: unknown | null;
    created_at: string;
  }[],
  linkedTaskIds: Set<string>
) {
  return chatsData
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
      } satisfies BriefCard;
    })
    .filter((brief): brief is BriefCard => Boolean(brief));
}

async function insertTasksForBrief(userId: string, brief: BriefCard) {
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

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});



export default function BriefsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [briefs, setBriefs] = useState<BriefCard[]>([]);
  const [draftEmail, setDraftEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [taskStats, setTaskStats] = useState({
    active: 0,
    finished: 0,
  });

  const loadBriefs = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!user) {
      setBriefs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { chatsData, chatsError, tasksData } = await fetchBriefsData(user.id);

    if (chatsError) {
      setErrorMessage(chatsError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const linkedTaskIds = new Set(
      (tasksData ?? [])
        .map((task: { chat_id: string | null }) => task.chat_id)
        .filter((chatId): chatId is string => Boolean(chatId)),
    );

    const nextBriefs = mapBriefCards(chatsData ?? [], linkedTaskIds);

    setBriefs(nextBriefs);
    setTaskStats({
      active: (tasksData ?? []).filter((task) => !task.completed).length,
      finished: (tasksData ?? []).filter((task) => task.completed).length,
    });
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!user) {
      setBriefs([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadInitialBriefs = async () => {
      setLoading(true);
      const { chatsData, chatsError, tasksData } = await fetchBriefsData(
        user.id,
      );

      if (!active) {
        return;
      }

      if (chatsError) {
        setErrorMessage(chatsError.message);
        setLoading(false);
        return;
      }

      const linkedTaskIds = new Set(
        (tasksData ?? [])
          .map((task: { chat_id: string | null }) => task.chat_id)
          .filter((chatId): chatId is string => Boolean(chatId)),
      );

      const nextBriefs = mapBriefCards(chatsData ?? [], linkedTaskIds);

      setBriefs(nextBriefs);
      setTaskStats({
        active: (tasksData ?? []).filter((task) => !task.completed).length,
        finished: (tasksData ?? []).filter((task) => task.completed).length,
      });
      setLoading(false);
    };

    void loadInitialBriefs();

    return () => {
      active = false;
    };
  }, [user]);

  const handleSummarize = async () => {
    if (!draftEmail.trim() || !user) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    await Haptics.selectionAsync();

    try {
      const sourceEmail = draftEmail.trim();
      const { brief, assistantChat } = await createBriefFromEmail(sourceEmail);

      setBriefs((prev) => [
        {
          ...brief,
          id: assistantChat.id,
          createdAt: assistantChat.created_at,
          addedToTasks: false,
        },
        ...prev,
      ]);
      setDraftEmail('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const nextMessage = getSupabaseErrorMessage(
        error,
        'Failed to summarize email',
      );
      setErrorMessage(nextMessage);
      console.warn('Error summarizing email:', nextMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToTasks = async (brief: BriefCard) => {
    if (!user) {
      return;
    }

    setSubmittingId(brief.id);
    setErrorMessage('');

    try {
      const { error, insertedWithoutDeadline } = await insertTasksForBrief(
        user.id,
        brief,
      );

      if (error) {
        throw error;
      }

      setBriefs((prev) =>
        prev.map((item) =>
          item.id === brief.id ? { ...item, addedToTasks: true } : item,
        ),
      );
      setTaskStats((prev) => ({
        ...prev,
        active: prev.active + brief.actionItems.length,
      }));
      if (insertedWithoutDeadline) {
        setErrorMessage(
          'Tasks were added, but deadline storage is not enabled in your database yet.',
        );
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(tabs)/tasks');
    } catch (error) {
      const nextMessage = getSupabaseErrorMessage(error, 'Failed to add task');
      setErrorMessage(nextMessage);
      console.warn('Error adding task:', nextMessage);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop:
              10 + Math.max(insets.top, Platform.OS === 'android' ? 10 : 0),
            paddingBottom: 112 + Math.max(insets.bottom, 12),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadBriefs('refresh')}
            tintColor="#0F4737"
            colors={['#0F4737']}
          />
        }
      >
        <BriefsHero
          briefsCount={briefs.length}
          activeTasksCount={taskStats.active}
          finishedTasksCount={taskStats.finished}
        />

        <BriefComposer
          draftEmail={draftEmail}
          setDraftEmail={setDraftEmail}
          errorMessage={errorMessage}
          submitting={submitting}
          onSummarize={handleSummarize}
        />

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Recent Briefs</Text>
          <Text style={styles.listMeta}>
            {loading ? 'Loading...' : `${briefs.length} saved`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="small" color="#0F4737" />
            <Text style={styles.emptyTitle}>Loading your saved briefs</Text>
          </View>
        ) : briefs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEyebrow}>NO BRIEFS YET</Text>
            <Text style={styles.emptyTitle}>
              Start with one important email
            </Text>
            <Text style={styles.emptyCopy}>
              The first summary card will appear here, ready to drop into Tasks.
            </Text>
          </View>
        ) : (
          briefs.map((brief, index) => (
            <BriefCardItem
              key={brief.id}
              brief={brief}
              index={index}
              submittingId={submittingId}
              onAddToTasks={handleAddToTasks}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE6',
  },
  scrollContent: {
    padding: 18,
    gap: 18,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  listTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
  },
  listMeta: {
    color: '#5A6A63',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyEyebrow: {
    color: '#1B5A49',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  emptyTitle: {
    color: '#143229',
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    textAlign: 'center',
  },
  emptyCopy: {
    color: '#5A6A63',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

});
