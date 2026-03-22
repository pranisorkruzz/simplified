import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  LayoutRectangle,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CheckCheck } from 'lucide-react-native';
import {
  KanbanColumnId,
  KanbanPlan,
  KanbanSubtask,
} from '@/lib/briefs';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

const COLUMNS: {
  id: KanbanColumnId;
  label: string;
  surface: string;
  border: string;
}[] = [
  {
    id: 'todo',
    label: 'Todo',
    surface: '#EFE8DC',
    border: '#D8CEBE',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    surface: '#E1ECE7',
    border: '#BFD3CB',
  },
  {
    id: 'done',
    label: 'Done',
    surface: '#DDEFEA',
    border: '#A9CFC2',
  },
];

type WindowFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CardLayout = LayoutRectangle & {
  column: KanbanColumnId;
};

function normalizeSubtasksOrder(subtasks: KanbanSubtask[]) {
  const byColumn = COLUMNS.reduce<Record<KanbanColumnId, KanbanSubtask[]>>(
    (acc, column) => {
      acc[column.id] = subtasks
        .filter((task) => task.column === column.id)
        .sort((a, b) => a.order - b.order);
      return acc;
    },
    {
      todo: [],
      in_progress: [],
      done: [],
    },
  );

  return COLUMNS.flatMap((column) =>
    byColumn[column.id].map((task, index) => ({
      ...task,
      order: index,
      completedAt:
        task.column === 'done'
          ? task.completedAt ?? new Date().toISOString()
          : null,
    })),
  );
}

