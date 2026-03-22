import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useKanban } from '@/contexts/KanbanContext';
import { fetchTaskFeed, updateBriefPayload } from '@/lib/data';
import type { EmailBrief, KanbanPlan } from '@/lib/briefs';
import { getSupabaseErrorMessage, supabase } from '@/lib/supabase';
import TaskFlowchart from '@/components/TaskFlowchart';
import { TaskRow } from '@/types/database';


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
  const { activeBriefId, activeBrief, setActiveBrief, isGenerating } = useKanban();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string | null>(activeBriefId);
  const [savingKanban, setSavingKanban] = useState(false);

  const applyTaskFeed = useCallback((
    feed: Awaited<ReturnType<typeof fetchTaskFeed>>,
  ) => {
    setTasks(feed.tasks);
    setScreenError('');
  }, []);

  const loadTasks = useCallback(async (
    mode: 'initial' | 'refresh' | 'focus' = 'initial',
  ) => {
    if (!user) {
      setTasks([]);
      setScreenError('');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === 'refresh') {
      setRefreshing(true);
    } else if (mode === 'initial') {
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
  }, [applyTaskFeed, user]);

  useFocusEffect(
    useCallback(() => {
      void loadTasks('focus');
    }, [loadTasks]),
  );

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

  const deleteCategoryTasks = async (groupId: string) => {
    if (groupId === UNGROUPED_ACTIVE_FILTER) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      const { error } = await supabase.from('tasks').delete().eq('chat_id', groupId);
      if (error) throw error;
      setTasks((prev) => prev.filter((item) => item.chat_id !== groupId));
      setScreenError('');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      setScreenError(getSupabaseErrorMessage(error, 'Failed to delete category tasks'));
    }
  };

  const completeCategoryTasks = async (groupId: string) => {
    if (groupId === UNGROUPED_ACTIVE_FILTER) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: true })
        .eq('chat_id', groupId);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((item) =>
          item.chat_id === groupId ? { ...item, completed: true } : item,
        ),
      );
      setScreenError('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setScreenError(getSupabaseErrorMessage(error, 'Failed to complete tasks'));
    }
  };

  const persistBriefKanban = async (
    briefId: string,
    nextPlan: KanbanPlan,
  ) => {
    if (!user || !activeBrief) {
      return;
    }

    const nextBrief: EmailBrief = {
      ...activeBrief,
      kanbanPlan: nextPlan,
    };

    const { error } = await updateBriefPayload(user.id, briefId, nextBrief);

    if (error) {
      throw error;
    }

    setActiveBrief(briefId, nextBrief);
  };

  const handleKanbanPlanChange = async (nextPlan: KanbanPlan) => {
    if (!activeBrief || !activeBriefId) {
      return;
    }

    setSavingKanban(true);

    try {
      await persistBriefKanban(activeBriefId, nextPlan);
    } catch (error) {
      setScreenError(getSupabaseErrorMessage(error, 'Failed to save kanban'));
    } finally {
      setSavingKanban(false);
    }
  };

   const activeTasks = tasks.filter((task) => !task.completed);
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
        brief: task.brief,
      });
      return groups;
    }, new Map<string, { id: string; label: string; count: number; brief: EmailBrief | null }>()),
    ([, group]) => group,
  );
  const filteredActiveTasks = activeTasks.filter(
    (task) =>
      (task.chat_id ?? UNGROUPED_ACTIVE_FILTER) === selectedActiveFilter,
  );

  useEffect(() => {
    if (!selectedActiveFilter && activeTaskGroups.length > 0) {
      const first = activeTaskGroups[0];
      setSelectedActiveFilter(first.id);
      if (first.brief) {
        setActiveBrief(first.id, first.brief);
      }
      return;
    }

    if (!selectedActiveFilter) {
      return;
    }

    const currentGroup = activeTaskGroups.find(
      (group) => group.id === selectedActiveFilter,
    );

    if (!currentGroup) {
      // If the selected category is gone, pick the first overall
      if (activeTaskGroups.length > 0) {
        const first = activeTaskGroups[0];
        setSelectedActiveFilter(first.id);
        if (first.brief) {
          setActiveBrief(first.id, first.brief);
        }
      } else {
        setSelectedActiveFilter(null);
      }
    }
  }, [activeTaskGroups, selectedActiveFilter, setActiveBrief]);

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
                <Text style={styles.sectionBadgeText}>{filteredActiveTasks.length}</Text>
              </View>
            </View>
            {activeTaskGroups.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {activeTaskGroups.map((group) => {
                  const isSelected = selectedActiveFilter === group.id;

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.filterChip,
                        isSelected && styles.filterChipActive,
                      ]}
                      onPress={() => {
                        setSelectedActiveFilter(group.id);
                        if (group.brief) {
                          setActiveBrief(group.id, group.brief);
                        }
                      }}
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

            {isGenerating && selectedActiveFilter === activeBriefId ? (
              <View style={styles.kanbanLoadingCard}>
                <ActivityIndicator size="small" color="#0F4737" />
                <Text style={styles.kanbanLoadingTitle}>Building your execution board</Text>
                <Text style={styles.kanbanLoadingCopy}>
                  Clarix is generating your Kanban flowchart — it will appear here in a moment.
                </Text>
              </View>
            ) : activeBrief?.kanbanPlan && selectedActiveFilter === activeBriefId ? (
          <TaskFlowchart
            plan={activeBrief.kanbanPlan}
            saving={savingKanban}
            onPlanChange={handleKanbanPlanChange}
            title={activeTaskGroups.find(g => g.id === selectedActiveFilter)?.label}
            onDelete={() => selectedActiveFilter && deleteCategoryTasks(selectedActiveFilter)}
            onComplete={() => selectedActiveFilter && completeCategoryTasks(selectedActiveFilter)}
            onEdit={() => Alert.alert('Edit', 'Flowchart editing coming soon')}
          />
        ) : null}

            {activeTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No active tasks</Text>
                <Text style={styles.emptyCopy}>
                  Add a brief from the Briefs tab and it will appear here.
                </Text>
              </View>
            ) : null}


          </>
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
  kanbanLoadingCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  kanbanLoadingTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    textAlign: 'center',
  },
  kanbanLoadingCopy: {
    color: '#5A6A63',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

});
