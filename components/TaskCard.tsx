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
  RotateCcw,
  Trash2,
} from 'lucide-react-native';
import { TaskRow } from '@/types/database';


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
}: {
  task: TaskRow;
  index: number;
  onToggle: (task: TaskRow) => Promise<void>;
  onDelete: (task: TaskRow) => Promise<void>;
}) {
  const entrance = useRef(new Animated.Value(0)).current;

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
          {/* Priority/Deadline features removed per request */}
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

      <View style={styles.cardActionsRow}>
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

  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
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
