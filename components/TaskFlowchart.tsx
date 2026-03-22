import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CheckCheck, Circle, Pencil, Trash2 } from 'lucide-react-native';
import { KanbanPlan, KanbanSubtask } from '@/lib/briefs';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

// ─── Topological sort ────────────────────────────────────────────────────────

function topoSort(subtasks: KanbanSubtask[]): KanbanSubtask[] {
  const idToTask = new Map(subtasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: KanbanSubtask[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const task = idToTask.get(id);
    if (!task) return;
    for (const dep of task.dependencies) {
      visit(dep);
    }
    result.push(task);
  }

  for (const task of subtasks) {
    visit(task.id);
  }

  return result;
}

// ─── Node layout types ───────────────────────────────────────────────────────

type NodeMeasure = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// ─── Individual flowchart node ────────────────────────────────────────────────

type FlowNodeProps = {
  task: KanbanSubtask;
  index: number;
  saving: boolean;
  onToggle: (task: KanbanSubtask) => void;
  onLayout: (id: string, x: number, y: number, w: number, h: number) => void;
};

const FlowNode = memo(function FlowNode({
  task,
  index,
  saving,
  onToggle,
  onLayout,
}: FlowNodeProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const isDone = task.column === 'done' || Boolean(task.completedAt);
  const isActive = task.column === 'in_progress' && !isDone;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      delay: index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  const nodeColor = isDone
    ? '#D9F0E8'
    : isActive
      ? '#E1ECE7'
      : '#FBF8F2';

  const borderColor = isDone
    ? '#8ECDB8'
    : isActive
      ? '#A3C9BC'
      : '#DDD5C5';

  const labelColor = isDone ? '#1B6A53' : '#102D24';

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
        alignItems: 'center',
        alignSelf: 'stretch',
      }}
      onLayout={(e) => {
        const { x, y, width, height } = e.nativeEvent.layout;
        onLayout(task.id, x, y, width, height);
      }}
    >
      <TouchableOpacity
        activeOpacity={saving ? 1 : 0.82}
        disabled={saving || isDone}
        onPress={() => onToggle(task)}
        style={[
          styles.node,
          { backgroundColor: nodeColor, borderColor },
        ]}
      >
        <View style={styles.nodeInner}>
          <View style={styles.nodeIconWrap}>
            {isDone ? (
              <CheckCheck size={16} color="#1B6A53" />
            ) : (
              <Circle
                size={16}
                color={isActive ? '#0F6B52' : '#8FA39B'}
                strokeWidth={2}
              />
            )}
          </View>
          <View style={styles.nodeTextWrap}>
            <Text
              style={[
                styles.nodeTitle,
                { color: labelColor },
                isDone && styles.nodeTitleDone,
              ]}
            >
              {task.title}
            </Text>
            {task.notes ? (
              <Text
                style={[styles.nodeNotes, isDone && styles.nodeNotesDone]}
                numberOfLines={2}
              >
                {task.notes}
              </Text>
            ) : null}
          </View>
        </View>

        {!isDone && !saving ? (
          <View
            style={[
              styles.tapHint,
              isActive && styles.tapHintActive,
            ]}
          >
            <Text
              style={[
                styles.tapHintText,
                isActive && styles.tapHintTextActive,
              ]}
            >
              {isActive ? 'In progress · tap to finish' : 'Tap to complete'}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Root node ────────────────────────────────────────────────────────────────

function RootNode({
  title,
  onLayout,
}: {
  title: string;
  onLayout: (x: number, y: number, w: number, h: number) => void;
}) {
  return (
    <View
      style={styles.rootNode}
      onLayout={(e) => {
        const { x, y, width, height } = e.nativeEvent.layout;
        onLayout(x, y, width, height);
      }}
    >
      <Text style={styles.rootEyebrow}>MAIN TASK</Text>
      <Text style={styles.rootTitle} numberOfLines={3}>
        {title}
      </Text>
    </View>
  );
}

// ─── Connector SVG overlay ─────────────────────────────────────────────────────

function ConnectorLayer({
  width,
  height,
  nodeMap,
  sortedTasks,
  rootMeasure,
}: {
  width: number;
  height: number;
  nodeMap: Map<string, NodeMeasure>;
  sortedTasks: KanbanSubtask[];
  rootMeasure: NodeMeasure | null;
}) {
  const paths: { key: string; d: string }[] = [];

  const centerX = width / 2;

  // Root → first task(s) (tasks with no dependencies)
  const entranceTasks = sortedTasks.filter((t) => t.dependencies.length === 0);

  if (rootMeasure) {
    const rootBottom = rootMeasure.y + rootMeasure.height;
    for (const task of entranceTasks) {
      const target = nodeMap.get(task.id);
      if (!target) continue;
      const tx = target.x + target.width / 2;
      const ty = target.y;
      const curve = Math.abs(ty - rootBottom) * 0.4;
      paths.push({
        key: `root_${task.id}`,
        d: `M ${centerX} ${rootBottom} C ${centerX} ${rootBottom + curve}, ${tx} ${ty - curve}, ${tx} ${ty}`,
      });
    }
  }

  // Between dependent tasks
  for (const task of sortedTasks) {
    const target = nodeMap.get(task.id);
    if (!target) continue;
    const tx = target.x + target.width / 2;
    const ty = target.y;

    for (const depId of task.dependencies) {
      const source = nodeMap.get(depId);
      if (!source) continue;
      const sx = source.x + source.width / 2;
      const sy = source.y + source.height;
      const curve = Math.max(20, Math.abs(ty - sy) * 0.35);

      paths.push({
        key: `${depId}_${task.id}`,
        d: `M ${sx} ${sy} C ${sx} ${sy + curve}, ${tx} ${ty - curve}, ${tx} ${ty}`,
      });
    }
  }

  if (paths.length === 0) return null;

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {paths.map((p) => (
        <Path
          key={p.key}
          d={p.d}
          stroke="#A3B8B0"
          strokeWidth={2}
          fill="none"
          strokeDasharray="5,4"
        />
      ))}
    </Svg>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TaskFlowchart({
  plan,
  saving,
  onPlanChange,
  title,
  onDelete,
  onComplete,
  onEdit,
}: {
  plan: KanbanPlan;
  saving: boolean;
  onPlanChange: (nextPlan: KanbanPlan) => Promise<void>;
  title?: string;
  onDelete?: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
}) {
  const sortedTasks = topoSort(plan.subtasks);

  const [rootMeasure, setRootMeasure] = useState<NodeMeasure | null>(null);
  const [nodeMap, setNodeMap] = useState<Map<string, NodeMeasure>>(new Map());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleRootLayout = useCallback(
    (x: number, y: number, width: number, height: number) => {
      setRootMeasure({ id: '__root__', x, y, width, height });
    },
    [],
  );

  const handleNodeLayout = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      setNodeMap((prev) => {
        const existing = prev.get(id);
        if (
          existing &&
          existing.x === x &&
          existing.y === y &&
          existing.width === width &&
          existing.height === height
        ) {
          return prev;
        }
        const next = new Map(prev);
        next.set(id, { id, x, y, width, height });
        return next;
      });
    },
    [],
  );

  const handleToggle = async (task: KanbanSubtask) => {
    if (saving || task.column === 'done') return;

    const otherTasks = plan.subtasks.filter((t) => t.id !== task.id);
    const doneOrder = otherTasks.filter((t) => t.column === 'done').length;

    const updated: KanbanSubtask = {
      ...task,
      column: 'done',
      order: doneOrder,
      completedAt: new Date().toISOString(),
    };

    await onPlanChange({ ...plan, subtasks: [...otherTasks, updated] });
  };

  const completedCount = plan.subtasks.filter(
    (t) => t.column === 'done' || t.completedAt,
  ).length;
  const total = plan.subtasks.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>TASK FLOWCHART</Text>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {title || 'Step-by-step plan'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>
              {completedCount}/{total} done
            </Text>
          </View>
          {onDelete && (
            <TouchableOpacity
              style={styles.trashCircle}
              onPress={onDelete}
              activeOpacity={0.7}
            >
              <Trash2 size={18} color="#8F3A2F" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* Flowchart canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.canvasScroll}
        scrollEnabled={false}
      >
        <View
          style={styles.canvas}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerSize({ width, height });
          }}
        >
          {/* SVG connectors sit behind everything */}
          <ConnectorLayer
            width={containerSize.width}
            height={containerSize.height}
            nodeMap={nodeMap}
            sortedTasks={sortedTasks}
            rootMeasure={rootMeasure}
          />

          {/* Root node */}
          <RootNode title={plan.sourceTask} onLayout={handleRootLayout} />

          {/* Subtask nodes */}
          {sortedTasks.map((task, index) => (
            <FlowNode
              key={task.id}
              task={task}
              index={index}
              saving={saving}
              onToggle={handleToggle}
              onLayout={handleNodeLayout}
            />
          ))}
        </View>
      </ScrollView>

      <Text style={styles.hint}>
        {saving
          ? 'Saving…'
          : completedCount === total && total > 0
            ? '🎉 All steps complete!'
            : 'Tap a step to mark it complete.'}
      </Text>

      {/* Footer Actions */}
      <View style={styles.footer}>
        {onEdit && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={onEdit}
            activeOpacity={0.8}
          >
            <Pencil size={16} color="#4A6A5E" />
            <Text style={styles.editButtonText}>Edit the chart</Text>
          </TouchableOpacity>
        )}
        {onComplete && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={onComplete}
            activeOpacity={0.8}
          >
            <CheckCheck size={18} color="#F7F3EA" />
            <Text style={styles.completeButtonText}>Mark Finished</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trashCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5DDD7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#1B5A49',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    marginTop: 2,
    lineHeight: 26,
  },
  progressPill: {
    backgroundColor: '#DDEFEA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 4,
  },
  progressPillText: {
    color: '#0F4737',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E6DDD0',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1D6D58',
    borderRadius: 999,
  },
  canvasScroll: {
    flexGrow: 1,
  },
  canvas: {
    alignSelf: 'stretch',
    gap: 14,
    alignItems: 'center',
  },
  // Root node
  rootNode: {
    width: '88%',
    backgroundColor: '#102D24',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  rootEyebrow: {
    color: '#F6D8AB',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  rootTitle: {
    color: '#F7F3EA',
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Subtask nodes
  node: {
    width: '88%',
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  nodeInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  nodeIconWrap: {
    marginTop: 2,
  },
  nodeTextWrap: {
    flex: 1,
  },
  nodeTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  nodeTitleDone: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  nodeNotes: {
    color: '#5A6A63',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  nodeNotesDone: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  tapHint: {
    marginTop: 10,
    backgroundColor: 'rgba(16, 45, 36, 0.07)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  tapHintActive: {
    backgroundColor: 'rgba(15, 71, 55, 0.13)',
  },
  tapHintText: {
    color: '#4A6A5E',
    fontSize: 11,
    fontWeight: '700',
  },
  tapHintTextActive: {
    color: '#0F4737',
  },
  hint: {
    color: '#7A8E87',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  editButton: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#E8EFEA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    color: '#4A6A5E',
    fontSize: 14,
    fontWeight: '700',
  },
  completeButton: {
    flex: 1.4,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#102D24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonText: {
    color: '#F7F3EA',
    fontSize: 14,
    fontWeight: '700',
  },
});
