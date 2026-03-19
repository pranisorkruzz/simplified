import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowRight,
  CheckCheck,
  Clock3,
  Plus,
} from 'lucide-react-native';
import { EmailBrief } from '@/lib/briefs';
import {
  getPriorityColors,
  formatTimeLeft,
  formatCreatedTimeLabel,
} from '@/utils/formatters';

export type BriefCardType = EmailBrief & {
  id: string;
  createdAt: string;
  addedToTasks: boolean;
};

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function BriefCardItem({
  brief,
  index,
  submittingId,
  onAddToTasks,
}: {
  brief: BriefCardType;
  index: number;
  submittingId: string | null;
  onAddToTasks: (brief: BriefCardType) => Promise<void>;
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
            <Text style={styles.timePillText}>
              {formatCreatedTimeLabel(brief.createdAt)}
            </Text>
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

const styles = StyleSheet.create({
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
