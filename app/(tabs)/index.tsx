import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendToGemini, extractTasksFromResponse } from '@/lib/gemini';
import { Chat } from '@/types/database';
import { Send, Paperclip } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function ChatScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setChats(data);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setSelectedFile({
          name: file.name,
          base64,
          mimeType: file.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      console.error('Error picking file:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() && !selectedFile) return;
    if (!user) return;

    setLoading(true);

    try {
      const userMessage = {
        user_id: user.id,
        message: message.trim() || 'Attached file',
        role: 'user' as const,
        file_urls: selectedFile ? [selectedFile.name] : [],
      };

      const { data: userChatData, error: userChatError } = await supabase
        .from('chats')
        .insert(userMessage)
        .select()
        .single();

      if (userChatError) throw userChatError;

      setChats((prev) => [...prev, userChatData]);
      setMessage('');

      const aiResponse = await sendToGemini(
        message.trim() || 'Please analyze this file',
        selectedFile?.base64,
        selectedFile?.mimeType
      );

      setSelectedFile(null);

      const assistantMessage = {
        user_id: user.id,
        message: aiResponse,
        role: 'assistant' as const,
      };

      const { data: assistantChatData, error: assistantChatError } =
        await supabase
          .from('chats')
          .insert(assistantMessage)
          .select()
          .single();

      if (assistantChatError) throw assistantChatError;

      setChats((prev) => [...prev, assistantChatData]);

      const tasks = extractTasksFromResponse(aiResponse);

      if (tasks.length > 0) {
        const taskInserts = tasks.map((task, index) => ({
          user_id: user.id,
          chat_id: assistantChatData.id,
          title: task,
          order_index: index,
          completed: false,
        }));

        await supabase.from('tasks').insert(taskInserts);
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Chat }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.role === 'user' && styles.userMessageText,
        ]}
      >
        {item.message}
      </Text>
      {item.file_urls && item.file_urls.length > 0 && (
        <Text style={styles.fileIndicator}>📎 {item.file_urls[0]}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Assistant</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={90}
      >
        {chats.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Start a conversation with your AI assistant
            </Text>
            <Text style={styles.emptySubtext}>
              Ask questions, upload files, and get step-by-step guidance
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chats}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        <View style={styles.inputContainer}>
          {selectedFile && (
            <View style={styles.filePreview}>
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <Text style={styles.removeFile}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={pickFile}
              disabled={loading}
            >
              <Paperclip size={24} color="#007AFF" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              multiline
              maxLength={500}
              editable={!loading}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!message.trim() && !selectedFile) || loading
                  ? styles.sendButtonDisabled
                  : null,
              ]}
              onPress={sendMessage}
              disabled={(!message.trim() && !selectedFile) || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  chatContainer: {
    flex: 1,
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
  messagesList: {
    padding: 16,
    gap: 12,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  userMessageText: {
    color: '#fff',
  },
  fileIndicator: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    padding: 8,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F0F0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#000',
  },
  removeFile: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
});
