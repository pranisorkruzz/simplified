import { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCheck,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react-native';
import { TaskRow } from '@/types/database';
import {
  getPriorityColors,
  getDeadlineTone,
  formatTimeLeft,
  formatCreatedLabel,
  formatDateLabel,
} from '@/utils/formatters';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function TaskCard({
  task,
  index,
  onToggle,
  onDelete,
  onEditDeadline,
}: {
  task: TaskRow;
  index: number;
  onToggle: (task: TaskRow) => Promise<void>;
  onDelete: (task: TaskRow) => Promise<void>;
  onEditDeadline: (task: TaskRow) => void;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const priorityColors = getPriorityColors(task.brief?.priority);
  const deadlineTone = getDeadlineTone(task.deadline_at);
  const hasDeadline = Boolean(task.deadline_at);
  const hasPriority = Boolean(task.brief?.priority);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 360,
      delay: index * 70,
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  return (
    <Animated.View
      style={[
        styles.taskCard,
        task.completed && styles.taskCardFinished,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.taskTopRow}>
        <View style={styles.taskMetaRow}>
          {hasDeadline ? (
            <View
              style={[
                styles.deadlinePill,
                { backgroundColor: deadlineTone.background },
              ]}
            >
              <Text
                style={[
                  styles.deadlinePillText,
                  { color: deadlineTone.text },
                ]}
              >
                {formatTimeLeft(task.deadline_at!)}
              </Text>
            </View>
          ) : null}
          {hasPriority ? (
            <View
              style={[
                styles.priorityPill,
                { backgroundColor: priorityColors.background },
              ]}
            >
              <Text style={[styles.priorityText, { color: priorityColors.text }]}>
                {task.brief!.priority.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => void onDelete(task)}
        >
          <Trash2 size={17} color="#8F3A2F" />
        </TouchableOpacity>
      </View>

      <Text style={[styles.taskTitle, task.completed && styles.finishedTitle]}>
        {task.title}
      </Text>

      {task.brief?.title && (
        <View style={styles.sourceMetaRow}>
          <Text
            style={[
              styles.sourceMetaBrief,
              task.completed && styles.finishedBody,
            ]}
            numberOfLines={1}
          >
            {task.brief.title}
          </Text>
        </View>
      )}

      <Text style={[styles.taskSummary, task.completed && styles.finishedBody]}>
        {task.brief?.summary || 'Task captured from your email brief.'}
      </Text>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>{formatCreatedLabel(task.created_at)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Deadline</Text>
          <Text style={styles.infoValue}>
            {task.deadline_at ? formatDateLabel(task.deadline_at) : 'Not set'}
          </Text>
        </View>
      </View>

      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={styles.deadlineButton}
          onPress={() => onEditDeadline(task)}
        >
          <Pencil size={15} color="#163D32" />
          <Text style={styles.deadlineButtonText}>
            {task.deadline_at ? 'Edit Deadline' : 'Add Deadline'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            task.completed
              ? styles.toggleButtonFinished
              : styles.toggleButtonActive,
          ]}
          onPress={() => void onToggle(task)}
        >
          {task.completed ? (
            <>
              <RotateCcw size={16} color="#163D32" />
              <Text style={styles.toggleButtonFinishedText}>Move Back</Text>
            </>
          ) : (
            <>
              <CheckCheck size={16} color="#F7F3EA" />
              <Text style={styles.toggleButtonActiveText}>Mark Finished</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: Platform.select({ android: 18, default: 20 }),
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  taskCardFinished: {
    backgroundColor: '#EFE7DA',
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    flex: 1,
  },
  deadlinePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deadlinePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  priorityPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5DDD7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 26, default: 28 }),
    lineHeight: Platform.select({ android: 31, default: 33 }),
    marginTop: 18,
  },
  finishedTitle: {
    color: '#476158',
  },
  sourceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  sourceMetaLabel: {
    color: '#0F4737',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sourceMetaBrief: {
    flexShrink: 1,
    color: '#52635B',
    fontSize: 12,
    fontWeight: '600',
  },
  taskSummary: {
    color: '#4E5F57',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 10,
  },
  finishedBody: {
    color: '#677A72',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#F2ECE1',
    borderRadius: 18,
    padding: 14,
  },
  infoLabel: {
    color: '#52635B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#163D32',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  deadlineButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#DCE9E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deadlineButtonText: {
    color: '#163D32',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleButton: {
    flex: 1.2,
    minHeight: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#102D24',
  },
  toggleButtonFinished: {
    backgroundColor: '#DCE9E2',
  },
  toggleButtonActiveText: {
    color: '#F7F3EA',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleButtonFinishedText: {
    color: '#163D32',
    fontSize: 13,
    fontWeight: '700',
  },
});
