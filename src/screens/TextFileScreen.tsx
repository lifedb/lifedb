import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  ScrollView,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { GeminiPromptBar } from '../components/GeminiPromptBar';
import { UndoControls } from '../components/UndoControls';
import { readTextFile, writeTextFile } from '../services/fileSystem';
import { getAggregatedContext } from '../services/contextManager';
import { promptWithContext, isGeminiInitialized } from '../services/geminiService';
import {
  recordChange,
  undo,
  redo,
  canUndo as checkCanUndo,
  canRedo as checkCanRedo,
  loadHistory,
  initializeDiffStorage,
} from '../services/diffTracker';
import { addConversation, getChatMessages, ChatMessage } from '../services/chatLog';

type Props = NativeStackScreenProps<RootStackParamList, 'TextFile'>;

// Define markdown styles before component
const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1a1a1a',
  },
  heading1: {
    fontSize: 32,
    fontWeight: '700' as const,
    marginVertical: 12,
    color: '#000',
  },
  heading2: {
    fontSize: 24,
    fontWeight: '600' as const,
    marginVertical: 10,
    color: '#000',
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginVertical: 8,
    color: '#000',
  },
  heading4: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginVertical: 6,
    color: '#000',
  },
  paragraph: {
    marginVertical: 8,
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  list_item: {
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  fence: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    marginVertical: 8,
  },
  blockquote: {
    backgroundColor: '#f8f8f8',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  link: {
    color: '#007AFF',
  },
  strong: {
    fontWeight: '600' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  hr: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
};

export const TextFileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { path, name } = route.params;
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showContext, setShowContext] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [contextPreview, setContextPreview] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContent = useRef('');

  const loadFile = useCallback(async () => {
    setIsLoading(true);
    try {
      await initializeDiffStorage();
      const fileContent = await readTextFile(path);
      setContent(fileContent);
      setOriginalContent(fileContent);
      lastSavedContent.current = fileContent;
      
      // Load context preview
      const context = await getAggregatedContext(path);
      setContextPreview(context.fullContextString || 'No context defined');
      
      // Update undo/redo state
      await updateUndoRedoState();
    } catch (error) {
      console.error('Error loading file:', error);
      Alert.alert('Error', 'Failed to load file');
    } finally {
      setIsLoading(false);
    }
  }, [path]);

  const updateUndoRedoState = async () => {
    const [canUndoVal, canRedoVal, history] = await Promise.all([
      checkCanUndo(path),
      checkCanRedo(path),
      loadHistory(path),
    ]);
    setCanUndoState(canUndoVal);
    setCanRedoState(canRedoVal);
    setHistoryCount(history.entries.length);
    setCurrentIndex(history.currentIndex);
  };

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  useEffect(() => {
    navigation.setOptions({
      title: name,
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => {
              setIsEditing(!isEditing);
              setShowContext(false);
              setShowChat(false);
            }}
            style={styles.headerButton}
          >
            <Ionicons
              name={isEditing ? 'eye-outline' : 'create-outline'}
              size={24}
              color="#007AFF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              if (!showChat) {
                const msgs = await getChatMessages(path);
                setChatMessages(msgs);
              }
              setShowChat(!showChat);
              setShowContext(false);
              setIsEditing(false);
            }}
            style={styles.headerButton}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={24}
              color={showChat ? '#007AFF' : '#8E8E93'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowContext(!showContext);
              setShowChat(false);
              setIsEditing(false);
            }}
            style={styles.headerButton}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={showContext ? '#007AFF' : '#8E8E93'}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, name, showContext, showChat, isEditing, path]);

  // Auto-save with debounce
  const saveContent = useCallback(async (newContent: string) => {
    if (newContent === lastSavedContent.current) return;
    
    try {
      // Record the change for undo
      await recordChange(path, lastSavedContent.current, newContent, 'user');
      await writeTextFile(path, newContent);
      lastSavedContent.current = newContent;
      await updateUndoRedoState();
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }, [path]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    
    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(newContent);
    }, 1000);
  };

  const handleGeminiPrompt = async (prompt: string) => {
    if (!isGeminiInitialized()) {
      Alert.alert(
        'API Key Required',
        'Please set your Gemini API key in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }

    try {
      // Save any pending changes first
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (content !== lastSavedContent.current) {
        await saveContent(content);
      }

      const context = await getAggregatedContext(path);
      const response = await promptWithContext(prompt, content, context);
      
      // Record Gemini change
      await recordChange(path, content, response.newContent, 'gemini', { prompt });
      await writeTextFile(path, response.newContent);
      
      // Save conversation to chat log
      const assistantMessage = response.explanation || 'Applied changes to file.';
      await addConversation(path, prompt, assistantMessage);
      const msgs = await getChatMessages(path);
      setChatMessages(msgs);
      
      setContent(response.newContent);
      lastSavedContent.current = response.newContent;
      await updateUndoRedoState();

      if (response.explanation) {
        Alert.alert('Gemini Response', response.explanation);
      }
    } catch (error) {
      console.error('Gemini error:', error);
      Alert.alert('Error', 'Failed to get response from Gemini');
    }
  };

  const handleUndo = async () => {
    const restoredContent = await undo(path);
    if (restoredContent !== null) {
      await writeTextFile(path, restoredContent);
      setContent(restoredContent);
      lastSavedContent.current = restoredContent;
      await updateUndoRedoState();
    }
  };

  const handleRedo = async () => {
    const restoredContent = await redo(path);
    if (restoredContent !== null) {
      await writeTextFile(path, restoredContent);
      setContent(restoredContent);
      lastSavedContent.current = restoredContent;
      await updateUndoRedoState();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {showChat ? (
          <View style={styles.chatContainer}>
            <Text style={styles.chatLabel}>Chat History</Text>
            {chatMessages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <Ionicons name="chatbubble-outline" size={48} color="#C7C7CC" />
                <Text style={styles.chatEmptyText}>No conversations yet</Text>
                <Text style={styles.chatEmptyHint}>Ask Gemini to edit this file</Text>
              </View>
            ) : (
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[
                    styles.chatMessage,
                    item.role === 'user' ? styles.chatMessageUser : styles.chatMessageAssistant
                  ]}>
                    <Text style={styles.chatMessageRole}>
                      {item.role === 'user' ? 'You' : 'Gemini'}
                    </Text>
                    <Text style={styles.chatMessageContent}>{item.content}</Text>
                    <Text style={styles.chatMessageTime}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                )}
                inverted={false}
                contentContainerStyle={styles.chatList}
              />
            )}
          </View>
        ) : showContext ? (
          <ScrollView style={styles.contextContainer}>
            <Text style={styles.contextLabel}>Aggregated Context</Text>
            <Text style={styles.contextText}>{contextPreview}</Text>
            <TouchableOpacity
              style={styles.editContextButton}
              onPress={() =>
                navigation.navigate('EditContext', { path, isDirectory: false })
              }
            >
              <Text style={styles.editContextButtonText}>
                Edit File Context
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : isEditing ? (
          <TextInput
            style={styles.editor}
            value={content}
            onChangeText={handleContentChange}
            multiline={true}
            textAlignVertical="top"
            placeholder="Start typing markdown..."
            placeholderTextColor="#999"
            editable={!isLoading}
            autoFocus={true}
          />
        ) : (
          <TouchableOpacity 
            style={styles.markdownContainer}
            onPress={() => setIsEditing(true)}
            activeOpacity={1}
          >
            <ScrollView style={styles.markdownScroll}>
              {content ? (
                <Markdown style={markdownStyles}>
                  {content}
                </Markdown>
              ) : (
                <Text style={styles.placeholder}>Tap to start writing...</Text>
              )}
            </ScrollView>
          </TouchableOpacity>
        )}

        <UndoControls
          canUndo={canUndoState}
          canRedo={canRedoState}
          onUndo={handleUndo}
          onRedo={handleRedo}
          historyCount={historyCount}
          currentIndex={currentIndex}
        />

        <GeminiPromptBar
          onSubmit={handleGeminiPrompt}
          disabled={isLoading}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  editor: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    color: '#1a1a1a',
  },
  headerButton: {
    marginRight: 8,
  },
  headerButtonText: {
    fontSize: 22,
  },
  contextContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  contextLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  contextText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1a1a1a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  editContextButton: {
    marginTop: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  editContextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  chatLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    padding: 16,
    textTransform: 'uppercase',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  chatList: {
    padding: 16,
  },
  chatEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  chatEmptyText: {
    fontSize: 18,
    color: '#8E8E93',
    marginTop: 16,
  },
  chatEmptyHint: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
  },
  chatMessage: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    maxWidth: '85%',
  },
  chatMessageUser: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  chatMessageAssistant: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chatMessageRole: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 4,
    color: '#8E8E93',
  },
  chatMessageContent: {
    fontSize: 15,
    lineHeight: 20,
    color: '#000',
  },
  chatMessageTime: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 6,
  },
  markdownContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  markdownScroll: {
    flex: 1,
    padding: 16,
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
});
