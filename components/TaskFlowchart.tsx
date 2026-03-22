import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Marker, Defs, Polygon, Rect } from 'react-native-svg';
import {
  CheckCircle2,
  Circle,
  MessageCircle,
  Pencil,
  Trash2,
  X,
  Send,
} from 'lucide-react-native';
import { KanbanPlan, KanbanSubtask, FlowchartEdge } from '@/lib/briefs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

// ─── Simple Layout Algorithm ──────────────────────────────────────────────────

type LayoutNode = KanbanSubtask & {
  x: number;
  y: number;
  level: number;
  width: number;
  height: number;
};

function calculateLayout(
  nodes: KanbanSubtask[],
  edges: FlowchartEdge[],
): Map<string, LayoutNode> {
  const nodeMap = new Map<string, LayoutNode>();
  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((n) => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  edges.forEach((e) => {
    adj.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });

  // Calculate levels (BFS)
  const queue: { id: string; level: number }[] = [];
  nodes.forEach((n) => {
    if ((inDegree.get(n.id) || 0) === 0) {
      queue.push({ id: n.id, level: 0 });
    }
  });

  const levels: Map<string, number> = new Map();
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    levels.set(id, Math.max(levels.get(id) || 0, level));

    adj.get(id)?.forEach((next) => {
      queue.push({ id: next, level: level + 1 });
    });
  }

  // Group by levels
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, id) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(id);
  });

  const nodeWidth = 160;
  const nodeHeight = 100;
  const horizontalGap = 40;
  const verticalGap = 80;

  levelGroups.forEach((ids, level) => {
    const totalLevelWidth = ids.length * nodeWidth + (ids.length - 1) * horizontalGap;
    const startX = (SCREEN_WIDTH - totalLevelWidth) / 2;

    ids.forEach((id, index) => {
      const node = idToNode.get(id);
      if (node) {
        nodeMap.set(id, {
          ...node,
          x: startX + index * (nodeWidth + horizontalGap),
          y: 20 + level * (nodeHeight + verticalGap),
          level,
          width: nodeWidth,
          height: nodeHeight,
        });
      }
    });
  });

  return nodeMap;
}

// ─── Individual Flowchart Node (Shape-Aware) ───────────────────────────────────

