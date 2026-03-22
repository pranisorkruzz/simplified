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
  Check,
  CheckCheck,
  Clock3,
  Plus,
} from 'lucide-react-native';
import { BriefCardData } from '@/types/database';
import {
  getPriorityColors,
  formatTimeLeft,
  formatCreatedTimeLabel,
} from '@/utils/formatters';

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
  selectionMode,
  selected,
  deleting,
  onToggleSelect,
}: {
  brief: BriefCardData;
  index: number;
  submittingId: string | null;
  onAddToTasks: (brief: BriefCardData) => Promise<void>;
  selectionMode: boolean;
  selected: boolean;
  deleting: boolean;
  onToggleSelect: (briefId: string) => void;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const priorityColors = getPriorityColors(brief.priority);
  const isBusy = submittingId === brief.id;
  const addDisabled = brief.addedToTasks || isBusy || selectionMode || deleting;

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
        selected && styles.briefCardSelected,
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
      <TouchableOpacity
        activeOpacity={selectionMode ? 0.92 : 1}
        disabled={!selectionMode}
        onPress={() => onToggleSelect(brief.id)}
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
          <View style={styles.headerRight}>
            {selectionMode ? (
              <View
                style={[
                  styles.selectionBadge,
                  selected && styles.selectionBadgeSelected,
                ]}
              >
                {selected ? <Check size={14} color="#F7F3EA" strokeWidth={3} /> : null}
              </View>
            ) : null}
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
        </View>

        <Text style={styles.briefTitle}>{brief.title}</Text>
        <Text style={styles.briefSummary}>{brief.summary}</Text>

        <TouchableOpacity
          style={[
            styles.addTaskButton,
            addDisabled && styles.addTaskButtonDisabled,
          ]}
          disabled={addDisabled}
          onPress={() => void onAddToTasks(brief)}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#F7F3EA" />
          ) : brief.addedToTasks ? (
            <>
              <CheckCheck size={16} color="#F7F3EA" />
              <Text style={styles.addTaskButtonText}>
                Added Task
              </Text>
            </>
          ) : selectionMode ? (
            <Text style={styles.addTaskButtonText}>Tap to select this brief</Text>
          ) : (
            <>
              <Plus size={16} color="#F7F3EA" />
              <Text style={styles.addTaskButtonText}>
                Add Task
              </Text>
              <ArrowRight size={16} color="#F7F3EA" />
            </>
          )}
        </TouchableOpacity>
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
  briefCardSelected: {
    borderWidth: 2,
    borderColor: '#0F4737',
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  selectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A9B7B1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F2',
  },
  selectionBadgeSelected: {
    backgroundColor: '#0F4737',
    borderColor: '#0F4737',
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
    opacity: 0.92,
  },
  addTaskButtonText: {
    color: '#F7F3EA',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
