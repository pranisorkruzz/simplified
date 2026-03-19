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

type BriefCard = EmailBrief & {
  id: string;
  createdAt: string;
  addedToTasks: boolean;
};

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

function getPriorityColors(priority: EmailBrief['priority']) {
  switch (priority) {
    case 'high':
      return {
        background: '#FFE0DB',
        text: '#A62C1B',
      };
    case 'low':
      return {
        background: '#E3F4EA',
        text: '#1F6A45',
      };
    case 'medium':
    default:
      return {
        background: '#FFF1D6',
        text: '#8A5A00',
      };
  }
}

function formatTimeLeft(deadlineAt: string) {
  const diff = new Date(deadlineAt).getTime() - Date.now();
  const abs = Math.abs(diff);
  const totalHours = Math.round(abs / (1000 * 60 * 60));
  const totalDays = Math.round(abs / (1000 * 60 * 60 * 24));

  if (abs < 1000 * 60 * 60) {
    const minutes = Math.max(1, Math.round(abs / (1000 * 60)));
    return diff >= 0 ? `${minutes}m left` : `${minutes}m overdue`;
  }

  if (abs < 1000 * 60 * 60 * 24) {
    return diff >= 0 ? `${totalHours}h left` : `${totalHours}h overdue`;
  }

  return diff >= 0 ? `${totalDays}d left` : `${totalDays}d overdue`;
}