function buildDependencyArrows({
  subtasks,
  cardLayouts,
  columnLayouts,
}: {
  subtasks: KanbanSubtask[];
  cardLayouts: Record<string, CardLayout | undefined>;
  columnLayouts: Partial<Record<KanbanColumnId, LayoutRectangle>>;
}) {
  const tasksById = new Map(subtasks.map((task) => [task.id, task]));

  return subtasks.flatMap((task) => {
    const targetCard = cardLayouts[task.id];
    const targetColumn = targetCard
      ? columnLayouts[targetCard.column]
      : undefined;

    if (!targetCard || !targetColumn) {
      return [];
    }

    const endX = targetColumn.x + targetCard.x;
    const endY = targetColumn.y + targetCard.y + targetCard.height / 2;

    return task.dependencies
      .map((dependencyId) => {
        const sourceTask = tasksById.get(dependencyId);

        if (!sourceTask) {
          return null;
        }

        const sourceCard = cardLayouts[sourceTask.id];
        const sourceColumn = sourceCard
          ? columnLayouts[sourceCard.column]
          : undefined;

        if (!sourceCard || !sourceColumn) {
          return null;
        }

        const startX = sourceColumn.x + sourceCard.x + sourceCard.width;
        const startY = sourceColumn.y + sourceCard.y + sourceCard.height / 2;

        const curve = Math.max(28, Math.abs(endX - startX) * 0.45);
        const path = `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;

        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowSize = 7;
        const arrowLeftX = endX - arrowSize * Math.cos(angle - 0.45);
        const arrowLeftY = endY - arrowSize * Math.sin(angle - 0.45);
        const arrowRightX = endX - arrowSize * Math.cos(angle + 0.45);
        const arrowRightY = endY - arrowSize * Math.sin(angle + 0.45);

        return {
          key: `${sourceTask.id}_${task.id}`,
          path,
          arrowPath: `M ${endX} ${endY} L ${arrowLeftX} ${arrowLeftY} M ${endX} ${endY} L ${arrowRightX} ${arrowRightY}`,
        };
      })
      .filter((arrow): arrow is NonNullable<typeof arrow> => Boolean(arrow));
  });
}

type DraggableCardProps = {
  task: KanbanSubtask;
  disabled: boolean;
  onDrop: (task: KanbanSubtask, moveX: number, moveY: number) => Promise<void>;
  onMarkFinished: (task: KanbanSubtask) => Promise<void>;
  onDragStateChange: (taskId: string | null) => void;
  onLayout: (
    taskId: string,
    column: KanbanColumnId,
    layout: LayoutRectangle,
  ) => void;
};

const DraggableCard = memo(function DraggableCard({
  task,
  disabled,
  onDrop,
  onMarkFinished,
  onDragStateChange,
  onLayout,
}: DraggableCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const completed = task.column === 'done' || Boolean(task.completedAt);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          if (disabled) {
            return false;
          }

          return Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 6;
        },
        onPanResponderGrant: () => {
          onDragStateChange(task.id);
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_evt, gestureState) => {
          void onDrop(task, gestureState.moveX, gestureState.moveY).catch(() => {});
          onDragStateChange(null);

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            bounciness: 8,
          }).start();
        },
        onPanResponderTerminate: () => {
          onDragStateChange(null);
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            bounciness: 8,
          }).start();
        },
      }),
    [disabled, onDragStateChange, onDrop, pan, task],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout(task.id, task.column, event.nativeEvent.layout);
  };

  return (
    <Animated.View
      style={[
        styles.subtaskCard,
        completed && styles.subtaskCardDone,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          zIndex: 20,
        },
      ]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={styles.cardTitleRow}>
        <Text
          style={[styles.subtaskTitle, completed && styles.subtaskTitleDone]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {completed ? <CheckCheck size={16} color="#18805D" /> : null}
      </View>

      {task.notes ? (
        <Text style={[styles.subtaskNotes, completed && styles.subtaskNotesDone]}>
          {task.notes}
        </Text>
      ) : null}

      {task.dependencies.length > 0 ? (
        <Text style={styles.dependenciesText}>
          Depends on {task.dependencies.length} task
          {task.dependencies.length > 1 ? 's' : ''}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.finishButton,
          completed && styles.finishButtonDone,
          disabled && styles.finishButtonDisabled,
        ]}
        onPress={() => {
          void onMarkFinished(task).catch(() => {});
        }}
        disabled={disabled}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.finishButtonText,
            completed && styles.finishButtonTextDone,
          ]}
        >
          {completed ? 'Finished' : 'Mark as Finished'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function BriefKanbanBoard({
  plan,
  saving,
  onPlanChange,
}: {
  plan: KanbanPlan;
  saving: boolean;
  onPlanChange: (nextPlan: KanbanPlan) => Promise<void>;
}) {
  const [subtasks, setSubtasks] = useState<KanbanSubtask[]>(
    normalizeSubtasksOrder(plan.subtasks),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [boardLayout, setBoardLayout] = useState<LayoutRectangle | null>(null);
  const [columnLayouts, setColumnLayouts] = useState<
    Partial<Record<KanbanColumnId, LayoutRectangle>>
  >({});
  const [cardLayouts, setCardLayouts] = useState<Record<string, CardLayout>>({});
  const columnRefs = useRef<Record<KanbanColumnId, View | null>>({
    todo: null,
    in_progress: null,
    done: null,
  });

  useEffect(() => {
    setSubtasks(normalizeSubtasksOrder(plan.subtasks));
  }, [plan.generatedAt, plan.subtasks]);

  const grouped = useMemo(
    () =>
      COLUMNS.reduce<Record<KanbanColumnId, KanbanSubtask[]>>(
        (acc, column) => {
          acc[column.id] = subtasks
            .filter((task) => task.column === column.id)
            .sort((a, b) => a.order - b.order);
          return acc;
        },
        {
          todo: [],
          in_progress: [],
          done: [],
        },
      ),
    [subtasks],
  );

  const arrows = useMemo(
    () =>
      buildDependencyArrows({
        subtasks,
        cardLayouts,
        columnLayouts,
      }),
    [cardLayouts, columnLayouts, subtasks],
  );

  const handleColumnLayout =
    (columnId: KanbanColumnId) => (event: LayoutChangeEvent) => {
      setColumnLayouts((prev) => ({
        ...prev,
        [columnId]: event.nativeEvent.layout,
      }));
    };

  const handleCardLayout = (
    taskId: string,
    column: KanbanColumnId,
    layout: LayoutRectangle,
  ) => {
    setCardLayouts((prev) => {
      const existing = prev[taskId];

      if (
        existing &&
        existing.column === column &&
        existing.x === layout.x &&
        existing.y === layout.y &&
        existing.width === layout.width &&
        existing.height === layout.height
      ) {
        return prev;
      }

      return {
        ...prev,
        [taskId]: {
          ...layout,
          column,
        },
      };
    });
  };

  const applyAndPersistPlan = async (nextSubtasks: KanbanSubtask[]) => {
    const previous = subtasks;
    const normalized = normalizeSubtasksOrder(nextSubtasks);
    setSubtasks(normalized);

    try {
      await onPlanChange({
        ...plan,
        subtasks: normalized,
      });
    } catch (error) {
      setSubtasks(previous);
      throw error;
    }
  };

  const measureColumn = (columnId: KanbanColumnId) =>
    new Promise<WindowFrame | null>((resolve) => {
      const columnRef = columnRefs.current[columnId];

      if (!columnRef || !columnRef.measureInWindow) {
        resolve(null);
        return;
      }

      columnRef.measureInWindow((x, y, width, height) => {
        resolve({ x, y, width, height });
      });
    });

  const resolveTargetColumn = async (
    moveX: number,
    moveY: number,
    currentColumn: KanbanColumnId,
  ) => {
    const frames = await Promise.all(
      COLUMNS.map(async (column) => ({
        id: column.id,
        frame: await measureColumn(column.id),
      })),
    );

    const directHit = frames.find(({ frame }) => {
      if (!frame) {
        return false;
      }

      return (
        moveX >= frame.x &&
        moveX <= frame.x + frame.width &&
        moveY >= frame.y &&
        moveY <= frame.y + frame.height
      );
    });

    if (directHit?.id) {
      return directHit.id;
    }

    const closest = frames
      .filter((entry): entry is { id: KanbanColumnId; frame: WindowFrame } =>
        Boolean(entry.frame),
      )
      .sort((a, b) => {
        const centerA = a.frame.x + a.frame.width / 2;
        const centerB = b.frame.x + b.frame.width / 2;
        return Math.abs(centerA - moveX) - Math.abs(centerB - moveX);
      })[0];

    return closest?.id ?? currentColumn;
  };

  const handleDrop = async (
    task: KanbanSubtask,
    moveX: number,
    moveY: number,
  ) => {
    if (saving) {
      return;
    }

    const targetColumn = await resolveTargetColumn(moveX, moveY, task.column);

    if (targetColumn === task.column) {
      return;
    }

    const otherTasks = subtasks.filter((item) => item.id !== task.id);
    const nextOrder = otherTasks.filter((item) => item.column === targetColumn).length;

    const movedTask: KanbanSubtask = {
      ...task,
      column: targetColumn,
      order: nextOrder,
      completedAt:
        targetColumn === 'done'
          ? task.completedAt ?? new Date().toISOString()
          : null,
    };

    await applyAndPersistPlan([...otherTasks, movedTask]);
  };

  const handleMarkFinished = async (task: KanbanSubtask) => {
    if (saving || task.column === 'done') {
      return;
    }

    const otherTasks = subtasks.filter((item) => item.id !== task.id);
    const doneOrder = otherTasks.filter((item) => item.column === 'done').length;

    const finishedTask: KanbanSubtask = {
      ...task,
      column: 'done',
      order: doneOrder,
      completedAt: new Date().toISOString(),
    };

    await applyAndPersistPlan([...otherTasks, finishedTask]);
  };

  return (
    <View style={styles.cardShell}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionEyebrow}>KANBAN FLOWCHART</Text>
          <Text style={styles.sectionTitle}>Execution board</Text>
        </View>
        <View style={styles.boardMetaPill}>
          <Text style={styles.boardMetaText}>{subtasks.length} subtasks</Text>
        </View>
      </View>

      <View
        style={styles.columnsRow}
        onLayout={(event) => setBoardLayout(event.nativeEvent.layout)}
      >
        {boardLayout ? (
          <Svg
            width={boardLayout.width}
            height={boardLayout.height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {arrows.map((arrow) => (
              <Path
                key={arrow.key}
                d={arrow.path}
                stroke="#95AAA2"
                strokeWidth={1.6}
                fill="none"
              />
            ))}
            {arrows.map((arrow) => (
              <Path
                key={`${arrow.key}_head`}
                d={arrow.arrowPath}
                stroke="#95AAA2"
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
              />
            ))}
          </Svg>
        ) : null}

        {COLUMNS.map((column) => (
          <View
            key={column.id}
            ref={(node) => {
              columnRefs.current[column.id] = node;
            }}
            style={[
              styles.column,
              {
                backgroundColor: column.surface,
                borderColor: column.border,
              },
            ]}
            onLayout={handleColumnLayout(column.id)}
          >
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{column.label}</Text>
              <View style={styles.columnCountPill}>
                <Text style={styles.columnCountText}>{grouped[column.id].length}</Text>
              </View>
            </View>

            <View style={styles.columnBody}>
              {grouped[column.id].length === 0 ? (
                <View style={styles.columnEmptyState}>
                  <Text style={styles.columnEmptyText}>Drop cards here</Text>
                </View>
              ) : (
                grouped[column.id].map((task) => (
                  <DraggableCard
                    key={task.id}
                    task={task}
                    disabled={saving}
                    onDrop={handleDrop}
                    onMarkFinished={handleMarkFinished}
                    onDragStateChange={setDraggingId}
                    onLayout={handleCardLayout}
                  />
                ))
              )}
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.dragHint}>
        {draggingId
          ? 'Release to move this card into a column.'
          : 'Drag cards between columns to update workflow status.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 29,
    marginTop: 8,
  },
  boardMetaPill: {
    borderRadius: 999,
    backgroundColor: '#E9E1D2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  boardMetaText: {
    color: '#284138',
    fontSize: 12,
    fontWeight: '700',
  },
  columnsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    minHeight: 320,
  },
  column: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    minWidth: 0,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  columnTitle: {
    color: '#102D24',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  columnCountPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 45, 36, 0.1)',
    paddingHorizontal: 6,
  },
  columnCountText: {
    color: '#1D4438',
    fontSize: 11,
    fontWeight: '800',
  },
  columnBody: {
    gap: 8,
  },
  columnEmptyState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9BDAA',
    borderStyle: 'dashed',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnEmptyText: {
    color: '#667970',
    fontSize: 11,
    fontWeight: '700',
  },
  subtaskCard: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FBF8F2',
    borderWidth: 1,
    borderColor: '#D9CFBF',
  },
  subtaskCardDone: {
    borderColor: '#A4CEBF',
    backgroundColor: '#E7F5F0',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  subtaskTitle: {
    flex: 1,
    color: '#143229',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  subtaskTitleDone: {
    color: '#2B6954',
    textDecorationLine: 'line-through',
  },
  subtaskNotes: {
    color: '#4E5F57',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  subtaskNotesDone: {
    color: '#4F8572',
    textDecorationLine: 'line-through',
  },
  dependenciesText: {
    color: '#6A7E76',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  finishButton: {
    marginTop: 10,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: '#103B31',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  finishButtonDone: {
    backgroundColor: '#1D7E5C',
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    color: '#F7F3EA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  finishButtonTextDone: {
    color: '#DCF5EB',
  },
  dragHint: {
    color: '#5F746B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
});
