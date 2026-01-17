import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  getFileContext,
  setFileContext,
  getDirectoryContext,
  setDirectoryContext,
} from '../services/fileSystem';

type Props = NativeStackScreenProps<RootStackParamList, 'EditContext'>;

export const EditContextScreen: React.FC<Props> = ({ navigation, route }) => {
  const { path, isDirectory } = route.params;
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    try {
      const context = isDirectory
        ? await getDirectoryContext(path)
        : await getFileContext(path);
      setContent(context);
      setOriginalContent(context);
    } catch (error) {
      console.error('Error loading context:', error);
      Alert.alert('Error', 'Failed to load context');
    } finally {
      setIsLoading(false);
    }
  }, [path, isDirectory]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  const handleSave = async () => {
    try {
      if (isDirectory) {
        await setDirectoryContext(path, content);
      } else {
        await setFileContext(path, content);
      }
      setOriginalContent(content);
      setHasChanges(false);
      Alert.alert('Saved', 'Context saved successfully');
    } catch (error) {
      console.error('Error saving context:', error);
      Alert.alert('Error', 'Failed to save context');
    }
  };

  useEffect(() => {
    const itemName = path === '/' ? 'Root' : path.split('/').pop() || 'Item';
    navigation.setOptions({
      title: `${isDirectory ? '📁' : '📄'} Context`,
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} disabled={!hasChanges}>
          <Text
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          >
            Save
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, path, isDirectory, hasChanges]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pathLabel}>
          {isDirectory ? 'Directory' : 'File'}: {path}
        </Text>
        <Text style={styles.hint}>
          This context will be included when prompting Gemini for{' '}
          {isDirectory ? 'files in this directory' : 'this file'}.
        </Text>
      </View>
      <TextInput
        style={styles.editor}
        value={content}
        onChangeText={setContent}
        multiline={true}
        textAlignVertical="top"
        placeholder="Add context information here...

Examples:
- Project description
- Coding conventions
- File purpose
- Relevant background information"
        placeholderTextColor="#999"
        editable={!isLoading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  pathLabel: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
  editor: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    color: '#1a1a1a',
  },
  saveButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  saveButtonDisabled: {
    color: '#ccc',
  },
});