function BriefCardItem({
  brief,
  index,
  submittingId,
  onAddToTasks,
}: {
  brief: BriefCard;
  index: number;
  submittingId: string | null;
  onAddToTasks: (brief: BriefCard) => Promise<void>;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const priorityColors = getPriorityColors(brief.priority);
  const isBusy = submittingId === brief.id;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 450,
      delay: index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  return (
    <Animated.View
      style={[
        styles.briefCard,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
            {
              scale: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.briefMetaRow}>
        <View style={styles.metaStack}>
          <View style={styles.timePill}>
            <Clock3 size={14} color="#0F4737" />
            <Text style={styles.timePillText}>{brief.timeLabel}</Text>
          </View>
          {brief.deadlineAt ? (
            <View style={styles.deadlinePill}>
              <Text style={styles.deadlinePillText}>
                {formatTimeLeft(brief.deadlineAt)}
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.priorityPill,
            { backgroundColor: priorityColors.background },
          ]}
        >
          <Text
            style={[styles.priorityPillText, { color: priorityColors.text }]}
          >
            {brief.priority.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.briefTitle}>{brief.title}</Text>
      <Text style={styles.briefSummary}>{brief.summary}</Text>

      <View style={styles.actionsBlock}>
        {brief.actionItems.map((item) => (
          <View key={`${brief.id}-${item}`} style={styles.actionRow}>
            <View style={styles.actionDot} />
            <Text style={styles.actionText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.addTaskButton,
          (brief.addedToTasks || isBusy) && styles.addTaskButtonDisabled,
        ]}
        disabled={brief.addedToTasks || isBusy}
        onPress={() => void onAddToTasks(brief)}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color="#F7F3EA" />
        ) : brief.addedToTasks ? (
          <>
            <CheckCheck size={16} color="#F7F3EA" />
            <Text style={styles.addTaskButtonText}>
              Added {brief.actionItems.length} Tasks
            </Text>
          </>
        ) : (
          <>
            <Plus size={16} color="#F7F3EA" />
            <Text style={styles.addTaskButtonText}>
              Add {brief.actionItems.length} Small Tasks
            </Text>
            <ArrowRight size={16} color="#F7F3EA" />
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function BriefsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const heroEntrance = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    Animated.timing(heroEntrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heroEntrance]);

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
        <Animated.View
          style={[
            styles.heroWrap,
            {
              opacity: heroEntrance,
              transform: [
                {
                  translateY: heroEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#103B31', '#1C6A57', '#D7B989']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.eyebrow}>ANY TASK TO ACTION</Text>
            <Text style={styles.heroTitle}>Clarix</Text>
            <Text style={styles.heroSubtitle}>
              Turn any problem into a clear step by step plan
            </Text>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatPill}>
                <Sparkles size={15} color="#103B31" />
                <Text style={styles.heroStatText}>{briefs.length} briefs</Text>
              </View>
              <View style={styles.heroStatPill}>
                <CheckCheck size={15} color="#103B31" />
                <Text style={styles.heroStatText}>
                  {taskStats.active} active
                </Text>
              </View>
              <View style={styles.heroStatPill}>
                <Clock3 size={15} color="#103B31" />
                <Text style={styles.heroStatText}>
                  {taskStats.finished} finished
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.composerCard}>
          <Text style={styles.sectionEyebrow}>PASTE ANYTHING</Text>
          <Text style={styles.sectionTitle}>Break it into simple steps</Text>
          <Text style={styles.sectionSubtitle}>
            Paste any task, problem, document or idea. Clarix breaks it down into clear visual steps instantly.
          </Text>

          <TextInput
            style={styles.emailInput}
            multiline
            value={draftEmail}
            onChangeText={setDraftEmail}
            placeholder={
              "Example:\nI need to launch my app on the Play Store by Friday but don't know where to start."
            }
            placeholderTextColor="#7B8A83"
            textAlignVertical="top"
          />

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButtonWrap}
            onPress={() => void handleSummarize()}
            disabled={submitting}
          >
            <LinearGradient
              colors={['#0F4737', '#216B56']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.primaryButton,
                submitting && styles.primaryButtonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#F7F3EA" />
              ) : (
                <>
                  <Sparkles size={18} color="#F7F3EA" />
                  <Text style={styles.primaryButtonText}>Break It Down</Text>
                  <ArrowRight size={18} color="#F7F3EA" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

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
  heroWrap: {
    borderRadius: 30,
  },
  heroCard: {
    borderRadius: 30,
    padding: Platform.select({ android: 22, default: 24 }),
    minHeight: Platform.select({ android: 208, default: 220 }),
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#F7F3EA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  heroTitle: {
    color: '#F7F3EA',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 36, default: 40 }),
    lineHeight: Platform.select({ android: 40, default: 44 }),
    marginTop: 8,
  },
  heroSubtitle: {
    color: '#E5DDD1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: '92%',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  heroStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6D8AB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroStatText: {
    color: '#103B31',
    fontSize: 12,
    fontWeight: '700',
  },
  composerCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: Platform.select({ android: 18, default: 20 }),
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  sectionEyebrow: {
    color: '#1B5A49',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sectionTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 28, default: 31 }),
    lineHeight: Platform.select({ android: 33, default: 36 }),
    marginTop: 10,
  },
  sectionSubtitle: {
    color: '#5A6A63',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  emailInput: {
    minHeight: 182,
    backgroundColor: '#F2ECE1',
    borderRadius: 22,
    padding: 18,
    color: '#102D24',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 18,
    textAlignVertical: 'top',
  },
  errorBanner: {
    marginTop: 12,
    backgroundColor: '#FFE2DC',
    borderRadius: 14,
    padding: 12,
  },
  errorBannerText: {
    color: '#8D2D20',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButtonWrap: {
    marginTop: 18,
  },
  primaryButton: {
    borderRadius: 18,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#F7F3EA',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
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
  briefCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: Platform.select({ android: 18, default: 20 }),
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    marginTop: 2,
  },
  briefMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metaStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DDEFEA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timePillText: {
    color: '#0F4737',
    fontSize: 12,
    fontWeight: '700',
  },
  deadlinePill: {
    backgroundColor: '#F7E8CC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deadlinePillText: {
    color: '#7B5410',
    fontSize: 12,
    fontWeight: '800',
  },
  priorityPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  briefTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 26, default: 28 }),
    lineHeight: Platform.select({ android: 31, default: 33 }),
    marginTop: 18,
  },
  briefSummary: {
    color: '#4E5F57',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
  },
  actionsBlock: {
    marginTop: 18,
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0F4737',
    marginTop: 7,
  },
  actionText: {
    flex: 1,
    color: '#163D32',
    fontSize: 14,
    lineHeight: 21,
  },
  addTaskButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#102D24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  addTaskButtonDisabled: {
    backgroundColor: '#6E847C',
  },
  addTaskButtonText: {
    color: '#F7F3EA',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
