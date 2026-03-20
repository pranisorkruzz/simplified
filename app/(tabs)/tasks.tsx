import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCheck,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTaskFeed } from '@/lib/data';
import { getSupabaseErrorMessage, supabase } from '@/lib/supabase';
import TaskCard from '@/components/TaskCard';
import DeadlineModal from '@/components/DeadlineModal';
import { TaskRow } from '@/types/database';
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

const ALL_ACTIVE_FILTER = 'all';
const UNGROUPED_ACTIVE_FILTER = 'ungrouped';

function getBriefFilterLabel(task: TaskRow) {
  const rawTitle = task.brief?.title?.trim();

  if (!rawTitle) {
    return 'Other Tasks';
  }

  return rawTitle.length > 26 ? `${rawTitle.slice(0, 26).trim()}...` : rawTitle;
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
  const [selectedActiveFilter, setSelectedActiveFilter] = useState(ALL_ACTIVE_FILTER);

  const applyTaskFeed = (
    feed: Awaited<ReturnType<typeof fetchTaskFeed>>,
  ) => {
    setTasks(feed.tasks);
    setDeadlineFeatureAvailable(feed.deadlineFeatureAvailable);
    setScreenError(
      !feed.deadlineFeatureAvailable
        ? 'Deadline storage is unavailable until the latest Supabase migration is applied.'
        : '',
    );
  };

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

    try {
      applyTaskFeed(await fetchTaskFeed(user.id));
    } catch (error) {
      setScreenError(getSupabaseErrorMessage(error, 'Failed to load tasks'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setScreenError('');
      setLoading(false);
      return;
    }

    let active = true;

    const loadInitialTasks = async () => {
      setLoading(true);

      try {
        const feed = await fetchTaskFeed(user.id);

        if (!active) {
          return;
        }

        applyTaskFeed(feed);
      } catch (error) {
        if (!active) {
          return;
        }

        setScreenError(getSupabaseErrorMessage(error, 'Failed to load tasks'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadInitialTasks();

    return () => {
      active = false;
    };
  }, [user]);

  const toggleTask = async (task: TaskRow) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: !task.completed })
        .eq('id', task.id);

      if (error) {
        throw error;
      }

      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, completed: !task.completed } : item,
        ),
      );
      setScreenError('');
      await Haptics.notificationAsync(
        task.completed
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
    } catch (error) {
      setScreenError(getSupabaseErrorMessage(error, 'Failed to update task'));
    }
  };

  const deleteTask = async (task: TaskRow) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);

      if (error) {
        throw error;
      }

      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      setScreenError('');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setScreenError(getSupabaseErrorMessage(error, 'Failed to delete task'));
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
        task.id === deadlineTask.id ? { ...task, deadline_at: parsedDeadline } : task,
      ),
    );
    setScreenError('');
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
        task.id === deadlineTask.id ? { ...task, deadline_at: null } : task,
      ),
    );
    setScreenError('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeDeadlineEditor();
  };

  const activeTasks = tasks.filter((task) => !task.completed);
  const finishedTasks = tasks.filter((task) => task.completed);
  const activeTaskGroups = Array.from(
    activeTasks.reduce((groups, task) => {
      const groupId = task.chat_id ?? UNGROUPED_ACTIVE_FILTER;
      const existing = groups.get(groupId);

      if (existing) {
        existing.count += 1;
        return groups;
      }

      groups.set(groupId, {
        id: groupId,
        label: getBriefFilterLabel(task),
        count: 1,
      });
      return groups;
    }, new Map<string, { id: string; label: string; count: number }>()),
    ([, group]) => group,
  );
  const filteredActiveTasks =
    selectedActiveFilter === ALL_ACTIVE_FILTER
      ? activeTasks
      : activeTasks.filter(
          (task) =>
            (task.chat_id ?? UNGROUPED_ACTIVE_FILTER) === selectedActiveFilter,
        );

  useEffect(() => {
    if (selectedActiveFilter === ALL_ACTIVE_FILTER) {
      return;
    }

    const stillExists = activeTaskGroups.some(
      (group) => group.id === selectedActiveFilter,
    );

    if (!stillExists) {
      setSelectedActiveFilter(ALL_ACTIVE_FILTER);
    }
  }, [activeTaskGroups, selectedActiveFilter]);

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

            {activeTasks.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedActiveFilter === ALL_ACTIVE_FILTER &&
                      styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedActiveFilter(ALL_ACTIVE_FILTER)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedActiveFilter === ALL_ACTIVE_FILTER &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                  <View
                    style={[
                      styles.filterCount,
                      selectedActiveFilter === ALL_ACTIVE_FILTER &&
                        styles.filterCountActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterCountText,
                        selectedActiveFilter === ALL_ACTIVE_FILTER &&
                          styles.filterCountTextActive,
                      ]}
                    >
                      {activeTasks.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                {activeTaskGroups.map((group) => {
                  const isSelected = selectedActiveFilter === group.id;

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.filterChip,
                        isSelected && styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedActiveFilter(group.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isSelected && styles.filterChipTextActive,
                        ]}
                      >
                        {group.label}
                      </Text>
                      <View
                        style={[
                          styles.filterCount,
                          isSelected && styles.filterCountActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterCountText,
                            isSelected && styles.filterCountTextActive,
                          ]}
                        >
                          {group.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            {activeTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No active tasks</Text>
                <Text style={styles.emptyCopy}>
                  Add a brief from the Briefs tab and it will appear here.
                </Text>
              </View>
            ) : (
              filteredActiveTasks.map((task, index) => (
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
    fontSize: 22,
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
  filterRow: {
    gap: 10,
    paddingBottom: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8E0D2',
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: '#102D24',
  },
  filterChipText: {
    color: '#29433A',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#F7F3EA',
  },
  filterCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 45, 36, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  filterCountActive: {
    backgroundColor: 'rgba(247, 243, 234, 0.18)',
  },
  filterCountText: {
    color: '#29433A',
    fontSize: 11,
    fontWeight: '800',
  },
  filterCountTextActive: {
    color: '#F7F3EA',
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
