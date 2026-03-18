import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Task } from '@/types/database';
import { SquareCheck as CheckSquare, Square, Trash2 } from 'lucide-react-native';

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true });

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !currentStatus })
      .eq('id', taskId);

    if (!error) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, completed: !currentStatus } : task
        )
      );
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (!error) {
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  const renderTask = ({ item }: { item: Task }) => (
    <View style={styles.taskCard}>
      <TouchableOpacity
        style={styles.taskContent}
        onPress={() => toggleTask(item.id, item.completed)}
      >
        <View style={styles.checkboxContainer}>
          {item.completed ? (
            <CheckSquare size={24} color="#34C759" strokeWidth={2} />
          ) : (
            <Square size={24} color="#8E8E93" />
          )}
        </View>
        <Text
          style={[styles.taskTitle, item.completed && styles.taskCompleted]}
        >
          {item.title}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteTask(item.id)}
      >
        <Trash2 size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
        {totalCount > 0 && (
          <Text style={styles.headerSubtitle}>
            {completedCount} of {totalCount} completed
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading tasks...</Text>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tasks yet</Text>
          <Text style={styles.emptySubtext}>
            Chat with the AI assistant to generate step-by-step tasks
          </Text>
        </View>
      ) : (
        <>
          {totalCount > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(completedCount / totalCount) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={renderTask}
            contentContainerStyle={styles.tasksList}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  tasksList: {
    padding: 16,
    gap: 12,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  taskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
  },
  taskTitle: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  deleteButton: {
    padding: 8,
  },
});
