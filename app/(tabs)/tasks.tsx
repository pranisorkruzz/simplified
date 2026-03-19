import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCheck,
  Clock3,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { EmailBrief, readBriefFromRecord } from '@/lib/briefs';
import {
  getSupabaseErrorMessage,
  isMissingColumnError,
  supabase,
} from '@/lib/supabase';
import TaskCard, { TaskRow } from '@/components/TaskCard';
import DeadlineModal from '@/components/DeadlineModal';
import { formatDeadlineInputValue, parseManualDeadlineInput } from '@/utils/formatters';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

async function fetchTasksData(userId: string) {
  const tasksWithDeadlineQuery = await supabase
    .from('tasks')
    .select(
      'id, user_id, chat_id, title, order_index, completed, created_at, deadline_at, chat:chats(message)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('order_index', { ascending: true });

  const tasksWithoutDeadlineQuery = isMissingColumnError(
    tasksWithDeadlineQuery.error,
    'deadline_at'
  )
    ? await supabase
        .from('tasks')
        .select(
          'id, user_id, chat_id, title, order_index, completed, created_at, chat:chats(message)'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('order_index', { ascending: true })
    : null;

  const baseTasksData = tasksWithDeadlineQuery.data
    ? tasksWithDeadlineQuery.data
    : (tasksWithoutDeadlineQuery?.data ?? []).map((task) => ({
        ...task,
        deadline_at: null,
      }));

  const baseTasksError =
    tasksWithDeadlineQuery.error &&
    !isMissingColumnError(tasksWithDeadlineQuery.error, 'deadline_at')
      ? tasksWithDeadlineQuery.error
      : tasksWithoutDeadlineQuery?.error ?? null;

  if (baseTasksError) {
    return {
      data: null,
      error: baseTasksError,
      deadlineFeatureAvailable: !isMissingColumnError(
        tasksWithDeadlineQuery.error,
        'deadline_at'
      ),
    };
  }

  const chatIds = Array.from(
    new Set(
      (baseTasksData ?? [])
        .map((task) => task.chat_id)
        .filter((chatId): chatId is string => Boolean(chatId))
    )
  );

  if (chatIds.length === 0) {
    return {
      data: baseTasksData,
      error: null,
      deadlineFeatureAvailable: !isMissingColumnError(
        tasksWithDeadlineQuery.error,
        'deadline_at'
      ),
    };
  }

  const briefPayloadQuery = await supabase
    .from('chats')
    .select('id, brief_payload')
    .in('id', chatIds);

  const briefPayloadByChatId = isMissingColumnError(
    briefPayloadQuery.error,
    'brief_payload'
  )
    ? new Map<string, unknown | null>()
    : new Map(
        (briefPayloadQuery.data ?? []).map((chat) => [chat.id, chat.brief_payload])
      );

  const data = (baseTasksData ?? []).map((task) => {
    const chatRecord = Array.isArray(task.chat) ? task.chat[0] : task.chat;

    return {
      ...task,
      chat: chatRecord
        ? {
            ...chatRecord,
            brief_payload: task.chat_id
              ? briefPayloadByChatId.get(task.chat_id) ?? null
              : null,
          }
        : null,
    };
  });

  const error =
    briefPayloadQuery.error &&
    !isMissingColumnError(briefPayloadQuery.error, 'brief_payload')
      ? briefPayloadQuery.error
      : null;

  return {
    data,
    error,
    deadlineFeatureAvailable: !isMissingColumnError(
      tasksWithDeadlineQuery.error,
      'deadline_at'
    ),
  };
}



function mapTaskRows(data: any[]): TaskRow[] {
  return data.map((task: any) => {
    return {
      ...task,
      brief: task.chat ? readBriefFromRecord(task.chat) : null,
    } as TaskRow;
  });
}



export default function TasksScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deadlineTask, setDeadlineTask] = useState<TaskRow | null>(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [deadlineError, setDeadlineError] = useState('');
  const [screenError, setScreenError] = useState('');
  const [deadlineFeatureAvailable, setDeadlineFeatureAvailable] = useState(true);
  const [savingDeadline, setSavingDeadline] = useState(false);

  const loadTasks = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error, deadlineFeatureAvailable: nextDeadlineAvailability } =
      await fetchTasksData(user.id);

    setDeadlineFeatureAvailable(nextDeadlineAvailability);
    setScreenError(
      !nextDeadlineAvailability
        ? 'Deadline storage is unavailable until the latest Supabase migration is applied.'
        : ''
    );

    if (!error && data) {
      setTasks(mapTaskRows(data));
    } else if (error) {
      setScreenError(getSupabaseErrorMessage(error, 'Failed to load tasks'));
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadInitialTasks = async () => {
      setLoading(true);
      const {
        data,
        error,
        deadlineFeatureAvailable: nextDeadlineAvailability,
      } = await fetchTasksData(user.id);

      if (!active) {
        return;
      }

      setDeadlineFeatureAvailable(nextDeadlineAvailability);
      setScreenError(
        !nextDeadlineAvailability
          ? 'Deadline storage is unavailable until the latest Supabase migration is applied.'
          : ''
      );

      if (!error && data) {
        setTasks(mapTaskRows(data));
      } else if (error) {
        setScreenError(getSupabaseErrorMessage(error, 'Failed to load tasks'));
      }

      setLoading(false);
    };

    void loadInitialTasks();

    return () => {
      active = false;
    };
  }, [user]);

  const toggleTask = async (task: TaskRow) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);

    if (!error) {
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, completed: !task.completed } : item
        )
      );

      await Haptics.notificationAsync(
        task.completed
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    }
  };

  const deleteTask = async (task: TaskRow) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const { error } = await supabase.from('tasks').delete().eq('id', task.id);

    if (!error) {
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openDeadlineEditor = (task: TaskRow) => {
    if (!deadlineFeatureAvailable) {
      Alert.alert(
        'Deadline unavailable',
        'Run the latest Supabase migration to enable deadline storage for tasks.'
      );
      return;
    }

    setDeadlineTask(task);
    setDeadlineInput(formatDeadlineInputValue(task.deadline_at));
    setDeadlineError('');
  };

  const closeDeadlineEditor = () => {
    setDeadlineTask(null);
    setDeadlineInput('');
    setDeadlineError('');
    setSavingDeadline(false);
  };

  const saveDeadline = async () => {
    if (!deadlineTask) {
      return;
    }

    const parsedDeadline = parseManualDeadlineInput(deadlineInput);

    if (deadlineInput.trim() && !parsedDeadline) {
      setDeadlineError('Use YYYY-MM-DD or YYYY-MM-DD HH:mm');
      return;
    }

    setSavingDeadline(true);
    setDeadlineError('');

    const { error } = await supabase
      .from('tasks')
      .update({ deadline_at: parsedDeadline })
      .eq('id', deadlineTask.id);

    if (error) {
      setDeadlineError(getSupabaseErrorMessage(error, 'Failed to save deadline'));
      setSavingDeadline(false);
      return;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === deadlineTask.id ? { ...task, deadline_at: parsedDeadline } : task
      )
    );
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeDeadlineEditor();
  };

  const clearDeadline = async () => {
    if (!deadlineTask) {
      return;
    }

    setSavingDeadline(true);

    const { error } = await supabase
      .from('tasks')
      .update({ deadline_at: null })
      .eq('id', deadlineTask.id);

    if (error) {
      setDeadlineError(getSupabaseErrorMessage(error, 'Failed to clear deadline'));
      setSavingDeadline(false);
      return;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === deadlineTask.id ? { ...task, deadline_at: null } : task
      )
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeDeadlineEditor();
  };

  const activeTasks = tasks.filter((task) => !task.completed);
  const finishedTasks = tasks.filter((task) => task.completed);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 10 + Math.max(insets.top, Platform.OS === 'android' ? 10 : 0),
            paddingBottom: 112 + Math.max(insets.bottom, 12),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTasks('refresh')}
            tintColor="#0F4737"
            colors={['#0F4737']}
          />
        }
      >
        {screenError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{screenError}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="small" color="#0F4737" />
            <Text style={styles.emptyTitle}>Loading your tasks</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active</Text>
              <View style={styles.sectionBadge}>
                <Sparkles size={14} color="#0F4737" />
                <Text style={styles.sectionBadgeText}>{activeTasks.length}</Text>
              </View>
            </View>

            {activeTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No active tasks</Text>
                <Text style={styles.emptyCopy}>
                  Add a brief from the Briefs tab and it will appear here.
                </Text>
              </View>
            ) : (
              activeTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  onEditDeadline={openDeadlineEditor}
                />
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Finished</Text>
              <View style={styles.sectionBadge}>
                <CheckCheck size={14} color="#0F4737" />
                <Text style={styles.sectionBadgeText}>{finishedTasks.length}</Text>
              </View>
            </View>

            {finishedTasks.length === 0 ? (
              <View style={styles.emptyArchiveCard}>
                <Text style={styles.emptyTitle}>Nothing archived yet</Text>
                <Text style={styles.emptyCopy}>
                  Finished work lands here automatically when a task is done.
                </Text>
              </View>
            ) : (
              finishedTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  onEditDeadline={openDeadlineEditor}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <DeadlineModal
        visible={Boolean(deadlineTask)}
        deadlineInput={deadlineInput}
        setDeadlineInput={setDeadlineInput}
        deadlineError={deadlineError}
        savingDeadline={savingDeadline}
        onClose={closeDeadlineEditor}
        onClear={() => void clearDeadline()}
        onSave={() => void saveDeadline()}
      />
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
  errorBanner: {
    backgroundColor: '#FFE2DC',
    borderRadius: 18,
    padding: 14,
  },
  errorBannerText: {
    color: '#8D2D20',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DDEFEA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionBadgeText: {
    color: '#0F4737',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyArchiveCard: {
    backgroundColor: '#EFE7DA',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#102D24',
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