const NodeShape = ({
  type,
  isDone,
  isActive,
  children,
  onPress,
}: {
  type: 'step' | 'decision';
  isDone: boolean;
  isActive: boolean;
  children: React.ReactNode;
  onPress: () => void;
}) => {
  const nodeColor = isDone ? '#D9F0E8' : isActive ? '#E1ECE7' : '#FFFFFF';
  const borderColor = isDone ? '#4CAF50' : isActive ? '#0F4737' : '#CBBEAA';

  if (type === 'decision') {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={styles.diamondWrapper}
      >
        <View style={[styles.diamond, { backgroundColor: nodeColor, borderColor }]}>
          <View style={styles.diamondContent}>{children}</View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.rectNode, { backgroundColor: nodeColor, borderColor }]}
    >
      {children}
    </TouchableOpacity>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const nodes = plan.nodes || plan.subtasks;
  const edges = plan.edges || [];

  const layoutMap = useMemo(() => calculateLayout(nodes, edges), [nodes, edges]);
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<
    { id: string; text: string; role: 'user' | 'assistant' }[]
  >([]);

  const handleNodePress = (node: LayoutNode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedNode(node);
    // Initialize dummy chat
    setMessages([
      {
        id: '1',
        text: `How can I help you with "${node.title}"?`,
        role: 'assistant',
      },
    ]);
  };

  const closeBottomSheet = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedNode(null);
  };

  const handleToggleDone = async (nodeId: string) => {
    if (saving) return;

    const nextNodes = nodes.map((n) => {
      if (n.id === nodeId) {
        const isNowDone = n.column !== 'done';
        return {
          ...n,
          column: (isNowDone ? 'done' : 'todo') as any,
          completedAt: isNowDone ? new Date().toISOString() : null,
        };
      }
      return n;
    });

    await onPlanChange({ ...plan, nodes: nextNodes, subtasks: nextNodes });
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => (prev ? { ...prev, column: 'done' as any } : null));
    }
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      text: chatMessage,
      role: 'user' as const,
    };
    setMessages((prev) => [...prev, newMessage]);
    setChatMessage('');
    // Simulate bot response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "I'm analyzing the subtask details to give you the best advice...",
          role: 'assistant',
        },
      ]);
    }, 1000);
  };

  const canvasHeight = useMemo(() => {
    let maxY = 0;
    layoutMap.forEach((n) => {
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });
    return maxY + 150;
  }, [layoutMap]);

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>WORKFLOW FLOWCHART</Text>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {title || 'Execution Plan'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color="#8D2D20" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onEdit}
            activeOpacity={0.7}
          >
            <Pencil size={18} color="#0F4737" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Flowchart Area */}
      <View style={styles.container}>
        <ScrollView
          style={styles.graphScroll}
          contentContainerStyle={{ height: canvasHeight, width: SCREEN_WIDTH }}
          showsVerticalScrollIndicator={false}
          maximumZoomScale={2}
          minimumZoomScale={0.5}
        >
          <Svg
            width={SCREEN_WIDTH}
            height={canvasHeight}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <Marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <Path d="M 0 0 L 10 5 L 0 10 z" fill="#A3B8B0" />
              </Marker>
            </Defs>

            {edges.map((edge, i) => {
              const start = layoutMap.get(edge.from);
              const end = layoutMap.get(edge.to);
              if (!start || !end) return null;

              const sy = start.y + start.height;
              const sx = start.x + start.width / 2;
              const ty = end.y;
              const tx = end.x + end.width / 2;

              return (
                <Path
                  key={`edge-${i}`}
                  d={`M ${sx} ${sy} C ${sx} ${(sy + ty) / 2}, ${tx} ${(sy + ty) / 2}, ${tx} ${ty}`}
                  stroke="#A3B8B0"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              );
            })}
          </Svg>

          {Array.from(layoutMap.values()).map((node) => {
            const isDone = node.column === 'done';
            return (
              <View
                key={node.id}
                style={[
                  styles.nodeContainer,
                  { left: node.x, top: node.y, width: node.width },
                ]}
              >
                <NodeShape
                  type={node.type || 'step'}
                  isDone={isDone}
                  isActive={node.column === 'in_progress'}
                  onPress={() => handleNodePress(node)}
                >
                  <Text
                    style={[
                      styles.nodeLabel,
                      { color: isDone ? '#1B6A53' : '#102D24' },
                    ]}
                    numberOfLines={3}
                  >
                    {node.title}
                  </Text>
                  {isDone && (
                    <CheckCircle2
                      size={14}
                      color="#4CAF50"
                      style={styles.doneIcon}
                    />
                  )}
                </NodeShape>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={styles.finishButton}
        onPress={onComplete}
        activeOpacity={0.8}
      >
        <Text style={styles.finishButtonText}>Complete Workflow</Text>
      </TouchableOpacity>

      {/* Node Detail Bottom Sheet */}
      {selectedNode && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={closeBottomSheet}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <View
                style={[
                  styles.sheetIcon,
                  {
                    backgroundColor:
                      selectedNode.type === 'decision' ? '#FFF3E0' : '#E8F5E9',
                  },
                ]}
              >
                {selectedNode.type === 'decision' ? (
                  <Circle size={18} color="#F57C00" />
                ) : (
                  <CheckCircle2 size={18} color="#2E7D32" />
                )}
              </View>
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetTitle}>{selectedNode.title}</Text>
                <Text style={styles.sheetSubtitle}>
                  {selectedNode.type === 'decision' ? 'Decision point' : 'Action step'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeBottomSheet} style={styles.closeBtn}>
                <X size={20} color="#5A6A63" />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>
                {selectedNode.notes || 'No specific notes for this step yet.'}
              </Text>

              <View style={styles.chatSection}>
                <View style={styles.chatHeader}>
                  <MessageCircle size={16} color="#0F4737" />
                  <Text style={styles.chatHeaderTitle}>Subtask Chatbot</Text>
                </View>

                <ScrollView
                  style={styles.chatList}
                  contentContainerStyle={styles.chatContent}
                >
                  {messages.map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.msgBubble,
                        m.role === 'user' ? styles.userMsg : styles.botMsg,
                      ]}
                    >
                      <Text
                        style={[
                          styles.msgText,
                          m.role === 'user' ? styles.userMsgText : styles.botMsgText,
                        ]}
                      >
                        {m.text}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.chatInputRow}>
                  <View style={styles.inputWrap}>
                    <Pencil size={14} color="#5A6A63" style={styles.inputIcon} />
                    <Animated.View style={{ flex: 1 }}>
                      <Text style={styles.placeholder}>Ask Clarix about this step...</Text>
                    </Animated.View>
                  </View>
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={sendMessage}
                    disabled={!chatMessage.trim()}
                  >
                    <Send size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.doneButton,
                selectedNode.column === 'done' && styles.doneButtonActive,
              ]}
              onPress={() => handleToggleDone(selectedNode.id)}
            >
              <CheckCircle2
                size={20}
                color={selectedNode.column === 'done' ? '#F7F3EA' : '#0F4737'}
              />
              <Text
                style={[
                  styles.doneButtonText,
                  selectedNode.column === 'done' && styles.doneButtonTextActive,
                ]}
              >
                {selectedNode.column === 'done' ? 'Completed' : 'Mark as Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#FBF8F2',
    borderRadius: 32,
    padding: 20,
    minHeight: 500,
    shadowColor: '#102D24',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F4737',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: DISPLAY_FONT,
    color: '#102D24',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E0D2',
  },
  container: {
    height: 400,
    backgroundColor: '#F7F3EA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    overflow: 'hidden',
  },
  graphScroll: {
    flex: 1,
  },
  nodeContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rectNode: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    width: 150,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  diamondWrapper: {
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamond: {
    width: 90,
    height: 90,
    borderWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondContent: {
    transform: [{ rotate: '-45deg' }],
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  doneIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
  },
  finishButton: {
    height: 56,
    backgroundColor: '#102D24',
    borderRadius: 18,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    color: '#F7F3EA',
    fontSize: 16,
    fontWeight: '800',
  },
  // Bottom Sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 45, 36, 0.4)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    right: -20,
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitleWrap: {
    flex: 1,
    marginLeft: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: DISPLAY_FONT,
    color: '#102D24',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#5A6A63',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  sheetBody: {
    flex: 1,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F4737',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#3B4F48',
    lineHeight: 22,
    marginBottom: 24,
  },
  chatSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    marginBottom: 24,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  chatHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#102D24',
  },
  chatList: {
    maxHeight: 150,
  },
  chatContent: {
    gap: 8,
  },
  msgBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '85%',
  },
  botMsg: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F3',
  },
  userMsg: {
    alignSelf: 'flex-end',
    backgroundColor: '#102D24',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  botMsgText: {
    color: '#29433A',
  },
  userMsgText: {
    color: '#F7F3EA',
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
    height: 44,
    backgroundColor: '#FBF8F2',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E8E0D2',
  },
  inputIcon: {
    marginRight: 8,
  },
  placeholder: {
    fontSize: 13,
    color: '#7A8E87',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#102D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#102D24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  doneButtonActive: {
    backgroundColor: '#102D24',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#102D24',
  },
  doneButtonTextActive: {
    color: '#F7F3EA',
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
