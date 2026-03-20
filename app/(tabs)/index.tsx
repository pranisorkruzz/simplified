import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildBriefCards,
  buildLinkedTaskIds,
  buildTaskStats,
  fetchBriefFeed,
  insertTasksForBrief,
} from '@/lib/data';
import { createBriefFromEmail } from '@/lib/gemini';
import { getSupabaseErrorMessage } from '@/lib/supabase';
import { BriefCardData } from '@/types/database';
import BriefCardItem from '@/components/BriefCard';
import BriefsHero from '@/components/BriefsHero';
import BriefComposer from '@/components/BriefComposer';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function BriefsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [briefs, setBriefs] = useState<BriefCardData[]>([]);
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

  const applyBriefFeed = (feed: Awaited<ReturnType<typeof fetchBriefFeed>>) => {
    setBriefs(buildBriefCards(feed.chats, buildLinkedTaskIds(feed.tasks)));
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
