import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useKanban } from '@/contexts/KanbanContext';
import {
  buildBriefCards,
  buildLinkedTaskIds,
  buildTaskStats,
  deleteBriefsByIds,
  fetchBriefFeed,
  insertTasksForBrief,
  updateBriefPayload,
} from '@/lib/data';
import {
  buildUserAiContext,
  getFollowUpQuestions,
  readUserAiContextFromMetadata,
  UserAiContextResponse,
} from '@/lib/ai-context';
import { createBriefFromEmail, generateKanbanPlan } from '@/lib/gemini';
import { getSupabaseErrorMessage } from '@/lib/supabase';
import { KanbanPlan } from '@/lib/briefs';
import { BriefCardData } from '@/types/database';
import BriefCardItem from '@/components/BriefCard';
import BriefFollowUpSheet from '@/components/BriefFollowUpSheet';
import BriefsHero from '@/components/BriefsHero';
import BriefComposer from '@/components/BriefComposer';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function BriefsScreen() {
  const { user, profile, updateAiContext } = useAuth();
  const { setActiveBrief, setIsGenerating } = useKanban();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [briefs, setBriefs] = useState<BriefCardData[]>([]);
  const [latestBrief, setLatestBrief] = useState<BriefCardData | null>(null);
  const [draftEmail, setDraftEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBriefIds, setSelectedBriefIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [followUpVisible, setFollowUpVisible] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [latestSourceTask, setLatestSourceTask] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [taskStats, setTaskStats] = useState({
    active: 0,
    finished: 0,
  });
  const followUpQuestions = getFollowUpQuestions(
    profile?.user_type,
    latestBrief?.suggestedFollowUpQuestions,
  );
  const existingAiContext = readUserAiContextFromMetadata(user?.user_metadata);

  const applyBriefFeed = (feed: Awaited<ReturnType<typeof fetchBriefFeed>>) => {
    const nextBriefs = buildBriefCards(feed.chats, buildLinkedTaskIds(feed.tasks));

    setBriefs(nextBriefs);
    setTaskStats(buildTaskStats(feed.tasks));
    setErrorMessage('');
  };

  const loadBriefs = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!user) {
      setBriefs([]);
      setErrorMessage('');
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
      const feed = await fetchBriefFeed(user.id);
      applyBriefFeed(feed);
    } catch (error) {
      setErrorMessage(getSupabaseErrorMessage(error, 'Failed to load briefs'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setBriefs([]);
      setErrorMessage('');
      setLoading(false);
      return;
    }

    let active = true;

    const loadInitialBriefs = async () => {
      setLoading(true);

      try {
        const feed = await fetchBriefFeed(user.id);

        if (!active) {
          return;
        }

        applyBriefFeed(feed);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(getSupabaseErrorMessage(error, 'Failed to load briefs'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadInitialBriefs();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    setSelectedBriefIds((prev) =>
      prev.filter((id) => briefs.some((brief) => brief.id === id)),
    );
  }, [briefs]);

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

      const newBrief = {
        ...brief,
        id: assistantChat.id,
        createdAt: assistantChat.created_at,
        addedToTasks: false,
      };

      setBriefs((prev) => [newBrief, ...prev]);
      setLatestBrief(newBrief);
      setLatestSourceTask(sourceEmail);
      setActiveBrief(newBrief.id, newBrief);
      setDraftEmail('');
      setFollowUpVisible(true);
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

  const handleAddToTasks = async (brief: BriefCardData) => {
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
        active: prev.active + 1,
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

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedBriefIds([]);
      }

      return !prev;
    });
  };

  const handleToggleBriefSelection = (briefId: string) => {
    void Haptics.selectionAsync();
    setSelectedBriefIds((prev) =>
      prev.includes(briefId)
        ? prev.filter((id) => id !== briefId)
        : [...prev, briefId],
    );
  };

  const handleSelectAll = () => {
    if (selectedBriefIds.length === briefs.length) {
      setSelectedBriefIds([]);
    } else {
      setSelectedBriefIds(briefs.map((b) => b.id));
    }
    void Haptics.selectionAsync();
  };

  const performDeleteSelected = async () => {
    if (!user || selectedBriefIds.length === 0) {
      return;
    }

    setDeleting(true);
    setErrorMessage('');

    try {
      const { error, data } = await deleteBriefsByIds(user.id, selectedBriefIds);

      if (error) {
        throw error;
      }

      const deletedCount = data?.length ?? 0;
      console.log(`Successfully deleted ${deletedCount} chat records`);

      const feed = await fetchBriefFeed(user.id);
      applyBriefFeed(feed);
      setSelectedBriefIds([]);
      setSelectionMode(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setErrorMessage(getSupabaseErrorMessage(error, 'Failed to delete briefs'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedBriefIds.length === 0) {
      return;
    }

    const title =
      selectedBriefIds.length === 1 ? 'Delete brief?' : 'Delete selected briefs?';
    const message =
      selectedBriefIds.length === 1
        ? 'This will remove the brief and any tasks created from it.'
        : `This will remove ${selectedBriefIds.length} briefs and any tasks created from them.`;

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) {
        void performDeleteSelected();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void performDeleteSelected(),
      },
    ]);
  };

  const selectedBriefCount = selectedBriefIds.length;

  const persistBriefKanban = async (
    briefId: string,
    nextPlan: KanbanPlan,
  ) => {
    if (!user) {
      return;
    }

    const existingBrief =
      briefs.find((brief) => brief.id === briefId) ??
      (latestBrief?.id === briefId ? latestBrief : null);

    if (!existingBrief) {
      return;
    }

    const nextBrief = {
      ...existingBrief,
      kanbanPlan: nextPlan,
    };

    const { error } = await updateBriefPayload(user.id, briefId, nextBrief);

    if (error) {
      throw error;
    }

    setBriefs((prev) =>
      prev.map((brief) =>
        brief.id === briefId
          ? {
              ...brief,
              kanbanPlan: nextPlan,
            }
          : brief,
      ),
    );
    setLatestBrief((prev) =>
      prev?.id === briefId
        ? {
            ...prev,
            kanbanPlan: nextPlan,
          }
        : prev,
    );
  };

  const handleSaveFollowUp = async (responses: UserAiContextResponse[]) => {
    if (!latestBrief || !user) {
      setFollowUpVisible(false);
      return;
    }

    try {
      setSavingFollowUp(true);
      setIsGenerating(true);
      setErrorMessage('');
      await updateAiContext(buildUserAiContext(profile?.user_type, responses));

      const plan = await generateKanbanPlan({
        sourceTask: latestSourceTask || latestBrief.title,
        brief: latestBrief,
        responses,
      });

      await persistBriefKanban(latestBrief.id, plan);
      setActiveBrief(latestBrief.id, { ...latestBrief, kanbanPlan: plan });
      setFollowUpVisible(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setErrorMessage(
        getSupabaseErrorMessage(
          error,
          'Failed to save follow-up answers and generate kanban',
        ),
      );
    } finally {
      setSavingFollowUp(false);
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadBriefs('refresh')}
              tintColor="#0F4737"
              colors={['#0F4737']}
            />
          }
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View>
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
                <View style={styles.listHeaderCopy}>
                  <Text style={styles.listTitle}>
                    {selectionMode ? 'Select Briefs' : 'Recent Briefs'}
                  </Text>
                  <Text style={styles.listMeta}>
                    {selectionMode
                      ? `${selectedBriefCount} selected`
                      : loading
                        ? 'Loading...'
                        : `${briefs.length} saved`}
                  </Text>
                </View>

                {briefs.length > 0 ? (
                  <View style={styles.headerActions}>
                    {selectionMode ? (
                      <>
                        <TouchableOpacity
                          style={styles.headerSecondaryButton}
                          onPress={handleSelectAll}
                          activeOpacity={0.85}
                          disabled={deleting}
                        >
                          <Text style={styles.headerSecondaryButtonText}>
                            {selectedBriefIds.length === briefs.length
                              ? 'Deselect All'
                              : 'Select All'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.headerSecondaryButton}
                          onPress={toggleSelectionMode}
                          activeOpacity={0.85}
                          disabled={deleting}
                        >
                          <Text style={styles.headerSecondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.headerDeleteButton,
                            (selectedBriefCount === 0 || deleting) &&
                              styles.headerDeleteButtonDisabled,
                          ]}
                          onPress={handleDeleteSelected}
                          activeOpacity={0.85}
                          disabled={selectedBriefCount === 0 || deleting}
                        >
                          {deleting ? (
                            <ActivityIndicator size="small" color="#F7F3EA" />
                          ) : (
                            <Text style={styles.headerDeleteButtonText}>
                              {selectedBriefCount > 0
                                ? `Delete (${selectedBriefCount})`
                                : 'Delete'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.headerSelectButton}
                        onPress={toggleSelectionMode}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.headerSelectButtonText}>Select</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
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
                    selectionMode={selectionMode}
                    selected={selectedBriefIds.includes(brief.id)}
                    deleting={deleting}
                    onToggleSelect={handleToggleBriefSelection}
                  />
                ))
              )}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      <BriefFollowUpSheet
        visible={followUpVisible}
        questions={followUpQuestions}
        initialContext={existingAiContext}
        firstName={profile?.first_name}
        saving={savingFollowUp}
        onClose={() => setFollowUpVisible(false)}
        onSave={handleSaveFollowUp}
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
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  listHeaderCopy: {
    flex: 1,
    gap: 4,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSelectButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: '#E8E0D2',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSelectButtonText: {
    color: '#0F4737',
    fontSize: 13,
    fontWeight: '800',
  },
  headerSecondaryButton: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBBEAA',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F2',
  },
  headerSecondaryButtonText: {
    color: '#5A6A63',
    fontSize: 13,
    fontWeight: '700',
  },
  headerDeleteButton: {
    minHeight: 38,
    minWidth: 94,
    borderRadius: 999,
    backgroundColor: '#A53F31',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDeleteButtonDisabled: {
    backgroundColor: '#C89288',
  },
  headerDeleteButtonText: {
    color: '#F7F3EA',
    fontSize: 13,
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
